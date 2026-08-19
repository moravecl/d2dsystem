import type { ReactNode } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import type { DataPermissionKey, ModuleKey } from '../../lib/permissions';
import { Lock } from 'lucide-react';

interface Props {
  permission?: DataPermissionKey;
  module?: ModuleKey;
  children: ReactNode;
  fallback?: ReactNode;
  hide?: boolean;
}

export default function PermissionGate({ permission, module, children, fallback, hide = false }: Props) {
  const { hasPermission, hasModule } = usePermissions();

  const allowed =
    (permission ? hasPermission(permission) : true) &&
    (module ? hasModule(module) : true);

  if (allowed) return <>{children}</>;

  if (hide) return null;

  if (fallback) return <>{fallback}</>;

  return (
    <div className="flex items-center gap-2 text-xs text-slate-400 italic">
      <Lock className="w-3 h-3" />
      <span>Nedostatecna opravneni</span>
    </div>
  );
}

export function PriceDisplay({ value, className = '' }: { value: number; className?: string }) {
  const { hasPermission } = usePermissions();
  if (!hasPermission('view_prices')) return <span className="text-slate-400 text-xs">---</span>;
  return <span className={className}>{value.toLocaleString('cs-CZ')} Kc</span>;
}

export function PurchasePriceDisplay({ value, className = '' }: { value: number; className?: string }) {
  const { hasPermission } = usePermissions();
  if (!hasPermission('view_purchase_prices')) return <span className="text-slate-400 text-xs">---</span>;
  return <span className={className}>{value.toLocaleString('cs-CZ')} Kc</span>;
}

export function MarginDisplay({ value, className = '' }: { value: number; className?: string }) {
  const { hasPermission } = usePermissions();
  if (!hasPermission('view_margins')) return <span className="text-slate-400 text-xs">---</span>;
  return <span className={className}>{value.toFixed(1)}%</span>;
}
