import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { form_id, data, file_urls } = await req.json();

    if (!form_id || !data) {
      return new Response(
        JSON.stringify({ error: "Missing form_id or data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: form, error: formError } = await supabase
      .from("inquiry_forms")
      .select("id, organization_id, fields, is_active, form_type")
      .eq("id", form_id)
      .maybeSingle();

    if (formError || !form) {
      return new Response(
        JSON.stringify({ error: "Form not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!form.is_active) {
      return new Response(
        JSON.stringify({ error: "Form is inactive" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const name = data.name || data.jmeno || "";
    const email = data.email || data.e_mail || "";
    const phone = data.phone || data.telefon || "";
    const message = data.message || data.zprava || "";

    const enrichedData = { ...data };
    if (file_urls && typeof file_urls === "object") {
      for (const [key, url] of Object.entries(file_urls)) {
        enrichedData[`${key}_url`] = url;
      }
    }

    if (form.form_type === "service") {
      const titleParts = [name, email].filter(Boolean);
      const { error: insertError } = await supabase.from("service_tickets").insert({
        organization_id: form.organization_id,
        inquiry_form_id: form_id,
        title: `Formulář: ${titleParts.join(" - ") || "Nový požadavek"}`,
        description: message || "",
        status: "open",
        priority: "normal",
        reported_by_portal: false,
        form_data: enrichedData,
      });

      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Failed to save service ticket" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      const { error: insertError } = await supabase.from("leads").insert({
        organization_id: form.organization_id,
        inquiry_form_id: form_id,
        name,
        email,
        phone,
        message,
        source: "web_form",
        form_data: enrichedData,
        status: "new",
      });

      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Failed to save lead" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
