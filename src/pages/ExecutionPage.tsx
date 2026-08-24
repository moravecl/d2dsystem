import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HardHat,
  Search,
  ArrowUpDown,
  LayoutGrid,
  List,
  ArrowRight,
  MapPin,
  Calendar,
  Clock,
  Banknote,
  BookOpen,
  Filter,
} from 'lucide-react';
import { useHeader } from '../contexts/HeaderContext';
import { useExecutionProjects } from '../hooks/useExecutionProjects';
import type { ExecutionProject } from '../hooks/useExecutionProjects';
import ExecutionProjectCard from '../components/execution/ExecutionProjectCard';
import ExecutionStatsBar from '../components/execution/ExecutionStatsBar';

type SortKey = 'updated' | 'name' | 'deadline' | 'hours' | 'budget';
type ViewMode = 'grid' | 'list';
type JobStatus = 'ready' | 'in_progress' | 'paused';

const STORAGE_KEY = 'execution_status_filters';

const ALL_STATUSES: JobStatus[] = ['ready', 'in_progress', 'paused'];

const statusFilterOptions: { key: JobStatus; label: string; dot: string }[] = [
  { key: 'ready', label: 'Připraveno', dot: 'bg-amber-400' },
  { key: 'in_progress', label: 'Probíhá', dot: 'bg-teal-500/100' },
  { key: 'paused', label: 'Pozastaveno', dot: 'bg-orange-400' },
];

function loadSavedFilters(): Set<JobStatus> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const arr = JSON.parse(saved) as string[];
      const valid = arr.filter(s => ALL_STATUSES.includes(s as JobStatus)) as JobStatus[];
      if (valid.length > 0) return new Set(valid);
    }
  } catch {}
  return new Set(ALL_STATUSES);
}

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'updated', label: 'Poslední aktivita' },
  { key: 'name', label: 'Název A-Z' },
  { key: 'deadline', label: 'Deadline' },
  { key: 'hours', label: 'Odpracováno' },
  { key: 'budget', label: 'Rozpočet' },
];

function sortProjects(projects: ExecutionProject[], key: SortKey): ExecutionProject[] {
  const sorted = [...projects];
  switch (key) {
    case 'updated':
      return sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    case 'name':
      return sorted.sort((a, b) => a.project_name.localeCompare(b.project_name, 'cs'));
    case 'deadline':
      return sorted.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      });
    case 'hours':
      return sorted.sort((a, b) => b.total_work_minutes - a.total_work_minutes);
    case 'budget':
      return sorted.sort((a, b) => b.approved_budget - a.approved_budget);
    default:
      return sorted;
  }
}

function formatHoursShort(minutes: number): string {
  if (minutes === 0) return '0h';
  const h = Math.floor(minutes / 60);
  return `${h}h`;
}

