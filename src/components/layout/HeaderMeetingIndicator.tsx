import { Link } from 'react-router-dom';
import { Video } from 'lucide-react';
import { useActiveMeeting } from '../../contexts/ActiveMeetingContext';

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

export default function HeaderMeetingIndicator() {
  const { active, meetingId, meetingTitle, elapsed } = useActiveMeeting();

  if (!active) return null;

  return (
    <Link
      to={`/porady/${meetingId}`}
      className="flex items-center gap-2 h-9 px-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all text-xs font-semibold group"
      title={meetingTitle}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      <Video className="w-3.5 h-3.5 shrink-0 text-blue-500" />
      <span className="hidden sm:inline max-w-[120px] truncate">{meetingTitle}</span>
      <span className="font-mono tracking-tight">{fmtTime(elapsed)}</span>
    </Link>
  );
}
