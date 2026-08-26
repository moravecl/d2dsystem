import { BellRing } from 'lucide-react';
import NotificationPreferencesPanel from '../../components/notifications/NotificationPreferencesPanel';

/**
 * Administrace → Systém → Notifikace. Stejný panel si každý uživatel
 * otevře i z ozubeného kola u zvonečku v hlavičce.
 */
export default function NotificationSettingsPage() {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <BellRing className="w-6 h-6 text-slate-300" />
          <h1 className="text-xl font-bold text-white">Notifikace</h1>
        </div>
        <p className="text-sm text-slate-500">
          Co vám má systém hlásit a u termínů kolik dní předem — nastavení platí pro váš účet
        </p>
      </div>
      <NotificationPreferencesPanel />
    </div>
  );
}
