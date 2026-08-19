import { X, Calendar, Users, MapPin, ExternalLink, ArrowRight, Wrench, Split } from 'lucide-react';
import type { InstallationJob } from '../calendarTypes';
import { JOB_TYPE_LABELS } from '../calendarTypes';
import { useNavigate } from 'react-router-dom';

interface Props {
  job: InstallationJob | null;
  onClose: () => void;
  onMoveJob?: (job: InstallationJob) => void;
  onChangeTechnicians?: (job: InstallationJob) => void;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Koncept',
  design: 'Návrh',
  quoted: 'Nabídnuto',
  approved: 'Schváleno',
  in_progress: 'Probíhá',
  completed: 'Dokončeno',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/20 text-slate-300',
  design: 'bg-blue-500/20 text-blue-300',
  quoted: 'bg-amber-500/20 text-amber-300',
  approved: 'bg-emerald-500/20 text-emerald-300',
  in_progress: 'bg-cyan-500/20 text-cyan-300',
  completed: 'bg-teal-500/20 text-teal-300',
};

export default function InstallationInspector({ job, onClose, onMoveJob, onChangeTechnicians }: Props) {
  const navigate = useNavigate();

  const dateRange = job?.start_date && job?.end_date
    ? `${formatDateShort(job.start_date)}–${formatDate(job.end_date)}`
    : formatDate(job?.start_date);

  return (
    <div
      className={`fixed top-0 right-0 h-full w-[320px] bg-navy-900/95 backdrop-blur-xl border-l border-white/[0.08] shadow-2xl z-50 flex flex-col transition-transform duration-300 ${
        job ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.08]">
        <h3 className="text-sm font-bold text-white">Detail zakázky</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {job && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 border-b border-white/[0.06]">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="text-base font-bold text-white leading-tight">{job.project_name}</p>
                {job.client_name && (
                  <p className="text-sm text-slate-400 mt-0.5">{job.client_name}</p>
                )}
              </div>
              <span className={`text-[10px] font-semibold px-2 py-1 rounded shrink-0 ${STATUS_COLORS[job.status] || STATUS_COLORS.draft}`}>
                {STATUS_LABELS[job.status] || job.status}
              </span>
            </div>
            <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
              {JOB_TYPE_LABELS[job.job_type]}
            </span>
          </div>

          <div className="p-4 space-y-4 border-b border-white/[0.06]">
            {job.start_date && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-0.5">Termín</p>
                  <p className="text-sm font-semibold text-white">{dateRange}</p>
                </div>
              </div>
            )}

            {job.technicians.length > 0 && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Technici</p>
                  <div className="flex flex-wrap gap-1.5">
                    {job.technicians.map((t, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {job.address && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-orange-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-0.5">Adresa</p>
                  <p className="text-sm text-slate-300">{job.address}</p>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 space-y-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-3">Akce</p>

            {onMoveJob && (
              <button
                onClick={() => onMoveJob(job)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-slate-300 hover:bg-white/[0.07] hover:text-white transition text-left"
              >
                <ArrowRight className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Přesunout zakázku</span>
              </button>
            )}

            {onChangeTechnicians && (
              <button
                onClick={() => onChangeTechnicians(job)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-slate-300 hover:bg-white/[0.07] hover:text-white transition text-left"
              >
                <Wrench className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Změnit techniky</span>
              </button>
            )}

            <button
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-slate-300 hover:bg-white/[0.07] hover:text-white transition text-left opacity-50 cursor-not-allowed"
              disabled
            >
              <Split className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Rozdělit zakázku</span>
            </button>

            <button
              onClick={() => navigate(`/projekty/${job.project_id}`)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-sm text-blue-300 hover:bg-blue-600/30 hover:text-blue-200 transition text-left mt-3"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              <span>Otevřít projekt</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
