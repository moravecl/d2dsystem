import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, Package, BookOpen, CheckSquare, Map,
  BarChart3, ClipboardCheck, Wrench, FileText, Square,
  CheckCircle2, Play, Plus, BookOpen as DiaryIcon, Timer,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { logAudit } from '../../lib/auditLog';
import ExecutionHeroBanner from './ExecutionHeroBanner';
import ExecutionOverview from './ExecutionOverview';
import WorklogModule from './WorklogModule';
import MaterialModule from './MaterialModule';
import DiaryModule from './DiaryModule';
import DefectsModule from './DefectsModule';

interface ProjectQuote {
  id: string;
  quote_number: string;
  version: number;
  total_selling: number;
  status: string;
}

interface Job {
  id: string;
  project_id: string;
  quote_id: string | null;
  included_quote_ids: string[];
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Props {
  job: Job;
  allQuotes: ProjectQuote[];
  onStatusChange: (status: string) => void;
  onRefresh: () => void;
}

const execTabs = [
  { key: 'overview', label: 'Přehled', icon: BarChart3 },
  { key: 'material', label: 'Materiál', icon: Package },
  { key: 'time', label: 'Čas', icon: Clock },
  { key: 'diary', label: 'Deník', icon: BookOpen },
  { key: 'tasks', label: 'Úkoly', icon: CheckSquare },
  { key: 'floorplan', label: 'Půdorys', icon: Map },
  { key: 'predani', label: 'Předání', icon: ClipboardCheck },
  { key: 'servis', label: 'Servis', icon: Wrench },
];

export default function ExecutionDashboard({ job, allQuotes, onStatusChange, onRefresh }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobile] = useState(() => window.innerWidth < 900);
  const [projectName, setProjectName] = useState('');
  const [projectAddress, setProjectAddress] = useState('');
  const [projectLat, setProjectLat] = useState<number | null>(null);
  const [projectLon, setProjectLon] = useState<number | null>(null);

