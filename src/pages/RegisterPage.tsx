import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signUp(email, password, displayName);
    setSubmitting(false);
    if (error) {
      toast(error, 'error');
    } else {
      navigate('/onboarding');
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 deep-bg relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-40 -right-20 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-20 w-80 h-80 bg-blue-500/100/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <img src="/housesmartlogo.png" alt="" className="w-10 h-10 rounded-xl" />
            <span className="text-white font-bold text-xl">HouseSmart</span>
          </div>
          <div>
            <h2 className="text-4xl font-extrabold text-white leading-tight mb-4">
              Zaregistrujte se<br />a začněte hned
            </h2>
            <p className="text-slate-400 text-lg max-w-md">
              Kompletní platforma pro správu projektů, nabídek a realizací staveb.
            </p>
          </div>
          <p className="text-slate-400 text-sm">HouseSmart Platform</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 bg-[#070f26]">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 lg:text-left">
            <div className="inline-flex items-center justify-center lg:hidden mb-5">
              <img src="/housesmartlogo.png" alt="HouseSmart" className="h-12 w-auto" />
            </div>
            <h1 className="text-2xl font-extrabold text-white">Vytvořit účet</h1>
            <p className="text-sm text-slate-500 mt-1.5">Registrace nového uživatele</p>
          </div>

          <div className="bg-navy-800/60 rounded-2xl shadow-xl shadow-slate-200/50 border border-white/[0.06] p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Jméno
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/[0.04]/50 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white/[0.06] transition"
                  placeholder="Vaše jméno"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/[0.04]/50 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white/[0.06] transition"
                  placeholder="vas@email.cz"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Heslo
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-white/10 bg-white/[0.04]/50 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white/[0.06] transition"
                    placeholder="Min. 6 znaků"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-400 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-bold hover:from-blue-700 hover:to-blue-800 active:scale-[0.99] transition-all shadow-lg shadow-blue-600/25 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  'Vytváří se účet...'
                ) : (
                  <>Vytvořit účet <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            <div className="mt-6 text-center space-y-3">
              <p className="text-sm text-slate-500">
                Už máte účet?{' '}
                <Link to="/login" className="text-blue-400 font-bold hover:underline">
                  Přihlášení
                </Link>
              </p>
              <p className="text-xs text-slate-400">
                Registrací souhlasíte s{' '}
                <Link to="/podminky" className="text-slate-400 hover:underline">Obchodními podmínkami</Link>
                {' '}a{' '}
                <Link to="/soukromi" className="text-slate-400 hover:underline">Zásadami ochrany osobních údajů</Link>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
