import { Link } from 'react-router-dom';
import { Lock, Zap } from 'lucide-react';
import { useOrganization } from '../../contexts/OrganizationContext';

type Tier = 'free' | 'pro' | 'business' | 'enterprise';

const TIER_ORDER: Record<Tier, number> = {
  free: 0,
  pro: 1,
  business: 2,
  enterprise: 3,
};

interface PlanGateProps {
  requiredTier: Tier;
  children: React.ReactNode;
  featureName?: string;
}

export default function PlanGate({ requiredTier, children, featureName }: PlanGateProps) {
  const { organization } = useOrganization();

  const currentTier = (organization?.subscription_tier ?? 'free') as Tier;
  const hasAccess = TIER_ORDER[currentTier] >= TIER_ORDER[requiredTier];

  if (hasAccess) return <>{children}</>;

  const tierLabels: Record<Tier, string> = {
    free: 'Free',
    pro: 'Pro',
    business: 'Business',
    enterprise: 'Enterprise',
  };

  return (
    <div className="relative group">
      <div className="pointer-events-none select-none opacity-40 blur-[1px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl shadow-lg p-5 text-center max-w-xs mx-4">
          <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Lock className="w-5 h-5 text-amber-500" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">
            {featureName ? `${featureName} vyžaduje` : 'Tato funkce vyžaduje'} plán {tierLabels[requiredTier]}
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Váš aktuální plán je <strong>{tierLabels[currentTier]}</strong>.
            Přejděte na vyšší plán a odemkněte tuto funkci.
          </p>
          <Link
            to="/admin/licence"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition"
          >
            <Zap className="w-3.5 h-3.5" />
            Upgradovat plán
          </Link>
        </div>
      </div>
    </div>
  );
}

export function usePlanAccess(requiredTier: Tier): boolean {
  const { organization } = useOrganization();
  const currentTier = (organization?.subscription_tier ?? 'free') as Tier;
  return TIER_ORDER[currentTier] >= TIER_ORDER[requiredTier];
}
