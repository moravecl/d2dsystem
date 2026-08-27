// public-configurator: verejny konfigurator pro zakazniky.
//
// GET  ?token=...  -> zjednoduseny cenik organizace (jen verejna cast:
//                     ceny, dotace, viditelnost cen; zadne marze)
// POST {token, data, pricing} -> vytvori LEAD (source 'konfigurator',
//                     form_data nese celou konfiguraci i naceneni),
//                     posle zakaznikovi potvrzovaci e-mail pres vychozi
//                     SMTP ucet organizace a vraci {ok, email_sent}
//
// Identifikace pres public_token v configurator_settings; funguje jen
// pri public_enabled = true. Rate limit 10 odeslani/hod na IP
// (tabulka public_config_log). Endpoint je verejny (anon key).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.8";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RATE_LIMIT_PER_HOUR = 10;

// vychozi verejny cenik - stejne hodnoty jako DEFAULT_CONFIGURATOR_CONFIG.public
const DEFAULT_PUBLIC_PRICES: Record<string, { value: number; unit: string }> = {
  heatPumpBase: { value: 220000, unit: "flat" },
  floorHeatingPerM2: { value: 1250, unit: "per_m2" },
  radiatorPerPcs: { value: 8000, unit: "per_piece" },
  tank: { value: 45000, unit: "flat" },
  electroBoiler: { value: 65000, unit: "flat" },
  solidFuelBoiler: { value: 85000, unit: "flat" },
  waterBase: { value: 120000, unit: "flat" },
  waterSoftener: { value: 35000, unit: "flat" },
  smartValve: { value: 18000, unit: "flat" },
  circulationPump: { value: 25000, unit: "flat" },
  recuperationBase: { value: 145000, unit: "flat" },
  recuperationPerM2: { value: 350, unit: "per_m2" },
  recuperationCooling: { value: 95000, unit: "flat" },
  fveBasic: { value: 160000, unit: "flat" },
  fveOptimum: { value: 380000, unit: "flat" },
  fveMax: { value: 480000, unit: "flat" },
  smartHomeBase: { value: 65000, unit: "flat" },
  smartPerM2: { value: 450, unit: "per_m2" },
  smartBasic: { value: 35000, unit: "flat" },
  electroPerM2: { value: 850, unit: "per_m2" },
  alarmPrep: { value: 5000, unit: "flat" },
  alarmBase: { value: 25000, unit: "flat" },
  alarmPerM2: { value: 75, unit: "per_m2" },
  cameraPrep: { value: 8000, unit: "flat" },
  cameraFull: { value: 40000, unit: "flat" },
  loxoneFeatureBase: { value: 15000, unit: "per_piece" },
};

interface SettingsRow {
  organization_id: string;
  config: {
    public?: {
      prices?: Record<string, { value: number; unit: string }>;
      subsidies?: { sector: string; label: string; description: string; amount: number; enabled: boolean }[];
      showLivePrices?: boolean;
      showResultPrices?: boolean;
    };
  };
}

async function findSettings(supabase: SupabaseClient, token: string): Promise<SettingsRow | null> {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data } = await supabase
    .from("configurator_settings")
    .select("organization_id, config")
    .eq("public_token", token)
    .eq("public_enabled", true)
    .maybeSingle();
  return (data as SettingsRow | null) ?? null;
}

function publicConfigOf(row: SettingsRow) {
  const pub = row.config?.public ?? {};
  return {
    prices: { ...DEFAULT_PUBLIC_PRICES, ...(pub.prices ?? {}) },
    subsidies: pub.subsidies ?? [],
    show_live_prices: pub.showLivePrices ?? false,
    show_result_prices: pub.showResultPrices ?? true,
  };
}

const LABELS: Record<string, Record<string, string>> = {
  heatSource: {
    heat_pump: "Tepelné čerpadlo", electroboiler: "Elektrokotel", gas_boiler: "Plynový kotel",
    solid_fuel: "Tuhá paliva", electric_mats: "Elektrické rohože",
  },
  recuperation: { premium: "Prémiová rekuperace", yes: "Standardní rekuperace", no: "Bez rekuperace" },
  fve: { none: "Bez FVE", basic: "FVE základní (3-4 kWp)", optimum: "FVE optimum (6-8 kWp + baterie)", max: "FVE maximum (10+ kWp)" },
  smart: { none: "Bez smart home", basic: "Základní smart home", loxone: "Loxone" },
  alarm: { none: "Bez alarmu", prep: "Alarm - příprava", full: "Alarm Jablotron komplet" },
  cameras: { none: "Bez kamer", prep: "Kamery - příprava", full: "Kamerový systém komplet" },
};

