import { useState, useEffect, useCallback } from 'react';
import { Plus, FileCheck, Calendar, User, AlertTriangle, CheckCircle2, Clock, Edit2, Trash2, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import type { ProjectProtocol } from './protocolTypes';
import { PROTOCOL_TYPES, RESULT_OPTIONS, STATUS_OPTIONS } from './protocolTypes';
import ProtocolFormModal from './ProtocolFormModal';
import ProtocolDetailView from './ProtocolDetailView';

interface Props {
  projectId: string;
}

export default function ProjectProtocolsTab({ projectId }: Props) {
  const { toast } = useToast();
  const [protocols, setProtocols] = useState<ProjectProtocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProtocol, setEditProtocol] = useState<ProjectProtocol | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('project_protocols')
      .select('*')
      .eq('project_id', projectId)
      .order('protocol_date', { ascending: false });

    if (filterType) query = query.eq('protocol_type', filterType);

    const { data } = await query;
    setProtocols((data || []) as ProjectProtocol[]);
    setLoading(false);
  }, [projectId, filterType]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Smazat protokol? Tato akce je nevratná.')) return;
    await supabase.from('protocol_checklist_items').delete().eq('protocol_id', id);
    await supabase.from('project_protocols').delete().eq('id', id);
    setProtocols(prev => prev.filter(p => p.id !== id));
    toast('Protokol smazán');
  };

  const openEdit = (p: ProjectProtocol) => {
    setEditProtocol(p);
    setShowForm(true);
  };

  const openNew = () => {
    setEditProtocol(null);
    setShowForm(true);
  };

  const filtered = search
    ? protocols.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.protocol_number.toLowerCase().includes(search.toLowerCase()) ||
        p.inspector_name.toLowerCase().includes(search.toLowerCase())
      )
    : protocols;

  const typeStats = PROTOCOL_TYPES.map(t => ({
    ...t,
    count: protocols.filter(p => p.protocol_type === t.key).length,
  })).filter(t => t.count > 0);

  const resultIcon = (result: string) => {
    if (result === 'pass') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (result === 'fail') return <AlertTriangle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-amber-500" />;
  };

  const getTypeLabel = (key: string) => PROTOCOL_TYPES.find(t => t.key === key)?.label || key;
  const getResultConf = (key: string) => RESULT_OPTIONS.find(r => r.key === key);
  const getStatusConf = (key: string) => STATUS_OPTIONS.find(s => s.key === key);

  const expiringCount = protocols.filter(p => {
    if (!p.valid_until) return false;
    const diff = new Date(p.valid_until).getTime() - Date.now();
    return diff > 0 && diff < 90 * 24 * 60 * 60 * 1000;
  }).length;

  const expiredCount = protocols.filter(p => {
    if (!p.valid_until) return false;
    return new Date(p.valid_until).getTime() < Date.now();
  }).length;

  return (
    <div className="space-y-5">
      {(expiringCount > 0 || expiredCount > 0) && (
        <div className="flex items-center gap-3 flex-wrap">
          {expiredCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-xs font-semibold text-red-400">{expiredCount} protokol{expiredCount > 1 ? 'ů' : ''} po platnosti</span>
            </div>
          )}
          {expiringCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-200 rounded-xl">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold text-amber-400">{expiringCount} protokol{expiringCount > 1 ? 'ů' : ''} brzy vyprší</span>
            </div>
          )}
        </div>
      )}

      {typeStats.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {typeStats.map(t => (
            <button
              key={t.key}
              onClick={() => setFilterType(filterType === t.key ? '' : t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                filterType === t.key
                  ? 'bg-blue-500/10 text-blue-400 border-blue-200'
                  : 'bg-white/[0.06] text-slate-500 border-white/10 hover:bg-white/[0.04]'
              }`}
            >
              {t.label} <span className="ml-1 opacity-60">({t.count})</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hledat protokol..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition "
        >
          <Plus className="w-4 h-4" />
          Nový protokol
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white/[0.06] rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileCheck className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-500 mb-1">
            {search || filterType ? 'Žádné protokoly odpovídající filtru' : 'Zatím žádné protokoly'}
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Vytvořte protokoly o tlakových zkouškách, revizích, zaregulování a dalších.
          </p>
          {!search && !filterType && (
            <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-400 bg-blue-500/10 rounded-xl hover:bg-blue-500/20 transition">
              <Plus className="w-4 h-4" /> Vytvořit první protokol
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const rConf = getResultConf(p.result);
            const sConf = getStatusConf(p.status);
            const isExpired = p.valid_until && new Date(p.valid_until).getTime() < Date.now();
            const isExpiring = p.valid_until && !isExpired && (new Date(p.valid_until).getTime() - Date.now()) < 90 * 24 * 60 * 60 * 1000;

            return (
              <div
                key={p.id}
                className="flex items-center gap-4 p-4 bg-white/[0.06] border border-white/[0.06] rounded-xl hover:border-white/10 hover: transition group cursor-pointer"
                onClick={() => setDetailId(p.id)}
              >
                <div className="shrink-0">{resultIcon(p.result)}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="text-sm font-bold text-white truncate">{p.title}</h4>
                    {sConf && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg ${sConf.color}`}>{sConf.label}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="font-medium text-slate-500">{getTypeLabel(p.protocol_type)}</span>
                    <span>{p.protocol_number}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(p.protocol_date).toLocaleDateString('cs-CZ')}</span>
                    {p.inspector_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{p.inspector_name}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {(isExpired || isExpiring) && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${isExpired ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {isExpired ? 'Prošlé' : 'Brzy vyprší'}
                    </span>
                  )}
                  {rConf && (
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border ${rConf.color}`}>
                      {rConf.label}
                    </span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); openEdit(p); }}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-blue-400 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(p.id); }}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ProtocolFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditProtocol(null); }}
        projectId={projectId}
        protocol={editProtocol}
        onSaved={load}
      />

      {detailId && (
        <ProtocolDetailView
          open={!!detailId}
          onClose={() => setDetailId(null)}
          protocolId={detailId}
          projectId={projectId}
        />
      )}
    </div>
  );
}
