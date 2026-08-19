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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Chybi autorizace" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jwt = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(jwt);

    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Neplatny token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Pouze admin muze vytvaret ucty" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, displayName, clientId, isPortalClient, organizationId, orgRole } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Chybi email nebo password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Heslo musi mit alespon 6 znaku" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName || email },
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (newUser?.user) {
      if (isPortalClient === false && organizationId) {
        await adminClient
          .from("profiles")
          .update({
            organization_id: organizationId,
            role: "user",
            is_portal_client: false,
            display_name: displayName || null,
          })
          .eq("id", newUser.user.id);

        await adminClient.from("organization_members").insert({
          organization_id: organizationId,
          user_id: newUser.user.id,
          role: orgRole || "employee",
          invited_by: caller.id,
          invited_at: new Date().toISOString(),
          joined_at: new Date().toISOString(),
        });
      } else if (clientId) {
        await adminClient
          .from("profiles")
          .update({
            client_id: clientId,
            role: "client",
            is_portal_client: true,
            display_name: displayName || null,
          })
          .eq("id", newUser.user.id);

        await adminClient
          .from("clients")
          .update({ portal_user_id: newUser.user.id })
          .eq("id", clientId);
      }
    }

    return new Response(
      JSON.stringify({ success: true, userId: newUser?.user?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in create-portal-user:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Interni chyba serveru" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
