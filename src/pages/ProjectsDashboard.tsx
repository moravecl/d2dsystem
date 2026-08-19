import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FolderOpen, Plus, Trash2, ChevronRight, Clock, CheckCircle2,
  Send, FileEdit, Settings, LogOut, User, Search, Layers, Building2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import type { Project } from '../types/database';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  draft: { label: 'Koncept', color: 'text-slate-400', bg: 'bg-white/[0.06]', icon: <FileEdit className="w-3 h-3" /> },
  in_progress: { label: 'Rozpracovaný', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: <Clock className="w-3 h-3" /> },
  completed: { label: 'Dokončený', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: <CheckCircle2 className="w-3 h-3" /> },
  sent: { label: 'Odeslaný', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: <Send className="w-3 h-3" /> },
};

interface ProjectGroup {
  key: string;
  projectName: string;
  clientName: string;
  versions: Project[];
  latestStatus: string;
  latestDate: string;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${cfg.color} ${cfg.bg}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

export default function ProjectsDashboard() {
  const { user, isAdmin, profile, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadProjects = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast('Chyba při načítání projektů', 'error');
    }
    setProjects(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) loadProjects();
  }, [user]);

  const groups = useMemo(() => {
    const map = new Map<string, ProjectGroup>();
    for (const proj of projects) {
      const key = `${proj.project_name || 'Bez názvu'}::${proj.client_name || ''}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          projectName: proj.project_name || 'Bez názvu',
          clientName: proj.client_name || '',
          versions: [],
          latestStatus: proj.status || 'draft',
          latestDate: proj.created_at,
        });
      }
      map.get(key)!.versions.push(proj);
    }
    let result = Array.from(map.values());

    if (statusFilter !== 'all') {
      result = result.filter((g) => g.latestStatus === statusFilter);
    }

    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (g) =>
          g.projectName.toLowerCase().includes(q) ||
          g.clientName.toLowerCase().includes(q) ||
          g.versions.some((v) => v.name.toLowerCase().includes(q) || v.description?.toLowerCase().includes(q))
      );
    }

    return result;
  }, [projects, search, statusFilter]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Opravdu smazat tuto verzi?')) return;
    await supabase.from('projects').delete().eq('id', id);
    toast('Verze smazána');
    loadProjects();
  };

  const handleUpdateStatus = async (id: string, status: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('projects').update({ status }).eq('id', id);
    toast('Stav aktualizován');
    loadProjects();
  };

  const handleOpenVersion = (projectId: string) => {
    navigate(`/?load=${projectId}`);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-white/[0.04] flex items-center justify-center p-4">
        <div className="bg-navy-800/60 rounded-3xl border border-white/[0.06]  p-10 text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 mx-auto flex items-center justify-center mb-4">
            <FolderOpen className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-lg font-extrabold text-white">Přihlašte se</h2>
          <p className="text-sm text-slate-500 mt-2">Pro zobrazení projektů se musíte přihlásit.</p>
          <Link
            to="/admin/login"
            className="mt-5 inline-block bg-blue-600 text-white px-6 py-2.5 rounded-xl font-extrabold hover:bg-blue-700 transition"
          >
            Přihlásit se
          </Link>
        </div>
      </div>
    );
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: projects.length };
    for (const proj of projects) {
      const s = proj.status || 'draft';
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [projects]);

  return (
    <div className="min-h-screen bg-white/[0.04]">
      <header className="bg-white/[0.06] border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/housesmartlogo.png" alt="HouseSmart" className="h-9 w-auto" />
            <div className="hidden sm:block">
              <div className="text-sm font-extrabold text-white">Projekty</div>
              <div className="text-[11px] text-slate-400">Správa a přehled</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="bg-blue-600 text-white px-4 py-2 rounded-xl font-extrabold hover:bg-blue-700 transition  text-sm flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" /> Katalog
            </Link>
            {isAdmin && (
              <Link to="/admin" className="p-2 rounded-xl hover:bg-white/[0.06] transition border border-white/10" title="Administrace">
                <Settings className="w-4 h-4 text-slate-500" />
              </Link>
            )}
            <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] rounded-xl border border-white/[0.06]">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                <User className="w-3 h-3 text-blue-400" />
              </div>
              <span className="text-xs font-extrabold text-slate-300 max-w-[100px] truncate">
                {profile?.display_name || user.email}
              </span>
            </div>
            <button onClick={() => signOut()} className="p-2 rounded-xl hover:bg-white/[0.06] transition border border-white/10" title="Odhlásit">
              <LogOut className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Moje projekty</h1>
            <p className="text-sm text-slate-500 mt-0.5">{projects.length} uložených verzí</p>
          </div>
          <Link
            to="/"
            className="bg-slate-900 text-white px-4 py-2.5 rounded-xl font-extrabold hover:bg-slate-800 transition shadow-lg text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nový projekt
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat projekt, zákazníka..."
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { key: 'all', label: 'Vše' },
              { key: 'draft', label: 'Koncepty' },
              { key: 'in_progress', label: 'Rozpracované' },
              { key: 'completed', label: 'Dokončené' },
              { key: 'sent', label: 'Odeslané' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap transition ${
                  statusFilter === f.key
                    ? 'bg-slate-900 text-white '
                    : 'bg-navy-800/60 border border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'
                }`}
              >
                {f.label}
                {statusCounts[f.key] != null && (
                  <span className="ml-1 opacity-60">({statusCounts[f.key] || 0})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-navy-800/60 rounded-2xl border border-white/[0.06] p-6 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.06]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 bg-white/[0.06] rounded" />
                    <div className="h-3 w-1/4 bg-white/[0.06] rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white/[0.06] border border-white/[0.06] rounded-3xl p-16 text-center ">
            <div className="w-20 h-20 rounded-2xl bg-white/[0.06] mx-auto flex items-center justify-center mb-5">
              <FolderOpen className="w-10 h-10 text-slate-300" />
            </div>
            <div className="text-xl font-extrabold text-white">
              {search || statusFilter !== 'all' ? 'Nic nenalezeno' : 'Zatím žádné projekty'}
            </div>
            <div className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
              {search || statusFilter !== 'all'
                ? 'Zkuste upravit filtry nebo hledání.'
                : 'Přejděte do katalogu, nastavte projekt a uložte ho.'}
            </div>
            {!search && statusFilter === 'all' && (
              <Link
                to="/"
                className="mt-6 inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-extrabold hover:bg-blue-700 transition shadow-lg"
              >
                <Plus className="w-4 h-4" /> Vytvořit první projekt
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const isExpanded = expandedGroup === group.key;
              const latest = group.versions[0];
              const versionCount = group.versions.length;

              return (
                <div
                  key={group.key}
                  className="bg-navy-800/60 rounded-2xl border border-white/[0.06] overflow-hidden   transition-shadow"
                >
                  <button
                    onClick={() => setExpandedGroup(isExpanded ? null : group.key)}
                    className="w-full p-5 flex items-center gap-4 text-left hover:bg-white/[0.04]/50 transition"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center shrink-0 border border-white/[0.06]">
                      <Building2 className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-extrabold text-white truncate">
                          {group.projectName}
                        </span>
                        <StatusBadge status={group.latestStatus} />
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        {group.clientName && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {group.clientName}
                          </span>
                        )}
                        <span>{versionCount} {versionCount === 1 ? 'verze' : versionCount < 5 ? 'verze' : 'verzi'}</span>
                        <span>{new Date(group.latestDate).toLocaleDateString('cs-CZ')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        onClick={(e) => { e.stopPropagation(); handleOpenVersion(latest.id); }}
                        className="px-3 py-2 rounded-xl bg-blue-600 text-white font-extrabold text-xs hover:bg-blue-700 transition flex items-center gap-1.5"
                      >
                        <FolderOpen className="w-3.5 h-3.5" /> Otevřít
                      </div>
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/[0.06] bg-white/[0.04]/50">
                      <div className="px-5 py-3">
                        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Historie verzí</div>
                        <div className="space-y-2">
                          {group.versions.map((version, idx) => (
                            <div
                              key={version.id}
                              className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.06] border border-white/[0.06] hover:border-blue-200 transition group"
                            >
                              <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 text-xs font-extrabold text-slate-500">
                                v{group.versions.length - idx}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-extrabold text-white truncate">{version.name}</span>
                                  <StatusBadge status={version.status || 'draft'} />
                                </div>
                                {version.description && (
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">{version.description}</div>
                                )}
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {new Date(version.created_at).toLocaleString('cs-CZ')}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition">
                                <select
                                  value={version.status || 'draft'}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleUpdateStatus(version.id, e.target.value, e as unknown as React.MouseEvent)}
                                  className="text-[10px] font-extrabold border border-white/10 rounded-lg px-2 py-1 bg-white/[0.06] focus:outline-none"
                                >
                                  <option value="draft">Koncept</option>
                                  <option value="in_progress">Rozpracovaný</option>
                                  <option value="completed">Dokončený</option>
                                  <option value="sent">Odeslaný</option>
                                </select>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleOpenVersion(version.id); }}
                                  className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-extrabold hover:bg-blue-700 transition"
                                >
                                  Otevřít
                                </button>
                                <button
                                  onClick={(e) => handleDelete(version.id, e)}
                                  className="p-1 rounded-lg hover:bg-red-500/100/10 text-slate-400 hover:text-red-500 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
