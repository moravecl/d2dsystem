// ai-assistant: mozek sekce AI Asistent.
//
// Akce (body.action):
//   summarize_emails {date_from, date_to, only_unassigned?}
//     -> Opus 5: shrnuti posty za obdobi + navrhy akci napric systemem
//   classify_emails {}
//     -> Haiku 4.5: navrhy prirazeni nepriraznych e-mailu k projektum
//
// Asistent nic NEZAPISUJE do dat - vraci navrhy (ProposedAction[]),
// ktere uzivatel schvali v UI a zapis probehne pod jeho uctem (RLS).
// Kazde volani se loguje do ai_runs (tokeny + odhad ceny).
//
// Env: ANTHROPIC_API_KEY (dashboard -> Edge Functions -> Secrets).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

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
      "Content-Type, Authorization, X-Client-Info, Apikey",
  };
}

// mix modelu dle rozhodnuti: Opus 5 na shrnuti/analyzy, Haiku na trideni
const MODEL_SMART = "claude-opus-5";
const MODEL_FAST = "claude-haiku-4-5";
const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  [MODEL_SMART]: { input: 5, output: 25 },
  [MODEL_FAST]: { input: 1, output: 5 },
};

// mensi davka = odpoved do ~pul minuty; delsi obdobi se zkrati na
// nejnovejsi zpravy (UI to u vysledku prizna)
const MAX_EMAILS_SUMMARY = 40;
const SNIPPET_CHARS = 400;
const CLASSIFY_BATCH = 25;

interface OrgContext {
  projects: { id: string; name: string; client: string; status: string }[];
  assets: { id: string; name: string }[];
}

function textSnippet(e: { body_text: string; body_html: string }): string {
  const t = e.body_text || e.body_html.replace(/<[^>]+>/g, " ");
  return t.replace(/\s+/g, " ").trim().slice(0, SNIPPET_CHARS);
}

// model vraci JSON v textu - vytahnout nejvnejsi objekt a naparsovat
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Odpověď modelu neobsahuje JSON");
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function loadOrgContext(supabase: SupabaseClient, orgId: string): Promise<OrgContext> {
  const [projectsRes, assetsRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, project_name, status, clients(name)")
      .eq("organization_id", orgId)
      .not("status", "in", "(completed,cancelled)")
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("assets")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name")
      .limit(100),
  ]);
  return {
    projects: (projectsRes.data ?? []).map((p: {
      id: string; name: string; project_name: string; status: string;
      clients: { name: string } | null;
    }) => ({
      id: p.id,
      name: p.project_name || p.name,
      client: p.clients?.name ?? "",
      status: p.status,
    })),
    assets: (assetsRes.data ?? []) as { id: string; name: string }[],
  };
}

