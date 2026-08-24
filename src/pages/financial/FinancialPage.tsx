import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, DollarSign, CheckCircle2, AlertCircle, Clock, Download, Search, Eye, FileText, PenLine, Trash2, CreditCard as Edit2, TrendingUp, TrendingDown, Zap, ChevronDown, ArrowDownCircle, Receipt, FileCheck, Banknote, CreditCard } from 'lucide-react';
import SortControl, { sortItems, type SortDir } from '../../components/ui/SortControl';
import { useHeader } from '../../contexts/HeaderContext';
import { supabase } from '../../lib/supabase';
import { downloadCsv } from '../../lib/csvExport';
import { formatCZK, formatDate } from '../../lib/invoiceUtils';
import Tabs from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import ManualEntryModal, { type FinancialEntry } from '../../components/financial/ManualEntryModal';
import BillingQuickJobsTab from '../../components/financial/BillingQuickJobsTab';
import { INVOICE_TYPES, INVOICE_TYPE_COLORS, INVOICE_TYPE_SHORT_LABELS } from '../../lib/invoiceTypes';

const FOLLOWUP_DOC: Record<string, { type: string; label: string }> = {
  [INVOICE_TYPES.DEPOSIT_INVOICE]: { type: INVOICE_TYPES.TAX_DOCUMENT, label: 'Daňový doklad' },
  [INVOICE_TYPES.TAX_DOCUMENT]: { type: INVOICE_TYPES.SETTLEMENT_INVOICE, label: 'Vyúčtovací faktura' },
  [INVOICE_TYPES.STANDARD]: { type: INVOICE_TYPES.CREDIT_NOTE, label: 'Dobropis' },
};

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total: number;
  subtotal: number;
  tax_amount: number;
  client_name: string;
  client_id: string | null;
  project_id: string | null;
  paid_at: string | null;
  invoice_type: string;
}

interface ProjectRef { id: string; project_name: string; }

interface BillingQuickJob {
  id: string;
  title: string;
  client_name: string;
  client_id: string | null;
  project_id: string | null;
  address: string;
  completed_at: string;
  billing_status: string;
  total_work_hours: number;
  total_work_cost: number;
  total_material_cost: number;
}

interface BillingServiceSchedule {
  id: string;
  type_name: string;
  client_name: string;
  client_address: string;
  project_id: string | null;
  project_name: string;
  last_completed_date: string | null;
  agreed_price: number | null;
  final_price: number | null;
  billing_status: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Koncept', color: 'text-slate-400', bg: 'bg-white/[0.06]/[0.08]' },
  sent: { label: 'Odeslaná', color: 'text-blue-300', bg: 'bg-blue-500/100/15' },
  partial: { label: 'Částečně uhrazena', color: 'text-amber-300', bg: 'bg-amber-500/100/15' },
  paid: { label: 'Zaplacená', color: 'text-emerald-300', bg: 'bg-emerald-500/100/15' },
  overdue: { label: 'Po splatnosti', color: 'text-red-300', bg: 'bg-red-500/100/15' },
  cancelled: { label: 'Stornovaná', color: 'text-slate-500', bg: 'bg-white/[0.06]/[0.06]' },
};

const filterTabs = [
  { key: 'all', label: 'Všechny' },
  { key: 'draft', label: 'Koncepty' },
  { key: 'sent', label: 'Odeslané' },
  { key: 'partial', label: 'Částečně uhrazené' },
  { key: 'paid', label: 'Zaplacené' },
  { key: 'overdue', label: 'Po splatnosti' },
];

