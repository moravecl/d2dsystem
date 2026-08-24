import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { Loader2, ShieldX } from 'lucide-react';
import type { ModuleKey } from '../lib/permissions';

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requiredModule,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requiredModule?: ModuleKey;
}) {
  const { user, profile, loading, signOut } = useAuth();
  const { hasModule, isFullAdmin, loading: permissionsLoading } = usePermissions();

  if (loading) {
    return (
      <div className="min-h-screen bg-white/[0.04] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (profile && !profile.is_portal_client && !profile.organization_id) {
    return <Navigate to="/onboarding" replace />;
  }

  if (profile?.is_portal_client) {
    return (
      <div className="min-h-screen bg-white/[0.04] flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-navy-800/60 rounded-2xl shadow-xl border border-white/[0.06] p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <ShieldX className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-lg font-bold text-white mb-2">Pristup odepren</h1>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Vas ucet ma pristup pouze do klientskeho portalu. Pro pristup do systemu kontaktujte spravce.
          </p>
          <div className="flex flex-col gap-3">
            <a
              href="/portal"
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition text-center block"
            >
              Prejit na klientsky portal
            </a>
            <button
              onClick={() => signOut()}
              className="w-full py-2.5 rounded-xl border border-white/10 text-slate-400 text-sm font-medium hover:bg-white/[0.04] transition"
            >
              Odhlasit se
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Opravneni se nacitaji asynchronne. Dokud nejsou znama, nic nepovolujeme
  // ani nepresmerovavame - jinak by se bud kratkodobe zobrazil obsah, na ktery
  // uzivatel nema narok, nebo by ho hlidka vyhodila z platneho odkazu.
  if ((requireAdmin && !profile) || ((requireAdmin || requiredModule) && permissionsLoading)) {
    return (
      <div className="min-h-screen bg-white/[0.04] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }
  if (requireAdmin && profile?.role !== 'admin' && !isFullAdmin) return <Navigate to="/" replace />;

  if (requiredModule && !hasModule(requiredModule)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
