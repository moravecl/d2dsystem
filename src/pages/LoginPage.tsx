import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Shield, Zap, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';

function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-[10%] left-[15%] w-72 h-72 bg-blue-500/100/[0.07] rounded-full blur-3xl animate-float" />
      <div className="absolute top-[60%] right-[10%] w-96 h-96 bg-cyan-500/100/[0.06] rounded-full blur-3xl animate-float-delayed" />
      <div className="absolute bottom-[10%] left-[30%] w-64 h-64 bg-teal-500/100/[0.05] rounded-full blur-3xl animate-float-slow" />

      <div className="absolute top-[20%] right-[25%] w-px h-32 bg-gradient-to-b from-transparent via-white/10 to-transparent rotate-45 animate-float-delayed" />
      <div className="absolute top-[50%] left-[10%] w-px h-24 bg-gradient-to-b from-transparent via-white/[0.07] to-transparent -rotate-12 animate-float-slow" />

      <div className="absolute top-[15%] right-[15%] w-2 h-2 bg-blue-400/30 rounded-full animate-float" />
      <div className="absolute top-[45%] left-[20%] w-1.5 h-1.5 bg-cyan-400/25 rounded-full animate-float-delayed" />
      <div className="absolute bottom-[25%] right-[30%] w-1 h-1 bg-white/[0.06]/20 rounded-full animate-float-slow" />

      <svg className="absolute top-[30%] left-[8%] w-16 h-16 text-white/[0.04] animate-spin-slow" viewBox="0 0 100 100">
        <polygon points="50,5 95,30 95,70 50,95 5,70 5,30" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <svg className="absolute bottom-[20%] right-[12%] w-12 h-12 text-white/[0.03] animate-spin-slow" style={{ animationDirection: 'reverse' }} viewBox="0 0 100 100">
        <rect x="10" y="10" width="80" height="80" rx="8" fill="none" stroke="currentColor" strokeWidth="1" transform="rotate(15, 50, 50)" />
      </svg>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.06]/[0.04] border border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.06]/[0.06] transition-colors duration-300">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const { signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast(error, 'error');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[55%] deep-bg relative overflow-hidden">
        <FloatingShapes />

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.06),transparent_60%)]" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div className="flex items-center gap-3">
            <img src="/housesmartlogo.png" alt="HouseSmart" className="h-12 w-auto object-contain" />
          </div>

          <div className="max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/100/10 border border-blue-500/20 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs font-semibold text-blue-300">Platforma pro inteligentní projekty</span>
            </div>

            <h2 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] mb-5">
              Spravujte projekty
              <span className="block bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
                efektivně a přehledně
              </span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed max-w-md">
              Návrhy, nabídky, realizace a klienti na jednom místě.
            </p>

            <div className="grid grid-cols-1 gap-3 mt-8">
              <FeatureCard
                icon={<Shield className="w-4 h-4 text-blue-400" />}
                title="Bezpečná správa dat"
                desc="Všechna data šifrována a zabezpečena"
              />
              <FeatureCard
                icon={<Zap className="w-4 h-4 text-cyan-400" />}
                title="Rychlé workflow"
                desc="Od návrhu po realizaci na pár kliknutí"
              />
              <FeatureCard
                icon={<BarChart3 className="w-4 h-4 text-teal-400" />}
                title="Přehledné reporty"
                desc="Finance, čas a vytíženost v reálném čase"
              />
            </div>
          </div>

          <p className="text-slate-400 text-xs font-medium tracking-wider uppercase">HouseSmart Platform</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 bg-[#070f26] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl opacity-60 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500/6 rounded-full blur-3xl opacity-40 translate-y-1/3 -translate-x-1/4" />

        <div className="w-full max-w-[420px] relative z-10">
          <div className="text-center mb-8 lg:text-left">
            <div className="inline-flex items-center justify-center lg:hidden mb-6">
              <img src="/housesmartlogo.png" alt="HouseSmart" className="h-16 w-auto object-contain" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Vítejte zpět</h1>
            <p className="text-sm text-slate-500 mt-1.5">Přihlašte se do systému</p>
          </div>

          <div className="bg-navy-800/60 rounded-2xl shadow-xl shadow-slate-200/60 border border-white/[0.06]/80 p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Email
                </label>
                <div className={`relative rounded-xl transition-all duration-200 ${focused === 'email' ? 'ring-2 ring-blue-500/20' : ''}`}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    required
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/[0.04]/50 text-sm font-medium text-white focus:outline-none focus:border-blue-400 focus:bg-white/[0.06] transition placeholder:text-slate-400"
                    placeholder="vas@email.cz"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Heslo
                </label>
                <div className={`relative rounded-xl transition-all duration-200 ${focused === 'password' ? 'ring-2 ring-blue-500/20' : ''}`}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-white/10 bg-white/[0.04]/50 text-sm font-medium text-white focus:outline-none focus:border-blue-400 focus:bg-white/[0.06] transition placeholder:text-slate-400"
                    placeholder="Min. 6 znaků"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-400 rounded-lg hover:bg-white/[0.06] transition-all"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="group w-full bg-gradient-to-r from-blue-600 via-blue-600 to-cyan-600 text-white py-3.5 rounded-xl font-bold hover:from-blue-700 hover:via-blue-700 hover:to-cyan-700 active:scale-[0.99] transition-all shadow-lg shadow-blue-600/25 disabled:opacity-60 flex items-center justify-center gap-2 relative overflow-hidden"
              >
                <div className="absolute inset-0 animate-shimmer" />
                <span className="relative z-10 flex items-center gap-2">
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Přihlašuji...
                    </span>
                  ) : (
                    <>
                      Přihlásit se
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </span>
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-500">
                Nemáte účet?{' '}
                <Link to="/register" className="text-blue-400 font-bold hover:text-blue-400 transition-colors">
                  Registrace
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
