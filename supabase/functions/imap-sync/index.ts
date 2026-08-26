// imap-sync: stahne novou postu ze schranek (smtp_accounts s imap_enabled),
// roztridi ji k projektum a ulozi do tabulky `emails` + prilohy do storage.
//
// Spousteni:
//   - pg_cron kazdych 5 min (hlavicka x-cron-secret == env CRON_SECRET)
//   - rucne prihlasenym clenem organizace (Authorization header) - tlacitko
//     "Synchronizovat ted"; syncuji se jen ucty jeho organizace
//   - body {"mode":"test","account_id":"..."} = jen connect + NOOP + STATUS
//     (overeni IMAP udaju, nic se nezapisuje)
//
// Limity: max 50 zprav na ucet a beh (timeout edge funkce); zbytek dozene
// dalsi tik cronu. Prilohy do 10 MB do bucketu email-attachments/{org}/{id}/.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { ImapFlow } from "npm:imapflow@1.0.164";
import { simpleParser, type ParsedMail, type AddressObject } from "npm:mailparser@3.7.1";

const ALLOWED_ORIGINS = [
  "https://dev.housesmart.cz",
  "http://localhost:5173",
];

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Client-Info, Apikey, x-cron-secret",
  };
}

const MAX_MESSAGES_PER_RUN = 50;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

interface ImapAccount {
  id: string;
  organization_id: string | null;
  name: string;
  imap_host: string | null;
  imap_port: number;
  imap_username: string | null;
  imap_password: string | null;
  imap_use_ssl: boolean;
  imap_last_uid: number;
}

// ============================================================
// CLASSIFIER - samostatna sekce pripravena na AI
//
// Rozhrani je stabilni: az se zapoji AI (env AI_CLASSIFIER=on),
// vymeni se jen implementace classifyAi() - volajici kod v syncAccount
// se nemeni. Heuristika zustane jako fallback.
// ============================================================

interface IncomingMessage {
  from_email: string;
  subject: string;
  body_text: string;
}

interface Classification {
  project_id: string | null;
  client_id: string | null;
  confidence: number | null;
  reason: string;
  engine: string;
}

const UNASSIGNED: Classification = {
  project_id: null,
  client_id: null,
  confidence: null,
  reason: "Nenalezena shoda s klientem ani nabídkou",
  engine: "heuristic",
};

async function classify(
  supabase: SupabaseClient,
  orgId: string,
  msg: IncomingMessage,
): Promise<Classification> {
  if (Deno.env.get("AI_CLASSIFIER") === "on") {
    const ai = await classifyAi(supabase, orgId, msg);
    if (ai) return ai;
  }
  return classifyHeuristic(supabase, orgId, msg);
}

// Budouci AI trideni (Claude API). Vraci null = pouzij heuristiku.
// Az se bude zapojovat: zavolat model s predmetem/telem + kandidatnimi
// projekty organizace, vratit {project_id, confidence, reason, engine:'ai'}.
async function classifyAi(
  _supabase: SupabaseClient,
  _orgId: string,
  _msg: IncomingMessage,
): Promise<Classification | null> {
  return null;
}

async function classifyHeuristic(
  supabase: SupabaseClient,
  orgId: string,
  msg: IncomingMessage,
): Promise<Classification> {
  // 1) Cislo nabidky v predmetu (Q-..., FVE-..., CAM-..., EPS-...) - nejsilnejsi signal
  const quoteNumbers = msg.subject.match(/\b(?:Q|FVE|CAM|EPS)-[A-Za-z0-9][A-Za-z0-9/-]*/gi) ?? [];
  if (quoteNumbers.length > 0) {
    const { data: quotes } = await supabase
      .from("project_quotes")
      .select("project_id, quote_number, projects!inner(id, client_id, organization_id)")
      .in("quote_number", quoteNumbers)
      .eq("projects.organization_id", orgId)
      .limit(1);
    const q = (quotes ?? [])[0] as
      | { project_id: string; quote_number: string; projects: { client_id: string | null } }
      | undefined;
    if (q) {
      return {
        project_id: q.project_id,
        client_id: q.projects?.client_id ?? null,
        confidence: 0.9,
        reason: `Předmět obsahuje číslo nabídky ${q.quote_number}`,
        engine: "heuristic",
      };
    }
  }

  // 2) Odesilatel = e-mail klienta nebo kontaktu klienta
  const sender = msg.from_email.toLowerCase();
  if (!sender) return UNASSIGNED;

  let clientId: string | null = null;
  const { data: clientRows } = await supabase
    .from("clients")
    .select("id")
    .eq("organization_id", orgId)
    .ilike("email", sender)
    .limit(1);
  if (clientRows && clientRows.length > 0) {
    clientId = clientRows[0].id;
  } else {
    const { data: contactRows } = await supabase
      .from("client_contacts")
      .select("client_id, clients!inner(id, organization_id)")
      .ilike("email", sender)
      .eq("clients.organization_id", orgId)
      .limit(1);
    if (contactRows && contactRows.length > 0) {
      clientId = (contactRows[0] as { client_id: string }).client_id;
    }
  }
  if (!clientId) return UNASSIGNED;

  // klientuv nejnovejsi bezici projekt (mimo completed/cancelled)
  const { data: projects } = await supabase
    .from("projects")
    .select("id, project_name, name")
    .eq("client_id", clientId)
    .eq("organization_id", orgId)
    .not("status", "in", "(completed,cancelled)")
    .order("updated_at", { ascending: false })
    .limit(2);

  if (!projects || projects.length === 0) {
    return {
      project_id: null,
      client_id: clientId,
      confidence: 0.4,
      reason: "Odesílatel odpovídá klientovi, ale nemá běžící projekt",
      engine: "heuristic",
    };
  }
  const p = projects[0] as { id: string; project_name: string; name: string };
  const pname = p.project_name || p.name || "";
  return {
    project_id: p.id,
    client_id: clientId,
    confidence: projects.length === 1 ? 0.8 : 0.6,
    reason: projects.length === 1
      ? `Odesílatel je klient projektu ${pname}`
      : `Odesílatel je klient s více projekty — přiřazeno k nejnovějšímu (${pname})`,
    engine: "heuristic",
  };
}

