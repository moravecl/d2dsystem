import { useEffect, useState } from 'react';
import { Loader2, Bell, Mail } from 'lucide-react';
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
  email_enabled: boolean;
  days_before: number | null;
}

/**
 * Nastavení notifikací přihlášeného uživatele. Dva nezávislé kanály:
 * v systému (zvonek, bez záznamu ZAPNUTO) a e-mailem (bez záznamu
 * VYPNUTO). U termínových eventů navíc počet dní předem. Sdíleno mezi
 * ozubeným kolem zvonečku a stránkou v administraci (/admin/notifikace).
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
      .select('event_key, enabled, email_enabled, days_before')
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

  const savePref = async (eventKey: string, next: Omit<PrefRow, 'event_key'>) => {
    if (!user) return;
    setSavingKey(eventKey);
    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        organization_id: organization?.id ?? null,
        event_key: eventKey,
        enabled: next.enabled,
        email_enabled: next.email_enabled,
        days_before: next.days_before,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,event_key' })
      .select('event_key');
    if (error || !data || data.length === 0) {
      toast('Nastavení se nepodařilo uložit', 'error');
    } else {
      setPrefs((prev) => {
        const map = new Map(prev);
        map.set(eventKey, { event_key: eventKey, ...next });
        return map;
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
      <div className="flex items-center justify-end gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 pr-1">
        <span className="flex items-center gap-1"><Bell className="w-3 h-3" /> Systém</span>
        <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> E-mail</span>
      </div>
      {NOTIFICATION_EVENT_GROUPS.map((group) => (
        <div key={group.group}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            {group.group}
          </div>
          <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] overflow-hidden">
            {group.events.map((event) => {
              const pref = prefs.get(event.key);
              const enabled = pref ? pref.enabled : true;
              const emailEnabled = pref ? pref.email_enabled : false;
              const days = pref?.days_before ?? DEFAULT_DAYS_BEFORE;
              const saving = savingKey === event.key;
              return (
                <div key={event.key} className="flex items-center gap-3 px-3.5 py-2.5 bg-white/[0.02]">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">{event.label}</div>
                    <div className="text-xs text-slate-500 truncate">{event.description}</div>
                  </div>
                  {event.hasDaysBefore && (enabled || emailEnabled) && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={60}
                        value={days}
                        disabled={saving}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(60, parseInt(e.target.value) || 0));
                          savePref(event.key, { enabled, email_enabled: emailEnabled, days_before: v });
                        }}
                        className="w-16 px-2 py-1 text-sm text-center border border-white/10 rounded-lg bg-white/[0.06] outline-none focus:border-blue-400"
                      />
                      <span className="text-xs text-slate-500">dní předem</span>
                    </div>
                  )}
                  <label
                    className="flex items-center justify-center w-9 shrink-0 cursor-pointer"
                    title="Upozornění v systému (zvoneček)"
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      disabled={saving}
                      onChange={(e) => savePref(event.key, {
                        enabled: e.target.checked,
                        email_enabled: emailEnabled,
                        days_before: event.hasDaysBefore ? days : null,
                      })}
                      className="w-4 h-4 accent-blue-500"
                    />
                  </label>
                  <label
                    className="flex items-center justify-center w-9 shrink-0 cursor-pointer"
                    title="Upozornění e-mailem"
                  >
                    <input
                      type="checkbox"
                      checked={emailEnabled}
                      disabled={saving}
                      onChange={(e) => savePref(event.key, {
                        enabled,
                        email_enabled: e.target.checked,
                        days_before: event.hasDaysBefore ? days : null,
                      })}
                      className="w-4 h-4 accent-emerald-500"
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-xs text-slate-500">
        Nastavení platí jen pro váš účet. Zvoneček je ve výchozím stavu zapnutý,
        e-maily vypnuté. E-mailová upozornění se odesílají souhrnně, zhruba
        jednou za 5 minut, na adresu vašeho účtu.
      </p>
    </div>
  );
}
