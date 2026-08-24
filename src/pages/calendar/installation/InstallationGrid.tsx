import { Plus } from 'lucide-react';
import type { ResourceGroup, InstallationJob } from '../calendarTypes';
import { addDays, dateToStr } from '../calendarTypes';
import InstallationEventCard from './InstallationEventCard';

const DAY_LABELS = ['Po', 'Út', 'St', 'Čt', 'Pá'];
const DAY_LABELS_FULL = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek'];

interface Props {
  weekStart: Date;
  groups: ResourceGroup[];
  jobs: InstallationJob[];
  selectedGroupId: string | null;
  onCellClick: (groupId: string, dateStr: string) => void;
  onJobClick: (job: InstallationJob) => void;
  onJobDragStart: (e: React.DragEvent, job: InstallationJob) => void;
  onDropOnCell: (e: React.DragEvent, groupId: string, dateStr: string) => void;
  dragOverCell: { groupId: string; date: string } | null;
  onDragOverCell: (groupId: string, dateStr: string) => void;
  onDragLeaveCell: () => void;
}

function getJobsForGroupAndDay(
  jobs: InstallationJob[],
  groupId: string,
  dateStr: string
): InstallationJob[] {
  return jobs.filter(j => {
    if (j.resource_group_id !== groupId) return false;
    if (!j.start_date) return false;
    const start = j.start_date;
    const end = j.end_date || j.start_date;
    return dateStr >= start && dateStr <= end;
  });
}

function getJobStartColumn(job: InstallationJob, weekDays: string[]): number {
  if (!job.start_date) return 0;
  const idx = weekDays.indexOf(job.start_date);
  return idx >= 0 ? idx : 0;
}

function getJobSpan(job: InstallationJob, weekDays: string[], startCol: number): number {
  if (!job.end_date && !job.start_date) return 1;
  const end = (job.end_date || job.start_date)!;
  const endIdx = weekDays.lastIndexOf(end);
  if (endIdx < 0) {
    if (end > weekDays[weekDays.length - 1]) return weekDays.length - startCol;
    return 1;
  }
  return Math.max(1, endIdx - startCol + 1);
}

function isJobStartThisWeek(job: InstallationJob, weekDays: string[]): boolean {
  return weekDays.includes(job.start_date || '');
}

export default function InstallationGrid({
  weekStart,
  groups,
  jobs,
  selectedGroupId,
  onCellClick,
  onJobClick,
  onJobDragStart,
  onDropOnCell,
  dragOverCell,
  onDragOverCell,
  onDragLeaveCell,
}: Props) {
  const weekDays: string[] = Array.from({ length: 5 }, (_, i) => dateToStr(addDays(weekStart, i)));

  const visibleGroups = selectedGroupId
    ? groups.filter(g => g.id === selectedGroupId)
    : groups;

  const today = dateToStr(new Date());

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="min-w-[600px]">
        <div className="grid border-b border-white/[0.08]" style={{ gridTemplateColumns: `1fr repeat(5, 1fr)` }}>
          <div className="px-3 py-2.5" />
          {weekDays.map((d, i) => {
            const date = addDays(weekStart, i);
            const isToday = d === today;
            return (
              <div
                key={d}
                className={`px-3 py-2.5 border-l border-white/[0.06] text-center ${isToday ? 'bg-blue-600/10' : ''}`}
              >
                <p className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-blue-400' : 'text-slate-500'}`}>
                  {DAY_LABELS[i]}
                </p>
                <p className={`text-sm font-bold mt-0.5 ${isToday ? 'text-blue-300' : 'text-slate-300'}`}>
                  {date.getDate()}.{date.getMonth() + 1}.
                </p>
                <p className="text-[9px] text-slate-600 hidden xl:block">{DAY_LABELS_FULL[i]}</p>
              </div>
            );
          })}
        </div>

        {visibleGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
              <Plus className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-slate-400">Žádné skupiny nejsou vytvořeny</p>
            <p className="text-xs text-slate-600 mt-1">Přidejte pracovní skupiny v nastavení týmů</p>
          </div>
        )}

        {visibleGroups.map((group, groupIdx) => {
          const groupJobs = jobs.filter(j => j.resource_group_id === group.id);
          const jobsStartingThisWeek = groupJobs.filter(j => isJobStartThisWeek(j, weekDays));

          return (
            <div
              key={group.id}
              className={`border-b border-white/[0.06] ${groupIdx % 2 === 0 ? 'bg-white/[0.01]' : ''}`}
            >
              <div className="grid" style={{ gridTemplateColumns: `1fr repeat(5, 1fr)` }}>
                <div className="flex items-start gap-2 px-3 py-3 border-r border-white/[0.06]">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <div>
                    <p className="text-[11px] font-bold text-white leading-tight">{group.name}</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      {group.members.map(m => m.display_name).join(', ') || 'Bez členů'}
                    </p>
                  </div>
                </div>

                {weekDays.map(d => {
                  const isDragOver = dragOverCell?.groupId === group.id && dragOverCell?.date === d;
                  const isToday = d === today;

                  return (
                    <div
                      key={d}
                      className={`border-l border-white/[0.06] min-h-[80px] relative transition-colors duration-100 ${
                        isToday ? 'bg-blue-600/[0.05]' : ''
                      } ${isDragOver ? 'bg-blue-500/20 border-blue-500/40' : ''}`}
                      onDragOver={e => {
                        e.preventDefault();
                        onDragOverCell(group.id, d);
                      }}
                      onDragLeave={onDragLeaveCell}
                      onDrop={e => onDropOnCell(e, group.id, d)}
                      onClick={() => onCellClick(group.id, d)}
                    >
                      {isDragOver && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-6 h-6 rounded-full bg-blue-500/30 flex items-center justify-center">
                            <Plus className="w-3 h-3 text-blue-400" />
                          </div>
                        </div>
                      )}

                      {!isDragOver && getJobsForGroupAndDay(jobs, group.id, d).length === 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); onCellClick(group.id, d); }}
                          className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity group"
                        >
                          <span className="flex items-center gap-1 text-[9px] text-slate-500 group-hover:text-blue-400 transition-colors">
                            <Plus className="w-3 h-3" />
                            Naplánovat
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {jobsStartingThisWeek.length > 0 && (
                <div className="px-3 pb-3 pt-0">
                  <div
                    className="grid gap-1.5"
                    style={{ gridTemplateColumns: `240px repeat(5, 1fr)` }}
                  >
                    <div />
                    <div
                      className="col-span-5 grid gap-1.5"
                      style={{ gridTemplateColumns: `repeat(5, 1fr)` }}
                    >
                      {jobsStartingThisWeek.map(job => {
                        const startCol = getJobStartColumn(job, weekDays);
                        const span = getJobSpan(job, weekDays, startCol);
                        return (
                          <div
                            key={job.id}
                            style={{ gridColumnStart: startCol + 1, gridColumnEnd: `span ${span}` }}
                          >
                            <InstallationEventCard
                              job={job}
                              spanDays={span}
                              onClick={onJobClick}
                              onDragStart={onJobDragStart}
                              groupColor={group.color}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
