import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Save, Loader2, Copy, Package, Search, X,
  FileText, Receipt, ArrowDownCircle, CreditCard, FileCheck, Banknote, Info,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { useHeader } from '../../contexts/HeaderContext';
import {
  calcItemTotals, calcVatBreakdown, calcTotals,
  loadInvoiceSettings, loadCompanyInfo, generateInvoiceNumber,
  allocateInvoiceNumber, addDays, formatCZK,
  type InvoiceItem, type InvoiceSettings, type CompanyInfo,
} from '../../lib/invoiceUtils';
import {
  INVOICE_TYPES, INVOICE_TYPE_LABELS, INVOICE_TYPE_DESCRIPTIONS,
  INVOICE_TYPE_COLORS, INVOICE_TYPE_PRINT_TITLE, INVOICE_TYPES_CASH_ONLY,
  INVOICE_TYPES_REQUIRING_RELATED, type InvoiceType,
} from '../../lib/invoiceTypes';

interface ClientRef {
  id: string; name: string; ico: string; dic: string; address: string; city: string;
}
interface ProjectRef { id: string; project_name: string; client_id: string | null; }
interface CatalogProduct { id: string; name: string; code: string; price: number; brand: string; trade: string; }
interface InvoiceRef { id: string; invoice_number: string; client_name: string; total: number; invoice_type: string; }

const VAT_RATES = [0, 12, 21];
const UNITS = ['ks', 'hod', 'm', 'm2', 'm3', 'kg', 'kpl', 'den'];

const INVOICE_TYPE_OPTIONS: { value: InvoiceType; label: string; icon: typeof FileText; desc: string }[] = [
  { value: INVOICE_TYPES.STANDARD, label: 'Faktura', icon: FileText, desc: 'Běžná faktura za dodané zboží nebo služby' },
  { value: INVOICE_TYPES.DEPOSIT_INVOICE, label: 'Zálohová faktura', icon: ArrowDownCircle, desc: 'Faktura na zálohu před dodáním' },
  { value: INVOICE_TYPES.TAX_DOCUMENT, label: 'Daňový doklad k přijaté platbě', icon: Receipt, desc: 'Potvrzení přijaté zálohy pro DPH' },
  { value: INVOICE_TYPES.SETTLEMENT_INVOICE, label: 'Vyúčtovací faktura', icon: FileCheck, desc: 'Konečné vyúčtování s odečtením záloh' },
  { value: INVOICE_TYPES.CREDIT_NOTE, label: 'Dobropis', icon: CreditCard, desc: 'Opravný daňový doklad – snížení faktury' },
  { value: INVOICE_TYPES.CASH_RECEIPT, label: 'Pokladní doklad', icon: Banknote, desc: 'Příjem nebo výdej hotovosti z pokladny' },
];

const emptyItem = (order: number, vatRate: number): InvoiceItem => ({
  description: '', quantity: 1, unit: 'ks', unit_price: 0,
  total_price: 0, vat_rate: vatRate, vat_amount: 0, sort_order: order,
});

