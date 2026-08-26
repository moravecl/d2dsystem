import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.8";

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

interface SendEmailPayload {
  smtp_account_id: string;
  template_id?: string;
  to_emails: string[];
  cc_emails?: string[];
  bcc_emails?: string[];
  subject: string;
  body_html: string;
  body_text?: string;
  project_id?: string;
  is_bulk?: boolean;
  bulk_batch_id?: string;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: SendEmailPayload = await req.json();

    const { data: smtpAccount, error: smtpError } = await supabase
      .from("smtp_accounts")
      .select("*")
      .eq("id", payload.smtp_account_id)
      .eq("is_active", true)
      .maybeSingle();

    if (smtpError || !smtpAccount) {
      return new Response(
        JSON.stringify({ error: "SMTP account not found or inactive" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Caller's org — used both for authorization and for the log row
    // (without organization_id the row is invisible to org-scoped RLS).
    const { data: callerMembership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    const callerOrgId = callerMembership?.organization_id ?? null;

    // Authorization: the SMTP account must belong to the caller's organization,
    // or be the shared platform account. Prevents using foreign orgs' SMTP as a relay.
    if (!smtpAccount.is_platform_default) {
      if (!smtpAccount.organization_id || smtpAccount.organization_id !== callerOrgId) {
        return new Response(
          JSON.stringify({ error: "SMTP account does not belong to your organization" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const logEntry = {
      smtp_account_id: payload.smtp_account_id,
      template_id: payload.template_id || null,
      organization_id: smtpAccount.organization_id ?? callerOrgId,
      sender_user_id: user.id,
      project_id: payload.project_id || null,
      from_email: smtpAccount.from_email,
      from_name: smtpAccount.from_name,
      to_emails: payload.to_emails,
      cc_emails: payload.cc_emails || [],
      bcc_emails: payload.bcc_emails || [],
      subject: payload.subject,
      body_html: payload.body_html,
      body_text: payload.body_text || "",
      status: "queued",
      is_bulk: payload.is_bulk || false,
      bulk_batch_id: payload.bulk_batch_id || null,
    };

    const { data: logRow, error: logError } = await supabase
      .from("email_log")
      .insert(logEntry)
      .select("id")
      .single();

    if (logError) {
      return new Response(
        JSON.stringify({ error: "Failed to create email log" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpAccount.host,
        port: smtpAccount.port,
        secure: smtpAccount.port === 465,
        auth: {
          user: smtpAccount.username,
          pass: smtpAccount.password_encrypted,
        },
        requireTLS: smtpAccount.use_tls === true,
      });

      await transporter.sendMail({
        from: smtpAccount.from_name
          ? `"${smtpAccount.from_name}" <${smtpAccount.from_email}>`
          : smtpAccount.from_email,
        to: payload.to_emails.join(", "),
        cc: payload.cc_emails?.length
          ? payload.cc_emails.join(", ")
          : undefined,
        bcc: payload.bcc_emails?.length
          ? payload.bcc_emails.join(", ")
          : undefined,
        subject: payload.subject,
        text: payload.body_text || "",
        html: payload.body_html,
      });

      await supabase
        .from("email_log")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", logRow.id);

      return new Response(
        JSON.stringify({ success: true, log_id: logRow.id }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (sendError: unknown) {
      const errMsg =
        sendError instanceof Error ? sendError.message : "Unknown SMTP error";

      await supabase
        .from("email_log")
        .update({ status: "failed", error_message: errMsg })
        .eq("id", logRow.id);

      return new Response(
        JSON.stringify({ error: "Failed to send email", detail: errMsg }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
