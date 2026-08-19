import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertTriangle, Wrench, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Announcement {
  id: string;
  title: string;
  body: string;
  announcement_type: string;
  target_org_id: string | null;
  expires_at: string | null;
}

const typeConfig = {
  info: {
    icon: CheckCircle,
    bg: 'bg-blue-500/10 border-blue-200',
    iconColor: 'text-blue-500',
    textColor: 'text-blue-900',
    subColor: 'text-blue-400',
    closeColor: 'text-blue-400 hover:text-blue-400 hover:bg-blue-500/20',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-500/10 border-amber-200',
    iconColor: 'text-amber-500',
    textColor: 'text-amber-900',
    subColor: 'text-amber-400',
    closeColor: 'text-amber-400 hover:text-amber-400 hover:bg-amber-500/20',
  },
  maintenance: {
    icon: Wrench,
    bg: 'bg-orange-500/10 border-orange-200',
    iconColor: 'text-orange-500',
    textColor: 'text-orange-900',
    subColor: 'text-orange-700',
    closeColor: 'text-orange-400 hover:text-orange-600 hover:bg-orange-500/20',
  },
  feature: {
    icon: Sparkles,
    bg: 'bg-emerald-500/10 border-emerald-200',
    iconColor: 'text-emerald-500',
    textColor: 'text-emerald-900',
    subColor: 'text-emerald-400',
    closeColor: 'text-emerald-400 hover:text-emerald-400 hover:bg-emerald-500/20',
  },
};

const STORAGE_KEY = 'dismissed_announcements';

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveDismissed(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export default function AnnouncementBanner() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(getDismissed);

  useEffect(() => {
    if (!profile?.organization_id) return;
    loadAnnouncements(profile.organization_id);
  }, [profile?.organization_id]);

  const loadAnnouncements = async (_orgId: string) => {
    const { data } = await supabase
      .from('system_announcements')
      .select('id, title, body, announcement_type, target_org_id, expires_at')
      .order('created_at', { ascending: false });

    setAnnouncements(data ?? []);
  };

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    saveDismissed(next);
  };

  const visible = announcements.filter((a) => !dismissed.includes(a.id));

  if (visible.length === 0) return null;

  return (
    <div className="space-y-0">
      {visible.map((ann) => {
        const cfg = typeConfig[ann.announcement_type as keyof typeof typeConfig] ?? typeConfig.info;
        const Icon = cfg.icon;
        return (
          <div
            key={ann.id}
            className={`border-b ${cfg.bg} px-4 lg:px-6 py-2.5 flex items-start gap-3 animate-fade-in`}
          >
            <Icon className={`w-4 h-4 ${cfg.iconColor} shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-semibold ${cfg.textColor}`}>{ann.title}</span>
              {ann.body && (
                <span className={`text-sm ${cfg.subColor} ml-2`}>{ann.body}</span>
              )}
            </div>
            <button
              onClick={() => dismiss(ann.id)}
              className={`shrink-0 p-1 rounded-lg transition-colors ${cfg.closeColor}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
