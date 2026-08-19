import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, Activity, CreditCard,
  Megaphone, LogOut, Menu, X, Shield, ChevronRight, MousePointerClick
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
  { to: '/superadmin', icon: LayoutDashboard, label: 'Přehled', end: true },
  { to: '/superadmin/organizations', icon: Building2, label: 'Organizace', end: false },
  { to: '/superadmin/users', icon: Users, label: 'Uživatelé', end: false },
  { to: '/superadmin/activity', icon: MousePointerClick, label: 'Aktivita uživatelů', end: false },
  { to: '/superadmin/health', icon: Activity, label: 'Zdraví systému', end: false },
  { to: '/superadmin/plans', icon: CreditCard, label: 'Plány & Limity', end: false },
  { to: '/superadmin/announcements', icon: Megaphone, label: 'Oznámení', end: false },
];

function SidebarContent({ profile, onSignOut, onNavClick }: {
  profile: { display_name?: string; email?: string } | null;
  onSignOut: () => void;
  onNavClick?: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-navy-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.04] via-transparent to-transparent pointer-events-none" />

      <div className="p-4 border-b border-white/[0.06] relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">SuperAdmin</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">Platform Control</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto relative z-10">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : ''}`} />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 text-amber-500/60" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-2.5 border-t border-white/[0.06] relative z-10">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors">
          <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">
              {profile?.display_name || profile?.email}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Superadmin</div>
          </div>
          <button
            onClick={onSignOut}
            className="text-slate-500 hover:text-red-400 hover:bg-white/[0.06] rounded-lg p-1.5 transition-all"
            title="Odhlásit se"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-navy-950 flex">
      <aside className="hidden lg:flex w-60 flex-col shrink-0 border-r border-white/[0.06]">
        <SidebarContent profile={profile} onSignOut={handleSignOut} />
      </aside>

      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-navy-900 border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-xl hover:bg-white/[0.06] transition">
            <Menu className="w-5 h-5 text-slate-300" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-white">SuperAdmin</span>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full flex flex-col shadow-2xl border-r border-white/[0.06]">
            <div className="absolute top-3 right-3 z-10">
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-xl hover:bg-white/[0.06] transition">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <SidebarContent
              profile={profile}
              onSignOut={handleSignOut}
              onNavClick={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-auto lg:pt-0 pt-14 min-h-screen bg-navy-950">
        <Outlet />
      </main>
    </div>
  );
}
