import { useState } from 'react';
import { X, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QuickAuthModal({ open, onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) {
        toast(error, 'error');
        setLoading(false);
        return;
      }
      toast('Přihlášení úspěšné');
    } else {
      const { error } = await signUp(email, password, displayName);
      if (error) {
        toast(error, 'error');
        setLoading(false);
        return;
      }
      const { error: loginErr } = await signIn(email, password);
      if (loginErr) {
        toast(loginErr, 'error');
        setLoading(false);
        return;
      }
      toast('Registrace a přihlášení úspěšné');
    }

    setLoading(false);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[75] flex items-center justify-center p-4 animate-backdrop-enter">
      <div className="bg-navy-800/60 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-modal-enter">
        <div className="p-5 border-b bg-white/[0.04] flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-white">
            {mode === 'login' ? 'Přihlášení' : 'Registrace'}
          </h3>
          <button onClick={onClose} className="bg-white/[0.06] p-2 rounded-full border  text-slate-400 hover:text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-slate-500">
            Pro ukládání konfigurací do databáze je potřeba se přihlásit.
          </p>

          {mode === 'register' && (
            <div>
              <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Jméno</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                placeholder="Vaše jméno" />
            </div>
          )}

          <div>
            <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20"
              placeholder="vas@email.cz" />
          </div>
          <div>
            <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Heslo</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20"
              placeholder="Min. 6 znaků" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-extrabold hover:bg-blue-700 transition shadow-lg disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? 'Čekejte...' : mode === 'login' ? (
              <><LogIn className="w-4 h-4" /> Přihlásit se</>
            ) : (
              <><UserPlus className="w-4 h-4" /> Registrovat</>
            )}
          </button>

          <div className="text-center">
            <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-sm text-blue-400 font-extrabold hover:underline">
              {mode === 'login' ? 'Nemám účet – registrovat se' : 'Už mám účet – přihlásit se'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
