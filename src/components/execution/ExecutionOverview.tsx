import { useState, useEffect } from 'react';
import { Clock, Package, BookOpen, AlertTriangle, Users, FileText, Plus, X, TrendingUp, CheckCircle2, Eye, RotateCcw, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ProjectQuote {
  id: string;
  quote_number: string;
  version: number;
  total_selling: number;
  status: string;
}

interface OverviewStats {
  totalMinutes: number;
  materialEntries: number;
  materialWithActual: number;
  totalPlannedItems: number;
  diaryEntries: number;
  lastDiaryDate: string | null;
  openDefects: number;
  criticalDefects: number;
}

interface ActivityItem {
  id: string;
  type: 'worklog' | 'material' | 'diary';
  title: string;
  detail: string;
  timestamp: string;
}

interface TodayWorker {
  name: string;
  type: 'employee' | 'temp';
}


interface Props {
  jobId: string;
  projectId: string;
  allQuotes: ProjectQuote[];
  includedIds: string[];
  mainQuoteId: string | null;
  jobStatus: string;
  onIncludeQuote: (id: string) => void;
  onRemoveQuote: (id: string) => void;
}

const STATUS_BADGE: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  approved: { label: 'Schváleno', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', Icon: CheckCircle2 },
  presented: { label: 'Předloženo', cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20', Icon: Eye },
  returned: { label: 'Vráceno', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20', Icon: RotateCcw },
  draft: { label: 'Rozpracována', cls: 'text-slate-400 bg-white/[0.06] border-white/[0.08]', Icon: FileText },
};

function QuoteStatusBadge({ status }: { status: string }) {
  const meta = STATUS_BADGE[status] || STATUS_BADGE.draft;
  const Icon = meta.Icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border ${meta.cls}`}>
      <Icon className="w-2.5 h-2.5" /> {meta.label}
    </span>
  );
}

function ProgressRing({ percentage }: { percentage: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;
  const color = percentage >= 100 ? '#10b981' : percentage >= 70 ? '#0d9488' : '#0ea5e9';

  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle
          cx="50" cy="50" r={radius} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{
            '--progress-start': circumference,
            '--progress-end': offset,
          } as React.CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold text-white tabular-nums">
          {Math.round(percentage)}%
        </span>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">postup</span>
      </div>
    </div>
  );
}

function MiniBarChart({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-6">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-1.5 rounded-full bg-sky-400/60 transition-all duration-500"
          style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export default function ExecutionOverview({
  jobId, projectId, allQuotes, includedIds, mainQuoteId, jobStatus,
  onIncludeQuote, onRemoveQuote,
}: Props) {
  const [stats, setStats] = useState<OverviewStats>({
    totalMinutes: 0, materialEntries: 0, materialWithActual: 0,
    totalPlannedItems: 0, diaryEntries: 0, lastDiaryDate: null,
    openDefects: 0, criticalDefects: 0,
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [todayWorkers, setTodayWorkers] = useState<TodayWorker[]>([]);
  const [weeklyHours, setWeeklyHours] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const includedIdsKey = includedIds.join(',');
  const isCompleted = jobStatus === 'completed';

  useEffect(() => {
    (async () => {
      const quoteIdsToFetch = includedIdsKey.split(',').filter(Boolean);

      const queries: PromiseLike<{ data: unknown; error: unknown }>[] = [
        supabase.from('job_worklogs').select('duration_minutes, started_at, workers').eq('job_id', jobId),
        supabase.from('job_material_entries').select('id, material_name, actual_qty').eq('job_id', jobId),
        supabase.from('job_diary_entries').select('id, entry_date, people_on_site').eq('job_id', jobId).order('entry_date', { ascending: false }),
        supabase.from('project_defects').select('id, status, severity').eq('project_id', projectId),
        supabase.from('job_worklogs').select('id, activity, duration_minutes, started_at, workers').eq('job_id', jobId).eq('is_running', false).order('created_at', { ascending: false }).limit(5),
        supabase.from('job_material_entries').select('id, material_name, actual_qty, unit, created_at').eq('job_id', jobId).order('created_at', { ascending: false }).limit(5),
        supabase.from('job_diary_entries').select('id, entry_date, content, created_at').eq('job_id', jobId).order('created_at', { ascending: false }).limit(3),
      ];
      if (quoteIdsToFetch.length > 0) {
        queries.push(supabase.from('project_quotes').select('sections_data').in('id', quoteIdsToFetch));
      }

      const results = await Promise.all(queries);
      const [timeRes, matRes, diaryRes, defectsRes, recentWorklogsRes, recentMatRes, recentDiaryRes] = results;

      const allWorklogs = (timeRes.data || []) as any[];
      const totalMin = allWorklogs.reduce((s: number, r: any) => s + (r.duration_minutes || 0), 0);

      const allMat = (matRes.data || []) as any[];

      let totalPlannedCount = 0;
      const plannedNamesSet = new Set<string>();
      const quotesRes = quoteIdsToFetch.length > 0 ? results[7] : { data: [] };
      const quoteRows = (quotesRes.data || []) as any[];
      for (const quote of quoteRows) {
        const raw = (quote as any)?.sections_data;
        const sections = Array.isArray(raw) ? raw : (Array.isArray(raw?.sections) ? raw.sections : []);
        for (const sec of sections) {
          if (!sec || !Array.isArray(sec.items)) continue;
          for (const item of sec.items) {
            if (item.name) {
              totalPlannedCount++;
              plannedNamesSet.add(item.name);
            }
          }
        }
      }

      const materialNamesWithActual = new Set(
        allMat.filter((m: any) => m.actual_qty > 0).map((m: any) => m.material_name)
      );
      let plannedWithActual = 0;
      for (const quote of quoteRows) {
        const raw = (quote as any)?.sections_data;
        const sections = Array.isArray(raw) ? raw : (Array.isArray(raw?.sections) ? raw.sections : []);
        for (const sec of sections) {
          if (!sec || !Array.isArray(sec.items)) continue;
          for (const item of sec.items) {
            if (item.name && materialNamesWithActual.has(item.name)) plannedWithActual++;
          }
        }
      }

      const allDiary = (diaryRes.data || []) as any[];
      const lastDiaryDate = allDiary.length > 0 ? allDiary[0].entry_date : null;

      const allDefects = (defectsRes.data || []) as any[];
      const openDefects = allDefects.filter((d: any) => d.status !== 'resolved').length;
      const criticalDefects = allDefects.filter((d: any) => d.status !== 'resolved' && d.severity === 'critical').length;

      const today = new Date().toISOString().slice(0, 10);
      const todayDiary = allDiary.find((d: any) => d.entry_date === today);
      const workers: TodayWorker[] = [];
      if (todayDiary?.people_on_site) {
        for (const _pid of todayDiary.people_on_site) {
          workers.push({ name: _pid.slice(0, 8), type: 'employee' });
        }
      }
      const todayWorklogs = allWorklogs.filter((w: any) => w.started_at?.startsWith(today));
      for (const wl of todayWorklogs) {
        if (wl.workers && Array.isArray(wl.workers)) {
          for (const wr of wl.workers) {
            if (!workers.find(w => w.name === wr.name)) {
              workers.push({ name: wr.name, type: wr.type || 'employee' });
            }
          }
        }
      }

      const weekData: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        const dayMin = allWorklogs
          .filter((w: any) => w.started_at?.startsWith(ds))
          .reduce((s: number, w: any) => s + (w.duration_minutes || 0), 0);
        weekData.push(Math.round(dayMin / 60));
      }

      setStats({
        totalMinutes: totalMin,
        materialEntries: totalPlannedCount > 0 ? totalPlannedCount : allMat.length,
        materialWithActual: totalPlannedCount > 0 ? plannedWithActual : allMat.filter((m: any) => m.actual_qty > 0).length,
        totalPlannedItems: totalPlannedCount,
        diaryEntries: allDiary.length,
        lastDiaryDate,
        openDefects,
        criticalDefects,
      });
      setWeeklyHours(weekData);
      setTodayWorkers(workers);

      const activityFeed: ActivityItem[] = [];
      for (const w of (recentWorklogsRes.data || []) as any[]) {
        activityFeed.push({
          id: `wl-${w.id}`,
          type: 'worklog',
          title: w.activity,
          detail: `${Math.floor((w.duration_minutes || 0) / 60)}h ${(w.duration_minutes || 0) % 60}m`,
          timestamp: w.started_at || '',
        });
      }
      for (const m of (recentMatRes.data || []) as any[]) {
        activityFeed.push({
          id: `mat-${m.id}`,
          type: 'material',
          title: m.material_name,
          detail: `${m.actual_qty} ${m.unit}`,
          timestamp: m.created_at || '',
        });
      }
      for (const d of (recentDiaryRes.data || []) as any[]) {
        activityFeed.push({
          id: `diary-${d.id}`,
          type: 'diary',
          title: 'Zápis v deníku',
          detail: (d.content || '').slice(0, 60) + ((d.content || '').length > 60 ? '...' : ''),
          timestamp: d.created_at || '',
        });
      }
      activityFeed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivity(activityFeed.slice(0, 8));
      setLoading(false);
    })();
  }, [jobId, projectId, includedIdsKey]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-28 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-skeleton" />
        ))}
      </div>
    );
  }

  const hours = Math.floor(stats.totalMinutes / 60);
  const mins = stats.totalMinutes % 60;
  const materialProgress = stats.materialEntries > 0
    ? Math.round((stats.materialWithActual / Math.max(stats.materialEntries, 1)) * 100)
    : 0;

  const overallProgress = Math.min(100, materialProgress);

  const includedQuotes = allQuotes.filter(q => includedIds.includes(q.id));
  const unincluded = allQuotes.filter(q => !includedIds.includes(q.id));
  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

  const ACTIVITY_ICONS: Record<string, { icon: typeof Clock; bg: string; fg: string }> = {
    worklog: { icon: Clock, bg: 'bg-sky-50', fg: 'text-sky-600' },
    material: { icon: Package, bg: 'bg-emerald-500/10', fg: 'text-emerald-400' },
    diary: { icon: BookOpen, bg: 'bg-amber-500/10', fg: 'text-amber-400' },
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 rounded-2xl border border-white/10 bg-white/[0.06] p-5 flex flex-col items-center justify-center">
          <ProgressRing percentage={overallProgress} />
          <p className="text-[10px] font-semibold text-slate-400 mt-2 uppercase tracking-wider">
            Odhad dokončení
          </p>
          {stats.totalPlannedItems > 0 && (
            <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
              {stats.materialWithActual} z {stats.totalPlannedItems} položek
            </p>
          )}
        </div>

        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 group hover:shadow-md hover:shadow-slate-100 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center">
                <Clock className="w-4.5 h-4.5 text-sky-600" />
              </div>
              <MiniBarChart values={weeklyHours} />
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Odpracováno</div>
            <div className="text-xl font-extrabold text-white tabular-nums mt-0.5">{hours}h {mins}m</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 group hover:shadow-md hover:shadow-slate-100 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Package className="w-4.5 h-4.5 text-emerald-400" />
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Materiál</div>
            <div className="text-xl font-extrabold text-white tabular-nums mt-0.5">{stats.materialWithActual}<span className="text-sm text-slate-400 font-bold">/{stats.materialEntries}</span></div>
            <div className="mt-2 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${materialProgress}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 group hover:shadow-md hover:shadow-slate-100 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <BookOpen className="w-4.5 h-4.5 text-amber-400" />
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deník</div>
            <div className="text-xl font-extrabold text-white tabular-nums mt-0.5">{stats.diaryEntries}</div>
            {stats.lastDiaryDate && (
              <p className="text-[10px] text-slate-400 mt-1">
                Poslední: {new Date(stats.lastDiaryDate).toLocaleDateString('cs-CZ')}
              </p>
            )}
          </div>

          <div className={`rounded-2xl border bg-white/[0.06] p-4 group hover:shadow-md hover:shadow-slate-100 transition-all ${
            stats.criticalDefects > 0 ? 'border-red-200' : 'border-white/10'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                stats.criticalDefects > 0 ? 'bg-red-500/10' : 'bg-white/[0.04]'
              }`}>
                <AlertTriangle className={`w-4.5 h-4.5 ${
                  stats.criticalDefects > 0 ? 'text-red-500' : 'text-slate-400'
                }`} />
              </div>
              {stats.criticalDefects > 0 && (
                <span className="text-[9px] font-extrabold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-200 animate-pulse">
                  KRITICKÉ
                </span>
              )}
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vady</div>
            <div className={`text-xl font-extrabold tabular-nums mt-0.5 ${
              stats.openDefects > 0 ? 'text-red-400' : 'text-white'
            }`}>
              {stats.openDefects}
              <span className="text-sm text-slate-400 font-bold"> otevřených</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {todayWorkers.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dnes na stavbě</h3>
              <span className="text-[10px] font-bold text-teal-600 bg-teal-500/10 px-2 py-0.5 rounded-full">
                {todayWorkers.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {todayWorkers.map((w, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg ${
                    w.type === 'employee'
                      ? 'bg-sky-50 text-sky-700 border border-sky-100'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    w.type === 'employee' ? 'bg-sky-500' : 'bg-amber-500'
                  }`} />
                  {w.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className={`rounded-2xl border border-white/10 bg-white/[0.06] p-4 ${todayWorkers.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Poslední aktivita</h3>
          </div>
          {activity.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Zatím žádná aktivita</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {activity.map((item) => {
                const meta = ACTIVITY_ICONS[item.type];
                const Icon = meta.icon;
                return (
                  <div key={item.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition">
                    <div className={`w-7 h-7 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-3.5 h-3.5 ${meta.fg}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-300 truncate">{item.title}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">{item.detail}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                      {item.timestamp ? new Date(item.timestamp).toLocaleDateString('cs-CZ') : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.06] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            Napojené nabídky
          </h3>
          <span className="text-[10px] text-slate-400 font-semibold bg-white/[0.06] px-2 py-0.5 rounded-full">
            {includedIds.length}
          </span>
        </div>
        <div className="p-3 space-y-2">
          {includedQuotes.length === 0 && (
            <div className="text-center py-4">
              <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Zakázka nemá napojenou žádnou nabídku</p>
              {!isCompleted && unincluded.length > 0 && (
                <p className="text-[10px] text-slate-500 mt-1">Připojte nabídku níže</p>
              )}
            </div>
          )}

          {includedQuotes.map((q) => (
            <div key={q.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.04] transition">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-50 border border-sky-100">
                  <FileText className="w-3 h-3 text-sky-600" />
                  <span className="text-xs font-extrabold text-sky-700">{q.quote_number}</span>
                </span>
                <span className="text-xs text-slate-500">v{q.version}</span>
                <QuoteStatusBadge status={q.status} />
                <span className="text-xs font-semibold text-slate-300">{fmt(q.total_selling)} Kc</span>
                {q.id === mainQuoteId && (
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase bg-white/[0.06] px-1.5 py-0.5 rounded">hlavní</span>
                )}
              </div>
              {!isCompleted && (
                <button
                  onClick={() => onRemoveQuote(q.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {isCompleted && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] text-slate-500">Zakázka je dokončena. Pro změnu nabídek ji vrate do stavu Probíhá.</span>
            </div>
          )}

          {!isCompleted && unincluded.length > 0 && (
            <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider px-1">Další dostupné</p>
              {unincluded.map((q) => (
                <div key={q.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-dashed border-white/10 hover:border-sky-500/30 hover:bg-sky-500/5 transition">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-400">{q.quote_number}</span>
                    <span className="text-xs text-slate-400">v{q.version}</span>
                    <QuoteStatusBadge status={q.status} />
                    <span className="text-xs font-semibold text-slate-300">{fmt(q.total_selling)} Kc</span>
                  </div>
                  <button
                    onClick={() => onIncludeQuote(q.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-[10px] font-extrabold hover:bg-sky-700 transition"
                  >
                    <Plus className="w-3 h-3" /> Zahrnout
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
