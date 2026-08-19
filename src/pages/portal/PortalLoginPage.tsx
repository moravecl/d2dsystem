import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../../contexts/PortalAuthContext';
import { Loader2, Eye, EyeOff, ArrowRight, ShieldCheck, Smartphone } from 'lucide-react';

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

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PortalLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = usePortalAuth();
  const navigate = useNavigate();

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  usePortalPwa();

  useEffect(() => {
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    );

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setInstallPrompt(null);
      setIsStandalone(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      navigate('/portal', { replace: true });
    }
  };

  return (
    <div className="min-h-screen deep-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-3xl animate-float-delayed" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/[0.03] rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-[380px] relative z-10 animate-scale-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-black/20 border border-white/10">
            <img src="/housesmartlogo.png" alt="" className="w-9 h-9 rounded-lg" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Klientsky portal
          </h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Prihlaste se pro pristup k vasim projektum
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-navy-800/60 rounded-2xl shadow-2xl shadow-black/25 border border-white/10 p-7 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-white/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition bg-white/[0.06] placeholder:text-slate-300"
              placeholder="vas@email.cz"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Heslo</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 pr-11 rounded-xl border border-white/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition bg-white/[0.06] placeholder:text-slate-300"
                placeholder="Zadejte heslo"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors p-1"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25 disabled:opacity-50 flex items-center justify-center gap-2.5 group"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            )}
            Prihlasit se
          </button>

          <div className="flex items-center gap-2 justify-center pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-[11px] text-slate-400 font-medium">
              Zabezpecene pripojeni
            </span>
          </div>
        </form>

        {installPrompt && !isStandalone && (
          <button
            onClick={handleInstall}
            className="w-full mt-4 py-3 px-4 rounded-2xl bg-white/[0.06] backdrop-blur-sm border border-white/10 text-white text-sm font-semibold hover:bg-white/[0.10] transition-all flex items-center justify-center gap-3 group"
          >
            <Smartphone className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
            Nainstalovat jako aplikaci
          </button>
        )}

        {isStandalone && (
          <div className="mt-4 flex items-center justify-center gap-2 text-slate-500">
            <Smartphone className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">Spusteno jako aplikace</span>
          </div>
        )}
      </div>
    </div>
  );
}
