import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  FolderKanban, Flag, Edit2, Trash2, Download,
} from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import { exportGanttPdf } from './ganttPdfExport';
import GanttMilestoneBar from './GanttMilestoneBar';
import GanttDependencyArrows from './GanttDependencyArrows';
import {
  type ProjectRef, type Milestone,
  STATUS_COLORS, STATUS_LABELS, MS_STATUS, PRESET_COLORS, VIEW_PRESETS,
  addDays, daysBetween, fmtDate,
} from './ganttTypes';

const ROW_HEIGHT = 36;

export default function GanttPage() {
  const { setConfig } = useHeader();
  const { user: _user } = useAuth();
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editMs, setEditMs] = useState<Milestone | null>(null);
  const [form, setForm] = useState({
    project_id: '', name: '', start_date: '', end_date: '', status: 'planned',
    color: '#3b82f6', progress: 0, depends_on: [] as string[],
  });
  const [dayOffset, setDayOffset] = useState(0);
  const [viewKey, setViewKey] = useState('3m');

  const viewDays = VIEW_PRESETS.find(v => v.key === viewKey)?.days ?? 91;

  useEffect(() => {
    setConfig({
      breadcrumbs: [{ label: 'Gantt' }],
      primaryAction: {
        label: 'Nový milník',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => {
          setEditMs(null);
          setForm({ project_id: '', name: '', start_date: '', end_date: '', status: 'planned', color: '#3b82f6', progress: 0, depends_on: [] });
          setShowModal(true);
        },
      },
    });
  }, [setConfig]);

  const fetchMilestones = useCallback(async () => {
    const { data } = await supabase.from('project_milestones').select('*').order('sort_order').order('start_date');
    setMilestones((data || []) as Milestone[]);
  }, []);

  useEffect(() => {
    (async () => {
      const [projRes] = await Promise.all([
        supabase.from('projects').select('id, project_name, status, deadline, created_at').neq('status', 'cancelled').order('created_at', { ascending: false }),
      ]);
      setProjects((projRes.data || []) as ProjectRef[]);
      setExpandedProjects(new Set((projRes.data || []).map((p: any) => p.id)));
      await fetchMilestones();
      setLoading(false);
    })();
  }, [fetchMilestones]);

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.project_id || !form.name || !form.start_date || !form.end_date) return;
    const payload = {
      project_id: form.project_id,
      name: form.name,
      start_date: form.start_date,
      end_date: form.end_date,
      status: form.status,
      color: form.color,
      progress: form.progress,
      depends_on: form.depends_on,
    };
    if (editMs) {
      const { error } = await supabase.from('project_milestones').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editMs.id);
      if (error) { toast('Chyba', 'error'); return; }
      toast('Milník aktualizován');
    } else {
      const { error } = await supabase.from('project_milestones').insert(payload);
      if (error) { toast('Chyba', 'error'); return; }
      toast('Milník vytvořen');
    }
    setShowModal(false);
    await fetchMilestones();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Smazat milník?')) return;
    await supabase.from('project_milestones').delete().eq('id', id);
    setMilestones(prev => prev.filter(m => m.id !== id));
    toast('Milník smazán');
  };

  const handleDragUpdate = useCallback(async (id: string, start_date: string, end_date: string) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, start_date, end_date } : m));
    const { error } = await supabase.from('project_milestones').update({ start_date, end_date, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      toast('Chyba při ukládání', 'error');
      await fetchMilestones();
    }
  }, [fetchMilestones, toast]);

  const handleProgressChange = useCallback(async (id: string, progress: number) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, progress } : m));
    await supabase.from('project_milestones').update({ progress, updated_at: new Date().toISOString() }).eq('id', id);
  }, []);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = addDays(today, dayOffset);
  const endDate = addDays(startDate, viewDays);
  const totalDays = viewDays;

  const stepSize = useMemo(() => {
    if (viewDays <= 14) return viewDays;
    if (viewDays <= 31) return 14;
    return 30;
  }, [viewDays]);

  const timeHeaders = useMemo(() => {
    if (viewDays <= 31) {
      const monthGroups: { label: string; span: number }[] = [];
      const days: { label: string; isWeekend: boolean; isToday: boolean }[] = [];
      let curMonth = '';
      let curSpan = 0;

      for (let i = 0; i < totalDays; i++) {
        const d = addDays(startDate, i);
        const ml = d.toLocaleDateString('cs-CZ', { month: 'short', year: 'numeric' });
        const dow = d.getDay();
        if (ml !== curMonth) {
          if (curMonth) monthGroups.push({ label: curMonth, span: curSpan });
          curMonth = ml;
          curSpan = 0;
        }
        curSpan++;
        days.push({ label: String(d.getDate()), isWeekend: dow === 0 || dow === 6, isToday: d.toDateString() === now.toDateString() });
      }
      if (curMonth) monthGroups.push({ label: curMonth, span: curSpan });
      return { type: 'days' as const, monthGroups, days };
    }

    const monthGroups: { label: string; days: number }[] = [];
    let cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cur < endDate) {
      const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const mStart = cur < startDate ? startDate : cur;
      const mEnd = next > endDate ? endDate : next;
      const d = daysBetween(mStart, mEnd);
      if (d > 0) {
        monthGroups.push({ label: cur.toLocaleDateString('cs-CZ', { month: 'short', year: 'numeric' }), days: d });
      }
      cur = next;
    }
    return { type: 'months' as const, monthGroups };
  }, [startDate.getTime(), endDate.getTime(), totalDays, viewDays]);

  const getBarPosition = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const leftDay = Math.max(0, daysBetween(startDate, s));
    const rightDay = Math.min(totalDays, daysBetween(startDate, e) + 1);
    const width = Math.max(1, rightDay - leftDay);
    return { left: `${(leftDay / totalDays) * 100}%`, width: `${(width / totalDays) * 100}%` };
  };

  const todayPos = (() => {
    const diff = daysBetween(startDate, now);
    if (diff < 0 || diff > totalDays) return null;
    return `${(diff / totalDays) * 100}%`;
  })();

  const rangeLabel = `${fmtDate(startDate)} – ${fmtDate(addDays(endDate, -1))}`;

  const headerHeight = useMemo(() => timeHeaders.type === 'days' ? 68 : 40, [timeHeaders.type]);

  const visibleMilestones = useMemo(() => {
    const result: Milestone[] = [];
    for (const p of projects) {
      if (!expandedProjects.has(p.id)) continue;
      result.push(...milestones.filter(m => m.project_id === p.id));
    }
    return result;
  }, [projects, milestones, expandedProjects]);

  const toggleDependency = (msId: string) => {
    setForm(prev => {
      const deps = prev.depends_on.includes(msId)
        ? prev.depends_on.filter(d => d !== msId)
        : [...prev.depends_on, msId];
      return { ...prev, depends_on: deps };
    });
  };

  if (loading) {
    return <div className="space-y-4"><div className="h-64 bg-navy-700/50 rounded-xl border border-white/[0.08] animate-pulse" /></div>;
  }

  return (
    <div className="space-y-4">
      <div data-tour="gantt-controls" className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => setDayOffset(o => o - stepSize)} className="p-1.5 rounded-lg hover:bg-white/[0.06]/[0.04] transition">
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </button>
          <span className="text-sm font-semibold text-slate-300 min-w-[220px] text-center">{rangeLabel}</span>
          <button onClick={() => setDayOffset(o => o + stepSize)} className="p-1.5 rounded-lg hover:bg-white/[0.06]/[0.04] transition">
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        {dayOffset !== 0 && <button onClick={() => setDayOffset(0)} className="text-xs text-blue-400 font-semibold">Dnes</button>}
        <div data-tour="gantt-presets" className="ml-auto flex items-center gap-1 flex-wrap">
          {VIEW_PRESETS.map(v => (
            <button
              key={v.key}
              onClick={() => setViewKey(v.key)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${viewKey === v.key ? 'bg-blue-600 text-white' : 'text-slate-400 bg-white/[0.06]/[0.07] border border-white/10 hover:bg-white/[0.06]/[0.04]'}`}
            >
              {v.label}
            </button>
          ))}
          <div className="w-px h-5 bg-white/[0.06]/[0.08] mx-1" />
          <button
            onClick={() => exportGanttPdf(projects, milestones, startDate, totalDays, todayPos, rangeLabel, STATUS_COLORS, STATUS_LABELS, MS_STATUS)}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-400 hover:bg-white/[0.06]/[0.04] rounded-lg transition"
            title="Export do PDF"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>
      </div>

      <div ref={containerRef} className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] overflow-hidden relative">
        <div className="flex">
          <div className="w-64 shrink-0 border-r border-white/[0.08]">
            <div className="h-10 border-b border-white/[0.08] px-3 flex items-center">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Projekt / Milník</span>
            </div>
            {timeHeaders.type === 'days' && <div className="h-7 border-b border-white/[0.06]" />}
          </div>
          <div className="flex-1 overflow-x-auto">
            {timeHeaders.type === 'days' ? (
              <>
                <div className="flex h-10 border-b border-white/[0.08] min-w-[600px]">
                  {timeHeaders.monthGroups.map((m, i) => (
                    <div key={i} className="flex items-center justify-center text-xs font-semibold text-slate-500 border-r border-white/[0.06] last:border-r-0" style={{ width: `${(m.span / totalDays) * 100}%` }}>
                      {m.label}
                    </div>
                  ))}
                </div>
                <div className="flex h-7 border-b border-white/[0.06] min-w-[600px]">
                  {timeHeaders.days.map((d, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-center text-[10px] font-semibold border-r border-white/[0.04] last:border-r-0 ${d.isToday ? 'bg-red-900/30 text-red-400 font-bold' : d.isWeekend ? 'bg-white/[0.06]/[0.04] text-slate-500' : 'text-slate-500'}`}
                      style={{ width: `${(1 / totalDays) * 100}%` }}
                    >
                      {d.label}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-10 border-b border-white/[0.08] min-w-[600px]">
                {timeHeaders.monthGroups.map((m, i) => (
                  <div key={i} className="flex items-center justify-center text-xs font-semibold text-slate-500 border-r border-white/[0.06] last:border-r-0" style={{ width: `${(m.days / totalDays) * 100}%` }}>
                    {m.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {projects.map((project) => {
          const projMilestones = milestones.filter(m => m.project_id === project.id);
          const isExpanded = expandedProjects.has(project.id);
          const projColor = STATUS_COLORS[project.status] || '#64748b';

          return (
            <div key={project.id}>
              <div className="flex border-b border-white/[0.06] hover:bg-white/[0.06]/[0.04] transition">
                <div className="w-64 shrink-0 border-r border-white/[0.08] px-3 py-2.5 flex items-center gap-2">
                  <button onClick={() => toggleProject(project.id)} className="p-0.5 rounded hover:bg-white/[0.06]/[0.08] transition shrink-0">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: projColor }} />
                  <Link to={`/projekty/${project.id}`} className="text-xs font-bold text-white truncate hover:text-blue-400 transition">
                    {project.project_name}
                  </Link>
                  <span className="ml-auto text-[9px] font-bold text-slate-500">{projMilestones.length}</span>
                </div>
                <div className="flex-1 relative py-2.5 min-w-[600px]" data-gantt-timeline>
                  {!isExpanded && projMilestones.length > 0 ? (() => {
                    const minStart = projMilestones.reduce((a, b) => a.start_date < b.start_date ? a : b).start_date;
                    const maxEnd = projMilestones.reduce((a, b) => a.end_date > b.end_date ? a : b).end_date;
                    const totalMs = Math.max(1, Math.round((new Date(maxEnd).getTime() - new Date(minStart).getTime()) / 86400000) + 1);
                    const pos = getBarPosition(minStart, maxEnd);
                    return (
                      <div className="absolute top-2 h-6 rounded-full flex items-center px-2 " style={{ left: pos.left, width: pos.width, backgroundColor: projColor }}>
                        <span className="text-[9px] font-bold text-white truncate whitespace-nowrap">
                          {projMilestones.length} milníků  |  {fmtDate(new Date(minStart))} – {fmtDate(new Date(maxEnd))}  |  {totalMs} dní
                        </span>
                      </div>
                    );
                  })() : !isExpanded && project.deadline ? (() => {
                    const pos = getBarPosition(project.created_at, project.deadline);
                    return <div className="absolute top-2.5 h-5 rounded-full opacity-20" style={{ left: pos.left, width: pos.width, backgroundColor: projColor }} />;
                  })() : null}
                  {isExpanded && project.deadline && (() => {
                    const pos = getBarPosition(project.created_at, project.deadline);
                    return <div className="absolute top-2.5 h-5 rounded-full opacity-20" style={{ left: pos.left, width: pos.width, backgroundColor: projColor }} />;
                  })()}
                  {todayPos && <div className="absolute top-0 bottom-0 w-px bg-red-400 z-10" style={{ left: todayPos }} />}
                </div>
              </div>

              {isExpanded && projMilestones.map((ms) => {
                const st = MS_STATUS[ms.status] || MS_STATUS.planned;
                return (
                  <div key={ms.id} data-milestone-id={ms.id} className="flex border-b border-white/[0.06] hover:bg-white/[0.06]/[0.04] transition group" style={{ height: ROW_HEIGHT }}>
                    <div className="w-64 shrink-0 border-r border-white/[0.08] pl-10 pr-3 py-1.5 flex items-center gap-2">
                      <Flag className="w-3 h-3 shrink-0" style={{ color: ms.color }} />
                      <span className="text-[11px] font-semibold text-slate-300 truncate">{ms.name}</span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${st.color} shrink-0`}>{st.label}</span>
                      {ms.progress > 0 && (
                        <div className="flex items-center gap-1 shrink-0">
                          <div className="w-10 h-1.5 bg-white/[0.06]/[0.08] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${ms.progress}%`, backgroundColor: ms.color }} />
                          </div>
                          <span className="text-[8px] font-bold text-slate-500">{ms.progress}%</span>
                        </div>
                      )}
                      <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={ms.progress}
                          onChange={e => handleProgressChange(ms.id, Number(e.target.value))}
                          className="w-12 h-1 accent-blue-600 cursor-pointer"
                          title={`Dokončeno: ${ms.progress}%`}
                        />
                        <button onClick={() => {
                          setEditMs(ms);
                          setForm({
                            project_id: ms.project_id, name: ms.name, start_date: ms.start_date,
                            end_date: ms.end_date, status: ms.status, color: ms.color,
                            progress: ms.progress, depends_on: ms.depends_on || [],
                          });
                          setShowModal(true);
                        }} className="p-0.5 rounded hover:bg-blue-500/100/100/20 text-slate-400 hover:text-blue-400 transition">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDelete(ms.id)} className="p-0.5 rounded hover:bg-red-500/100/100/20 text-slate-400 hover:text-red-400 transition">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 relative min-w-[600px]" data-gantt-timeline>
                      <GanttMilestoneBar
                        milestone={ms}
                        startDate={startDate}
                        totalDays={totalDays}
                        onUpdate={handleDragUpdate}
                      />
                      {todayPos && <div className="absolute top-0 bottom-0 w-px bg-red-400 z-10" style={{ left: todayPos }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {projects.length === 0 && (
          <div className="py-16 text-center">
            <FolderKanban className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Žádné projekty</p>
          </div>
        )}

        <GanttDependencyArrows
          milestones={visibleMilestones}
          startDate={startDate}
          totalDays={totalDays}
          containerRef={containerRef}
          rowHeight={ROW_HEIGHT}
          headerHeight={headerHeight}
          sidebarWidth={256}
        />
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editMs ? 'Upravit milník' : 'Nový milník'} size="md" footer={
        <>
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-400 bg-white/[0.06]/[0.07] border border-white/10 hover:bg-white/[0.06]/[0.04] rounded-lg transition">Zrušit</button>
          <button onClick={handleSave} disabled={!form.project_id || !form.name || !form.start_date || !form.end_date} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">{editMs ? 'Uložit' : 'Vytvořit'}</button>
        </>
      }>
        <div className="space-y-4">
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Projekt *</label>
            <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
              <option value="">Vyberte...</option>{projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Název milníku *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Začátek *</label><input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" /></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Konec *</label><input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Stav</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                {Object.entries(MS_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Dokončeno ({form.progress}%)</label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={form.progress}
                onChange={e => setForm({ ...form, progress: Number(e.target.value) })}
                className="w-full h-2 accent-blue-600 mt-2"
              />
            </div>
          </div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Barva</label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setForm({ ...form, color: c })} className={`w-7 h-7 rounded-lg border-2 transition ${form.color === c ? 'border-white/40 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {form.project_id && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Závislosti</label>
              <div className="max-h-32 overflow-y-auto space-y-1 border border-white/[0.06] rounded-xl p-2">
                {milestones
                  .filter(m => m.project_id === form.project_id && m.id !== editMs?.id)
                  .map(m => (
                    <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.06]/[0.04] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.depends_on.includes(m.id)}
                        onChange={() => toggleDependency(m.id)}
                        className="w-3.5 h-3.5 rounded border-white/20 text-blue-400 focus:ring-blue-500/50"
                      />
                      <Flag className="w-3 h-3 shrink-0" style={{ color: m.color }} />
                      <span className="text-xs text-slate-300">{m.name}</span>
                    </label>
                  ))}
                {milestones.filter(m => m.project_id === form.project_id && m.id !== editMs?.id).length === 0 && (
                  <p className="text-xs text-slate-500 px-2">Žádné další milníky v tomto projektu</p>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
