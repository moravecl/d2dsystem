import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const WEATHER_CODES: Record<number, string> = {
  0: "Jasno",
  1: "Prevazne jasno",
  2: "Polojasno",
  3: "Oblacno",
  45: "Mlha",
  48: "Namraza",
  51: "Mirne mrzeni",
  53: "Mrzeni",
  55: "Silne mrzeni",
  56: "Mrzni mrzeni",
  57: "Silne mrzni mrzeni",
  61: "Mirny dest",
  63: "Dest",
  65: "Silny dest",
  66: "Mrzni dest",
  67: "Silny mrzni dest",
  71: "Mirne snezeni",
  73: "Snezeni",
  75: "Silne snezeni",
  77: "Snehove zrno",
  80: "Mirne prehnanky",
  81: "Prehnanky",
  82: "Silne prehnanky",
  85: "Snehove prehnanky",
  86: "Silne snehove prehnanky",
  95: "Bourka",
  96: "Bourka s krupobitim",
  99: "Silna bourka s krupobitim",
};

interface GeoResult {
  latitude: number;
  longitude: number;
  name: string;
}

interface WeatherResponse {
  temperature_min: number;
  temperature_max: number;
  precipitation_sum: number;
  wind_speed_max: number;
  weather_code: number;
  weather_description: string;
}

async function geocodeAddress(address: string): Promise<GeoResult | null> {
  const candidates = [address];

  const parts = address.split(",").map((s: string) => s.trim());
  for (const part of parts) {
    const cleaned = part.replace(/\d+/g, "").trim();
    if (cleaned.length >= 3 && cleaned !== address) {
      candidates.push(cleaned);
    }
  }

  for (const query of candidates) {
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=cs`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      if (data.results && data.results.length > 0) {
        return {
          latitude: data.results[0].latitude,
          longitude: data.results[0].longitude,
          name: data.results[0].name,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

function parseWeatherDaily(data: Record<string, unknown>): WeatherResponse | null {
  const daily = data.daily as Record<string, unknown[]> | undefined;
  if (!daily || !daily.time || daily.time.length === 0) return null;

  const code = (daily.weather_code?.[0] as number) ?? 0;

  return {
    temperature_min: (daily.temperature_2m_min?.[0] as number) ?? 0,
    temperature_max: (daily.temperature_2m_max?.[0] as number) ?? 0,
    precipitation_sum: (daily.precipitation_sum?.[0] as number) ?? 0,
    wind_speed_max: (daily.wind_speed_10m_max?.[0] as number) ?? 0,
    weather_code: code,
    weather_description: WEATHER_CODES[code] || "Neznamo",
  };
}

const DAILY_PARAMS = "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max";

async function fetchWeather(
  lat: number,
  lon: number,
  date: string
): Promise<WeatherResponse | null> {
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&daily=${DAILY_PARAMS}&timezone=Europe/Prague&past_days=14`;

  try {
    const res = await fetch(forecastUrl);
    if (res.ok) {
      const data = await res.json();
      const result = parseWeatherDaily(data);
      if (result) return result;
    }
  } catch {
    // fall through to archive
  }

  const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&daily=${DAILY_PARAMS}&timezone=Europe/Prague`;

  try {
    const res = await fetch(archiveUrl);
    if (res.ok) {
      const data = await res.json();
      return parseWeatherDaily(data);
    }
  } catch {
    // return null
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { date, address, lat, lon } = body;

    if (!date) {
      return new Response(
        JSON.stringify({ error: "Chybí datum" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let latitude: number;
    let longitude: number;
    let locationName = "";

    if (typeof lat === "number" && typeof lon === "number") {
      latitude = lat;
      longitude = lon;
      locationName = address || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    } else if (address) {
      const geo = await geocodeAddress(address);
      if (!geo) {
        return new Response(
          JSON.stringify({ error: `Adresu nelze geokódovat: ${address}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      latitude = geo.latitude;
      longitude = geo.longitude;
      locationName = geo.name;
    } else {
      return new Response(
        JSON.stringify({ error: "Chybí souřadnice nebo adresa" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const weather = await fetchWeather(latitude, longitude, date);
    if (!weather) {
      return new Response(
        JSON.stringify({ error: `Počasí pro ${date} není k dispozici` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ...weather,
        location: locationName,
        coordinates: { lat: latitude, lon: longitude },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Interní chyba serveru", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
