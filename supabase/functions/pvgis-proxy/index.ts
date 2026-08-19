import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PvgisRequest {
  lat: number;
  lon: number;
  peakpower: number;
  aspect: number;
  angle: number;
  loss?: number;
  mountingplace?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const params: PvgisRequest = await req.json();

    const url = new URL("https://re.jrc.ec.europa.eu/api/v5_2/PVcalc");
    url.searchParams.set("lat", params.lat.toFixed(4));
    url.searchParams.set("lon", params.lon.toFixed(4));
    url.searchParams.set("peakpower", params.peakpower.toFixed(3));
    url.searchParams.set("mountingplace", params.mountingplace ?? "building");
    url.searchParams.set("aspect", params.aspect.toFixed(1));
    url.searchParams.set("angle", params.angle.toFixed(1));
    url.searchParams.set("outputformat", "json");
    url.searchParams.set("loss", (params.loss ?? 14).toString());

    const pvgisResp = await fetch(url.toString());

    if (!pvgisResp.ok) {
      const errorText = await pvgisResp.text();
      return new Response(
        JSON.stringify({
          success: false,
          error: `PVGIS returned ${pvgisResp.status}: ${errorText.slice(0, 500)}`,
          requestUrl: url.toString(),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await pvgisResp.json();
    const monthly = data?.outputs?.monthly?.fixed;

    if (!Array.isArray(monthly) || monthly.length < 12) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid PVGIS response structure: monthly data missing or incomplete`,
          requestUrl: url.toString(),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const monthlyKwh = monthly.slice(0, 12).map((m: Record<string, number>) => m.E_m ?? 0);
    const annual = data?.outputs?.totals?.fixed?.E_y ?? monthlyKwh.reduce((s: number, v: number) => s + v, 0);

    return new Response(
      JSON.stringify({
        success: true,
        monthly: monthlyKwh,
        annual,
        requestUrl: url.toString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Proxy error: ${err instanceof Error ? err.message : "Unknown error"}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
