import { Lock, Zap } from 'lucide-react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { Link } from 'react-router-dom';

type Tier = 'free' | 'pro' | 'business' | 'enterprise';

const TIER_ORDER: Record<Tier, number> = {
  free: 0,
  pro: 1,
  business: 2,
  enterprise: 3,
};

const TIER_LABELS: Record<Tier, string> = {
  free: 'Free',
  pro: 'Pro',
  business: 'Business',
  enterprise: 'Enterprise',
};

interface Props {
  requiredTier: Tier;
  featureName: string;
  children: React.ReactNode;
}

export default function PlanProtectedRoute({ requiredTier, featureName, children }: Props) {
  const { organization, loading } = useOrganization();

  if (loading) return null;

  const currentTier = (organization?.subscription_tier ?? 'free') as Tier;
  const hasAccess = TIER_ORDER[currentTier] >= TIER_ORDER[requiredTier];

  if (hasAccess) return <>{children}</>;

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Lock className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-xl font-extrabold text-white mb-2">{featureName}</h2>
        <p className="text-sm text-slate-500 mb-6">
          Tato funkce je dostupná od plánu <strong>{TIER_LABELS[requiredTier]}</strong>.
          Váš aktuální plán je <strong>{TIER_LABELS[currentTier]}</strong>.
        </p>
        <Link
          to="/admin/licence"
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition shadow-lg"
        >
          <Zap className="w-4 h-4" />
          Zobrazit plány a upgradovat
        </Link>
      </div>
    </div>
  );
}