export default function InvoiceFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { setConfig } = useHeader();
  const isEdit = !!id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [invoiceRefs, setInvoiceRefs] = useState<InvoiceRef[]>([]);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>(INVOICE_TYPES.STANDARD);
  const [relatedInvoiceId, setRelatedInvoiceId] = useState('');
  const [depositPercent, setDepositPercent] = useState<number | ''>('');
  const [creditReason, setCreditReason] = useState('');
  const [autoNumber, setAutoNumber] = useState('');

  const [form, setForm] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    taxable_date: new Date().toISOString().split('T')[0],
    due_date: '',
    client_id: '',
    project_id: '',
    client_name: '', client_ico: '', client_dic: '', client_address: '',
    issuer_name: '', issuer_ico: '', issuer_dic: '', issuer_address: '',
    variable_symbol: '', constant_symbol: '0308',
    payment_method: 'bank_transfer',
    bank_account: '', iban: '',
    note: '', issued_by: '',
    quote_id: '',
  });

  const [items, setItems] = useState<InvoiceItem[]>([]);

  useEffect(() => {
    const typeLabel = INVOICE_TYPE_LABELS[invoiceType] || 'Faktura';
    setConfig({
      breadcrumbs: [
        { label: 'Finance', path: '/finance' },
        { label: isEdit ? `Upravit – ${typeLabel}` : `Nový doklad – ${typeLabel}` },
      ],
    });
  }, [setConfig, isEdit, invoiceType]);

  const initData = useCallback(async () => {
    const [settingsData, companyData, clientsRes, projectsRes, productsRes, invoicesRes] = await Promise.all([
      loadInvoiceSettings(),
      loadCompanyInfo(),
      supabase.from('clients').select('id, name, ico, dic, address, city').eq('is_active', true),
      supabase.from('projects').select('id, project_name, client_id').neq('status', 'cancelled'),
      supabase.from('products').select('id, name, code, price, brand, trade').eq('is_active', true).order('name'),
      supabase.from('invoices').select('id, invoice_number, client_name, total, invoice_type').in('status', ['sent', 'partial', 'paid']).order('invoice_date', { ascending: false }).limit(200),
    ]);
    setSettings(settingsData);
    setCompany(companyData);
    setClients((clientsRes.data || []) as ClientRef[]);
    setProjects((projectsRes.data || []) as ProjectRef[]);
    setCatalogProducts((productsRes.data || []) as CatalogProduct[]);
    setInvoiceRefs((invoicesRes.data || []) as InvoiceRef[]);

    if (isEdit) {
      const { data: inv } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle();
      if (inv) {
        setInvoiceType((inv.invoice_type as InvoiceType) || INVOICE_TYPES.STANDARD);
        setRelatedInvoiceId(inv.related_invoice_id || '');
        setDepositPercent(inv.deposit_percent ?? '');
        setCreditReason(inv.credit_reason || '');
        setForm({
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          taxable_date: inv.taxable_date,
          due_date: inv.due_date,
          client_id: inv.client_id || '',
          project_id: inv.project_id || '',
          client_name: inv.client_name, client_ico: inv.client_ico,
          client_dic: inv.client_dic, client_address: inv.client_address,
          issuer_name: inv.issuer_name, issuer_ico: inv.issuer_ico,
          issuer_dic: inv.issuer_dic, issuer_address: inv.issuer_address,
          variable_symbol: inv.variable_symbol, constant_symbol: inv.constant_symbol,
          payment_method: inv.payment_method,
          bank_account: inv.bank_account, iban: inv.iban,
          note: inv.note, issued_by: inv.issued_by,
          quote_id: inv.quote_id || '',
        });
        const { data: existingItems } = await supabase
          .from('invoice_items').select('*').eq('invoice_id', id).order('sort_order');
        if (existingItems?.length) setItems(existingItems as InvoiceItem[]);
      }
    } else {
      const typeParam = searchParams.get('type') as InvoiceType | null;
      const resolvedType = (typeParam && INVOICE_TYPE_LABELS[typeParam]) ? typeParam : INVOICE_TYPES.STANDARD;
      if (typeParam && INVOICE_TYPE_LABELS[typeParam]) setInvoiceType(typeParam);

      const relatedParam = searchParams.get('related');
      if (relatedParam) setRelatedInvoiceId(relatedParam);

      const defVat = settingsData?.default_vat_rate ?? 21;
      const invNum = settingsData ? generateInvoiceNumber(settingsData, resolvedType) : '';
      setAutoNumber(invNum);
      const dueDate = settingsData
        ? addDays(new Date().toISOString().split('T')[0], settingsData.default_due_days)
        : addDays(new Date().toISOString().split('T')[0], 14);

      setForm(prev => ({
        ...prev,
        invoice_number: invNum,
        variable_symbol: invNum.replace(/[^0-9]/g, ''),
        due_date: dueDate,
        payment_method: settingsData?.default_payment_method || 'bank_transfer',
        bank_account: companyData?.bank_account || '',
        iban: companyData?.iban || '',
        issuer_name: companyData?.company_name || '',
        issuer_ico: companyData?.company_id || '',
        issuer_dic: companyData?.tax_id || '',
        issuer_address: companyData ? `${companyData.address}, ${companyData.zip} ${companyData.city}` : '',
      }));
      setItems([emptyItem(0, defVat)]);

      if (relatedParam) {
        const { data: srcInv } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', relatedParam)
          .maybeSingle();

        if (srcInv) {
          setForm(prev => ({
            ...prev,
            client_id: srcInv.client_id || '',
            client_name: srcInv.client_name || '',
            client_ico: srcInv.client_ico || '',
            client_dic: srcInv.client_dic || '',
            client_address: srcInv.client_address || '',
            project_id: srcInv.project_id || '',
            issuer_name: srcInv.issuer_name || companyData?.company_name || '',
            issuer_ico: srcInv.issuer_ico || companyData?.company_id || '',
            issuer_dic: srcInv.issuer_dic || companyData?.tax_id || '',
            issuer_address: srcInv.issuer_address || (companyData ? `${companyData.address}, ${companyData.zip} ${companyData.city}` : ''),
            bank_account: srcInv.bank_account || companyData?.bank_account || '',
            iban: srcInv.iban || companyData?.iban || '',
            payment_method: resolvedType === INVOICE_TYPES.TAX_DOCUMENT ? 'bank_transfer' : (srcInv.payment_method || settingsData?.default_payment_method || 'bank_transfer'),
            note: srcInv.note || '',
            issued_by: srcInv.issued_by || '',
          }));

          if (resolvedType !== INVOICE_TYPES.TAX_DOCUMENT) {
            const { data: srcItems } = await supabase
              .from('invoice_items')
              .select('*')
              .eq('invoice_id', relatedParam)
              .order('sort_order');
            if (srcItems?.length) {
              setItems(srcItems.map((it, idx) => ({
                description: it.description,
                quantity: it.quantity,
                unit: it.unit,
                unit_price: it.unit_price,
                total_price: it.total_price,
                vat_rate: it.vat_rate,
                vat_amount: it.vat_amount,
                sort_order: idx,
                section_name: it.section_name || undefined,
              })));
            }
          } else {
            const todayStr = new Date().toISOString().split('T')[0];
            const invoiceTotal = srcInv.total || 0;
            const invoiceSubtotal = srcInv.subtotal || (invoiceTotal / (1 + defVat / 100));
            const unitPrice = Math.round(invoiceSubtotal * 100) / 100;
            const vatAmount = Math.round(unitPrice * (defVat / 100) * 100) / 100;
            const paidTotal = srcInv.paid_amount || invoiceTotal;
            const paidSubtotal = Math.round((paidTotal / (1 + defVat / 100)) * 100) / 100;
            const paidVat = Math.round(paidSubtotal * (defVat / 100) * 100) / 100;
            const invoiceDateLabel = srcInv.invoice_date
              ? new Date(srcInv.invoice_date).toLocaleDateString('cs-CZ')
              : '';
            setItems([
              {
                description: `Fakturovaná záloha dle zálohové faktury č. ${srcInv.invoice_number}`,
                quantity: 1,
                unit: 'kpl',
                unit_price: unitPrice,
                total_price: unitPrice,
                vat_rate: defVat,
                vat_amount: vatAmount,
                sort_order: 0,
              },
              {
                description: `Uhrazeno zálohou dne ${invoiceDateLabel} (faktura č. ${srcInv.invoice_number})`,
                quantity: 1,
                unit: 'kpl',
                unit_price: -paidSubtotal,
                total_price: -paidSubtotal,
                vat_rate: defVat,
                vat_amount: -paidVat,
                sort_order: 1,
              },
            ]);
            setForm(prev => ({ ...prev, taxable_date: todayStr }));
          }
        }
      }

      const quoteId = searchParams.get('quote');
      const prefillRaw = searchParams.get('prefill');
      const projectParam = searchParams.get('project');
      const clientParam = searchParams.get('client');
      const quickJobId = searchParams.get('qj');
      const serviceScheduleId = searchParams.get('ss');

      if (prefillRaw) {
        try {
          const parsed = JSON.parse(decodeURIComponent(prefillRaw));
          if (parsed.items?.length) setItems(parsed.items as InvoiceItem[]);
          if (parsed.note) setForm(prev => ({ ...prev, note: parsed.note }));
        } catch { /* ignore */ }
      }

      if (quoteId) {
        const { data: quote } = await supabase.from('quotes').select('id, project_id, total_price').eq('id', quoteId).maybeSingle();
        if (quote) {
          setForm(prev => ({ ...prev, quote_id: quote.id, project_id: quote.project_id || '' }));
          if (!prefillRaw) {
            setItems([{
              description: 'Dle schválené nabídky',
              quantity: 1, unit: 'kpl',
              unit_price: quote.total_price || 0,
              total_price: quote.total_price || 0,
              vat_rate: defVat,
              vat_amount: Math.round((quote.total_price || 0) * (defVat / 100) * 100) / 100,
              sort_order: 0,
            }]);
          }
        }
      }

      if (quickJobId) {
        const { data: qj } = await supabase
          .from('quick_jobs')
          .select('id, title, client_id, client_name, project_id, address, total_work_cost, total_material_cost, billing_status')
          .eq('id', quickJobId).maybeSingle();
        if (qj) {
          if (qj.billing_status === 'invoiced') {
            toast('Tato rychla zakazka jiz byla vyfakturovana', 'error');
            navigate('/finance');
            return;
          }
          if (qj.project_id) {
            setForm(prev => ({ ...prev, project_id: qj.project_id }));
            const proj = (projectsRes.data || []).find((p: ProjectRef) => p.id === qj.project_id);
            if (proj?.client_id) {
              const cl = (clientsRes.data || []).find((c: ClientRef) => c.id === proj.client_id);
              if (cl) {
                setForm(prev => ({
                  ...prev, client_id: cl.id, client_name: cl.name,
                  client_ico: cl.ico || '', client_dic: cl.dic || '',
                  client_address: [cl.address, cl.city].filter(Boolean).join(', '),
                }));
              }
            }
          }
          if (!qj.project_id && qj.client_id) {
            const cl = (clientsRes.data || []).find((c: ClientRef) => c.id === qj.client_id);
            if (cl) {
              setForm(prev => ({
                ...prev, client_id: cl.id, client_name: cl.name,
                client_ico: cl.ico || '', client_dic: cl.dic || '',
                client_address: [cl.address, cl.city].filter(Boolean).join(', '),
              }));
            } else if (qj.client_name) {
              setForm(prev => ({ ...prev, client_name: qj.client_name }));
            }
          } else if (!qj.project_id && qj.client_name) {
            setForm(prev => ({ ...prev, client_name: qj.client_name }));
          }

          setForm(prev => ({ ...prev, note: `Rychla zakazka: ${qj.title}${qj.address ? '\n' + qj.address : ''}` }));

          const [workRes, matRes] = await Promise.all([
            supabase.from('quick_job_work_entries').select('worker_name, hours, hourly_rate, description').eq('quick_job_id', quickJobId),
            supabase.from('quick_job_material_entries').select('material_name, quantity, unit, unit_price').eq('quick_job_id', quickJobId),
          ]);

          const invoiceItems: InvoiceItem[] = [];
          let sortIdx = 0;
          const workEntries = (workRes.data || []) as { worker_name: string; hours: number; hourly_rate: number; description: string }[];
          for (const w of workEntries) {
            const unitPrice = w.hourly_rate || 0;
            invoiceItems.push(calcItemTotals({
              description: `Montazni prace - ${w.worker_name}${w.description ? ': ' + w.description : ''}`,
              quantity: w.hours, unit: 'hod', unit_price: unitPrice,
              total_price: w.hours * unitPrice, vat_rate: defVat, vat_amount: 0, sort_order: sortIdx++,
            }));
          }
          const matEntries = (matRes.data || []) as { material_name: string; quantity: number; unit: string; unit_price: number }[];
          for (const m of matEntries) {
            invoiceItems.push(calcItemTotals({
              description: m.material_name, quantity: m.quantity, unit: m.unit || 'ks',
              unit_price: m.unit_price, total_price: m.quantity * m.unit_price, vat_rate: defVat, vat_amount: 0, sort_order: sortIdx++,
            }));
          }
          if (invoiceItems.length > 0) setItems(invoiceItems);
        }
      }

      if (serviceScheduleId) {
        const { data: ss } = await supabase
          .from('service_schedules')
          .select(`
            id, service_type_id, client_name, client_address, client_phone, client_email, client_ico, client_dic, project_id,
            agreed_price, final_price, price_change_note, billing_status,
            service_types (id, name),
            projects (id, project_name, client_id)
          `)
          .eq('id', serviceScheduleId).maybeSingle();
        if (ss) {
          if (ss.billing_status === 'invoiced') {
            toast('Tento servis jiz byl vyfakturovan', 'error');
            navigate('/finance');
            return;
          }
          let clientId = '';
          let clientName = ss.client_name || '';
          let clientIco = ss.client_ico || '';
          let clientDic = ss.client_dic || '';
          let clientAddress = ss.client_address || '';

          if (ss.project_id && ss.projects) {
            const proj = ss.projects as { id: string; project_name: string; client_id: string | null };
            setForm(prev => ({ ...prev, project_id: proj.id }));
            if (proj.client_id) {
              const cl = (clientsRes.data || []).find((c: ClientRef) => c.id === proj.client_id);
              if (cl) {
                clientId = cl.id;
                clientName = cl.name;
                clientIco = cl.ico || '';
                clientDic = cl.dic || '';
                clientAddress = [cl.address, cl.city].filter(Boolean).join(', ');
              }
            }
          }

          const typeName = (ss.service_types as { id: string; name: string } | null)?.name || 'Servis';

          setForm(prev => ({
            ...prev,
            client_id: clientId,
            client_name: clientName,
            client_ico: clientIco,
            client_dic: clientDic,
            client_address: clientAddress,
            note: `Servis: ${typeName}${ss.client_address ? '\n' + ss.client_address : ''}${ss.client_phone ? '\nTel: ' + ss.client_phone : ''}${ss.price_change_note ? '\nPoznamka k cene: ' + ss.price_change_note : ''}`,
          }));

          const { data: reportData } = await supabase
            .from('service_reports')
            .select('id, travel_km, travel_rate')
            .eq('schedule_id', serviceScheduleId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const invoiceItems: InvoiceItem[] = [];
          let sortIdx = 0;

          if (reportData?.id) {
            const { data: reportItems } = await supabase
              .from('service_report_items')
              .select('item_type, description, quantity, unit, unit_price, total_price, worker_name, hours, hourly_rate, work_date')
              .eq('report_id', reportData.id)
              .order('sort_order');

            if (reportItems?.length) {
              reportItems.forEach((item: any) => {
                if (item.item_type === 'work') {
                  const qty = item.hours || item.quantity || 0;
                  const price = item.hourly_rate || item.unit_price || 0;
                  if (qty > 0 && price > 0) {
                    invoiceItems.push(calcItemTotals({
                      description: `Prace: ${item.worker_name || 'Technik'}${item.description ? ' - ' + item.description : ''}${item.work_date ? ' (' + new Date(item.work_date).toLocaleDateString('cs-CZ') + ')' : ''}`,
                      quantity: qty, unit: 'hod', unit_price: price,
                      total_price: qty * price, vat_rate: defVat, vat_amount: 0, sort_order: sortIdx++,
                    }));
                  }
                } else if (item.item_type === 'material') {
                  const qty = item.quantity || 0;
                  const price = item.unit_price || 0;
                  if (qty > 0 && price > 0) {
                    invoiceItems.push(calcItemTotals({
                      description: item.description || 'Material', quantity: qty, unit: item.unit || 'ks',
                      unit_price: price, total_price: qty * price, vat_rate: defVat, vat_amount: 0, sort_order: sortIdx++,
                    }));
                  }
                } else if (item.item_type === 'travel') {
                  const qty = item.quantity || 0;
                  const price = item.unit_price || 0;
                  if (qty > 0 && price > 0) {
                    invoiceItems.push(calcItemTotals({
                      description: item.description || 'Doprava', quantity: qty, unit: item.unit || 'km',
                      unit_price: price, total_price: qty * price, vat_rate: defVat, vat_amount: 0, sort_order: sortIdx++,
                    }));
                  }
                } else if (item.item_type === 'other') {
                  const qty = item.quantity || 0;
                  const price = item.unit_price || 0;
                  if (qty > 0 && price > 0) {
                    invoiceItems.push(calcItemTotals({
                      description: item.description || 'Ostatni', quantity: qty, unit: item.unit || 'ks',
                      unit_price: price, total_price: qty * price, vat_rate: defVat, vat_amount: 0, sort_order: sortIdx++,
                    }));
                  }
                }
              });
            }

            if (reportData.travel_km > 0 && reportData.travel_rate > 0) {
              const existingTravelIdx = invoiceItems.findIndex(i => i.description?.includes('Doprava'));
              if (existingTravelIdx === -1) {
                invoiceItems.push(calcItemTotals({
                  description: 'Doprava', quantity: reportData.travel_km, unit: 'km',
                  unit_price: reportData.travel_rate, total_price: reportData.travel_km * reportData.travel_rate,
                  vat_rate: defVat, vat_amount: 0, sort_order: sortIdx++,
                }));
              }
            }
          }

          if (invoiceItems.length === 0) {
            const price = ss.final_price ?? ss.agreed_price ?? 0;
            if (price > 0) {
              invoiceItems.push(calcItemTotals({
                description: `Servisni prace: ${typeName}`,
                quantity: 1, unit: 'kpl', unit_price: price,
                total_price: price, vat_rate: defVat, vat_amount: 0, sort_order: 0,
              }));
            }
          }

          if (invoiceItems.length > 0) setItems(invoiceItems);
        }
      }

      if (!quickJobId && !serviceScheduleId && projectParam) {
        const proj = (projectsRes.data || []).find((p: ProjectRef) => p.id === projectParam);
        if (proj) {
          setForm(prev => ({ ...prev, project_id: proj.id }));
          if (proj.client_id) {
            const cl = (clientsRes.data || []).find((c: ClientRef) => c.id === proj.client_id);
            if (cl) {
              setForm(prev => ({
                ...prev, client_id: cl.id, client_name: cl.name,
                client_ico: cl.ico || '', client_dic: cl.dic || '',
                client_address: [cl.address, cl.city].filter(Boolean).join(', '),
              }));
            }
          }
        }
      } else if (!quickJobId && !serviceScheduleId && clientParam) {
        const cl = (clientsRes.data || []).find((c: ClientRef) => c.id === clientParam);
        if (cl) {
          setForm(prev => ({
            ...prev, client_id: cl.id, client_name: cl.name,
            client_ico: cl.ico || '', client_dic: cl.dic || '',
            client_address: [cl.address, cl.city].filter(Boolean).join(', '),
          }));
        }
      }
    }
    setLoading(false);
  }, [id, isEdit, searchParams]);

  useEffect(() => { initData(); }, [initData]);

  useEffect(() => {
    if (INVOICE_TYPES_CASH_ONLY.includes(invoiceType as typeof INVOICE_TYPES_CASH_ONLY[number])) {
      setForm(prev => ({ ...prev, payment_method: 'cash' }));
    }
  }, [invoiceType]);

  const selectClient = (clientId: string) => {
    const c = clients.find(cl => cl.id === clientId);
    if (c) {
      setForm(prev => ({
        ...prev, client_id: c.id, client_name: c.name,
        client_ico: c.ico || '', client_dic: c.dic || '',
        client_address: [c.address, c.city].filter(Boolean).join(', '),
      }));
    } else {
      setForm(prev => ({ ...prev, client_id: '', client_name: '', client_ico: '', client_dic: '', client_address: '' }));
    }
  };

  const selectProject = (projectId: string) => {
    setForm(prev => ({ ...prev, project_id: projectId }));
    const proj = projects.find(p => p.id === projectId);
    if (proj?.client_id && !form.client_id) selectClient(proj.client_id);
  };

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    setItems(prev => prev.map((it, i) => i !== idx ? it : calcItemTotals({ ...it, ...patch })));
  };

  const addItem = () => {
    setItems(prev => [...prev, emptyItem(prev.length, settings?.default_vat_rate ?? 21)]);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sort_order: i })));
  };

  const addFromCatalog = (product: CatalogProduct) => {
    const defVat = settings?.default_vat_rate ?? 21;
    setItems(prev => [...prev, calcItemTotals({
      description: `${product.name}${product.code ? ` (${product.code})` : ''}`,
      quantity: 1, unit: 'ks', unit_price: product.price || 0,
      total_price: 0, vat_rate: defVat, vat_amount: 0, sort_order: prev.length,
    })]);
    setShowCatalog(false);
    setCatalogSearch('');
  };

  const filteredCatalog = catalogProducts.filter(p => {
    if (!catalogSearch) return true;
    const s = catalogSearch.toLowerCase();
    return p.name.toLowerCase().includes(s) || (p.code || '').toLowerCase().includes(s) || (p.brand || '').toLowerCase().includes(s);
  });

  const { subtotal, taxTotal, total } = calcTotals(items);
  const vatBreakdown = calcVatBreakdown(items);

  const relatedInvoiceTotal = relatedInvoiceId
    ? invoiceRefs.find(r => r.id === relatedInvoiceId)?.total ?? 0
    : 0;

  const settlementDeductionAmount = invoiceType === INVOICE_TYPES.SETTLEMENT_INVOICE && relatedInvoiceId
    ? relatedInvoiceTotal : 0;

  const finalTotal = invoiceType === INVOICE_TYPES.SETTLEMENT_INVOICE
    ? total - settlementDeductionAmount : total;

  const requiresRelated = INVOICE_TYPES_REQUIRING_RELATED.includes(invoiceType as typeof INVOICE_TYPES_REQUIRING_RELATED[number]);

  const handleSave = async (asDraft = true) => {
    if (!form.invoice_number.trim()) { toast('Zadejte číslo faktury', 'error'); return; }
    if (items.length === 0 || items.every(i => !i.description.trim())) {
      toast('Přidejte alespoň jednu položku', 'error'); return;
    }
    if (requiresRelated && !relatedInvoiceId) {
      toast('Vyberte původní fakturu/zálohu', 'error'); return;
    }
    setSaving(true);

    // B2: při vytváření nového dokladu s automatickým číslem přidělí číslo
    // atomicky databáze (row lock) — dva uživatelé nedostanou stejné číslo.
    let finalInvoiceNumber = form.invoice_number;
    let finalVariableSymbol = form.variable_symbol;
    if (!isEdit && settings && form.invoice_number === autoNumber) {
      const allocated = await allocateInvoiceNumber(invoiceType);
      if (allocated) {
        finalInvoiceNumber = allocated;
        if (form.variable_symbol === autoNumber.replace(/[^0-9]/g, '')) {
          finalVariableSymbol = allocated.replace(/[^0-9]/g, '');
        }
      }
    }

    const payload: Record<string, unknown> = {
      invoice_number: finalInvoiceNumber,
      invoice_date: form.invoice_date,
      taxable_date: form.taxable_date,
      due_date: form.due_date || null,
      client_id: form.client_id || null,
      project_id: form.project_id || null,
      client_name: form.client_name,
      client_ico: form.client_ico,
      client_dic: form.client_dic,
      client_address: form.client_address,
      issuer_name: form.issuer_name,
      issuer_ico: form.issuer_ico,
      issuer_dic: form.issuer_dic,
      issuer_address: form.issuer_address,
      variable_symbol: finalVariableSymbol,
      constant_symbol: form.constant_symbol,
      payment_method: form.payment_method,
      bank_account: form.bank_account,
      iban: form.iban,
      note: form.note,
      issued_by: form.issued_by,
      quote_id: form.quote_id || null,
      invoice_type: invoiceType,
      related_invoice_id: relatedInvoiceId || null,
      deposit_percent: depositPercent !== '' ? depositPercent : null,
      credit_reason: creditReason || null,
      subtotal,
      tax_amount: taxTotal,
      amount: total,
      total,
      status: asDraft ? 'draft' : 'sent',
      currency: 'CZK',
      updated_at: new Date().toISOString(),
    };

    let invoiceId = id;

    if (isEdit) {
      const { error } = await supabase.from('invoices').update(payload).eq('id', id);
      if (error) { toast('Chyba při ukládání', 'error'); setSaving(false); return; }
      await supabase.from('invoice_items').delete().eq('invoice_id', id);
    } else {
      const { data, error } = await supabase.from('invoices')
        .insert({ ...payload, created_by: user!.id })
        .select('id').single();
      if (error || !data) { toast('Chyba při vytváření', 'error'); setSaving(false); return; }
      invoiceId = data.id;
      // Čítač posunula atomicky DB funkce allocate_invoice_number (viz výše).

      if (relatedInvoiceId && (invoiceType === INVOICE_TYPES.SETTLEMENT_INVOICE || invoiceType === INVOICE_TYPES.TAX_DOCUMENT)) {
        await supabase.from('invoice_document_links').insert({
          source_invoice_id: relatedInvoiceId,
          target_invoice_id: invoiceId,
          link_type: invoiceType === INVOICE_TYPES.TAX_DOCUMENT ? 'deposit_to_tax_doc' : 'deposit_to_settlement',
          deposit_amount_used: relatedInvoiceTotal || null,
        });
      }
      if (relatedInvoiceId && invoiceType === INVOICE_TYPES.CREDIT_NOTE) {
        await supabase.from('invoice_document_links').insert({
          source_invoice_id: relatedInvoiceId,
          target_invoice_id: invoiceId,
          link_type: 'original_to_credit',
        });
      }

      const ssParam = searchParams.get('ss');
      if (ssParam) {
        await supabase.from('service_schedules')
          .update({ billing_status: 'invoiced', updated_at: new Date().toISOString() })
          .eq('id', ssParam);
      }

      const qjParam = searchParams.get('qj');
      if (qjParam) {
        await supabase.from('quick_jobs')
          .update({ billing_status: 'invoiced', updated_at: new Date().toISOString() })
          .eq('id', qjParam);
      }
    }

    const itemsPayload = items
      .filter(i => i.description.trim())
      .map((it, idx) => ({
        invoice_id: invoiceId,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        total_price: it.total_price,
        vat_rate: it.vat_rate,
        vat_amount: it.vat_amount,
        sort_order: idx,
        section_name: it.section_name || null,
      }));

    if (itemsPayload.length > 0) {
      await supabase.from('invoice_items').insert(itemsPayload);
    }

    setSaving(false);
    toast(isEdit ? 'Doklad uložen' : 'Doklad vytvořen');
    navigate(`/finance/faktura/${invoiceId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition';
  const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1';
  const typeColors = INVOICE_TYPE_COLORS[invoiceType];
  const titleLabel = INVOICE_TYPE_PRINT_TITLE[invoiceType] || 'FAKTURA';

  const relatedLabel = invoiceType === INVOICE_TYPES.CREDIT_NOTE ? 'Původní faktura (k opravě)'
    : invoiceType === INVOICE_TYPES.TAX_DOCUMENT ? 'Zálohová faktura (záloha přijata)'
    : invoiceType === INVOICE_TYPES.SETTLEMENT_INVOICE ? 'Záloha k odečtení'
    : 'Původní doklad';

  const relatedFilteredRefs = invoiceType === INVOICE_TYPES.SETTLEMENT_INVOICE || invoiceType === INVOICE_TYPES.TAX_DOCUMENT
    ? invoiceRefs.filter(r => r.invoice_type === 'deposit_invoice' || r.invoice_type === 'standard')
    : invoiceRefs;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/finance')} className="p-2 rounded-xl hover:bg-white/[0.06] transition">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-white">
            {isEdit ? `Upravit – ${form.invoice_number}` : 'Nový daňový doklad'}
          </h1>
          <p className={`text-xs font-bold mt-0.5 ${typeColors.text}`}>{titleLabel}</p>
        </div>
      </div>

      {!isEdit && (
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Typ dokladu</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {INVOICE_TYPE_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const selected = invoiceType === opt.value;
              const colors = INVOICE_TYPE_COLORS[opt.value];
              return (
                <button
                  key={opt.value}
                  onClick={() => setInvoiceType(opt.value)}
                  title={opt.desc}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition ${
                    selected
                      ? `${colors.bg} ${colors.border} ${colors.text}`
                      : 'border-white/[0.06] text-slate-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[11px] font-bold leading-tight">{opt.label}</span>
                </button>
              );
            })}
          </div>
          {INVOICE_TYPE_DESCRIPTIONS[invoiceType] && (
            <div className={`mt-3 flex items-start gap-2 p-3 rounded-lg ${typeColors.bg} ${typeColors.border} border`}>
              <Info className={`w-4 h-4 shrink-0 mt-0.5 ${typeColors.text}`} />
              <p className={`text-xs ${typeColors.text}`}>{INVOICE_TYPE_DESCRIPTIONS[invoiceType]}</p>
            </div>
          )}
        </div>
      )}

      {requiresRelated && (
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 space-y-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Vazba na doklad</h2>
          <div>
            <label className={labelCls}>{relatedLabel} *</label>
            <select
              value={relatedInvoiceId}
              onChange={e => setRelatedInvoiceId(e.target.value)}
              className={inputCls}
            >
              <option value="">-- Vyberte fakturu --</option>
              {relatedFilteredRefs.map(r => (
                <option key={r.id} value={r.id}>
                  {r.invoice_number} – {r.client_name} ({formatCZK(r.total)} Kč)
                </option>
              ))}
            </select>
          </div>
          {invoiceType === INVOICE_TYPES.CREDIT_NOTE && (
            <div>
              <label className={labelCls}>Důvod dobropisu</label>
              <input
                value={creditReason}
                onChange={e => setCreditReason(e.target.value)}
                placeholder="Např. storno objednávky, vrácení zboží..."
                className={inputCls}
              />
            </div>
          )}
          {invoiceType === INVOICE_TYPES.SETTLEMENT_INVOICE && relatedInvoiceId && relatedInvoiceTotal > 0 && (
            <div className={`p-3 rounded-lg ${typeColors.bg} border ${typeColors.border}`}>
              <p className={`text-xs font-semibold ${typeColors.text}`}>
                Záloha {formatCZK(relatedInvoiceTotal)} Kč bude automaticky odečtena od celkové částky.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Základní údaje</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>Číslo dokladu</label>
                <input value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Datum vystavení</label>
                <input type="date" value={form.invoice_date} onChange={e => setForm(p => ({ ...p, invoice_date: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>DUZP</label>
                <input type="date" value={form.taxable_date} onChange={e => setForm(p => ({ ...p, taxable_date: e.target.value }))} className={inputCls} />
              </div>
              {invoiceType !== INVOICE_TYPES.CASH_RECEIPT && (
                <div>
                  <label className={labelCls}>Splatnost</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className={inputCls} />
                </div>
              )}
              {invoiceType === INVOICE_TYPES.DEPOSIT_INVOICE && (
                <div>
                  <label className={labelCls}>Záloha (%)</label>
                  <input
                    type="number" min={1} max={100} step={1}
                    value={depositPercent}
                    onChange={e => setDepositPercent(e.target.value ? parseFloat(e.target.value) : '')}
                    placeholder="Např. 50"
                    className={inputCls}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 space-y-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Odběratel</h2>
              <div>
                <label className={labelCls}>Vybrat klienta</label>
                <select value={form.client_id} onChange={e => selectClient(e.target.value)} className={inputCls}>
                  <option value="">-- Vyberte --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Název / Jméno</label>
                <input value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>IČO</label><input value={form.client_ico} onChange={e => setForm(p => ({ ...p, client_ico: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>DIČ</label><input value={form.client_dic} onChange={e => setForm(p => ({ ...p, client_dic: e.target.value }))} className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Adresa</label><input value={form.client_address} onChange={e => setForm(p => ({ ...p, client_address: e.target.value }))} className={inputCls} /></div>
            </div>

            <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 space-y-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Dodavatel</h2>
              <div><label className={labelCls}>Název firmy</label><input value={form.issuer_name} onChange={e => setForm(p => ({ ...p, issuer_name: e.target.value }))} className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>IČO</label><input value={form.issuer_ico} onChange={e => setForm(p => ({ ...p, issuer_ico: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>DIČ</label><input value={form.issuer_dic} onChange={e => setForm(p => ({ ...p, issuer_dic: e.target.value }))} className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Adresa</label><input value={form.issuer_address} onChange={e => setForm(p => ({ ...p, issuer_address: e.target.value }))} className={inputCls} /></div>
            </div>
          </div>

          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Položky dokladu</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button onClick={() => setShowCatalog(!showCatalog)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition">
                    <Package className="w-3.5 h-3.5" /> Z ceníku
                  </button>
                  {showCatalog && (
                    <div className="absolute right-0 top-full mt-1 w-96 bg-navy-800/60 rounded-xl border border-white/[0.08] shadow-xl z-50">
                      <div className="p-3 border-b border-white/[0.06] flex items-center gap-2">
                        <Search className="w-4 h-4 text-slate-400 shrink-0" />
                        <input
                          autoFocus value={catalogSearch}
                          onChange={e => setCatalogSearch(e.target.value)}
                          placeholder="Hledat v ceníku..."
                          className="flex-1 text-sm outline-none"
                        />
                        <button onClick={() => { setShowCatalog(false); setCatalogSearch(''); }} className="p-0.5 rounded hover:bg-white/[0.06]">
                          <X className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {filteredCatalog.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400">Žádné položky</div>
                        ) : (
                          filteredCatalog.slice(0, 50).map(p => (
                            <button key={p.id} onClick={() => addFromCatalog(p)}
                              className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] transition flex items-center justify-between gap-3 border-b border-slate-50 last:border-0"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-white truncate">{p.name}</div>
                                <div className="text-[10px] text-slate-400">{[p.code, p.brand, p.trade].filter(Boolean).join(' / ')}</div>
                              </div>
                              <div className="text-sm font-bold text-slate-300 shrink-0 tabular-nums">{formatCZK(p.price || 0)} Kč</div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={addItem} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition">
                  <Plus className="w-3.5 h-3.5" /> Prázdná řádka
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/[0.06]">
                    <th className="pb-2 pr-2 w-[40%]">Popis</th>
                    <th className="pb-2 pr-2 w-16 text-right">Množství</th>
                    <th className="pb-2 pr-2 w-16">Jednotka</th>
                    <th className="pb-2 pr-2 w-24 text-right">Cena/j.</th>
                    <th className="pb-2 pr-2 w-16 text-right">DPH %</th>
                    <th className="pb-2 pr-2 w-24 text-right">Celkem</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {items.map((item, idx) => (
                    <tr key={idx} className="group">
                      <td className="py-2 pr-2">
                        <input value={item.description} onChange={e => updateItem(idx, { description: e.target.value })} placeholder="Popis položky..." className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-white/10 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 text-sm outline-none transition" />
                      </td>
                      <td className="py-2 pr-2">
                        <input type="number" min={0} step="0.01" value={item.quantity} onChange={e => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-white/10 focus:border-blue-500/50 text-sm text-right outline-none transition" />
                      </td>
                      <td className="py-2 pr-2">
                        <select value={item.unit} onChange={e => updateItem(idx, { unit: e.target.value })} className="w-full px-1 py-1.5 rounded-lg border border-transparent hover:border-white/10 focus:border-blue-500/50 text-sm outline-none transition bg-transparent">
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <input type="number" min={0} step="0.01" value={item.unit_price} onChange={e => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-white/10 focus:border-blue-500/50 text-sm text-right outline-none transition" />
                      </td>
                      <td className="py-2 pr-2">
                        <select value={item.vat_rate} onChange={e => updateItem(idx, { vat_rate: parseFloat(e.target.value) })} className="w-full px-1 py-1.5 rounded-lg border border-transparent hover:border-white/10 focus:border-blue-500/50 text-sm text-right outline-none transition bg-transparent">
                          {VAT_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-2 text-right font-semibold text-white tabular-nums">
                        {formatCZK(item.total_price)} Kč
                      </td>
                      <td className="py-2">
                        {items.length > 1 && (
                          <button onClick={() => removeItem(idx)} className="p-1 rounded-lg text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <div className="w-72 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Základ</span>
                  <span className="font-semibold tabular-nums">{formatCZK(subtotal)} Kč</span>
                </div>
                {vatBreakdown.map(vb => (
                  <div key={vb.rate} className="flex justify-between text-slate-500">
                    <span>DPH {vb.rate}%</span>
                    <span className="font-semibold tabular-nums">{formatCZK(vb.vat)} Kč</span>
                  </div>
                ))}
                <div className="flex justify-between text-slate-400">
                  <span>Mezisoučet</span>
                  <span className="font-semibold tabular-nums">{formatCZK(total)} Kč</span>
                </div>
                {invoiceType === INVOICE_TYPES.SETTLEMENT_INVOICE && settlementDeductionAmount > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Záloha (odečtení)</span>
                    <span className="font-semibold tabular-nums">- {formatCZK(settlementDeductionAmount)} Kč</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-white/10 text-base font-extrabold text-white">
                  <span>K úhradě</span>
                  <span className="tabular-nums">{formatCZK(Math.max(0, finalTotal))} Kč</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 space-y-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Platba</h2>
            <div>
              <label className={labelCls}>Způsob platby</label>
              <select
                value={form.payment_method}
                onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}
                className={inputCls}
                disabled={INVOICE_TYPES_CASH_ONLY.includes(invoiceType as typeof INVOICE_TYPES_CASH_ONLY[number])}
              >
                <option value="bank_transfer">Bankovní převod</option>
                <option value="cash">Hotovost</option>
                <option value="card">Kartou</option>
              </select>
            </div>
            {form.payment_method === 'bank_transfer' && (
              <>
                <div><label className={labelCls}>Číslo účtu</label><input value={form.bank_account} onChange={e => setForm(p => ({ ...p, bank_account: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>IBAN</label><input value={form.iban} onChange={e => setForm(p => ({ ...p, iban: e.target.value }))} className={inputCls} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>VS</label><input value={form.variable_symbol} onChange={e => setForm(p => ({ ...p, variable_symbol: e.target.value }))} className={inputCls} /></div>
                  <div><label className={labelCls}>KS</label><input value={form.constant_symbol} onChange={e => setForm(p => ({ ...p, constant_symbol: e.target.value }))} className={inputCls} /></div>
                </div>
              </>
            )}
          </div>

          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 space-y-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Další</h2>
            <div>
              <label className={labelCls}>Projekt</label>
              <select value={form.project_id} onChange={e => selectProject(e.target.value)} className={inputCls}>
                <option value="">-- Bez projektu --</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Vystavil/a</label><input value={form.issued_by} onChange={e => setForm(p => ({ ...p, issued_by: e.target.value }))} className={inputCls} /></div>
            <div><label className={labelCls}>Poznámka</label><textarea rows={3} value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} className={inputCls} /></div>
          </div>

          <div className="flex flex-col gap-2">
            <button onClick={() => handleSave(false)} disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEdit ? 'Uložit změny' : `Vystavit ${INVOICE_TYPE_LABELS[invoiceType] || 'doklad'}`}
            </button>
            <button onClick={() => handleSave(true)} disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/[0.06] text-slate-300 font-semibold rounded-xl hover:bg-white/[0.08] transition disabled:opacity-50">
              <Copy className="w-4 h-4" />
              Uložit jako koncept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
