import { supabase } from './supabase';
import type { CompanyInfo } from './invoiceUtils';

export interface QuoteClientInfo {
  name: string;
  address?: string;
  city?: string;
  zip?: string;
  email?: string;
  phone?: string;
  ico?: string;
  dic?: string;
  client_type?: string;
}

export interface QuoteCompanyInfo {
  company_name: string;
  address?: string;
  city?: string;
  zip?: string;
  phone?: string;
  email?: string;
  company_id?: string;
  tax_id?: string;
}

export async function loadQuoteClientInfo(projectId: string): Promise<QuoteClientInfo | null> {
  const { data } = await supabase
    .from('projects')
    .select('client_name, client_id, clients(name, address, city, email, phone, ico, dic, client_type)')
    .eq('id', projectId)
    .maybeSingle();

  if (!data) return null;

  const client = data.clients as unknown as QuoteClientInfo | null;
  if (client?.name) return client;

  if (data.client_name) return { name: data.client_name };

  return null;
}

export async function loadQuoteCompanyInfo(): Promise<QuoteCompanyInfo | null> {
  const { data } = await supabase
    .from('company_info')
    .select('company_name, address, city, zip, phone, email, company_id, tax_id')
    .limit(1)
    .maybeSingle();
  return data as QuoteCompanyInfo | null;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildQuoteHeaderHtml(
  company: QuoteCompanyInfo | null,
  client: QuoteClientInfo | null,
  accentColor = '#3b82f6'
): string {
  if (!company && !client) return '';

  const companyBlock = company
    ? `<div style="flex:1;min-width:200px;">
        <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:6px;">Dodavatel</div>
        <div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:4px;">${esc(company.company_name)}</div>
        ${company.address ? `<div style="font-size:10px;color:#475569;">${esc(company.address)}</div>` : ''}
        ${company.city || company.zip ? `<div style="font-size:10px;color:#475569;">${esc([company.zip, company.city].filter(Boolean).join(' '))}</div>` : ''}
        <div style="display:flex;gap:16px;margin-top:6px;flex-wrap:wrap;">
          ${company.company_id ? `<div style="font-size:9px;color:#64748b;"><span style="font-weight:700;">IC:</span> ${esc(company.company_id)}</div>` : ''}
          ${company.tax_id ? `<div style="font-size:9px;color:#64748b;"><span style="font-weight:700;">DIC:</span> ${esc(company.tax_id)}</div>` : ''}
        </div>
        <div style="display:flex;gap:16px;margin-top:3px;flex-wrap:wrap;">
          ${company.phone ? `<div style="font-size:9px;color:#64748b;">${esc(company.phone)}</div>` : ''}
          ${company.email ? `<div style="font-size:9px;color:#64748b;">${esc(company.email)}</div>` : ''}
        </div>
      </div>`
    : '';

  const clientTypeLabel = (t?: string) => {
    if (t === 'firma') return 'Firma';
    if (t === 'obec') return 'Obec';
    return '';
  };

  const clientBlock = client
    ? `<div style="flex:1;min-width:200px;">
        <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:6px;">Odberatel</div>
        <div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:4px;">${esc(client.name)}${client.client_type && client.client_type !== 'rd' ? ` <span style="font-size:9px;font-weight:600;color:#64748b;background:#f1f5f9;padding:1px 6px;border-radius:3px;">${clientTypeLabel(client.client_type)}</span>` : ''}</div>
        ${client.address ? `<div style="font-size:10px;color:#475569;">${esc(client.address)}</div>` : ''}
        ${client.city || client.zip ? `<div style="font-size:10px;color:#475569;">${esc([client.zip, client.city].filter(Boolean).join(' '))}</div>` : ''}
        <div style="display:flex;gap:16px;margin-top:6px;flex-wrap:wrap;">
          ${client.ico ? `<div style="font-size:9px;color:#64748b;"><span style="font-weight:700;">IC:</span> ${esc(client.ico)}</div>` : ''}
          ${client.dic ? `<div style="font-size:9px;color:#64748b;"><span style="font-weight:700;">DIC:</span> ${esc(client.dic)}</div>` : ''}
        </div>
        <div style="display:flex;gap:16px;margin-top:3px;flex-wrap:wrap;">
          ${client.phone ? `<div style="font-size:9px;color:#64748b;">${esc(client.phone)}</div>` : ''}
          ${client.email ? `<div style="font-size:9px;color:#64748b;">${esc(client.email)}</div>` : ''}
        </div>
      </div>`
    : '';

  return `<div style="display:flex;gap:24px;padding:16px 0;margin-bottom:16px;border-bottom:1px solid #e2e8f0;border-top:1px solid #e2e8f0;">
    ${companyBlock}
    ${companyBlock && clientBlock ? `<div style="width:1px;background:${accentColor};opacity:0.2;"></div>` : ''}
    ${clientBlock}
  </div>`;
}
