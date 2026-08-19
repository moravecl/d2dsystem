import { useState } from 'react';
import {
  GripVertical, Search, ChevronDown, ChevronUp, Package,
  HardHat, Wrench, UserCog, User, Truck, Boxes, Globe, Users
} from 'lucide-react';
import type { ResourceGroup, InstallationJob, ResourceGroupType } from '../calendarTypes';
import { RESOURCE_TYPE_LABELS } from '../calendarTypes';

interface Props {
  groups: ResourceGroup[];
  jobs: InstallationJob[];
  unplannedJobs: InstallationJob[];
  selectedGroupId: string | null;
  onSelectGroup: (id: string | null) => void;
  onUnplannedDragStart: (e: React.DragEvent, job: InstallationJob) => void;
}

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  installation_team: HardHat,
  service_team: Wrench,
  design_team: UserCog,
  individual: User,
  vehicle: Truck,
  equipment: Boxes,
  external: Globe,
  installation: HardHat,
  service: Wrench,
  design: UserCog,
  other: Users,
};

const TYPE_COLOR: Record<string, string> = {
  installation_team: 'text-blue-400',
  service_team: 'text-emerald-400',
  design_team: 'text-cyan-400',
  individual: 'text-amber-400',
  vehicle: 'text-orange-400',
  equipment: 'text-rose-400',
  external: 'text-slate-400',
  installation: 'text-blue-400',
  service: 'text-emerald-400',
  design: 'text-cyan-400',
  other: 'text-slate-400',
};

function getCapacityPercent(group: ResourceGroup, jobs: InstallationJob[], weekDays: number = 5): number {
  const groupJobs = jobs.filter(j => j.resource_group_id === group.id);
  if (groupJobs.length === 0) return 0;
  const totalPlannedDays = groupJobs.reduce((sum, j) => {
    if (!j.start_date || !j.end_date) return sum + 1;
    const start = new Date(j.start_date);
    const end = new Date(j.end_date);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return sum + diffDays;
  }, 0);
  return Math.round((totalPlannedDays / weekDays) * 100);
}

function CapacityBar({ percent }: { percent: number }) {
  const capped = Math.min(percent, 100);
  const isOver = percent > 100;
  const barColor = isOver ? 'bg-red-500' : percent >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  const blocks = 8;
  const filledBlocks = Math.round((capped / 100) * blocks);

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex gap-0.5">
        {Array.from({ length: blocks }).map((_, i) => (
          <div key={i} className={`w-2 h-1.5 rounded-sm ${i < filledBlocks ? barColor : 'bg-white/[0.08]'}`} />
        ))}
      </div>
      <span className={`text-[9px] font-bold ${isOver ? 'text-red-400' : percent >= 80 ? 'text-amber-400' : 'text-slate-500'}`}>
        {percent}%
      </span>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Koncept',
  design: 'Návrh',
  quoted: 'Nabídnuto',
  approved: 'Schváleno',
  in_progress: 'Probíhá',
};

type TypeSection = {
  type: ResourceGroupType;
  groups: ResourceGroup[];
};

function buildSections(groups: ResourceGroup[]): TypeSection[] {
  const order: ResourceGroupType[] = [
    'installation_team', 'service_team', 'design_team',
    'individual', 'vehicle', 'equipment', 'external',
    'installation', 'service', 'design', 'other',
  ];
  const map = new Map<ResourceGroupType, ResourceGroup[]>();
  groups.forEach(g => {
    const arr = map.get(g.type) || [];
    arr.push(g);
    map.set(g.type, arr);
  });
  return order.filter(t => map.has(t)).map(t => ({ type: t, groups: map.get(t)! }));
}

