import { useEffect, useState } from 'react';
import { Check, Zap, Star, Building2, ArrowRight, Users, FolderOpen, HardDrive, Crown, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOrganization } from '../../contexts/OrganizationContext';

interface Plan {
  id: string;
  name: string;
  slug: string;
  max_users: number;
  max_projects: number;
  max_storage_mb: number;
  price_monthly: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

const planIcons: Record<string, React.ElementType> = {
  free: Zap,
  pro: Star,
  business: Building2,
  enterprise: Crown,
};

const planColors: Record<string, {
  border: string;
  bg: string;
  badge: string;
  badgeText: string;
  button: string;
  iconBg: string;
  iconColor: string;
  highlight: boolean;
}> = {
  free: {
    border: 'border-white/10',
    bg: 'bg-white/[0.06]',
    badge: 'bg-white/[0.06] text-slate-400',
    badgeText: 'Základní',
    button: 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.08]',
    iconBg: 'bg-white/[0.06]',
    iconColor: 'text-slate-500',
    highlight: false,
  },
  pro: {
    border: 'border-blue-500/20',
    bg: 'bg-white/[0.06]',
    badge: 'bg-blue-500/100/20 text-blue-400',
    badgeText: 'Populární',
    button: 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20',
    iconBg: 'bg-blue-500/100/20',
    iconColor: 'text-blue-400',
    highlight: true,
  },
  business: {
    border: 'border-emerald-500/20',
    bg: 'bg-white/[0.06]',
    badge: 'bg-emerald-500/20 text-emerald-400',
    badgeText: 'Výhodný',
    button: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    highlight: false,
  },
  enterprise: {
    border: 'border-amber-500/20',
    bg: 'bg-white/[0.06]',
    badge: 'bg-amber-500/20 text-amber-400',
    badgeText: 'Enterprise',
    button: 'bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-500/20',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
    highlight: false,
  },
};

const tierOrder = ['free', 'pro', 'business', 'enterprise'];

