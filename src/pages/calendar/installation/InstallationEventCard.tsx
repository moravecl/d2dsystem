import { GripVertical, Clock, Users, ExternalLink } from 'lucide-react';
import type { InstallationJob } from '../calendarTypes';
import { JOB_TYPE_COLORS, JOB_TYPE_LABELS } from '../calendarTypes';

interface Props {
  job: InstallationJob;
  spanDays: number;
  onClick: (job: InstallationJob) => void;
  onDragStart: (e: React.DragEvent, job: InstallationJob) => void;
  groupColor: string;
}

export default function InstallationEventCard({ job, spanDays, onClick, onDragStart, groupColor }: Props) {
  const typeColor = JOB_TYPE_COLORS[job.job_type] || JOB_TYPE_COLORS.other;
  const typeLabel = JOB_TYPE_LABELS[job.job_type] || 'Jiné';

  const borderStyle = { borderLeftColor: groupColor };

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, job)}
      onClick={() => onClick(job)}
      style={{ ...borderStyle, gridColumn: `span ${Math.min(spanDays, 5)}` }}
      className={`relative group cursor-pointer rounded-lg border border-l-[3px] ${typeColor} bg-navy-700/80 backdrop-blur-sm hover:bg-navy-600/80 transition-all duration-150 shadow-sm hover:shadow-md overflow-hidden select-none min-h-[72px] flex flex-col`}
    >
      <div className="flex items-start gap-1.5 p-2 pb-1">
        <GripVertical className="w-3 h-3 text-slate-500 group-hover:text-slate-300 shrink-0 mt-0.5 cursor-grab" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${typeColor}`}>
              {typeLabel}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-white leading-tight truncate">
            {job.project_name}
          </p>
          {job.client_name && (
            <p className="text-[10px] text-slate-400 truncate mt-0.5">{job.client_name}</p>
          )}
        </div>
        <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="flex items-center gap-2 px-2 pb-2 mt-auto">
        {job.technicians.length > 0 && (
          <div className="flex items-center gap-1 text-[9px] text-slate-400">
            <Users className="w-2.5 h-2.5" />
            <span className="truncate max-w-[120px]">{job.technicians.join(' • ')}</span>
          </div>
        )}
        {spanDays > 1 && (
          <div className="flex items-center gap-1 text-[9px] text-slate-500 ml-auto">
            <Clock className="w-2.5 h-2.5" />
            <span>{spanDays} {spanDays === 1 ? 'den' : spanDays < 5 ? 'dny' : 'dní'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
