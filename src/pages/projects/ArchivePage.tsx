import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, Search, ArrowUpDown, ArrowRight, MapPin, Calendar, RotateCcw, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import StatusBadge from '../../components/ui/StatusBadge';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/auditLog';

interface ArchivedProject {
  id: string;
  project_name: string;
  client_name: string;
  status: string;
  address: string;
  deadline: string | null;
  responsible_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  display_name: string | null;
  email: string;
}

type StatusFilter = 'all' | 'completed' | 'cancelled';
type SortKey = 'updated' | 'name' | 'created';

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'updated', label: 'Poslední změna' },
  { key: 'name', label: 'Název A-Z' },
  { key: 'created', label: 'Datum vytvoření' },
];

export default function ArchivePage() {
  const { setConfig } = useHeader();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ArchivedProject[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const loadData = useCallback(async () => {
    const [projectsRes, profilesRes] = await Promise.all([
      supabase
        .from('projects')
        .select('id, project_name, client_name, status, address, deadline, responsible_user_id, created_at, updated_at')
        .in('status', ['completed', 'cancelled'])
        .order('updated_at', { ascending: false }),
      supabase.from('profiles').select('id, display_name, email'),
    ]);
    setProjects((projectsRes.data || []) as ArchivedProject[]);
    setProfiles((profilesRes.data || []) as Profile[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    setConfig({ breadcrumbs: [{ label: 'Archív projektů' }] });
  }, [setConfig]);

  const getProfileName = (userId: string | null) => {
    if (!userId) return '';
    const p = profiles.find(pr => pr.id === userId);
    return p?.display_name || p?.email || '';
  };

  const handleRestore = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Obnovit projekt a nastavit stav na "Realizace"?')) return;
    const { error } = await supabase
      .from('projects')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', projectId);
    if (error) {
      toast('Chyba při obnovení', 'error');
      return;
    }
    await logAudit('project', projectId, 'status_changed', { from: 'archived', to: 'in_progress' });
    toast('Projekt obnoven');
    loadData();
  };

  const handlePermanentDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return;
    if (!confirm('TRVALE smazat projekt a všechna jeho data? Tuto akci nelze vrátit!')) return;
    if (!confirm('Jste si opravdu jisti?')) return;

    const { data: jobRows } = await supabase.from('jobs').select('id').eq('project_id', projectId);
    const jobIds = (jobRows || []).map((j: { id: string }) => j.id);
    if (jobIds.length > 0) {
      await Promise.all([
        supabase.from('job_worklogs').delete().in('job_id', jobIds),
        supabase.from('job_material_entries').delete().in('job_id', jobIds),
        supabase.from('job_diary_entries').delete().in('job_id', jobIds),
      ]);
    }
    await Promise.all([
      supabase.from('jobs').delete().eq('project_id', projectId),
      supabase.from('project_quotes').delete().eq('project_id', projectId),
      supabase.from('project_defects').delete().eq('project_id', projectId),
      supabase.from('tasks').delete().eq('project_id', projectId),
      supabase.from('execution_viceprace').delete().eq('project_id', projectId),
      supabase.from('project_documents').delete().eq('project_id', projectId),
      supabase.from('project_files').delete().eq('project_id', projectId),
      supabase.from('project_project_types').delete().eq('project_id', projectId),
      supabase.from('service_schedules').delete().eq('project_id', projectId),
      supabase.from('service_protocols').delete().eq('project_id', projectId),
      supabase.from('audit_log').delete().eq('entity_type', 'project').eq('entity_id', projectId),
    ]);
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) {
      toast('Chyba při mazání', 'error');
      return;
    }
    toast('Projekt trvale smazán');
    loadData();
  };

  const filtered = useMemo(() => {
    let result = projects;
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }
    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter(p =>
        p.project_name.toLowerCase().includes(q) ||
        p.client_name.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q)
      );
    }
    const sorted = [...result];
    switch (sortKey) {
      case 'updated':
        return sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      case 'name':
        return sorted.sort((a, b) => a.project_name.localeCompare(b.project_name, 'cs'));
      case 'created':
        return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
      default:
        return sorted;
    }
  }, [projects, search, statusFilter, sortKey]);

  const completedCount = projects.filter(p => p.status === 'completed').length;
  const cancelledCount = projects.filter(p => p.status === 'cancelled').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Archív projektů</h1>
        <p className="text-sm text-slate-500 mt-1">Dokončené a zrušené projekty</p>
      </div>

      {!loading && projects.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Celkem</div>
            <div className="text-2xl font-bold text-white">{projects.length}</div>
          </div>
          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Dokončených</div>
            <div className="text-2xl font-bold text-green-400">{completedCount}</div>
          </div>
          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Zrušených</div>
            <div className="text-2xl font-bold text-red-500">{cancelledCount}</div>
          </div>
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { key: 'all' as StatusFilter, label: 'Vše', dot: 'bg-slate-400' },
            { key: 'completed' as StatusFilter, label: 'Dokončené', dot: 'bg-emerald-500/100/100' },
            { key: 'cancelled' as StatusFilter, label: 'Zrušené', dot: 'bg-red-400' },
          ]).map(opt => {
            const count = opt.key === 'all'
              ? projects.length
              : projects.filter(p => p.status === opt.key).length;
            return (
              <button
                key={opt.key}
                onClick={() => setStatusFilter(opt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === opt.key
                    ? 'bg-slate-800 text-white '
                    : 'bg-navy-800/60 border border-white/[0.08] text-slate-400 hover:border-white/[0.12] hover:bg-white/[0.04]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${statusFilter === opt.key ? 'bg-white/[0.06]/70' : opt.dot}`} />
                {opt.label}
                <span className={`text-[10px] ml-0.5 ${statusFilter === opt.key ? 'text-white/60' : 'text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Hledat projekt..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-navy-800/60 border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-2 px-3 py-2.5 bg-navy-800/60 border border-white/[0.08] rounded-xl text-sm text-slate-400 hover:border-white/[0.12] transition-colors"
            >
              <ArrowUpDown className="w-4 h-4" />
              <span className="hidden sm:inline">{sortOptions.find(o => o.key === sortKey)?.label}</span>
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-navy-800/60 border border-white/[0.08] rounded-xl shadow-xl shadow-slate-200/50 py-1 min-w-[200px]">
                  {sortOptions.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { setSortKey(opt.key); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        sortKey === opt.key
                          ? 'text-blue-400 bg-blue-500/10 font-medium'
                          : 'text-slate-400 hover:bg-white/[0.04]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-skeleton" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-white/10 p-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/[0.08]/50 flex items-center justify-center mx-auto mb-5">
            <Archive className="w-10 h-10 text-slate-400" />
          </div>
          <p className="text-lg font-bold text-slate-300 mb-2">Archív je prázdný</p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Dokončené a zrušené projekty se zobrazí zde.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-12 text-center">
          <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Žádný projekt neodpovídá hledání</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter('all'); }}
            className="mt-4 px-4 py-2 text-sm font-medium text-blue-400 hover:text-blue-400 hover:bg-blue-500/100/10 rounded-lg transition-colors"
          >
            Vymazat filtry
          </button>
        </div>
      ) : (
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden ">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Projekt</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Klient</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Stav</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Osoba</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Uzavřeno</th>
                  <th className="text-right px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Akce</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => (
                  <tr
                    key={project.id}
                    onClick={() => navigate(`/projekty/${project.id}`)}
                    className="border-b border-slate-50 last:border-0 hover:bg-white/[0.04]/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          project.status === 'completed' ? 'bg-emerald-500/100/10' : 'bg-red-500/10'
                        }`}>
                          {project.status === 'completed'
                            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                            : <XCircle className="w-4 h-4 text-red-400" />
                          }
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors truncate block">
                            {project.project_name}
                          </span>
                          {project.address && (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                              <MapPin className="w-3 h-3 shrink-0" />{project.address}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className="text-sm text-slate-400">{project.client_name || '-'}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <StatusBadge status={project.status} />
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      {project.responsible_user_id ? (
                        <span className="text-sm text-slate-400 truncate block max-w-[120px]">
                          {getProfileName(project.responsible_user_id)}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(project.updated_at).toLocaleDateString('cs-CZ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleRestore(project.id, e)}
                          className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/100/10 transition-all"
                          title="Obnovit projekt"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={(e) => handlePermanentDelete(project.id, e)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/100/10 transition-all"
                            title="Trvale smazat"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/projekty/${project.id}`)}
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-400 hover:bg-white/[0.06] transition-all"
                          title="Otevřít detail"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.04]/50">
            <span className="text-xs text-slate-400">
              {filtered.length} {filtered.length === 1 ? 'projekt' : filtered.length < 5 ? 'projekty' : 'projektů'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
