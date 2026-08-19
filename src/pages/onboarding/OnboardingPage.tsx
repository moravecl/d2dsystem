import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowRight, CheckCircle2, Loader2, Users, Zap, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { sendWelcomeEmail } from '../../lib/transactionalEmail';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

const PLAN_FEATURES = {
  free: ['5 uživatelů', '10 projektů', 'Základní moduly', 'Email podpora'],
  pro: ['20 uživatelů', 'Neomezené projekty', 'Všechny moduly', 'Prioritní podpora', 'Export PDF'],
  business: ['Neomezení uživatelé', 'Neomezené projekty', 'Všechny moduly + API', 'Dedikovaný support', 'SLA záruka'],
};

export default function OnboardingPage() {
  const { user, profile, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (profile?.organization_id) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, profile, loading]);
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [plan, setPlan] = useState<'free' | 'pro' | 'business'>('pro');
  const [submitting, setSubmitting] = useState(false);

  const handleNameChange = (v: string) => {
    setCompanyName(v);
    if (!slugManual) setSlug(slugify(v));
  };

  const handleCreate = async () => {
    if (!companyName.trim() || !slug.trim() || !user) return;
    setSubmitting(true);

    const orgId = crypto.randomUUID();

    const { error: orgError } = await supabase.from('organizations').insert({
      id: orgId,
      name: companyName.trim(),
      slug: slug.trim(),
      owner_id: user.id,
      subscription_tier: plan,
      max_users: plan === 'free' ? 5 : plan === 'pro' ? 20 : 9999,
      is_active: true,
    });

    if (orgError) {
      toast(orgError.message.includes('slug') ? 'Název URL je již obsazen, zkuste jiný.' : orgError.message, 'error');
      setSubmitting(false);
      return;
    }

    const { error: memberError } = await supabase.from('organization_members').insert({
      organization_id: orgId,
      user_id: user.id,
      role: 'owner',
      joined_at: new Date().toISOString(),
    });

    if (memberError) {
      toast('Chyba při nastavení členství: ' + memberError.message, 'error');
      setSubmitting(false);
      return;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ organization_id: orgId, role: 'admin' })
      .eq('id', user.id);

    if (profileError) {
      toast('Chyba při aktualizaci profilu: ' + profileError.message, 'error');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setStep(3);

    if (user.email) {
      sendWelcomeEmail({
        organizationId: orgId,
        organizationName: companyName.trim(),
        recipientEmail: user.email,
        recipientName: profile?.display_name ?? user.email,
      }).catch(() => {});
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen deep-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="min-h-screen deep-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/100/10 border-4 border-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-3">Firma vytvořena!</h1>
          <p className="text-slate-500 mb-8 leading-relaxed">
            Vaše organizace <strong className="text-slate-300">{companyName}</strong> je připravena.
            Nyní můžete pozvat kolegy a začít pracovat.
          </p>
          <button
            onClick={() => {
              window.location.href = '/dashboard';
            }}
            className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2"
          >
            Přejít do systému
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen deep-bg flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.06]/10 border border-white/20 mb-4">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Nastavte vaši firmu</h1>
          <p className="text-slate-400 text-sm mt-2">
            Vítejte, <strong className="text-white">{profile?.display_name || user?.email}</strong>. Před vstupem do systému vytvořte organizaci.
          </p>

          <div className="flex items-center justify-center gap-2 mt-5">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step >= s ? 'w-10 bg-blue-400' : 'w-6 bg-white/[0.06]/20'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="bg-navy-800/60 rounded-2xl shadow-2xl shadow-black/30 p-8">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Základní informace</h2>
                <p className="text-sm text-slate-500">Jak se jmenuje vaše firma?</p>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Název firmy
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  autoFocus
                  placeholder="např. Electro Solutions s.r.o."
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white/[0.06] transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  URL identifikátor
                </label>
                <div className="flex items-center gap-0 border border-white/10 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 bg-white/[0.04] focus-within:bg-white/[0.06] transition">
                  <span className="px-3 py-3 text-sm text-slate-400 bg-white/[0.06] border-r border-white/10 font-medium shrink-0">
                    app/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                      setSlugManual(true);
                    }}
                    className="flex-1 px-3 py-3 text-sm font-medium text-white bg-transparent focus:outline-none"
                    placeholder="nazev-firmy"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">Pouze malá písmena, čísla a pomlčky.</p>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!companyName.trim() || !slug.trim()}
                className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                Pokračovat
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Vyberte plán</h2>
                <p className="text-sm text-slate-500">Plán lze kdykoli změnit v nastavení.</p>
              </div>

              <div className="space-y-3">
                {(Object.entries(PLAN_FEATURES) as [typeof plan, string[]][]).map(([tier, features]) => (
                  <button
                    key={tier}
                    onClick={() => setPlan(tier)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      plan === tier
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/10 hover:border-white/[0.12] hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-bold text-sm capitalize ${plan === tier ? 'text-blue-400' : 'text-slate-300'}`}>
                        {tier === 'free' ? 'Free' : tier === 'pro' ? 'Pro' : 'Business'}
                      </span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition ${
                        plan === tier ? 'border-blue-500 bg-blue-500/100' : 'border-slate-300'
                      }`}>
                        {plan === tier && <div className="w-1.5 h-1.5 rounded-full bg-white/[0.06]" />}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {features.map((f) => (
                        <span key={f} className="text-xs text-slate-500 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                          {f}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="py-3 rounded-xl border border-white/10 text-slate-400 text-sm font-semibold hover:bg-white/[0.04] transition"
                >
                  Zpět
                </button>
                <button
                  onClick={handleCreate}
                  disabled={submitting}
                  className="py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Vytvořit firmu
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { icon: Shield, text: 'Vaše data jsou izolována od ostatních firem' },
            { icon: Users, text: 'Pozvěte kolegy do organizace' },
            { icon: Zap, text: 'Ihned připraveno k použití' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="text-center p-3 rounded-xl bg-white/[0.06]/5 border border-white/10">
              <Icon className="w-4 h-4 text-slate-400 mx-auto mb-1.5" />
              <p className="text-xs text-slate-400 leading-tight">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
