import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardHat, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const inputCls = 'w-full px-4 py-3 rounded-xl border border-white/10 bg-white/[0.06] text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition';

/**
 * Přihlášení / registrace do portálu subdodavatele. Účet se po přihlášení
 * přiváže k pozvánkám podle e-mailu (RPC link_subcontractor_user) —
 * subdodavatelský uživatel NIKDY nedostává členství v organizaci.
 */
export default function PartnerLoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const finishLogin = async () => {
    const { data: linked } = await supabase.rpc('link_subcontractor_user');
    if (!linked) {
      setError('Tento e-mail není přiřazen k žádnému subdodavateli. Požádejte firmu, která vás poptává, o pozvánku.');
      await supabase.auth.signOut();
      return;
    }
    navigate('/partner');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) { setError('Nesprávný e-mail nebo heslo.'); return; }
        await finishLogin();
      } else {
        if (password.length < 8) { setError('Heslo musí mít alespoň 8 znaků.'); return; }
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) { setError(err.message.includes('already') ? 'Účet s tímto e-mailem už existuje — přihlaste se.' : 'Registrace se nezdařila.'); return; }
        if (data.session) {
          await finishLogin();
        } else {
          setInfo('Potvrďte prosím registraci kliknutím na odkaz v e-mailu a poté se přihlaste.');
          setMode('login');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto mb-3">
            <HardHat className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-white">Portál subdodavatele</h1>
          <p className="text-xs text-slate-500 mt-1">Poptávky, termíny a smlouvy na jednom místě</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-navy-800/60 border border-white/[0.08] rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {([['login', 'Přihlášení'], ['register', 'Registrace']] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => { setMode(k); setError(''); setInfo(''); }}
                className={`py-2 rounded-xl text-sm font-extrabold transition ${
                  mode === k ? 'bg-blue-600 text-white' : 'bg-white/[0.06] text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail (na který přišla poptávka)" className={inputCls} autoComplete="email" />
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Heslo" className={inputCls} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />

          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          {info && <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl transition disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'login' ? 'Přihlásit se' : 'Vytvořit účet'}
          </button>

          {mode === 'register' && (
            <p className="text-[11px] text-slate-500">Registrujte se e-mailem, na který vám přišla poptávka — účet se k ní přiřadí automaticky.</p>
          )}
        </form>
      </div>
    </div>
  );
}