export default function FinancialPage() {
  const { setConfig } = useHeader();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [manualEntries, setManualEntries] = useState<FinancialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [mainTab, setMainTab] = useState<'invoices' | 'entries' | 'billing'>('invoices');
  const [billingJobs, setBillingJobs] = useState<BillingQuickJob[]>([]);
  const [billingServices, setBillingServices] = useState<BillingServiceSchedule[]>([]);
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);
  const [defaultEntryType, setDefaultEntryType] = useState<'income' | 'expense'>('income');
  const [entryFilter, setEntryFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showNewDocMenu, setShowNewDocMenu] = useState(false);
  const newDocMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newDocMenuRef.current && !newDocMenuRef.current.contains(e.target as Node)) {
        setShowNewDocMenu(false);
      }
    };
    if (showNewDocMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNewDocMenu]);

  useEffect(() => {
    setConfig({
      breadcrumbs: [{ label: 'Finance' }],
    });
  }, [setConfig]);

  const loadData = useCallback(async () => {
    const [invRes, projRes, entriesRes, billingRes, servicesRes] = await Promise.all([
      supabase.from('invoices')
        .select('id, invoice_number, invoice_date, due_date, status, total, subtotal, tax_amount, client_name, client_id, project_id, paid_at, invoice_type')
        .order('created_at', { ascending: false }),
      supabase.from('projects').select('id, project_name'),
      supabase.from('financial_entries').select('*').order('entry_date', { ascending: false }),
      supabase.from('quick_jobs')
        .select('id, title, client_name, client_id, project_id, address, completed_at, billing_status, total_work_hours, total_work_cost, total_material_cost')
        .eq('status', 'done')
        .in('billing_status', ['ready', 'invoiced'])
        .order('completed_at', { ascending: false }),
      supabase.from('service_schedules')
        .select('id, service_type_id, client_name, client_address, project_id, last_completed_date, agreed_price, final_price, billing_status')
        .in('billing_status', ['ready_for_invoicing', 'invoiced'])
        .order('last_completed_date', { ascending: false }),
    ]);

    const projectsData = (projRes.data || []) as ProjectRef[];
    setInvoices((invRes.data || []) as Invoice[]);
    setProjects(projectsData);
    setManualEntries((entriesRes.data || []) as FinancialEntry[]);
    setBillingJobs((billingRes.data || []) as BillingQuickJob[]);

    const serviceRows = (servicesRes.data || []) as Array<{
      id: string;
      service_type_id: string;
      client_name: string;
      client_address: string;
      project_id: string | null;
      last_completed_date: string | null;
      agreed_price: number | null;
      final_price: number | null;
      billing_status: string;
    }>;

    const typeIds = [...new Set(serviceRows.map(s => s.service_type_id))];
    let typeMap = new Map<string, string>();
    if (typeIds.length > 0) {
      const { data: types } = await supabase.from('service_types').select('id, name').in('id', typeIds);
      typeMap = new Map((types || []).map((t: { id: string; name: string }) => [t.id, t.name]));
    }

    const enriched: BillingServiceSchedule[] = serviceRows.map(s => ({
      id: s.id,
      type_name: typeMap.get(s.service_type_id) || 'Servis',
      client_name: s.client_name || '',
      client_address: s.client_address || '',
      project_id: s.project_id,
      project_name: s.project_id ? (projectsData.find(p => p.id === s.project_id)?.project_name || '') : '',
      last_completed_date: s.last_completed_date,
      agreed_price: s.agreed_price,
      final_price: s.final_price,
      billing_status: s.billing_status,
    }));

    setBillingServices(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getProjectName = (id: string | null) => {
    if (!id) return '';
    return projects.find(p => p.id === id)?.project_name || '';
  };

  const deleteEntry = async (entryId: string) => {
    const { error } = await supabase.from('financial_entries').delete().eq('id', entryId);
    if (error) { toast('Chyba při mazání', 'error'); return; }
    toast('Záznam smazán');
    loadData();
  };

  const invoiceSortOptions = [
    { key: 'invoice_number', label: 'Číslo faktury' },
    { key: 'client_name', label: 'Klient' },
    { key: 'status', label: 'Stav' },
    { key: 'total', label: 'Celková částka' },
    { key: 'invoice_date', label: 'Datum vystavení' },
    { key: 'due_date', label: 'Datum splatnosti' },
    { key: 'created_at', label: 'Datum přidání' },
  ];

  const filtered = sortItems(
    invoices.filter(inv => {
      if (activeFilter !== 'all' && inv.status !== activeFilter) return false;
      if (typeFilter !== 'all' && (inv.invoice_type || 'standard') !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return inv.invoice_number.toLowerCase().includes(s) ||
          inv.client_name.toLowerCase().includes(s) ||
          getProjectName(inv.project_id).toLowerCase().includes(s);
      }
      return true;
    }),
    sortKey,
    sortDir
  );

  const filteredEntries = manualEntries.filter(e => {
    if (entryFilter !== 'all' && e.entry_type !== entryFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return e.description.toLowerCase().includes(s) ||
        (e.category || '').toLowerCase().includes(s) ||
        getProjectName(e.project_id).toLowerCase().includes(s);
    }
    return true;
  });

  const totalInvoiced = invoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);
  const totalPending = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + i.total, 0);
  const totalOverdue = invoices.filter(i => {
    if (i.status === 'sent' && new Date(i.due_date) < new Date()) return true;
    return i.status === 'overdue';
  }).reduce((s, i) => s + i.total, 0);

  const manualIncomeTotal = manualEntries.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount), 0);
  const manualExpenseTotal = manualEntries.filter(e => e.entry_type === 'expense').reduce((s, e) => s + Number(e.amount), 0);

  const handleExport = () => {
    if (mainTab === 'invoices') {
      downloadCsv(filtered.map(i => ({
        Číslo: i.invoice_number,
        Klient: i.client_name,
        Projekt: getProjectName(i.project_id),
        Stav: STATUS_MAP[i.status]?.label || i.status,
        Základ: i.subtotal,
        DPH: i.tax_amount,
        Celkem: i.total,
        Vystaveno: i.invoice_date,
        Splatnost: i.due_date,
        Zaplaceno: i.paid_at || '',
      })), `faktury_${new Date().toISOString().slice(0, 10)}`);
    } else {
      downloadCsv(filteredEntries.map(e => ({
        Typ: e.entry_type === 'income' ? 'Výnos' : 'Náklad',
        Popis: e.description,
        Částka: e.amount,
        Kategorie: e.category || '',
        Projekt: getProjectName(e.project_id),
        Datum: e.entry_date,
        Poznámka: e.note || '',
      })), `zaznamy_${new Date().toISOString().slice(0, 10)}`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => <div key={i} className="h-32 bg-navy-800/50 rounded-xl border border-white/[0.06] animate-pulse" />)}
      </div>
    );
  }

  const typeFilterOptions = [
    { key: 'all', label: 'Všechny typy' },
    ...Object.entries(INVOICE_TYPE_SHORT_LABELS).map(([key, label]) => ({ key, label })),
  ];

  const NEW_DOC_TYPES = [
    { type: INVOICE_TYPES.STANDARD, label: 'Faktura', icon: FileText },
    { type: INVOICE_TYPES.DEPOSIT_INVOICE, label: 'Zálohová faktura', icon: ArrowDownCircle },
    { type: INVOICE_TYPES.CREDIT_NOTE, label: 'Dobropis', icon: Receipt },
    { type: INVOICE_TYPES.TAX_DOCUMENT, label: 'Daňový doklad', icon: FileCheck },
    { type: INVOICE_TYPES.SETTLEMENT_INVOICE, label: 'Vyúčtovací faktura', icon: Banknote },
    { type: INVOICE_TYPES.CASH_RECEIPT, label: 'Pokladní doklad', icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <div className="relative" ref={newDocMenuRef}>
          <button
            onClick={() => setShowNewDocMenu(v => !v)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg shadow-blue-900/30"
          >
            <Plus className="w-4 h-4" />
            Nový doklad
            <ChevronDown className={`w-4 h-4 transition-transform ${showNewDocMenu ? 'rotate-180' : ''}`} />
          </button>
          {showNewDocMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-navy-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
              {NEW_DOC_TYPES.map(({ type, label, icon: Icon }) => {
                const colors = INVOICE_TYPE_COLORS[type];
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setShowNewDocMenu(false);
                      navigate(type === INVOICE_TYPES.STANDARD
                        ? '/finance/faktura/nova'
                        : `/finance/faktura/nova?type=${type}`
                      );
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/[0.06] transition text-left"
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors.bg} ${colors.border} border`}>
                      <Icon className={`w-3.5 h-3.5 ${colors.text}`} />
                    </span>
                    <span className="text-slate-200 font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div data-tour="finance-stats" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Fakturováno', value: totalInvoiced, icon: DollarSign, gradient: 'from-blue-500 to-blue-600' },
          { label: 'Zaplaceno', value: totalPaid, icon: CheckCircle2, gradient: 'from-emerald-500 to-emerald-600' },
          { label: 'Čekající', value: totalPending, icon: Clock, gradient: 'from-amber-500 to-amber-600' },
          { label: 'Po splatnosti', value: totalOverdue, icon: AlertCircle, gradient: totalOverdue > 0 ? 'from-red-500 to-rose-600' : 'from-slate-600 to-slate-700' },
        ].map((card, idx) => (
          <div key={card.label} className={`relative overflow-hidden bg-gradient-to-br ${card.gradient} rounded-2xl p-5 hover:-translate-y-0.5 transition-all duration-300 group animate-count-up`} style={{ animationDelay: `${idx * 0.05}s` }}>
            <div className="absolute inset-0 bg-white/[0.04] opacity-0 group-hover:opacity-100 transition-opacity" />
            <svg className="absolute bottom-0 left-0 right-0 h-[60%] opacity-[0.15] pointer-events-none" viewBox="0 0 400 160" preserveAspectRatio="none">
              <path d="M0,160L48,138.7C96,117,192,75,288,74.7C384,75,480,117,528,138.7L576,160L576,160L0,160Z" fill="white" />
            </svg>
            <div className="absolute bottom-0 right-0 w-20 h-20 bg-white/[0.08] rounded-full blur-2xl translate-x-1/3 translate-y-1/3" />
            <div className="relative flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <card.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">{card.label}</div>
                <div className="text-lg font-extrabold text-white">{formatCZK(card.value)} Kč</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(manualIncomeTotal > 0 || manualExpenseTotal > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-emerald-500/100/10 rounded-xl border border-emerald-500/25 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/100/15 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ruční výnosy</div>
              <div className="text-lg font-extrabold text-emerald-400">{formatCZK(manualIncomeTotal)} Kč</div>
            </div>
          </div>
          <div className="bg-red-500/100/10 rounded-xl border border-red-500/25 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/100/15 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ruční náklady</div>
              <div className="text-lg font-extrabold text-red-400">{formatCZK(manualExpenseTotal)} Kč</div>
            </div>
          </div>
        </div>
      )}

      <div data-tour="finance-main" className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08]">
        <div className="flex items-center border-b border-white/[0.07]">
          <div data-tour="finance-tabs" className="flex">
            <button
              onClick={() => setMainTab('invoices')}
              className={`px-5 py-3 text-sm font-bold transition border-b-2 ${
                mainTab === 'invoices'
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              Faktury ({invoices.length})
            </button>
            <button
              onClick={() => setMainTab('entries')}
              className={`px-5 py-3 text-sm font-bold transition border-b-2 ${
                mainTab === 'entries'
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              Rucni zaznamy ({manualEntries.length})
            </button>
            <button
              onClick={() => setMainTab('billing')}
              className={`px-5 py-3 text-sm font-bold transition border-b-2 flex items-center gap-1.5 ${
                mainTab === 'billing'
                  ? 'border-amber-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              K fakturaci ({billingJobs.filter(j => j.billing_status === 'ready').length + billingServices.filter(s => s.billing_status === 'ready_for_invoicing').length})
            </button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 px-4">
            {mainTab === 'entries' && (
              <>
                <button
                  onClick={() => { setEditingEntry(null); setDefaultEntryType('income'); setShowEntryModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/100/15 hover:bg-emerald-500/100/20 rounded-lg transition"
                >
                  <Plus className="w-3 h-3" /> Výnos
                </button>
                <button
                  onClick={() => { setEditingEntry(null); setDefaultEntryType('expense'); setShowEntryModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-400 bg-red-500/100/15 hover:bg-red-500/100/100/20 rounded-lg transition"
                >
                  <Plus className="w-3 h-3" /> Náklad
                </button>
              </>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Hledat..."
                className="pl-9 pr-3 py-1.5 text-xs rounded-lg bg-white/[0.06]/[0.06] border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 w-48"
              />
            </div>
            {mainTab === 'invoices' && (
              <SortControl
                options={invoiceSortOptions}
                sortKey={sortKey}
                sortDir={sortDir}
                onChange={(k, d) => { setSortKey(k); setSortDir(d); }}
              />
            )}
            <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-white/[0.06]/[0.07] hover:bg-white/[0.06]/[0.12] rounded-lg transition">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>

        {mainTab === 'invoices' && (
          <>
            <div className="border-b border-white/[0.07]">
              <Tabs
                tabs={filterTabs.map(t => ({
                  ...t,
                  count: t.key === 'all' ? invoices.length : invoices.filter(i => i.status === t.key).length,
                }))}
                active={activeFilter}
                onChange={setActiveFilter}
              />
            </div>

            <div className="border-b border-white/[0.07] px-5 py-2.5 flex gap-2 flex-wrap">
              {typeFilterOptions.map(t => {
                const isActive = typeFilter === t.key;
                const colors = t.key !== 'all' ? INVOICE_TYPE_COLORS[t.key] : null;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTypeFilter(t.key)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      isActive
                        ? colors
                          ? `${colors.bg} ${colors.text} border ${colors.border}`
                          : 'bg-blue-600 text-white'
                        : 'bg-white/[0.05] text-slate-400 hover:bg-white/[0.09]'
                    }`}
                  >
                    {t.label}
                    {t.key !== 'all' && (
                      <span className="ml-1.5 opacity-70">
                        {invoices.filter(i => (i.invoice_type || 'standard') === t.key).length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-white/[0.07]">
                      <th className="pb-3 pr-4">Číslo</th>
                      <th className="pb-3 pr-4">Klient</th>
                      <th className="pb-3 pr-4">Projekt</th>
                      <th className="pb-3 pr-4">Stav</th>
                      <th className="pb-3 pr-4 text-right">Celkem</th>
                      <th className="pb-3 pr-4">Vystaveno</th>
                      <th className="pb-3 pr-4">Splatnost</th>
                      <th className="pb-3 w-40"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {filtered.map(inv => {
                      const st = STATUS_MAP[inv.status] || STATUS_MAP.draft;
                      const isOverdue = inv.status === 'sent' && new Date(inv.due_date) < new Date();
                      const followup = FOLLOWUP_DOC[inv.invoice_type];
                      return (
                        <tr
                          key={inv.id}
                          className="hover:bg-white/[0.03] transition cursor-pointer group"
                          onClick={() => navigate(`/finance/faktura/${inv.id}`)}
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-slate-400" />
                              <span className="font-semibold text-white">{inv.invoice_number}</span>
                              {inv.invoice_type && inv.invoice_type !== 'standard' && (() => {
                                const c = INVOICE_TYPE_COLORS[inv.invoice_type];
                                return c ? (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${c.bg} ${c.text} ${c.border}`}>
                                    {INVOICE_TYPE_SHORT_LABELS[inv.invoice_type]}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-slate-400">{inv.client_name || '-'}</td>
                          <td className="py-3 pr-4 text-slate-400">{getProjectName(inv.project_id) || '-'}</td>
                          <td className="py-3 pr-4">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${isOverdue ? 'bg-red-500/15 text-red-300' : `${st.bg} ${st.color}`}`}>
                              {isOverdue ? 'Po splatnosti' : st.label}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-right font-bold text-white tabular-nums">{formatCZK(inv.total)} Kč</td>
                          <td className="py-3 pr-4 text-slate-400">{formatDate(inv.invoice_date)}</td>
                          <td className="py-3 pr-4 text-slate-400">{formatDate(inv.due_date)}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition">
                              {followup && (inv.status === 'paid' || inv.status === 'partial' || inv.status === 'sent') && (
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    navigate(`/finance/faktura/nova?type=${followup.type}&related=${inv.id}`);
                                  }}
                                  title={`Vytvořit: ${followup.label}`}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 transition whitespace-nowrap"
                                >
                                  <Plus className="w-3 h-3" />
                                  {followup.label}
                                </button>
                              )}
                              <button
                                onClick={e => { e.stopPropagation(); navigate(`/finance/faktura/${inv.id}`); }}
                                className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-500 hover:text-blue-400 transition"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 font-medium">Žádné faktury</p>
                    <button onClick={() => navigate('/finance/faktura/nova')} className="mt-3 text-xs font-semibold text-blue-400 hover:underline">
                      Vytvořit první fakturu
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {mainTab === 'entries' && (
          <>
            <div className="border-b border-white/[0.07] px-5 py-2.5 flex gap-2">
              {[
                { key: 'all', label: 'Vše' },
                { key: 'income', label: 'Výnosy' },
                { key: 'expense', label: 'Náklady' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setEntryFilter(t.key as typeof entryFilter)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    entryFilter === t.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/[0.06]/[0.07] text-slate-400 hover:bg-white/[0.06]/[0.12]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {filteredEntries.length === 0 ? (
                <div className="text-center py-12">
                  <PenLine className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 font-medium">Žádné ruční záznamy</p>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <button
                      onClick={() => { setEditingEntry(null); setDefaultEntryType('income'); setShowEntryModal(true); }}
                      className="text-xs font-semibold text-emerald-400 hover:underline"
                    >
                      Přidat výnos
                    </button>
                    <span className="text-xs text-slate-300">|</span>
                    <button
                      onClick={() => { setEditingEntry(null); setDefaultEntryType('expense'); setShowEntryModal(true); }}
                      className="text-xs font-semibold text-red-400 hover:underline"
                    >
                      Přidat náklad
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredEntries.map(entry => {
                    const isIncome = entry.entry_type === 'income';
                    return (
                      <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.06]/[0.04] transition group">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isIncome ? 'bg-emerald-500/100/10' : 'bg-red-500/100/10'}`}>
                          {isIncome
                            ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                            : <TrendingDown className="w-4 h-4 text-red-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white">{entry.description}</div>
                          <div className="text-xs text-slate-400">
                            <span className={`font-bold ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                              {isIncome ? 'Výnos' : 'Náklad'}
                            </span>
                            {entry.category && ` | ${entry.category}`}
                            {entry.project_id && ` | ${getProjectName(entry.project_id)}`}
                            {` | ${new Date(entry.entry_date).toLocaleDateString('cs-CZ')}`}
                          </div>
                        </div>
                        <div className={`text-sm font-bold tabular-nums ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isIncome ? '+' : '-'}{formatCZK(Number(entry.amount))} Kč
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => { setEditingEntry(entry); setShowEntryModal(true); }}
                            className="p-1.5 rounded-lg hover:bg-white/[0.06]/[0.07] text-slate-400"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteEntry(entry.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/100/100/15 text-slate-400 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.07] mt-2">
                    <span className="text-xs font-semibold text-slate-500">
                      Celkem výnosy: <span className="text-emerald-400">{formatCZK(manualIncomeTotal)} Kč</span>
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      Celkem náklady: <span className="text-red-400">{formatCZK(manualExpenseTotal)} Kč</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {mainTab === 'billing' && (
          <BillingQuickJobsTab
            jobs={billingJobs}
            services={billingServices}
            projects={projects}
            onMarkInvoiced={async (jobId: string) => {
              await supabase.from('quick_jobs').update({ billing_status: 'invoiced', updated_at: new Date().toISOString() }).eq('id', jobId);
              toast('Oznaceno jako vyfakturovano');
              loadData();
            }}
            onCreateInvoice={(jobId: string) => navigate(`/finance/faktura/nova?qj=${jobId}`)}
            onMarkServiceInvoiced={async (serviceId: string) => {
              await supabase.from('service_schedules').update({ billing_status: 'invoiced', updated_at: new Date().toISOString() }).eq('id', serviceId);
              toast('Servis oznacen jako vyfakturovany');
              loadData();
            }}
            onCreateServiceInvoice={(serviceId: string) => navigate(`/finance/faktura/nova?ss=${serviceId}`)}
          />
        )}

      </div>

      <ManualEntryModal
        open={showEntryModal}
        onClose={() => { setShowEntryModal(false); setEditingEntry(null); }}
        entry={editingEntry}
        defaultType={defaultEntryType}
        onSaved={loadData}
      />
    </div>
  );
}
