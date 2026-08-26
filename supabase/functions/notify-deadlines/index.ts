// notify-deadlines: denni kontrola blizicich se terminu -> notifikace.
//
// Eventy (kazdy uzivatel si je zapina/vypina v notification_preferences,
// vcetne poctu dni predem; bez zaznamu = zapnuto, 14 dni):
//   project_deadline  - projects.deadline
//   insurance_expiry  - due_items s due_type 'insurance'
//   revision_expiry   - ostatni due_items (revize, STK, emise, kalibrace...)
//   service_due       - service_schedules.next_date (aktivni plany)
//   invoice_overdue   - nezaplacene faktury po splatnosti (dny predem se neuplatni)
//
// Deduplikace: dedupe_key = "{event}:{id_polozky}:{datum}" + partial unique
// index v notifications -> jedna polozka = jedna notifikace, zadny denni spam.
//
// Spousteni: pg_cron denne 6:00 (x-cron-secret == env CRON_SECRET),
// pripadne rucne prihlasenym uzivatelem (jen jeho organizace).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

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

const DEFAULT_DAYS_BEFORE = 14;
const HORIZON_DAYS = 60; // maximum, na ktere ma smysl nacitat kandidaty

interface DeadlineItem {
  eventKey: string;
  orgId: string;
  entityType: string;
  entityId: string;
  dueDate: string; // YYYY-MM-DD
  type: string;
  title: string;
  message: string;
  link: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("cs-CZ");
}