  const [runningTimer, setRunningTimer] = useState<{ activity: string; startedAt: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [defectsCount, setDefectsCount] = useState(0);

  useEffect(() => {
    supabase.from('projects').select('name, address, address_lat, address_lon').eq('id', job.project_id).maybeSingle()
      .then(({ data }) => {
        if (data?.name) setProjectName(data.name);
        if (data?.address) setProjectAddress(data.address);
        if (data?.address_lat) setProjectLat(data.address_lat);
        if (data?.address_lon) setProjectLon(data.address_lon);
      });
  }, [job.project_id]);

  const checkRunningTimer = useCallback(async () => {
    const { data } = await supabase
      .from('job_worklogs')
      .select('activity, started_at')
      .eq('job_id', job.id)
      .eq('is_running', true)
      .limit(1)
      .maybeSingle();
    if (data) {
      setRunningTimer({ activity: data.activity, startedAt: data.started_at });
    } else {
      setRunningTimer(null);
    }
  }, [job.id]);

  useEffect(() => { checkRunningTimer(); }, [checkRunningTimer]);

  useEffect(() => {
    supabase.from('project_defects').select('id', { count: 'exact', head: true })
      .eq('project_id', job.project_id).neq('status', 'resolved')
      .then(({ count }) => setDefectsCount(count || 0));
  }, [job.project_id]);

  useEffect(() => {
    if (runningTimer?.startedAt) {
      const start = new Date(runningTimer.startedAt).getTime();
      const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      setElapsed(0);
    }
  }, [runningTimer]);

  const includedIds = (job.included_quote_ids || []).filter(Boolean);
  if (job.quote_id && !includedIds.includes(job.quote_id)) {
    includedIds.unshift(job.quote_id);
  }

  const handleIncludeQuote = async (quoteId: string) => {
    const newIds = [...includedIds, quoteId];
    const updates: Record<string, unknown> = { included_quote_ids: newIds };
    if (!job.quote_id) {
      updates.quote_id = quoteId;
    }
    const { error } = await supabase.from('jobs').update(updates).eq('id', job.id);
    if (error) {
      toast('Chyba', 'error');
    } else {
      await logAudit('job', job.id, 'quote_included', { quote_id: quoteId });
      toast('Nabídka zahrnuta do realizace');
      onRefresh();
    }
  };

  const handleRemoveQuote = async (quoteId: string) => {
    const newIds = includedIds.filter(id => id !== quoteId);
    const updates: Record<string, unknown> = { included_quote_ids: newIds };
    if (quoteId === job.quote_id) {
      updates.quote_id = newIds[0] || null;
    }
    const { error } = await supabase.from('jobs').update(updates).eq('id', job.id);
    if (error) {
      toast('Chyba', 'error');
    } else {
      toast('Nabídka odebrána');
      onRefresh();
    }
  };

  const formatTimerElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const tabBadges: Record<string, number> = {};
  if (defectsCount > 0) tabBadges['tasks'] = defectsCount;

  return (
    <div className="space-y-4">
      <ExecutionHeroBanner
        job={job}
        onStatusChange={onStatusChange}
        runningTimerElapsed={runningTimer ? elapsed : null}
        runningTimerActivity={runningTimer?.activity || null}
      />

      {isMobile ? (
        <div className="fixed bottom-0 left-0 right-0 bg-navy-900/95 backdrop-blur-md border-t border-white/[0.08] z-40 flex safe-area-bottom">
          {execTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const badge = tabBadges[tab.key];
            const hasRunningDot = tab.key === 'time' && runningTimer;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition relative ${
                  isActive ? 'text-teal-400' : 'text-slate-500'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {badge && badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                  {hasRunningDot && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse-dot" />
                  )}
                </div>
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex gap-1 p-1 bg-white/[0.04] rounded-xl overflow-x-auto">
          {execTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const badge = tabBadges[tab.key];
            const hasRunningDot = tab.key === 'time' && runningTimer;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap relative ${
                  isActive
                    ? 'bg-white/[0.10] text-white '
                    : 'text-slate-400 hover:text-slate-300 hover:bg-white/[0.04]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {badge && badge > 0 && (
                  <span className="ml-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {badge}
                  </span>
                )}
                {hasRunningDot && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-dot ml-1" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {runningTimer && activeTab !== 'time' && !isMobile && (
        <button
          onClick={() => setActiveTab('time')}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-all group animate-timer-glow"
        >
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse-dot" />
            <span className="text-sm font-extrabold text-red-400">Timer běží</span>
            <span className="text-xs text-red-400/70">{runningTimer.activity}</span>
          </div>
          <span className="text-lg font-mono font-extrabold text-red-400 tabular-nums">
            {formatTimerElapsed(elapsed)}
          </span>
        </button>
      )}

      <div className={isMobile ? 'pb-24' : ''}>
        {activeTab === 'overview' && (
          <ExecutionOverview
            jobId={job.id}
            projectId={job.project_id}
            allQuotes={allQuotes}
            includedIds={includedIds}
            mainQuoteId={job.quote_id}
            jobStatus={job.status}
            onIncludeQuote={handleIncludeQuote}
            onRemoveQuote={handleRemoveQuote}
          />
        )}

        {activeTab === 'time' && (
          <WorklogModule jobId={job.id} isMobile={isMobile} onTimerChange={checkRunningTimer} />
        )}

        {activeTab === 'material' && (
          <MaterialModule jobId={job.id} quoteIds={includedIds} projectId={job.project_id} allQuotes={allQuotes} />
        )}

        {activeTab === 'diary' && (
          <DiaryModule jobId={job.id} projectName={projectName} projectAddress={projectAddress} projectLat={projectLat} projectLon={projectLon} />
        )}

        {activeTab === 'tasks' && (
          <DefectsModule projectId={job.project_id} />
        )}

        {activeTab === 'floorplan' && (
          <div className="text-center py-16">
            <Map className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">Půdorys realizace bude brzy k dispozici</p>
          </div>
        )}

        {activeTab === 'predani' && (
          <HandoverTab projectId={job.project_id} onNavigate={navigate} />
        )}

        {activeTab === 'servis' && (
          <ServiceTab projectId={job.project_id} onNavigate={navigate} />
        )}
      </div>

      {isMobile && (
        <MobileFAB
          activeTab={activeTab}
          onStartTimer={() => setActiveTab('time')}
          onAddDiary={() => setActiveTab('diary')}
          onAddMaterial={() => setActiveTab('material')}
        />
      )}
    </div>
  );
}

function MobileFAB({ activeTab, onStartTimer, onAddDiary, onAddMaterial }: {
  activeTab: string;
  onStartTimer: () => void;
  onAddDiary: () => void;
  onAddMaterial: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (activeTab !== 'overview') return null;

  return (
    <div className="fixed bottom-20 right-4 z-50">
      {open && (
        <div className="absolute bottom-16 right-0 space-y-2 animate-scale-in">
          <button
            onClick={() => { setOpen(false); onStartTimer(); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-navy-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/[0.08] text-sm font-semibold text-slate-300 whitespace-nowrap hover:bg-white/[0.07] transition"
          >
            <Timer className="w-4 h-4 text-red-400" /> Spustit timer
          </button>
          <button
            onClick={() => { setOpen(false); onAddDiary(); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-navy-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/[0.08] text-sm font-semibold text-slate-300 whitespace-nowrap hover:bg-white/[0.07] transition"
          >
            <DiaryIcon className="w-4 h-4 text-amber-400" /> Nový zápis
          </button>
          <button
            onClick={() => { setOpen(false); onAddMaterial(); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-navy-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/[0.08] text-sm font-semibold text-slate-300 whitespace-nowrap hover:bg-white/[0.07] transition"
          >
            <Package className="w-4 h-4 text-emerald-400" /> Přidat materiál
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all ${
          open ? 'bg-white/[0.15] rotate-45' : 'bg-teal-600 hover:bg-teal-700'
        }`}
      >
        <Plus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}

function HandoverTab({ projectId, onNavigate }: { projectId: string; onNavigate: (path: string) => void }) {
  const checklist = [
    'Kontrola dokončení všech prací',
    'Úklid staveniště',
    'Fotodokumentace hotového stavu',
    'Příprava předávacích dokumentů',
    'Zkoušky a revize',
    'Zaškolení klienta',
  ];
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const completedCount = Object.values(checked).filter(Boolean).length;
  const progress = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Checklist předání</h3>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            progress === 100
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-white/[0.07] text-slate-400'
          }`}>
            {completedCount}/{checklist.length}
          </span>
        </div>

        <div className="px-5 py-3">
          <div className="h-2 bg-white/[0.07] rounded-full overflow-hidden mb-4">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="space-y-1">
            {checklist.map((item, i) => (
              <label key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] cursor-pointer transition group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={!!checked[i]}
                    onChange={() => setChecked(prev => ({ ...prev, [i]: !prev[i] }))}
                    className="sr-only"
                  />
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                    checked[i]
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-white/20 group-hover:border-white/30'
                  }`}>
                    {checked[i] && (
                      <CheckCircle2 className="w-4 h-4 text-white animate-check-pop" />
                    )}
                  </div>
                </div>
                <span className={`text-sm transition-all ${
                  checked[i] ? 'text-slate-500 line-through' : 'text-slate-300'
                }`}>{item}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border border-emerald-500/20 rounded-2xl p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <ClipboardCheck className="w-7 h-7 text-emerald-400" />
        </div>
        <p className="text-sm font-semibold text-emerald-300 mb-4">Vytvořte předávací protokol z dokumentu projektu</p>
        <button
          onClick={() => {
            const url = `/projekty/${projectId}`;
            onNavigate(url);
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('open-document-modal', { detail: { type: 'predavaci_protokol' } }));
            }, 300);
          }}
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white text-sm font-extrabold rounded-xl hover:bg-emerald-700 transition-all hover:shadow-lg hover:shadow-emerald-600/20 active:scale-95"
        >
          <FileText className="w-4 h-4" />
          Vytvořit předávací protokol
        </button>
      </div>
    </div>
  );
}

function ServiceTab({ projectId, onNavigate }: { projectId: string; onNavigate: (path: string) => void }) {
  const [protocols, setProtocols] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('service_protocols').select('id, title, status, created_at')
      .eq('project_id', projectId).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => {
        setProtocols(data || []);
        setLoading(false);
      });
  }, [projectId]);

  return (
    <div className="space-y-5">
      {!loading && protocols.length > 0 && (
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Existující protokoly</h3>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {protocols.map(p => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-slate-300">{p.title || 'Servisní protokol'}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    {new Date(p.created_at).toLocaleDateString('cs-CZ')}
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  p.status === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {p.status === 'completed' ? 'Dokončen' : 'Rozpracován'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-sky-900/40 to-blue-900/40 border border-sky-500/20 rounded-2xl p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-sky-500/20 flex items-center justify-center mx-auto mb-4">
          <Wrench className="w-7 h-7 text-sky-400" />
        </div>
        <p className="text-sm font-semibold text-sky-300 mb-4">Vytvořte servisní protokol z dokumentu projektu</p>
        <button
          onClick={() => {
            const url = `/projekty/${projectId}`;
            onNavigate(url);
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('open-document-modal', { detail: { type: 'servisni_protokol' } }));
            }, 300);
          }}
          className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 text-white text-sm font-extrabold rounded-xl hover:bg-sky-700 transition-all hover:shadow-lg hover:shadow-sky-600/20 active:scale-95"
        >
          <FileText className="w-4 h-4" />
          Vytvořit servisní protokol
        </button>
      </div>
    </div>
  );
}
