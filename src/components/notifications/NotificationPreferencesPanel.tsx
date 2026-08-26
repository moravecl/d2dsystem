import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../ui/Toast';
import {
  NOTIFICATION_EVENT_GROUPS,
  DEFAULT_DAYS_BEFORE,
} from '../../lib/notificationEvents';

interface PrefRow {
  event_key: string;
  enabled: boolean;
  days_before: number | null;
}

/**
 * Nastavení notifikací přihlášeného uživatele. Bez uloženého záznamu
 * je event zapnutý (default-on); u termínových eventů se navíc volí
 * počet dní předem. Sdíleno mezi ozubeným kolem zvonečku a stránkou
 * v administraci (/admin/notifikace).
 */
export default function NotificationPreferencesPanel() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Map<string, PrefRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from('notification_preferences')
      .select('event_key, enabled, days_before')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const map = new Map<string, PrefRow>();
        for (const row of (data ?? []) as PrefRow[]) map.set(row.event_key, row);
        setPrefs(map);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  const savePref = async (eventKey: string, enabled: boolean, daysBefore: number | null) => {
    if (!user) return;
    setSavingKey(eventKey);
    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        organization_id: organization?.id ?? null,
        event_key: eventKey,
        enabled,
        days_before: daysBefore,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,event_key' })
      .select('event_key');
    if (error || !data || data.length === 0) {
      toast('Nastavení se nepodařilo uložit', 'error');
    } else {
      setPrefs((prev) => {
        const next = new Map(prev);
        next.set(eventKey, { event_key: eventKey, enabled, days_before: daysBefore });
        return next;
      });
    }
    setSavingKey(null);
  };

  if (loading) {
    return (
      <div className="py-10 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {NOTIFICATION_EVENT_GROUPS.map((group) => (
        <div key={group.group}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            {group.group}
          </div>
          <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] overflow-hidden">
            {group.events.map((event) => {
              const pref = prefs.get(event.key);
              const enabled = pref ? pref.enabled : true;
              const days = pref?.days_before ?? DEFAULT_DAYS_BEFORE;
              return (
                <div key={event.key} className="flex items-center gap-3 px-3.5 py-2.5 bg-white/[0.02]">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">{event.label}</div>
                    <div className="text-xs text-slate-500 truncate">{event.description}</div>
                  </div>
                  {event.hasDaysBefore && enabled && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={60}
                        value={days}
                        disabled={savingKey === event.key}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(60, parseInt(e.target.value) || 0));
                          savePref(event.key, true, v);
                        }}
                        className="w-16 px-2 py-1 text-sm text-center border border-white/10 rounded-lg bg-white/[0.06] outline-none focus:border-blue-400"
                      />
                      <span className="text-xs text-slate-500">dní předem</span>
                    </div>
                  )}
                  <button
                    onClick={() => savePref(event.key, !enabled, event.hasDaysBefore ? days : null)}
                    disabled={savingKey === event.key}
                    className={`relative w-10 h-5.5 rounded-full transition shrink-0 ${
                      enabled ? 'bg-blue-600' : 'bg-white/[0.10]'
                    }`}
                    style={{ height: '22px' }}
                    title={enabled ? 'Vypnout' : 'Zapnout'}
                  >
                    <span
                      className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white transition-all ${
                        enabled ? 'left-[20px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-xs text-slate-500">
        Nastavení platí jen pro váš účet. Nově přidané typy notifikací jsou ve výchozím stavu zapnuté.
      </p>
    </div>
  );
}
