import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ArrowUpRight,
  Trash2,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  FileText,
  Inbox,
  Eye,
  List,
  LayoutGrid,
} from 'lucide-react';
import SortControl, { sortItems, type SortDir } from '../../components/ui/SortControl';
import { useHeader } from '../../contexts/HeaderContext';
import { useToast } from '../../components/ui/Toast';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import LeadDetailModal from '../../components/leads/LeadDetailModal';
import ConvertLeadModal from '../../components/leads/ConvertLeadModal';
import KanbanBoard, { getColorConfig } from '../../components/ui/KanbanBoard';
import { useKanbanColumns } from '../../hooks/useKanbanColumns';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  source: string;
  form_data: Record<string, string>;
  status: string;
  converted_project_id: string | null;
  converted_client_id: string | null;
  inquiry_form_id: string | null;
  created_at: string;
  updated_at: string;
}

interface InquiryForm {
  id: string;
  name: string;
}

export default function LeadsPage() {
  const { setConfig } = useHeader();
  const { toast } = useToast();
  const { isAdmin } = useOrganization();
  const navigate = useNavigate();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [forms, setForms] = useState<InquiryForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { columns, loading: colsLoading, addColumn, updateColumn, removeColumn } = useKanbanColumns('leads');

  const loadData = useCallback(async () => {
    const [leadsRes, formsRes] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('inquiry_forms').select('id, name'),
    ]);
    setLeads((leadsRes.data ?? []) as Lead[]);
    setForms((formsRes.data ?? []) as InquiryForm[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    setConfig({ breadcrumbs: [{ label: 'Leady' }] });
  }, [setConfig]);

  const updateStatus = async (leadId: string, newStatus: string) => {
    await supabase
      .from('leads')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', leadId);
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)));
    toast('Status aktualizován', 'success');
  };

  const deleteLead = async (id: string) => {
    if (!confirm('Opravdu smazat tento lead?')) return;
    await supabase.from('leads').delete().eq('id', id);
    setLeads((prev) => prev.filter((l) => l.id !== id));
    toast('Lead smazán', 'success');
  };

  const handleConverted = () => {
    setConvertLead(null);
    loadData();
  };

  const formNameMap: Record<string, string> = {};
  forms.forEach((f) => { formNameMap[f.id] = f.name; });

  const leadSortOptions = [
    { key: 'name', label: 'Jméno' },
    { key: 'status', label: 'Stav' },
    { key: 'email', label: 'Email' },
    { key: 'created_at', label: 'Datum přidání' },
    { key: 'updated_at', label: 'Naposledy upraveno' },
  ];

  const filtered = sortItems(
    leads.filter((l) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        l.message.toLowerCase().includes(q)
      );
    }),
    sortKey,
    sortDir
  );

  const newCount = leads.filter((l) => l.status === 'new').length;
  const isLoading = loading || colsLoading;

  const renderLeadCard = (lead: Lead) => {

    return (
      <div className="bg-navy-800/60 backdrop-blur-sm rounded-lg border border-white/[0.08] p-3  transition-shadow group">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-sm font-bold text-white truncate">{lead.name || 'Bez jména'}</h4>
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setDetailLead(lead)} className="p-1 rounded text-slate-400 hover:text-slate-300 hover:bg-white/[0.06]/[0.07]" title="Detail">
              <Eye className="w-3.5 h-3.5" />
            </button>
            {lead.status !== 'converted' && (
              <button onClick={() => setConvertLead(lead)} className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/100/10" title="Převést">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
            {lead.converted_project_id && (
              <button onClick={() => navigate(`/projekty/${lead.converted_project_id}`)} className="p-1 rounded text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/100/10" title="Projekt">
                <FileText className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => deleteLead(lead.id)} className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/100/100/10" title="Smazat">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="space-y-1">
          {lead.email && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.phone && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Phone className="w-3 h-3 shrink-0" />
              {lead.phone}
            </div>
          )}
          {lead.message && (
            <p className="text-xs text-slate-400 line-clamp-2 mt-1.5">
              <MessageSquare className="w-3 h-3 inline mr-1 -mt-0.5" />
              {lead.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/[0.06]">
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(lead.created_at).toLocaleDateString('cs-CZ')}
          </span>
          {lead.inquiry_form_id && formNameMap[lead.inquiry_form_id] && (
            <span className="text-[10px] font-semibold text-slate-400 bg-white/[0.06]/[0.04] px-1.5 py-0.5 rounded">
              {formNameMap[lead.inquiry_form_id]}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-full mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white">Leady</h1>
            {newCount > 0 && (
              <span className="px-2.5 py-1 bg-blue-500/100/15 text-blue-300 border border-blue-500/25 text-xs font-bold rounded-full">
                {newCount} {newCount === 1 ? 'nový' : newCount < 5 ? 'nové' : 'nových'}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">Poptávky z webových formulářů</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-navy-900/50 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${viewMode === 'kanban' ? 'bg-white/[0.06]/[0.07] text-white ' : 'text-slate-400'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
              Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${viewMode === 'list' ? 'bg-white/[0.06]/[0.07] text-white ' : 'text-slate-400'}`}
            >
              <List className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
              Seznam
            </button>
          </div>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat podle jména, emailu..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.06]/[0.06] border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>
        <SortControl
          options={leadSortOptions}
          sortKey={sortKey}
          sortDir={sortDir}
          onChange={(k, d) => { setSortKey(k); setSortDir(d); }}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 && !search ? (
        <div className="text-center py-20 bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08]">
          <Inbox className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-500 mb-2">Zatím nemáte žádné leady</h3>
          <p className="text-sm text-slate-500">Leady se sem budou sbírat z vašich formulářů</p>
        </div>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard<Lead>
          columns={columns}
          items={filtered}
          getItemStatus={(l) => l.status}
          getItemId={(l) => l.id}
          renderCard={renderLeadCard}
          onMoveItem={updateStatus}
          onAddColumn={addColumn}
          onUpdateColumn={(id, u) => updateColumn(id, u)}
          onRemoveColumn={removeColumn}
          canManageColumns={isAdmin}
          emptyText="Žádné leady"
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((lead) => {
            const colDef = columns.find((c) => c.key === lead.status);
            const colColor = colDef ? getColorConfig(colDef.color) : getColorConfig('slate');
            return (
              <div key={lead.id} className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-4 sm:p-5  transition-shadow group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                      <h3 className="text-base font-bold text-white">{lead.name || 'Bez jména'}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${colColor.bg} ${colColor.text}`}>
                        {colDef?.label || lead.status}
                      </span>
                      {lead.inquiry_form_id && formNameMap[lead.inquiry_form_id] && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/[0.06]/[0.07] text-slate-400">
                          {formNameMap[lead.inquiry_form_id]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400 flex-wrap">
                      {lead.email && (
                        <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{lead.email}</span>
                      )}
                      {lead.phone && (
                        <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{lead.phone}</span>
                      )}
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(lead.created_at).toLocaleDateString('cs-CZ')}
                      </span>
                    </div>
                    {lead.message && (
                      <p className="mt-2 text-sm text-slate-300 line-clamp-2">
                        <MessageSquare className="w-3.5 h-3.5 inline mr-1.5 text-slate-400 -mt-0.5" />
                        {lead.message}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={lead.status}
                      onChange={(e) => updateStatus(lead.id, e.target.value)}
                      className="px-2 py-1.5 border border-white/10 rounded-lg text-xs bg-white/[0.06]/[0.06] text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                    >
                      {columns.map((c) => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                    <button onClick={() => setDetailLead(lead)} className="p-2 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-white/[0.06]/[0.07] transition" title="Detail">
                      <Eye className="w-4 h-4" />
                    </button>
                    {lead.status !== 'converted' && (
                      <button onClick={() => setConvertLead(lead)} className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/100/10 transition" title="Převést na projekt">
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    )}
                    {lead.converted_project_id && (
                      <button onClick={() => navigate(`/projekty/${lead.converted_project_id}`)} className="p-2 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/100/10 transition" title="Otevřít projekt">
                        <FileText className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => deleteLead(lead.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/100/100/10 transition" title="Smazat">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detailLead && (
        <LeadDetailModal
          lead={detailLead}
          formName={detailLead.inquiry_form_id ? formNameMap[detailLead.inquiry_form_id] : undefined}
          onClose={() => setDetailLead(null)}
          onConvert={() => { setDetailLead(null); setConvertLead(detailLead); }}
        />
      )}

      {convertLead && (
        <ConvertLeadModal
          lead={convertLead}
          onClose={() => setConvertLead(null)}
          onConverted={handleConverted}
        />
      )}
    </div>
  );
}
