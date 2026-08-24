import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Users, Settings, LogOut, ChevronLeft, ChevronDown, X, Car, Cpu, Building2, CalendarClock, ClipboardList, Box as BoxIcon, DollarSign, FileInput, Wallet, Repeat as RepeatIcon, TrendingUp, Landmark } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebarSettings } from '../../hooks/useSidebarSettings';
import { usePermissions } from '../../hooks/usePermissions';
import type { ModuleKey } from '../../lib/permissions';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const assetSubItems = [
  { to: '/majetek', label: 'Přehled', icon: BoxIcon, end: true },
  { to: '/majetek/vozidla', label: 'Vozový park', icon: Car },
  { to: '/majetek/zarizeni', label: 'Zařízení', icon: Cpu },
  { to: '/majetek/budovy', label: 'Budovy', icon: Building2 },
  { to: '/majetek/terminy', label: 'Revize & Termíny', icon: CalendarClock },
  { to: '/majetek/historie', label: 'Servisní historie', icon: ClipboardList },
];

const financeSubItems = [
  { to: '/finance', label: 'Vydané faktury', icon: DollarSign, end: true },
  { to: '/finance/prijate', label: 'Přijaté faktury', icon: FileInput },
  { to: '/finance/pokladna', label: 'Pokladna', icon: Wallet },
  { to: '/finance/dodavatele', label: 'Dodavatelé', icon: Users },
  { to: '/finance/stale-naklady', label: 'Stálé náklady', icon: RepeatIcon },
  { to: '/finance/cashflow', label: 'Cashflow', icon: TrendingUp },
  { to: '/finance/banka', label: 'Banka', icon: Landmark },
];

// Kolik radku kostry ukazat, nez dorazi opravneni - odpovida bezne delce menu.
const SIDEBAR_SKELETON_ROWS = Array.from({ length: 9 });

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { groupedItems } = useSidebarSettings();
  const { hasModule, loading: permissionsLoading } = usePermissions();
  const [assetExpanded, setAssetExpanded] = useState(location.pathname.startsWith('/majetek'));
  const [financeExpanded, setFinanceExpanded] = useState(location.pathname.startsWith('/finance'));

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const linkClass = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group ${
      isActive
        ? 'bg-white/[0.10] text-white'
        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
    }`;

  const subLinkClass = (isActive: boolean) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
      isActive ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
    }`;

  const renderExpandable = (
    key: string,
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
    pathPrefix: string,
    expanded: boolean,
    setExpanded: (v: boolean) => void,
    subItems: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean }[],
  ) => {
    const isPathActive = location.pathname.startsWith(pathPrefix);

    if (collapsed) {
      return (
        <NavLink key={key} to={pathPrefix} onClick={onMobileClose} className={({ isActive }) => linkClass(isActive)}>
          {({ isActive }) => (
            <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
          )}
        </NavLink>
      );
    }

    return (
      <div key={key}>
        <button onClick={() => setExpanded(!expanded)} className={`w-full ${linkClass(isPathActive)}`}>
          <Icon className={`w-5 h-5 shrink-0 ${isPathActive ? 'text-blue-400' : ''}`} />
          <span className="truncate flex-1 text-left">{label}</span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>
        {expanded && (
          <div className="ml-3 pl-4 border-l border-white/[0.06] mt-0.5 space-y-0.5">
            {subItems.map((sub) => (
              <NavLink
                key={sub.to}
                to={sub.to}
                end={sub.end}
                onClick={onMobileClose}
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <sub.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{sub.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderItem = (item: typeof groupedItems[number]['items'][number]) => {
    if (item.key === 'majetek') {
      return renderExpandable('majetek', item.label, item.icon, '/majetek', assetExpanded, setAssetExpanded, assetSubItems);
    }
    if (item.key === 'finance') {
      return renderExpandable('finance', item.label, item.icon, '/finance', financeExpanded, setFinanceExpanded, financeSubItems);
    }

    return (
      <NavLink key={item.to} to={item.to} onClick={onMobileClose} className={({ isActive }) => linkClass(isActive)}>
        {({ isActive }) => (
          <>
            <item.icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-blue-400' : ''}`} />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </>
        )}
      </NavLink>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full glass-sidebar relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 w-40 h-40 bg-[#4A7DFF]/[0.06] rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between h-16 px-3 border-b border-white/[0.06] relative z-10">
        <div className="flex items-center flex-1 min-w-0">
          <img
            src="/housesmartlogo.png"
            alt="HouseSmart"
            className={`object-contain transition-all duration-300 ${collapsed ? 'h-8 w-8' : 'h-10 w-full max-w-[180px]'}`}
          />
        </div>
        <button
          onClick={onToggle}
          className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-all shrink-0 ml-1"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={onMobileClose}
          className="lg:hidden flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] shrink-0 ml-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 py-3 px-2.5 overflow-y-auto relative z-10">
        {permissionsLoading && (
          <div className="space-y-1.5" aria-hidden="true">
            {SIDEBAR_SKELETON_ROWS.map((_, i) => (
              <div key={i} className="h-[42px] rounded-xl bg-white/[0.05] animate-skeleton" />
            ))}
          </div>
        )}

        {!permissionsLoading && groupedItems.map((group, gIdx) => {
          const visibleInGroup = group.items.filter((i) => i.visible && hasModule(i.key as ModuleKey));
          if (visibleInGroup.length === 0) return null;

          const showLabel = group.name && !collapsed;

          return (
            <div key={group.id || `ungrouped-${gIdx}`} className={gIdx > 0 ? 'mt-3' : ''}>
              {showLabel && (
                <div className="px-3 pt-1 pb-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    {group.name}
                  </div>
                </div>
              )}
              {!showLabel && gIdx > 0 && (
                <div className="my-2 border-t border-white/[0.06]" />
              )}
              <div className="space-y-0.5">
                {visibleInGroup.map((item) => renderItem(item))}
              </div>
            </div>
          );
        })}

        {!permissionsLoading && (isAdmin || hasModule('admin')) && (
          <>
            <div className="my-2 border-t border-white/[0.06]" />
            <NavLink to="/admin" onClick={onMobileClose} className={({ isActive }) => linkClass(isActive)}>
              {({ isActive }) => (
                <>
                  <Settings className={`w-5 h-5 shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
                  {!collapsed && <span>Admin</span>}
                </>
              )}
            </NavLink>
          </>
        )}
      </nav>

      <div className="p-2.5 border-t border-white/[0.06] relative z-10">
        <div className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-white/[0.05] transition-colors ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-lg shadow-blue-500/20 ring-2 ring-white/10">
            {(profile?.display_name || profile?.email || '?')[0].toUpperCase()}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{profile?.display_name || 'Uživatel'}</div>
              <div className="text-[11px] text-slate-500 truncate">{profile?.email}</div>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleSignOut}
              className="text-slate-500 hover:text-white hover:bg-white/[0.06] rounded-lg p-1.5 transition-all shrink-0"
              title="Odhlásit se"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden animate-backdrop-enter"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 lg:z-30 transition-all duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'lg:w-[72px]' : 'lg:w-64'} w-64 border-r border-white/[0.06]`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
