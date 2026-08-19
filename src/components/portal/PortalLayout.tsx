import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../../contexts/PortalAuthContext';
import { LogOut, Loader2, ChevronRight, Home } from 'lucide-react';

function usePortalPwa() {
  useEffect(() => {
    const original = document.querySelector('link[rel="manifest"]');
    const originalHref = original?.getAttribute('href') || '/manifest.json';

    if (original) {
      original.setAttribute('href', '/portal-manifest.json');
    } else {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/portal-manifest.json';
      document.head.appendChild(link);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/portal-sw.js', { scope: '/portal' });
    }

    return () => {
      const el = document.querySelector('link[rel="manifest"]');
      if (el) el.setAttribute('href', originalHref);
    };
  }, []);
}

export default function PortalLayout() {
  const { user, profile, loading, signOut, clientId } = usePortalAuth();
  const location = useLocation();
  const navigate = useNavigate();

  usePortalPwa();

  if (loading) {
    return (
      <div className="min-h-screen deep-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <span className="text-sm text-slate-400 font-medium">Nacitani...</span>
        </div>
      </div>
    );
  }

  if (!user || !clientId) {
    return <Navigate to="/portal/login" replace />;
  }

  const isProjectDetail = location.pathname.includes('/portal/projekt/');
  const initial = (profile?.display_name || profile?.email || '?')[0].toUpperCase();

  return (
    <div className="min-h-screen flex flex-col deep-bg">
      <header className="glass-header sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-8">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/portal')}
                className="flex items-center gap-3 group"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/30 transition-shadow">
                  <img src="/housesmartlogo.png" alt="" className="w-5 h-5 rounded" />
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-bold text-white leading-tight group-hover:text-blue-400 transition-colors">
                    HouseSmart
                  </div>
                  <div className="text-[10px] font-medium text-slate-400 leading-tight">
                    Klientsky portal
                  </div>
                </div>
              </button>

              {isProjectDetail && (
                <div className="hidden sm:flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  <button
                    onClick={() => navigate('/portal')}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    <Home className="w-3 h-3" />
                    Projekty
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 pr-3 border-r border-white/[0.08]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
                  {initial}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-white leading-tight">
                    {profile?.display_name || profile?.email}
                  </div>
                </div>
              </div>

              <button
                onClick={signOut}
                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Odhlasit se"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 animate-fade-in">
        <Outlet />
      </main>

      <footer className="border-t border-white/[0.08]">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-5 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">
            HouseSmart &copy; {new Date().getFullYear()}
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            Klientsky portal
          </span>
        </div>
      </footer>
    </div>
  );
}