export default function InstallationSidebar({
  groups,
  jobs,
  unplannedJobs,
  selectedGroupId,
  onSelectGroup,
  onUnplannedDragStart,
}: Props) {
  const [search, setSearch] = useState('');
  const [unplannedOpen, setUnplannedOpen] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const sections = buildSections(groups);

  const toggleSection = (type: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const filtered = search
    ? unplannedJobs.filter(j =>
        j.project_name.toLowerCase().includes(search.toLowerCase()) ||
        (j.client_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : unplannedJobs;

  return (
    <div className="flex flex-col h-full w-[240px] shrink-0 border-r border-white/[0.08] bg-navy-900/40 overflow-hidden">
      <div className="p-3 border-b border-white/[0.08] overflow-y-auto flex-shrink-0" style={{ maxHeight: '60%' }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Zdroje</h3>
          <button
            onClick={() => onSelectGroup(null)}
            className={`text-[9px] font-bold px-2 py-0.5 rounded transition ${
              selectedGroupId === null
                ? 'bg-blue-600/20 text-blue-300'
                : 'text-slate-500 hover:text-white'
            }`}
          >
            Vše
          </button>
        </div>

        <div className="space-y-3">
          {sections.map(section => {
            const Icon = TYPE_ICON[section.type] || Users;
            const colorClass = TYPE_COLOR[section.type] || 'text-slate-400';
            const label = RESOURCE_TYPE_LABELS[section.type] || section.type;
            const isCollapsed = collapsedSections.has(section.type);

            return (
              <div key={section.type}>
                <button
                  onClick={() => toggleSection(section.type)}
                  className="w-full flex items-center gap-1.5 mb-1.5 hover:opacity-80 transition"
                >
                  <Icon className={`w-3 h-3 ${colorClass}`} />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex-1 text-left">{label}</span>
                  <span className="text-[9px] text-slate-600">{section.groups.length}</span>
                  {isCollapsed ? <ChevronDown className="w-3 h-3 text-slate-600" /> : <ChevronUp className="w-3 h-3 text-slate-600" />}
                </button>

                {!isCollapsed && (
                  <div className="space-y-1 pl-1">
                    {section.groups.map(group => {
                      const capacity = getCapacityPercent(group, jobs);
                      const isSelected = selectedGroupId === group.id;
                      return (
                        <button
                          key={group.id}
                          onClick={() => onSelectGroup(isSelected ? null : group.id)}
                          className={`w-full text-left px-2 py-1.5 rounded-lg transition border ${
                            isSelected
                              ? 'border-white/20 bg-white/[0.07]'
                              : 'border-transparent hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                            <span className="text-[11px] font-semibold text-white truncate flex-1">{group.name}</span>
                          </div>
                          <CapacityBar percent={capacity} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {groups.length === 0 && (
            <p className="text-[10px] text-slate-500 text-center py-4">
              Žádné skupiny.<br />
              <a href="/admin/resource-groups" className="text-blue-400 hover:underline">Vytvořte je v nastavení.</a>
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <button
          onClick={() => setUnplannedOpen(o => !o)}
          className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.08] hover:bg-white/[0.03] transition shrink-0"
        >
          <div className="flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-slate-300">Neplánované</span>
            {unplannedJobs.length > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                {unplannedJobs.length}
              </span>
            )}
          </div>
          {unplannedOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          )}
        </button>

        {unplannedOpen && (
          <div className="flex flex-col flex-1 overflow-hidden min-h-0">
            <div className="px-2 pt-2 pb-1 shrink-0">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Hledat..."
                  className="w-full pl-6 pr-2 py-1.5 text-[11px] bg-white/[0.04] border border-white/[0.08] rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/30 text-white placeholder-slate-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5 min-h-0">
              {filtered.length === 0 && (
                <div className="text-center py-6 text-[10px] text-slate-500">
                  {search ? 'Nic nenalezeno' : 'Vše je naplánováno'}
                </div>
              )}
              {filtered.map(job => (
                <div
                  key={job.id}
                  draggable
                  onDragStart={e => onUnplannedDragStart(e, job)}
                  className="flex items-start gap-1.5 p-2 rounded-lg border border-white/[0.06] bg-white/[0.03] hover:bg-amber-500/10 hover:border-amber-500/30 cursor-grab active:cursor-grabbing transition group"
                >
                  <GripVertical className="w-3 h-3 text-slate-600 group-hover:text-amber-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-white truncate leading-tight">{job.project_name}</p>
                    {job.client_name && (
                      <p className="text-[9px] text-slate-500 truncate mt-0.5">{job.client_name}</p>
                    )}
                    <span className="inline-block mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-500">
                      {STATUS_LABELS[job.status] || job.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-3 py-2 border-t border-white/[0.06] shrink-0">
              <p className="text-[9px] text-slate-600 text-center">Přetáhněte zakázku do mřížky</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