function daysUntil(iso: string, today: Date): number {
  const due = new Date(iso + "T00:00:00");
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

// ------------------------------------------------------------
// Sber kandidatu po eventech (vse v horizontu HORIZON_DAYS + po splatnosti)
// ------------------------------------------------------------

async function collectItems(
  supabase: SupabaseClient,
  horizonIso: string,
): Promise<DeadlineItem[]> {
  const items: DeadlineItem[] = [];

  // projects.deadline
  const { data: projects } = await supabase
    .from("projects")
    .select("id, organization_id, project_name, name, deadline")
    .not("deadline", "is", null)
    .lte("deadline", horizonIso)
    .not("status", "in", "(completed,cancelled)");
  for (const p of projects ?? []) {
    if (!p.organization_id) continue;
    const pname = p.project_name || p.name || "projekt";
    items.push({
      eventKey: "project_deadline",
      orgId: p.organization_id,
      entityType: "project",
      entityId: p.id,
      dueDate: p.deadline,
      type: "warning",
      title: "Blíží se termín projektu",
      message: `${pname} — termín ${fmtDate(p.deadline)}`,
      link: `/projekty/${p.id}`,
    });
  }

  // due_items (pojistky, revize, STK...) pres majetek
  const { data: dueItems } = await supabase
    .from("due_items")
    .select("id, due_type, label, due_date, asset_id, assets!inner(id, name, organization_id)")
    .not("due_date", "is", null)
    .lte("due_date", horizonIso)
    .neq("status", "completed")
    .is("completed_at", null)
    .eq("notify", true);
  for (const d of (dueItems ?? []) as unknown as {
    id: string; due_type: string; label: string; due_date: string;
    asset_id: string; assets: { name: string; organization_id: string | null };
  }[]) {
    const orgId = d.assets?.organization_id;
    if (!orgId) continue;
    const isInsurance = d.due_type === "insurance";
    items.push({
      eventKey: isInsurance ? "insurance_expiry" : "revision_expiry",
      orgId,
      entityType: "asset",
      entityId: d.asset_id,
      dueDate: d.due_date,
      type: "warning",
      title: isInsurance ? "Vyprší pojistka" : "Blíží se termín revize/kontroly",
      message: `${d.label} (${d.assets?.name ?? "majetek"}) — do ${fmtDate(d.due_date)}`,
      link: "/majetek",
    });
  }

  // service_schedules (planovany servis)
  const { data: schedules } = await supabase
    .from("service_schedules")
    .select("id, next_date, service_types(name), projects!inner(id, project_name, name, organization_id)")
    .eq("is_active", true)
    .lte("next_date", horizonIso);
  for (const s of (schedules ?? []) as unknown as {
    id: string; next_date: string;
    service_types: { name: string } | null;
    projects: { id: string; project_name: string; name: string; organization_id: string | null };
  }[]) {
    const orgId = s.projects?.organization_id;
    if (!orgId) continue;
    const pname = s.projects.project_name || s.projects.name || "projekt";
    items.push({
      eventKey: "service_due",
      orgId,
      entityType: "project",
      entityId: s.projects.id,
      dueDate: s.next_date,
      type: "info",
      title: "Blíží se plánovaný servis",
      message: `${s.service_types?.name ?? "Servis"} — ${pname}, ${fmtDate(s.next_date)}`,
      link: "/servis",
    });
  }

  // nezaplacene faktury po splatnosti
  const todayIso = new Date().toISOString().slice(0, 10);
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, organization_id, invoice_number, amount, tax_amount, due_date, status")
    .in("status", ["sent", "overdue"])
    .lt("due_date", todayIso);
  for (const inv of invoices ?? []) {
    if (!inv.organization_id) continue;
    const total = Math.round((inv.amount ?? 0) + (inv.tax_amount ?? 0));
    items.push({
      eventKey: "invoice_overdue",
      orgId: inv.organization_id,
      entityType: "invoice",
      entityId: inv.id,
      dueDate: inv.due_date,
      type: "error",
      title: "Faktura po splatnosti",
      message: `${inv.invoice_number || "Faktura"} — ${total.toLocaleString("cs-CZ")} Kč, splatnost ${fmtDate(inv.due_date)}`,
      link: `/finance/faktura/${inv.id}`,
    });
  }

  return items;
}

// ------------------------------------------------------------
// HTTP handler
// ------------------------------------------------------------

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today.getTime() + HORIZON_DAYS * 86_400_000);
    const horizonIso = horizon.toISOString().slice(0, 10);

    // 1) kandidatni polozky
    let items = await collectItems(supabase, horizonIso);
    if (callerOrgId) items = items.filter((i) => i.orgId === callerOrgId);
    if (items.length === 0) return json({ ok: true, inserted: 0, note: "Žádné blížící se termíny" });

    // 2) clenove organizaci (bez portalovych klientu)
    const orgIds = [...new Set(items.map((i) => i.orgId))];
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id, organization_id, profiles!inner(id, is_portal_client)")
      .in("organization_id", orgIds);
    const usersByOrg = new Map<string, string[]>();
    for (const m of (members ?? []) as unknown as {
      user_id: string; organization_id: string;
      profiles: { is_portal_client: boolean | null };
    }[]) {
      if (m.profiles?.is_portal_client) continue;
      const list = usersByOrg.get(m.organization_id) ?? [];
      if (!list.includes(m.user_id)) list.push(m.user_id);
      usersByOrg.set(m.organization_id, list);
    }

    // 3) preference (bez radku = zapnuto, DEFAULT_DAYS_BEFORE dni)
    const eventKeys = [...new Set(items.map((i) => i.eventKey))];
    const { data: prefRows } = await supabase
      .from("notification_preferences")
      .select("user_id, event_key, enabled, days_before")
      .in("event_key", eventKeys);
    const prefs = new Map<string, { enabled: boolean; days_before: number | null }>();
    for (const p of prefRows ?? []) {
      prefs.set(`${p.user_id}:${p.event_key}`, { enabled: p.enabled, days_before: p.days_before });
    }

    // 4) sestavit radky notifikaci dle oken jednotlivych uzivatelu
    const candidates: {
      user_id: string; organization_id: string; type: string; title: string;
      message: string; entity_type: string; entity_id: string; link: string;
      dedupe_key: string;
    }[] = [];
    for (const item of items) {
      const users = usersByOrg.get(item.orgId) ?? [];
      const remaining = daysUntil(item.dueDate, today);
      for (const userId of users) {
        const pref = prefs.get(`${userId}:${item.eventKey}`);
        if (pref && !pref.enabled) continue;
        const days = pref?.days_before ?? DEFAULT_DAYS_BEFORE;
        // po splatnosti/proslé terminy projdou vzdy; budouci jen v okne uzivatele
        if (remaining > days) continue;
        candidates.push({
          user_id: userId,
          organization_id: item.orgId,
          type: item.type,
          title: item.title,
          message: item.message,
          entity_type: item.entityType,
          entity_id: item.entityId,
          link: item.link,
          dedupe_key: `${item.eventKey}:${item.entityId}:${item.dueDate}`,
        });
      }
    }
    if (candidates.length === 0) return json({ ok: true, inserted: 0 });

    // 5) deduplikace: partial unique index nejde pouzit jako PostgREST
    //    ON CONFLICT arbiter, proto se existujici pary predem odfiltruji
    const keys = [...new Set(candidates.map((c) => c.dedupe_key))];
    const existing = new Set<string>();
    for (let i = 0; i < keys.length; i += 200) {
      const { data: rows } = await supabase
        .from("notifications")
        .select("user_id, dedupe_key")
        .in("dedupe_key", keys.slice(i, i + 200));
      for (const r of rows ?? []) existing.add(`${r.user_id}:${r.dedupe_key}`);
    }
    const fresh = candidates.filter((c) => !existing.has(`${c.user_id}:${c.dedupe_key}`));

    let inserted = 0;
    for (let i = 0; i < fresh.length; i += 200) {
      const chunk = fresh.slice(i, i + 200);
      const { error } = await supabase.from("notifications").insert(chunk);
      if (error) {
        // zavod s jinym behem - zkusit po jedne a preskocit duplicity
        for (const row of chunk) {
          const { error: rowErr } = await supabase.from("notifications").insert(row);
          if (!rowErr) inserted++;
        }
      } else {
        inserted += chunk.length;
      }
    }

    return json({ ok: true, candidates: candidates.length, inserted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
