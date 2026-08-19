import { useState } from 'react';
import { X, Search, Calendar, Users } from 'lucide-react';
import type { InstallationJob, ResourceGroup } from '../calendarTypes';

interface Props {
  unplannedJobs: InstallationJob[];
  groupId: string;
  dateStr: string;
  groups: ResourceGroup[];
  onConfirm: (jobId: string, groupId: string, dateStr: string) => void;
  onClose: () => void;
}

function formatDateCz(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Koncept',
  design: 'Návrh',
  quoted: 'Nabídnuto',
  approved: 'Schváleno',
  in_progress: 'Probíhá',
};

export default function JobSelectorModal({ unplannedJobs, groupId, dateStr, groups, onConfirm, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const group = groups.find(g => g.id === groupId);

  const filtered = search
    ? unplannedJobs.filter(j =>
        j.project_name.toLowerCase().includes(search.toLowerCase()) ||
        (j.client_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : unplannedJobs;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-navy-800 border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.08]">
          <div>
            <h3 className="text-sm font-bold text-white">Naplánovat zakázku</h3>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Calendar className="w-3 h-3" />
                <span className="capitalize">{formatDateCz(dateStr)}</span>
              </div>
              {group && (
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                  <span>{group.name}</span>
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3">
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Hledat zakázku..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-white placeholder-slate-500"
            />
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-500">
                {search ? 'Žádné zakázky neodpovídají hledání' : 'Všechny zakázky jsou naplánovány'}
              </div>
            )}
            {filtered.map(job => (
              <button
                key={job.id}
                onClick={() => setSelected(job.id === selected ? null : job.id)}
                className={`w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg border transition ${
                  selected === job.id
                    ? 'border-blue-500/40 bg-blue-500/10'
                    : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <div className="w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors" style={{
                  borderColor: selected === job.id ? '#3b82f6' : '#475569',
                  backgroundColor: selected === job.id ? '#3b82f6' : 'transparent',
                }}>
                  {selected === job.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{job.project_name}</p>
                  {job.client_name && (
                    <p className="text-[10px] text-slate-400 truncate">{job.client_name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-500">
                      {STATUS_LABELS[job.status] || job.status}
                    </span>
                    {job.technicians.length > 0 && (
                      <span className="text-[9px] text-slate-500 flex items-center gap-0.5">
                        <Users className="w-2.5 h-2.5" />
                        {job.technicians.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs font-semibold rounded-lg border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
          >
            Zrušit
          </button>
          <button
            disabled={!selected}
            onClick={() => selected && onConfirm(selected, groupId, dateStr)}
            className="flex-1 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Naplánovat
          </button>
        </div>
      </div>
    </div>
  );
}
