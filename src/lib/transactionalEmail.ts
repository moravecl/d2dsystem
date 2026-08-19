import { supabase } from './supabase';

interface SmtpAccount {
  id: string;
  organization_id: string;
}

async function getDefaultSmtp(organizationId: string): Promise<SmtpAccount | null> {
  const { data } = await supabase
    .from('smtp_accounts')
    .select('id, organization_id')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('created_at')
    .limit(1)
    .maybeSingle();

  return data as SmtpAccount | null;
}

async function sendTransactional(params: {
  organizationId: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
}) {
  const smtp = await getDefaultSmtp(params.organizationId);
  if (!smtp) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      smtp_account_id: smtp.id,
      to_emails: params.to,
      subject: params.subject,
      body_html: params.html,
      body_text: params.text || '',
    }),
  });
}

export async function sendTeamInviteEmail(params: {
  organizationId: string;
  organizationName: string;
  inviterName: string;
  recipientEmail: string;
  role: string;
}) {
  const roleMap: Record<string, string> = {
    admin: 'Admin',
    manager: 'Manažer',
    employee: 'Zaměstnanec',
    viewer: 'Čtenář',
  };

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a;">Byli jste přidáni do týmu</h2>
      <p style="color: #475569;">
        <strong>${params.inviterName}</strong> vás přidal/a do organizace
        <strong>${params.organizationName}</strong> s rolí <strong>${roleMap[params.role] ?? params.role}</strong>.
      </p>
      <p style="color: #475569;">Přihlaste se do systému a začněte pracovat.</p>
      <a href="${window.location.origin}/login"
         style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px;">
        Přejít do systému
      </a>
      <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
        Pokud si nejste jistí proč jste tento email dostali, ignorujte ho.
      </p>
    </div>
  `;

  await sendTransactional({
    organizationId: params.organizationId,
    to: [params.recipientEmail],
    subject: `Byli jste přidáni do ${params.organizationName}`,
    html,
  });
}

export async function sendProjectCreatedEmail(params: {
  organizationId: string;
  projectName: string;
  creatorName: string;
  responsibleEmail?: string;
}) {
  if (!params.responsibleEmail) return;

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a;">Nový projekt přiřazen</h2>
      <p style="color: #475569;">
        <strong>${params.creatorName}</strong> vás označil/a jako zodpovědnou osobu za projekt
        <strong>${params.projectName}</strong>.
      </p>
      <a href="${window.location.origin}/projekty"
         style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px;">
        Zobrazit projekt
      </a>
    </div>
  `;

  await sendTransactional({
    organizationId: params.organizationId,
    to: [params.responsibleEmail],
    subject: `Nový projekt: ${params.projectName}`,
    html,
  });
}

export async function sendPasswordResetConfirmEmail(params: {
  organizationId: string;
  recipientEmail: string;
  recipientName: string;
}) {
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a;">Heslo bylo změněno</h2>
      <p style="color: #475569;">
        Heslo pro účet <strong>${params.recipientEmail}</strong> bylo právě změněno administrátorem.
      </p>
      <p style="color: #475569;">Pokud jste tuto změnu neočekávali, kontaktujte správce systému.</p>
      <a href="${window.location.origin}/login"
         style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px;">
        Přihlásit se
      </a>
    </div>
  `;

  await sendTransactional({
    organizationId: params.organizationId,
    to: [params.recipientEmail],
    subject: 'Vaše heslo bylo změněno',
    html,
  });
}

export async function sendWelcomeEmail(params: {
  organizationId: string;
  organizationName: string;
  recipientEmail: string;
  recipientName: string;
}) {
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a;">Vítejte v HouseSmart!</h2>
      <p style="color: #475569;">
        Vaše organizace <strong>${params.organizationName}</strong> je připravena k použití.
      </p>
      <p style="color: #475569;">Pro začátek doporučujeme:</p>
      <ul style="color: #475569;">
        <li>Vyplnit informace o firmě v <strong>Admin → Firma</strong></li>
        <li>Nastavit SMTP pro odesílání emailů v <strong>Admin → SMTP</strong></li>
        <li>Pozvat kolegy v <strong>Admin → Tým</strong></li>
        <li>Vytvořit první projekt v <strong>Projekty</strong></li>
      </ul>
      <a href="${window.location.origin}/dashboard"
         style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px;">
        Přejít do systému
      </a>
    </div>
  `;

  await sendTransactional({
    organizationId: params.organizationId,
    to: [params.recipientEmail],
    subject: `Vítejte v HouseSmart – ${params.organizationName} je připravena`,
    html,
  });
}