export default function LicencePage() {
  const { organization } = useOrganization();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showContact, setShowContact] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    const { data } = await supabase
      .from('org_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    setPlans((data ?? []) as Plan[]);
    setLoading(false);
  };

  const currentTierIndex = tierOrder.indexOf(organization?.subscription_tier ?? 'free');

  const isPlanCurrent = (slug: string) => organization?.subscription_tier === slug;
  const isPlanUpgrade = (slug: string) => tierOrder.indexOf(slug) > currentTierIndex;

  const formatStorage = (mb: number) => {
    if (mb >= 102400) return 'Neomezeno';
    return `${(mb / 1024).toFixed(0)} GB`;
  };

  const formatUsers = (n: number) => n >= 999 ? 'Neomezeno' : `Max ${n}`;
  const formatProjects = (n: number) => n >= 9999 ? 'Neomezeno' : `Max ${n}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-white">Licence a limity</h1>
        <p className="text-sm text-slate-500 mt-1">
          Aktuální plán vaší organizace a dostupné možnosti rozšíření.
        </p>
      </div>

      {organization && (
        <div className="mb-8 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 flex items-center gap-5">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <Crown className="w-6 h-6 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-0.5">Aktivní plán</div>
            <div className="text-xl font-extrabold text-white capitalize">
              {plans.find(p => p.slug === organization.subscription_tier)?.name ?? organization.subscription_tier}
            </div>
            <div className="text-sm text-slate-400 mt-0.5">{organization.name}</div>
          </div>
          <div className="text-right shrink-0 hidden sm:block">
            <div className="text-xs text-slate-500 mb-1">Počet uživatelů</div>
            <div className="text-2xl font-extrabold text-white">{organization.max_users >= 999 ? '∞' : organization.max_users}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {plans.map((plan) => {
          const cfg = planColors[plan.slug] ?? planColors.free;
          const Icon = planIcons[plan.slug] ?? Zap;
          const isCurrent = isPlanCurrent(plan.slug);
          const isUpgrade = isPlanUpgrade(plan.slug);

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 ${cfg.border} ${cfg.bg} p-6 flex flex-col transition-shadow hover:shadow-lg ${
                isCurrent ? 'ring-2 ring-offset-2 ring-blue-400' : ''
              } ${cfg.highlight && !isCurrent ? 'shadow-md' : ''}`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full">
                  Váš plán
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl ${cfg.iconBg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${cfg.iconColor}`} />
                </div>
                <div>
                  <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full w-fit ${cfg.badge}`}>
                    {cfg.badgeText}
                  </div>
                  <div className="text-base font-extrabold text-white mt-0.5">{plan.name}</div>
                </div>
              </div>

              <div className="mb-5">
                {plan.price_monthly > 0 ? (
                  <div>
                    <span className="text-3xl font-extrabold text-white">
                      {plan.price_monthly.toLocaleString('cs-CZ')}
                    </span>
                    <span className="text-sm text-slate-500 ml-1">Kč/měs</span>
                  </div>
                ) : (
                  <div className="text-3xl font-extrabold text-emerald-400">Zdarma</div>
                )}
              </div>

              <div className="space-y-2.5 mb-5 border-t border-white/[0.06] pt-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{formatUsers(plan.max_users)} uživatelů</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <FolderOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{formatProjects(plan.max_projects)} projektů</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <HardDrive className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{formatStorage(plan.max_storage_mb)} úložiště</span>
                </div>
              </div>

              {plan.features.length > 0 && (
                <div className="space-y-2 mb-5 flex-1">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-400">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-auto">
                {isCurrent ? (
                  <div className="w-full py-2.5 rounded-xl text-center text-sm font-bold text-slate-400 bg-white/[0.04] border border-white/10">
                    Aktivní
                  </div>
                ) : isUpgrade ? (
                  <button
                    onClick={() => setShowContact(plan.slug)}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${cfg.button}`}
                  >
                    Přejít na {plan.name}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-full py-2.5 rounded-xl text-center text-sm font-bold text-slate-300 bg-white/[0.04] border border-white/[0.06]">
                    Nižší plán
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-white/[0.04] rounded-2xl border border-white/10 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-10 h-10 bg-navy-800/60 rounded-xl border border-white/[0.08] flex items-center justify-center shrink-0">
          <Mail className="w-5 h-5 text-slate-500" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-white">Potřebujete poradit?</div>
          <div className="text-sm text-slate-500 mt-0.5">
            Napište nám a probereme, který plán je pro vás nejlepší. Rádi vám pomůžeme s migrací i nastavením.
          </div>
        </div>
        <a
          href="mailto:info@housesmart.cz"
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-navy-800/60 border border-white/[0.08] rounded-xl text-sm font-bold text-slate-300 hover:border-white/[0.12] hover: transition"
        >
          <Mail className="w-4 h-4" />
          Kontaktovat
        </a>
      </div>

      {showContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-navy-800/95 backdrop-blur-xl shadow-2xl rounded-2xl w-full max-w-md p-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ArrowRight className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-lg font-extrabold text-white mb-1">
                Upgrade na {plans.find(p => p.slug === showContact)?.name}
              </h3>
              <p className="text-sm text-slate-500">
                Pro aktivaci vyššího plánu nás kontaktujte. Postaráme se o vše ostatní.
              </p>
            </div>
            <div className="bg-white/[0.04] rounded-xl p-4 text-center mb-6">
              <div className="text-xs text-slate-500 mb-1">Kontaktní email</div>
              <a href="mailto:info@housesmart.cz" className="text-base font-bold text-blue-400 hover:underline">
                info@housesmart.cz
              </a>
            </div>
            <div className="text-center text-xs text-slate-400 mb-6">
              Uveďte název vaší organizace: <strong>{organization?.name}</strong>
              <br />
              a plán, na který chcete přejít.
            </div>
            <button
              onClick={() => setShowContact(null)}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-slate-400 bg-white/[0.06] hover:bg-white/[0.08] transition"
            >
              Zavřít
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