function formatCurrencyShort(amount: number): string {
  if (amount === 0) return '-';
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${Math.round(amount / 1000)}k`;
  return `${Math.round(amount)}`;
}

export default function ExecutionPage() {
  const { setConfig } = useHeader();
  const navigate = useNavigate();
  const { projects, loading } = useExecutionProjects();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeStatuses, setActiveStatuses] = useState<Set<JobStatus>>(() => loadSavedFilters());

  const toggleStatus = (status: JobStatus) => {
    setActiveStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        if (next.size > 1) next.delete(status);
      } else {
        next.add(status);
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const toggleAll = () => {
    const allSelected = activeStatuses.size === ALL_STATUSES.length;
    const next = allSelected ? new Set<JobStatus>(['in_progress']) : new Set<JobStatus>(ALL_STATUSES);
    setActiveStatuses(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch {}
  };

  useEffect(() => {
    setConfig({ breadcrumbs: [{ label: 'Realizace' }] });
  }, [setConfig]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = projects.filter(p => activeStatuses.has((p.job_status || 'ready') as JobStatus));
    if (q) {
      result = result.filter(p =>
        p.project_name.toLowerCase().includes(q) ||
        p.client_name.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q)
      );
    }
    return sortProjects(result, sortKey);
  }, [projects, search, sortKey, activeStatuses]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Realizace</h1>
        <p className="text-sm text-slate-500 mt-1">Přehled zakázek a jejich stavu</p>
      </div>

      {!loading && projects.length > 0 && (
        <ExecutionStatsBar projects={projects} />
      )}

      {!loading && projects.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <button
            onClick={toggleAll}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeStatuses.size === ALL_STATUSES.length
                ? 'bg-slate-800 text-white '
                : 'bg-navy-800/60 border border-white/[0.08] text-slate-400 hover:border-white/[0.12] hover:bg-white/[0.04]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeStatuses.size === ALL_STATUSES.length ? 'bg-white/[0.06]/70' : 'bg-slate-400'}`} />
            Vše
            <span className={`text-[10px] ml-0.5 ${activeStatuses.size === ALL_STATUSES.length ? 'text-white/60' : 'text-slate-400'}`}>
              {projects.length}
            </span>
          </button>
          {statusFilterOptions.map(opt => {
            const isActive = activeStatuses.has(opt.key);
            const count = projects.filter(p => p.job_status === opt.key).length;
            return (
              <button
                key={opt.key}
                onClick={() => toggleStatus(opt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-slate-800 text-white '
                    : 'bg-navy-800/60 border border-white/[0.08] text-slate-500 hover:border-white/[0.12] hover:bg-white/[0.04]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-white/[0.06]/70' : opt.dot}`} />
                {opt.label}
                <span className={`text-[10px] ml-0.5 ${isActive ? 'text-white/60' : 'text-slate-400'}`}>
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
              placeholder="Hledat zakázku..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-navy-800/60 border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
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
                <div className="absolute right-0 top-full mt-1 z-20 bg-navy-800/60 border border-white/[0.08] rounded-xl shadow-xl shadow-slate-200/50 py-1 min-w-[200px] animate-dropdown-enter">
                  {sortOptions.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { setSortKey(opt.key); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        sortKey === opt.key
                          ? 'text-teal-700 bg-teal-500/10 font-medium'
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

          <div className="flex items-center bg-navy-800/60 border border-white/[0.08] rounded-xl overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-teal-500/10 text-teal-600' : 'text-slate-400 hover:text-slate-400'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-teal-500/10 text-teal-600' : 'text-slate-400 hover:text-slate-400'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-navy-800/60 rounded-xl border border-white/[0.08] overflow-hidden">
              <div className="p-5 space-y-3">
                <div className="h-5 bg-white/[0.06] rounded-lg w-3/4 animate-skeleton" />
                <div className="h-4 bg-white/[0.06] rounded-lg w-1/2 animate-skeleton" />
                <div className="h-2 bg-white/[0.06] rounded-full w-full animate-skeleton mt-4" />
              </div>
              <div className="px-5 py-3 border-t border-white/[0.06] grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(j => (
                  <div key={j} className="flex flex-col items-center gap-1">
                    <div className="w-4 h-4 bg-white/[0.06] rounded animate-skeleton" />
                    <div className="h-3 w-8 bg-white/[0.06] rounded animate-skeleton" />
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-slate-50 bg-white/[0.04]/50">
                <div className="h-3 bg-white/[0.06] rounded-lg w-2/3 animate-skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 && projects.length > 0 ? (
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-12 text-center">
          <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Žádná zakázka neodpovídá hledání</p>
          <p className="text-xs text-slate-400 mt-1">Zkuste změnit vyhledávací dotaz</p>
          <button
            onClick={() => setSearch('')}
            className="mt-4 px-4 py-2 text-sm font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-500/10 rounded-lg transition-colors"
          >
            Vymazat filtr
          </button>
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-white/10 p-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-teal-100/50">
            <HardHat className="w-10 h-10 text-teal-600" />
          </div>
          <p className="text-lg font-bold text-slate-300 mb-2">Žádné běžící zakázky</p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Projekty ve stavu "Realizace" se zobrazí na tomto přehledu. Přesuňte projekt do fáze realizace pro jeho zobrazení.
          </p>
          <button
            onClick={() => navigate('/projekty')}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors "
          >
            Zobrazit všechny projekty
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project, i) => (
            <ExecutionProjectCard
              key={project.id}
              project={project}
              index={i}
              onClick={() => navigate(`/projekty/${project.id}?tab=execution`)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.04] border-b border-white/10">
                  <th className="text-left py-3 px-4 font-semibold text-slate-400">Zakázka</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-400 hidden md:table-cell">Adresa</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-400">Čas</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-400 hidden sm:table-cell">Rozpočet</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-400 hidden sm:table-cell">Deník</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-400 hidden lg:table-cell">Úkoly</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-400 hidden lg:table-cell">Deadline</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-400 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => {
                  const deadlineDate = project.deadline ? new Date(project.deadline) : null;
                  const isOverdue = deadlineDate && deadlineDate < new Date();
                  const taskPct = project.total_tasks > 0
                    ? Math.round((project.completed_tasks / project.total_tasks) * 100)
                    : null;

                  return (
                    <tr
                      key={project.id}
                      onClick={() => navigate(`/projekty/${project.id}?tab=execution`)}
                      className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.04] cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {project.active_timers > 0 && (
                            <span className="w-2 h-2 rounded-full bg-red-500/100 animate-pulse-dot shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-white group-hover:text-teal-700 transition-colors truncate">
                              {project.project_name}
                            </p>
                            {project.client_name && (
                              <p className="text-xs text-slate-400 truncate">{project.client_name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className="flex items-center gap-1 text-xs text-slate-400 truncate max-w-[200px]">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {project.address || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="flex items-center justify-center gap-1 text-xs font-medium text-blue-400">
                          <Clock className="w-3 h-3" />
                          {formatHoursShort(project.total_work_minutes)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center hidden sm:table-cell">
                        <span className="flex items-center justify-center gap-1 text-xs font-medium text-emerald-400">
                          <Banknote className="w-3 h-3" />
                          {formatCurrencyShort(project.approved_budget)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center hidden sm:table-cell">
                        <span className="flex items-center justify-center gap-1 text-xs font-medium text-slate-500">
                          <BookOpen className="w-3 h-3" />
                          {project.diary_entries}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center hidden lg:table-cell">
                        {taskPct !== null ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-teal-500/100"
                                style={{ width: `${taskPct}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-500">{taskPct}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        {deadlineDate ? (
                          <span className={`flex items-center gap-1 text-xs font-medium ${
                            isOverdue ? 'text-red-500' : 'text-slate-500'
                          }`}>
                            <Calendar className="w-3 h-3" />
                            {deadlineDate.toLocaleDateString('cs-CZ')}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-teal-500 transition-colors" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <p className="text-xs text-slate-400 text-center pb-2">
          Zobrazeno {filtered.length} z {projects.length} zakázek
        </p>
      )}
    </div>
  );
}
