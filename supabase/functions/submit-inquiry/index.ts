import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/*
  Verejny endpoint pro poptavkove formulare (embed na cizich webech).
  Bezi pod SERVICE_ROLE, proto je tu obrana ve vice vrstvach:
  - limit velikosti tela (64 kB)
  - rate limit per IP (5 / 10 min) a per formular (30 / hod)
    pres tabulku inquiry_submission_log
  - honeypot pole _hp (roboti ho vyplni, lide nevidi)
  - validace dat proti definici formulare (form.fields):
    ukladaji se jen definovane klice, hodnoty s limitem delky
  - file_urls musi mirit do vlastniho storage bucketu form-uploads
*/

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_BODY_BYTES = 64 * 1024;
const MAX_VALUE_LEN = 10_000;
const MAX_KEYS = 50;
const MAX_FILES = 10;
const IP_LIMIT = 5;         // podani z jedne IP za IP_WINDOW
const IP_WINDOW_MIN = 10;
const FORM_LIMIT = 30;      // podani na jeden formular za hodinu
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Alias klice, ktere stary embed posilal mimo definici poli
const ALIAS_KEYS = ["name", "jmeno", "email", "e_mail", "phone", "telefon", "message", "zprava"];

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

function cleanValue(v: unknown): string | null {
  if (typeof v === "string") return v.slice(0, MAX_VALUE_LEN);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    // multiselect
    return v.filter((x) => typeof x === "string").slice(0, 20)
      .map((x) => (x as string).slice(0, 500)).join(", ");
  }
  return null; // objekty a dalsi typy zahazujeme
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return json(413, { error: "Payload too large" });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json(400, { error: "Invalid JSON" });
    }
    const { form_id, data, file_urls } = (parsed ?? {}) as {
      form_id?: unknown; data?: unknown; file_urls?: unknown;
    };

    if (typeof form_id !== "string" || !UUID_RE.test(form_id)) {
      return json(400, { error: "Missing form_id or data" });
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return json(400, { error: "Missing form_id or data" });
    }
    const dataObj = data as Record<string, unknown>;

    // Honeypot: bot vyplnil skryte pole -> tvarime se, ze prislo v poradku
    if (typeof dataObj._hp === "string" && dataObj._hp.trim() !== "") {
      return json(200, { success: true });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ---------- rate limit ----------
    const ip = clientIp(req);
    const ipSince = new Date(Date.now() - IP_WINDOW_MIN * 60_000).toISOString();
    const formSince = new Date(Date.now() - 60 * 60_000).toISOString();

    const [ipRes, formRes] = await Promise.all([
      supabase.from("inquiry_submission_log")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip).gte("created_at", ipSince),
      supabase.from("inquiry_submission_log")
        .select("id", { count: "exact", head: true })
        .eq("form_id", form_id).gte("created_at", formSince),
    ]);
    if ((ipRes.count ?? 0) >= IP_LIMIT || (formRes.count ?? 0) >= FORM_LIMIT) {
      return json(429, { error: "Too many requests" });
    }
    // Zapis do logu jeste pred zpracovanim, at limit plati i pro neplatne pokusy
    await supabase.from("inquiry_submission_log").insert({ ip, form_id });
    // Prilezitostny uklid starych zaznamu
    if (Math.random() < 0.05) {
      await supabase.from("inquiry_submission_log").delete()
        .lt("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
    }

    // ---------- formular ----------
    const { data: form, error: formError } = await supabase
      .from("inquiry_forms")
      .select("id, organization_id, fields, is_active, form_type")
      .eq("id", form_id)
      .maybeSingle();

    if (formError || !form) {
      return json(404, { error: "Form not found" });
    }
    if (!form.is_active) {
      return json(400, { error: "Form is inactive" });
    }

    // ---------- validace dat proti definici poli ----------
    const fieldDefs = (Array.isArray(form.fields) ? form.fields : []) as
      { key?: string; type?: string }[];
    const allowedKeys = new Set<string>([
      ...fieldDefs.map((f) => f.key).filter((k): k is string => typeof k === "string"),
      ...ALIAS_KEYS,
    ]);

    const cleanData: Record<string, string> = {};
    let keyCount = 0;
    for (const [key, value] of Object.entries(dataObj)) {
      if (++keyCount > MAX_KEYS) break;
      if (!allowedKeys.has(key)) continue;      // nedefinovane klice zahodit
      const v = cleanValue(value);
      if (v !== null) cleanData[key] = v;
    }

    // ---------- validace priloh ----------
    const uploadPrefix = `${supabaseUrl}/storage/v1/object/form-uploads/`;
    if (file_urls && typeof file_urls === "object" && !Array.isArray(file_urls)) {
      let fileCount = 0;
      for (const [key, url] of Object.entries(file_urls as Record<string, unknown>)) {
        if (++fileCount > MAX_FILES) break;
        if (!allowedKeys.has(key)) continue;
        if (typeof url !== "string") continue;
        if (!url.startsWith(uploadPrefix) || url.includes("..")) continue;
        cleanData[`${key}_url`] = url.slice(0, 2000);
      }
    }

    const name = cleanData.name || cleanData.jmeno || "";
    const email = cleanData.email || cleanData.e_mail || "";
    const phone = cleanData.phone || cleanData.telefon || "";
    const message = cleanData.message || cleanData.zprava || "";

    if (form.form_type === "service") {
      const titleParts = [name, email].filter(Boolean);
      const { error: insertError } = await supabase.from("service_tickets").insert({
        organization_id: form.organization_id,
        inquiry_form_id: form_id,
        title: `Formulář: ${titleParts.join(" - ") || "Nový požadavek"}`.slice(0, 300),
        description: message,
        status: "open",
        priority: "normal",
        reported_by_portal: false,
        form_data: cleanData,
      });
      if (insertError) {
        return json(500, { error: "Failed to save service ticket" });
      }
    } else {
      const { error: insertError } = await supabase.from("leads").insert({
        organization_id: form.organization_id,
        inquiry_form_id: form_id,
        name: name.slice(0, 200),
        email: email.slice(0, 200),
        phone: phone.slice(0, 50),
        message,
        source: "web_form",
        form_data: cleanData,
        status: "new",
      });
      if (insertError) {
        return json(500, { error: "Failed to save lead" });
      }
    }

    return json(200, { success: true });
  } catch {
    return json(500, { error: "Internal server error" });
  }
});