// ============================================================
// IMAP sync
// ============================================================

function addressList(addr: AddressObject | AddressObject[] | undefined): string[] {
  if (!addr) return [];
  const objs = Array.isArray(addr) ? addr : [addr];
  return objs.flatMap((a) => a.value.map((v) => v.address ?? "")).filter(Boolean);
}

function sanitizeFilename(name: string): string {
  const trimmed = (name || "priloha").slice(0, 120);
  return trimmed.replace(/[^\w.-]+/g, "_");
}

interface SyncResult {
  account: string;
  fetched: number;
  inserted: number;
  unassigned: number;
  last_uid: number;
  error?: string;
}

async function syncAccount(
  supabase: SupabaseClient,
  account: ImapAccount,
): Promise<SyncResult> {
  const result: SyncResult = {
    account: account.name,
    fetched: 0,
    inserted: 0,
    unassigned: 0,
    last_uid: account.imap_last_uid,
  };
  const orgId = account.organization_id;
  if (!orgId || !account.imap_host || !account.imap_username) {
    result.error = "Účet nemá vyplněné IMAP údaje nebo organizaci";
    return result;
  }

  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port || 993,
    secure: account.imap_use_ssl !== false,
    auth: { user: account.imap_username, pass: account.imap_password ?? "" },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const lastUid = Number(account.imap_last_uid) || 0;
    const found = await client.search(
      { uid: `${lastUid + 1}:*` },
      { uid: true },
    );
    // rozsah "n:*" vraci i posledni zpravu, kdyz nic noveho neni - odfiltrovat
    const newUids = (found ?? [])
      .filter((u: number) => u > lastUid)
      .sort((a: number, b: number) => a - b)
      .slice(0, MAX_MESSAGES_PER_RUN);

    for (const uid of newUids) {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      result.fetched++;
      const maxUidSeen = uid;
      try {
        const parsed: ParsedMail = await simpleParser(msg.source);
        const fromValue = parsed.from?.value?.[0];
        const fromEmail = (fromValue?.address ?? "").toLowerCase();
        const fromName = fromValue?.name ?? "";
        const subject = parsed.subject ?? "";
        const bodyText = parsed.text ?? "";

        const cls = await classify(supabase, orgId, {
          from_email: fromEmail,
          subject,
          body_text: bodyText,
        });

        const references = Array.isArray(parsed.references)
          ? parsed.references
          : parsed.references ? [parsed.references] : [];

        const { data: insertedRows, error: insertErr } = await supabase
          .from("emails")
          .upsert({
            organization_id: orgId,
            account_id: account.id,
            message_id: parsed.messageId ?? `uid:${account.id}:${uid}`,
            in_reply_to: parsed.inReplyTo ?? null,
            reference_ids: references,
            from_email: fromEmail,
            from_name: fromName,
            to_emails: addressList(parsed.to),
            cc_emails: addressList(parsed.cc),
            subject,
            body_html: typeof parsed.html === "string" ? parsed.html : "",
            body_text: bodyText,
            received_at: (parsed.date ?? new Date()).toISOString(),
            project_id: cls.project_id,
            client_id: cls.client_id,
            assignment_status: cls.project_id ? "auto" : "unassigned",
            assignment_confidence: cls.confidence,
            assignment_reason: cls.reason,
            assignment_engine: cls.engine,
            attachments: [],
          }, { onConflict: "account_id,message_id", ignoreDuplicates: true })
          .select("id");

        if (insertErr) throw new Error(`insert: ${insertErr.message}`);
        const emailId = insertedRows?.[0]?.id as string | undefined;

        if (emailId) {
          result.inserted++;

          // prilohy do storage + zapis metadat
          const stored: { name: string; path: string; size: number; content_type: string }[] = [];
          for (const [i, att] of (parsed.attachments ?? []).entries()) {
            const size = att.content?.length ?? 0;
            if (size === 0 || size > MAX_ATTACHMENT_BYTES) continue;
            const safeName = sanitizeFilename(att.filename ?? `priloha-${i + 1}`);
            const path = `${orgId}/${emailId}/${i}_${safeName}`;
            const { error: upErr } = await supabase.storage
              .from("email-attachments")
              .upload(path, att.content, {
                contentType: att.contentType || "application/octet-stream",
                upsert: true,
              });
            if (!upErr) {
              stored.push({
                name: att.filename ?? safeName,
                path,
                size,
                content_type: att.contentType || "application/octet-stream",
              });
            }
          }
          if (stored.length > 0) {
            await supabase.from("emails").update({ attachments: stored }).eq("id", emailId);
          }

          if (!cls.project_id) {
            result.unassigned++;
            await supabase.rpc("notify_org_users", {
              p_org: orgId,
              p_roles: ["owner", "admin", "manager"],
              p_type: "email",
              p_title: "Nepřiřazený e-mail",
              p_message: `${fromName || fromEmail}: ${subject || "(bez předmětu)"}`,
              p_entity_type: "email",
              p_entity_id: emailId,
              p_link: `/posta?email=${emailId}`,
              p_event_key: "email_unassigned",
              p_dedupe: `email_unassigned:${emailId}`,
              p_extra_user: null,
            });
          }
        }
      } catch (msgErr) {
        // jedna vadna zprava nesmi zastavit sync; UID se presto posune,
        // jinak by se na ni cron zasekaval donekonecna
        console.error(`account ${account.name} uid ${uid}:`, msgErr);
      }
      result.last_uid = maxUidSeen;
      await supabase
        .from("smtp_accounts")
        .update({ imap_last_uid: maxUidSeen, imap_last_synced_at: new Date().toISOString() })
        .eq("id", account.id);
    }

    if (newUids.length === 0) {
      await supabase
        .from("smtp_accounts")
        .update({ imap_last_synced_at: new Date().toISOString() })
        .eq("id", account.id);
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  return result;
}

async function testAccount(account: ImapAccount): Promise<Record<string, unknown>> {
  if (!account.imap_host || !account.imap_username) {
    return { account: account.name, ok: false, error: "Chybí IMAP host nebo přihlašovací jméno" };
  }
  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port || 993,
    secure: account.imap_use_ssl !== false,
    auth: { user: account.imap_username, pass: account.imap_password ?? "" },
    logger: false,
  });
  try {
    await client.connect();
    await client.noop();
    const status = await client.status("INBOX", { messages: true, uidNext: true, unseen: true });
    await client.logout();
    return {
      account: account.name,
      ok: true,
      messages: status.messages,
      unseen: status.unseen,
      uid_next: status.uidNext,
    };
  } catch (err) {
    await client.logout().catch(() => {});
    return {
      account: account.name,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================
// HTTP handler
// ============================================================

Deno.serve(async (req: Request) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- autorizace: cron secret NEBO prihlaseny clen organizace ---
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    const isCron = cronSecret !== "" && req.headers.get("x-cron-secret") === cronSecret;
    let callerOrgId: string | null = null;

    if (!isCron) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "Unauthorized" }, 401);
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await anonClient.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);
      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (!membership) return json({ error: "No organization membership" }, 403);
      callerOrgId = membership.organization_id;
    }

    let payload: { mode?: string; account_id?: string } = {};
    try { payload = await req.json(); } catch { /* prazdne telo od cronu */ }

    let query = supabase
      .from("smtp_accounts")
      .select("id, organization_id, name, imap_host, imap_port, imap_username, imap_password, imap_use_ssl, imap_last_uid")
      .eq("is_active", true);
    if (payload.mode === "test") {
      // test bezi i pro jeste nezapnuty ucet (overeni pred zapnutim)
    } else {
      query = query.eq("imap_enabled", true);
    }
    if (payload.account_id) query = query.eq("id", payload.account_id);
    if (callerOrgId) query = query.eq("organization_id", callerOrgId);

    const { data: accounts, error: accErr } = await query;
    if (accErr) return json({ error: accErr.message }, 500);
    if (!accounts || accounts.length === 0) {
      return json({ ok: true, results: [], note: "Žádný účet k synchronizaci" });
    }

    const results: unknown[] = [];
    for (const account of accounts as ImapAccount[]) {
      if (payload.mode === "test") {
        results.push(await testAccount(account));
      } else {
        try {
          results.push(await syncAccount(supabase, account));
        } catch (err) {
          results.push({
            account: account.name,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
    return json({ ok: true, mode: payload.mode ?? "sync", results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