function summarize(data: Record<string, unknown>, pricing: { totalWithVat?: number; subsidyEstimate?: number }): string {
  const l = (group: string, key: unknown) => LABELS[group]?.[String(key)] ?? String(key ?? "");
  const lines = [
    `Plocha: ${data.area} m², podlaží: ${data.floors}, osob: ${data.occupants}`,
    `Vytápění: ${l("heatSource", data.heatSource)}`,
    `Vzduchotechnika: ${l("recuperation", data.recuperation)}${data.recuperationCooling ? " + chlazení" : ""}`,
    `Fotovoltaika: ${l("fve", data.fve)}`,
    `Smart home: ${l("smart", data.smart)}`,
    `Zabezpečení: ${l("alarm", data.alarm)}, kamery: ${l("cameras", data.cameras)}`,
  ];
  if (data.clientRegion) lines.push(`Kraj: ${data.clientRegion}`);
  if (pricing?.totalWithVat) {
    lines.push(`Orientační cena s DPH: ${Math.round(pricing.totalWithVat).toLocaleString("cs-CZ")} Kč`);
  }
  if (pricing?.subsidyEstimate) {
    lines.push(`Možné dotace: ${Math.round(pricing.subsidyEstimate).toLocaleString("cs-CZ")} Kč`);
  }
  return lines.join("\n");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendConfirmationEmail(
  supabase: SupabaseClient,
  orgId: string,
  clientName: string,
  clientEmail: string,
  summary: string,
  showPrices: boolean,
  pricing: { totalWithVat?: number; subsidyEstimate?: number },
): Promise<boolean> {
  try {
    const { data: accounts } = await supabase
      .from("smtp_accounts")
      .select("host, port, username, password_encrypted, from_email, from_name, use_tls, is_default, is_platform_default, organization_id")
      .eq("is_active", true);
    const list = accounts ?? [];
    const account = list.find((a) => a.organization_id === orgId && a.is_default)
      ?? list.find((a) => a.organization_id === orgId)
      ?? list.find((a) => a.is_platform_default);
    if (!account) return false;

    const summaryHtml = esc(summary).replace(/\n/g, "<br>");
    const priceBlock = showPrices && pricing?.totalWithVat
      ? `<div style="margin-top:16px;padding:14px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px">
           <div style="font-size:13px;color:#475569">Orientační cena s DPH</div>
           <div style="font-size:24px;font-weight:800;color:#1d4ed8">${Math.round(pricing.totalWithVat).toLocaleString("cs-CZ")} Kč</div>
         </div>`
      : "";

    const transporter = nodemailer.createTransport({
      host: account.host,
      port: account.port,
      secure: account.port === 465,
      auth: { user: account.username, pass: account.password_encrypted },
      requireTLS: account.use_tls === true,
    });
    await transporter.sendMail({
      from: account.from_name ? `"${account.from_name}" <${account.from_email}>` : account.from_email,
      to: clientEmail,
      subject: "Vaše konfigurace HouseSmart — orientační nabídka",
      html: `<div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a">
        <h2 style="margin:0 0 8px">Děkujeme za Vaši konfiguraci${clientName ? `, ${esc(clientName)}` : ""}!</h2>
        <p style="color:#475569;font-size:14px;line-height:1.6">Vaše poptávka byla přijata a náš tým se Vám co nejdříve ozve s upřesněnou nabídkou.</p>
        <div style="margin-top:12px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;line-height:1.7">${summaryHtml}</div>
        ${priceBlock}
        <p style="color:#94a3b8;font-size:11px;margin-top:18px">Cena je orientační — finální nabídku připravíme po konzultaci a technickém upřesnění.</p>
      </div>`,
      text: summary,
    });
    return true;
  } catch (err) {
    console.error("confirmation email:", err);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS });
  }
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (req.method === "GET") {
      const token = new URL(req.url).searchParams.get("token") ?? "";
      const row = await findSettings(supabase, token);
      if (!row) return json({ ok: false, error: "Konfigurátor není dostupný nebo je vypnutý" }, 404);
      return json({ ok: true, ...publicConfigOf(row) });
    }

    if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

    const payload = await req.json().catch(() => null) as {
      token?: string;
      data?: Record<string, unknown>;
      pricing?: { total?: number; totalWithVat?: number; subsidyEstimate?: number; details?: unknown };
    } | null;
    if (!payload?.token || !payload.data) return json({ ok: false, error: "Neplatný požadavek" }, 400);

    const row = await findSettings(supabase, payload.token);
    if (!row) return json({ ok: false, error: "Konfigurátor není dostupný nebo je vypnutý" }, 404);

    const d = payload.data;
    const name = String(d.clientName ?? "").trim().slice(0, 200);
    const email = String(d.clientEmail ?? "").trim().slice(0, 200);
    const phone = String(d.clientPhone ?? "").trim().slice(0, 50);
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || d.gdprConsent !== true) {
      return json({ ok: false, error: "Vyplňte jméno, platný e-mail a souhlas se zpracováním údajů" }, 400);
    }

    // rate limit dle IP
    const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await supabase
      .from("public_config_log")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", hourAgo);
    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return json({ ok: false, error: "Příliš mnoho odeslání — zkuste to prosím později" }, 429);
    }
    await supabase.from("public_config_log").insert({ ip });

    const pricing = payload.pricing ?? {};
    const summary = summarize(d, pricing);

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .insert({
        organization_id: row.organization_id,
        name,
        email,
        phone,
        message: summary,
        source: "konfigurator",
        form_data: {
          typ: "verejny_konfigurator",
          region: d.clientRegion ?? "",
          configuration: d,
          pricing,
        },
      })
      .select("id")
      .single();
    if (leadErr) {
      console.error("lead insert:", leadErr.message);
      return json({ ok: false, error: "Uložení se nepodařilo, zkuste to prosím znovu" }, 500);
    }

    const pub = publicConfigOf(row);
    const emailSent = await sendConfirmationEmail(
      supabase, row.organization_id, name, email, summary,
      pub.show_result_prices, pricing,
    );

    return json({ ok: true, lead_id: lead?.id ?? null, email_sent: emailSent });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("public-configurator:", msg);
    return new Response(JSON.stringify({ ok: false, error: "Interní chyba" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