async function logRun(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  action: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  note: string,
) {
  const price = PRICE_PER_MTOK[model] ?? { input: 0, output: 0 };
  const cost = (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
  await supabase.from("ai_runs").insert({
    organization_id: orgId,
    user_id: userId,
    action,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: Math.round(cost * 10000) / 10000,
    note,
  });
}

// ------------------------------------------------------------
// Shrnuti posty za obdobi + navrhy akci (Opus 5)
// ------------------------------------------------------------

const SUMMARY_SYSTEM = `Jsi AI asistent stavební firmy v systému HouseSmart (CRM, projekty, úkoly, majetek, servis). Dostaneš přehled příchozích e-mailů za období a kontext firmy (projekty, majetek).

Vrať POUZE platný JSON (žádný jiný text) v této struktuře:
{
  "summary": "Přehledné shrnutí pošty v češtině. Odstavce odděluj prázdným řádkem, odrážky začínej '- '. Seřaď od nejdůležitějšího: co vyžaduje reakci, termíny, peníze, problémy. U každé podstatné věci uveď odesílatele.",
  "actions": [
    { "type": "create_task", "title": "...", "description": "...", "due_date": "YYYY-MM-DD nebo null", "project_id": "id projektu z kontextu nebo null", "source_email_id": "id e-mailu" },
    { "type": "assign_email", "email_id": "...", "project_id": "...", "reason": "proč" },
    { "type": "create_due_item", "asset_id": "id majetku z kontextu nebo null", "asset_name": "název, když si nejsi jistý id", "due_type": "insurance|revision|stk|service|warranty|other", "label": "např. Pojistka Ford Transit", "due_date": "YYYY-MM-DD", "source_email_id": "..." },
    { "type": "create_lead", "name": "...", "email": "...", "phone": "", "message": "shrnutí poptávky", "source_email_id": "..." }
  ]
}

Pravidla pro akce: navrhuj jen to, co z e-mailů skutečně plyne (úkol s termínem, pojistka/revize k majetku, nová poptávka od neznámého odesílatele, zjevně špatně nepřiřazený e-mail). ID projektů a majetku ber VÝHRADNĚ z dodaného kontextu; když nenajdeš jistou shodu, dej null. Žádné akce nevymýšlej do počtu — klidně vrať prázdné pole.`;

async function summarizeEmails(
  anthropic: Anthropic,
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  params: { date_from?: string; date_to?: string; only_unassigned?: boolean },
) {
  const from = params.date_from ?? new Date(Date.now() - 7 * 86_400_000).toISOString();
  const to = params.date_to ?? new Date().toISOString();

  let query = supabase
    .from("emails")
    .select("id, from_email, from_name, subject, body_text, body_html, received_at, project_id, assignment_status")
    .eq("organization_id", orgId)
    .gte("received_at", from)
    .lte("received_at", to)
    .order("received_at", { ascending: false })
    .limit(MAX_EMAILS_SUMMARY + 1);
  if (params.only_unassigned) query = query.eq("assignment_status", "unassigned");

  const { data: emails, error } = await query;
  if (error) throw new Error(error.message);
  if (!emails || emails.length === 0) {
    return { summary: "V zadaném období nejsou žádné e-maily.", actions: [], emails_count: 0 };
  }
  const truncated = emails.length > MAX_EMAILS_SUMMARY;
  const list = emails.slice(0, MAX_EMAILS_SUMMARY);

  const ctx = await loadOrgContext(supabase, orgId);
  const projectName = (id: string | null) => ctx.projects.find((p) => p.id === id)?.name ?? "";

  const digest = list.map((e, i) =>
    `[${i + 1}] id=${e.id}\nod: ${e.from_name || ""} <${e.from_email}>\npředmět: ${e.subject}\npřijato: ${e.received_at}\nprojekt: ${projectName(e.project_id) || "(nepřiřazeno)"}\ntext: ${textSnippet(e)}`,
  ).join("\n\n");

  const contextBlock =
    `PROJEKTY (id | název | klient | stav):\n${ctx.projects.map((p) => `${p.id} | ${p.name} | ${p.client} | ${p.status}`).join("\n")}\n\n` +
    `MAJETEK (id | název):\n${ctx.assets.map((a) => `${a.id} | ${a.name}`).join("\n")}`;

  const response = await anthropic.messages.create({
    model: MODEL_SMART,
    max_tokens: 8000,
    // stredni usili: shrnuti posty nepotrebuje dlouhe premysleni a
    // odpoved prijde nekolikanasobne rychleji
    output_config: { effort: "medium" },
    system: SUMMARY_SYSTEM,
    messages: [{
      role: "user",
      content: `Dnešní datum: ${new Date().toISOString().slice(0, 10)}\n\n${contextBlock}\n\nE-MAILY (${list.length}${truncated ? ", zkráceno na nejnovějších " + MAX_EMAILS_SUMMARY : ""}):\n\n${digest}`,
    }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const parsed = extractJson(textBlock?.type === "text" ? textBlock.text : "") as {
    summary?: string; actions?: unknown[];
  };

  await logRun(supabase, orgId, userId, "summarize_emails", MODEL_SMART,
    response.usage.input_tokens, response.usage.output_tokens,
    `${list.length} e-mailů, ${from.slice(0, 10)}–${to.slice(0, 10)}`);

  return {
    summary: parsed.summary ?? "",
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    emails_count: list.length,
    truncated,
  };
}

// ------------------------------------------------------------
// Trideni nepriraznych e-mailu (Haiku 4.5)
// ------------------------------------------------------------

const CLASSIFY_SYSTEM = `Třídíš příchozí e-maily stavební firmy k projektům. Dostaneš seznam projektů (s klienty) a dávku e-mailů.

Vrať POUZE platný JSON: {"proposals": [{"email_id": "...", "project_id": "id z kontextu nebo null", "confidence": 0.0-1.0, "reason": "krátké české zdůvodnění"}]}

Přiřazuj podle odesílatele, jmen v textu, adres staveb, čísel nabídek a souvislostí. Když žádný projekt rozumně nesedí, dej project_id null a reason vysvětli (např. spam, newsletter, dodavatelská faktura bez projektu). Confidence pod 0.5 znamená spíš hádání — používej střízlivě.`;

async function classifyEmails(
  anthropic: Anthropic,
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
) {
  const { data: emails, error } = await supabase
    .from("emails")
    .select("id, from_email, from_name, subject, body_text, body_html, received_at")
    .eq("organization_id", orgId)
    .eq("assignment_status", "unassigned")
    .order("received_at", { ascending: false })
    .limit(CLASSIFY_BATCH);
  if (error) throw new Error(error.message);
  if (!emails || emails.length === 0) return { proposals: [], emails_count: 0 };

  const ctx = await loadOrgContext(supabase, orgId);
  const contextBlock =
    `PROJEKTY (id | název | klient | stav):\n${ctx.projects.map((p) => `${p.id} | ${p.name} | ${p.client} | ${p.status}`).join("\n")}`;
  const digest = emails.map((e, i) =>
    `[${i + 1}] id=${e.id}\nod: ${e.from_name || ""} <${e.from_email}>\npředmět: ${e.subject}\ntext: ${textSnippet(e)}`,
  ).join("\n\n");

  const response = await anthropic.messages.create({
    model: MODEL_FAST,
    max_tokens: 4000,
    system: CLASSIFY_SYSTEM,
    messages: [{ role: "user", content: `${contextBlock}\n\nE-MAILY (${emails.length}):\n\n${digest}` }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const parsed = extractJson(textBlock?.type === "text" ? textBlock.text : "") as {
    proposals?: { email_id: string; project_id: string | null; confidence: number; reason: string }[];
  };
  const valid = new Set(emails.map((e) => e.id));
  const projectIds = new Set(ctx.projects.map((p) => p.id));
  const proposals = (parsed.proposals ?? []).filter((p) =>
    valid.has(p.email_id) && (p.project_id === null || projectIds.has(p.project_id)));

  await logRun(supabase, orgId, userId, "classify_emails", MODEL_FAST,
    response.usage.input_tokens, response.usage.output_tokens,
    `${emails.length} e-mailů`);

  return { proposals, emails_count: emails.length };
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
    if (!Deno.env.get("ANTHROPIC_API_KEY")) {
      return json({ error: "Chybí ANTHROPIC_API_KEY v nastavení funkce" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
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
    const orgId = membership.organization_id;

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

    const payload = await req.json().catch(() => ({}));
    switch (payload.action) {
      case "summarize_emails":
        return json({ ok: true, ...(await summarizeEmails(anthropic, supabase, orgId, user.id, payload)) });
      case "classify_emails":
        return json({ ok: true, ...(await classifyEmails(anthropic, supabase, orgId, user.id)) });
      default:
        return json({ error: `Neznámá akce: ${payload.action}` }, 400);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("ai-assistant:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
