const statusConfig: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  lead: { label: 'Lead', bg: 'bg-slate-500/15', text: 'text-slate-300', border: 'border-slate-500/25', dot: 'bg-slate-400' },
  poptavka: { label: 'Poptávka', bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/25', dot: 'bg-amber-400' },
  design: { label: 'Návrh', bg: 'bg-sky-500/15', text: 'text-sky-300', border: 'border-sky-500/25', dot: 'bg-sky-400' },
  quote: { label: 'Nabídka', bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-500/25', dot: 'bg-cyan-400' },
  approval: { label: 'Schválení', bg: 'bg-orange-500/15', text: 'text-orange-300', border: 'border-orange-500/25', dot: 'bg-orange-400' },
  in_progress: { label: 'Realizace', bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/25', dot: 'bg-emerald-400' },
  completed: { label: 'Dokončeno', bg: 'bg-green-500/15', text: 'text-green-300', border: 'border-green-500/25', dot: 'bg-green-400' },
  draft: { label: 'Koncept', bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', dot: 'bg-slate-500' },
  sent: { label: 'Odesláno', bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/25', dot: 'bg-blue-400' },
  cancelled: { label: 'Zrušeno', bg: 'bg-red-500/15', text: 'text-red-300', border: 'border-red-500/25', dot: 'bg-red-400' },
};

interface StatusBadgeProps {
  status: string;
  onClick?: () => void;
  className?: string;
}

export default function StatusBadge({ status, onClick, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    bg: 'bg-slate-500/15',
    text: 'text-slate-300',
    border: 'border-slate-500/25',
    dot: 'bg-slate-400',
  };

  const Tag = onClick ? 'button' : 'span';

  return (
    <Tag
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${config.bg} ${config.text} ${config.border} ${
        onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
      } ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${(config as { dot?: string }).dot || 'bg-slate-400'}`} />
      {config.label}
    </Tag>
  );
}
