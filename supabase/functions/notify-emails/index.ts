// notify-emails: rozesle frontu notification_email_queue e-mailem.
//
// Kazdych 5 minut (pg_cron, x-cron-secret == env CRON_SECRET) vezme
// neodeslane radky, seskupi je po uzivatelich (max 1 e-mail na
// uzivatele a beh - souhrn) a odesle pres SMTP ucet organizace
// (vychozi ucet orgu, jinak platformni). Uspech = sent_at, neuspech =
// attempts+1 + error; po 3 pokusech se radek preskakuje.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.8";

const MAX_ROWS_PER_RUN = 50;
const MAX_ATTEMPTS = 3;

interface QueueRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  event_key: string;
  title: string;
  message: string;
  link: string | null;
  attempts: number;
}

interface SmtpAccount {
  id: string;
  organization_id: string | null;
  host: string;
  port: number;
  username: string;
  password_encrypted: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  is_default: boolean;
  is_platform_default: boolean;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildEmail(rows: QueueRow[], appUrl: string): { subject: string; html: string; text: string } {
  const subject = rows.length === 1
    ? `${rows[0].title} — HouseSmart`
    : `${rows.length} nových upozornění — HouseSmart`;

  const items = rows.map((r) => {
    const link = r.link ? `${appUrl}${r.link}` : appUrl;
    return `
      <div style="padding:14px 16px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:10px">
        <div style="font-weight:700;color:#0f172a;font-size:15px">${esc(r.title)}</div>
        <div style="color:#475569;font-size:13px;margin-top:4px">${esc(r.message)}</div>
        <a href="${link}" style="display:inline-block;margin-top:10px;padding:8px 14px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600">Otevřít v systému</a>
      </div>`;
  }).join("");

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9">
    <div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:'Segoe UI',Arial,sans-serif">
      <div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:14px">Upozornění ze systému</div>
      ${items}
      <div style="color:#94a3b8;font-size:11px;margin-top:18px">
        Tento e-mail chodí podle vašeho nastavení notifikací.
        Změnit je můžete v systému přes ozubené kolo u zvonečku.
      </div>
    </div>
  </body></html>`;

  const text = rows.map((r) => `${r.title}\n${r.message}\n${r.link ? appUrl + r.link : appUrl}`).join("\n\n");
  return { subject, html, text };
}

Deno.serve(async (req: Request) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  try {
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    if (cronSecret === "" || req.headers.get("x-cron-secret") !== cronSecret) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const appUrl = Deno.env.get("APP_URL") ?? "https://dev.housesmart.cz";

    const { data: pending, error: qErr } = await supabase
      .from("notification_email_queue")
      .select("id, user_id, organization_id, event_key, title, message, link, attempts")
      .is("sent_at", null)
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at")
      .limit(MAX_ROWS_PER_RUN);
    if (qErr) return json({ error: qErr.message }, 500);
    if (!pending || pending.length === 0) return json({ ok: true, sent: 0 });

    // prijemci
    const userIds = [...new Set(pending.map((r) => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .in("id", userIds);
    const emailByUser = new Map<string, string>();
    for (const p of profiles ?? []) {
      if (p.email) emailByUser.set(p.id, p.email);
    }

    // SMTP ucty: vychozi ucet organizace -> jiny ucet organizace -> platformni
    const { data: accounts } = await supabase
      .from("smtp_accounts")
      .select("id, organization_id, host, port, username, password_encrypted, from_email, from_name, use_tls, is_default, is_platform_default")
      .eq("is_active", true);
    const pickAccount = (orgId: string | null): SmtpAccount | undefined => {
      const list = (accounts ?? []) as SmtpAccount[];
      return list.find((a) => a.organization_id === orgId && a.is_default)
        ?? list.find((a) => a.organization_id === orgId)
        ?? list.find((a) => a.is_platform_default);
    };

    // seskupit po uzivatelich -> jeden souhrnny e-mail
    const byUser = new Map<string, QueueRow[]>();
    for (const row of pending as QueueRow[]) {
      const list = byUser.get(row.user_id) ?? [];
      list.push(row);
      byUser.set(row.user_id, list);
    }

    let sent = 0;
    let failed = 0;
    for (const [userId, rows] of byUser) {
      const ids = rows.map((r) => r.id);
      const recipient = emailByUser.get(userId);
      const account = pickAccount(rows[0].organization_id);

      if (!recipient || !account) {
        await supabase.from("notification_email_queue")
          .update({
            attempts: rows[0].attempts + 1,
            error: !recipient ? "Uživatel nemá e-mail v profilu" : "Žádný aktivní SMTP účet",
          })
          .in("id", ids);
        failed += rows.length;
        continue;
      }

      try {
        const transporter = nodemailer.createTransport({
          host: account.host,
          port: account.port,
          secure: account.port === 465,
          auth: { user: account.username, pass: account.password_encrypted },
          requireTLS: account.use_tls === true,
        });
        const { subject, html, text } = buildEmail(rows, appUrl);
        await transporter.sendMail({
          from: account.from_name
            ? `"${account.from_name}" <${account.from_email}>`
            : account.from_email,
          to: recipient,
          subject,
          html,
          text,
        });
        await supabase.from("notification_email_queue")
          .update({ sent_at: new Date().toISOString(), error: null })
          .in("id", ids);
        sent += rows.length;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`notify-emails user ${userId}:`, msg);
        await supabase.from("notification_email_queue")
          .update({ attempts: rows[0].attempts + 1, error: msg })
          .in("id", ids);
        failed += rows.length;
      }
    }

    return json({ ok: true, sent, failed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return json({ error: msg }, 500);
  }
});
