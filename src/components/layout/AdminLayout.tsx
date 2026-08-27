import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, Package, Puzzle, Settings, ArrowLeft, LogOut, Users, Lightbulb, Cable, Flame, Menu, X, FileText, Building2, Sliders, Receipt, Mail, FileCode, CreditCard, Shield, ClipboardList, Tags, Sun, Zap, Settings2, FolderOpen, PanelLeft, Camera, FileCheck, ShieldAlert, Shapes, PenTool, Link2, GitMerge, ChevronDown, Layers, FormInput, Boxes, BellRing, Calculator } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const overviewItem = { to: '/admin', icon: LayoutGrid, label: 'Přehled' };

// Sbalitelné skupiny. Otevřená je vždy ta, ve které je aktivní routa;
// ruční otevření/zavření se pamatuje v localStorage.
const NAV_GROUPS = [
  {
    id: 'katalog', label: 'Katalog',
    items: [
      { to: '/admin/categories', icon: Layers, label: 'Kategorie' },
      { to: '/admin/products', icon: Package, label: 'Položky' },
      { to: '/admin/materials', icon: Cable, label: 'Materiály a ceny' },
      { to: '/admin/heating', icon: Flame, label: 'Systémy vytápění' },
      { to: '/admin/inspirations', icon: Lightbulb, label: 'Inspirace' },
    ],
  },
  {
    id: 'obory', label: 'Oborové katalogy',
    items: [
      { to: '/admin/fv-katalog', icon: Sun, label: 'FV katalog' },
      { to: '/admin/camera-katalog', icon: Camera, label: 'Kamerový katalog' },
      { to: '/admin/eps-katalog', icon: ShieldAlert, label: 'EPS / EZS katalog' },
    ],
  },
  {
    id: 'navrhar', label: 'Návrhář',
    items: [
      { to: '/admin/design-modules', icon: Puzzle, label: 'Design moduly' },
      { to: '/admin/presets', icon: Settings, label: 'Presety' },
      { to: '/admin/design-element-types', icon: Shapes, label: 'Schématické značky' },
      { to: '/admin/compatibility', icon: Link2, label: 'Kompatibilita prvků' },
      { to: '/admin/design-series-links', icon: GitMerge, label: 'Mapování des. řad' },
      { to: '/admin/designer-config', icon: PenTool, label: 'Konfigurace návrháře' },
    ],
  },
  {
    id: 'projekty', label: 'Projekty a šablony',
    items: [
      { to: '/admin/project-types', icon: Tags, label: 'Typy projektů' },
      { to: '/admin/custom-fields', icon: Settings2, label: 'Vlastní pole' },
      { to: '/admin/project-templates', icon: FolderOpen, label: 'Šablony projektů' },
      { to: '/admin/protocol-templates', icon: FileCheck, label: 'Šablony protokolů' },
      { to: '/admin/templates', icon: FileText, label: 'Šablony dokumentů' },
      { to: '/admin/formulare', icon: FormInput, label: 'Formuláře' },
      { to: '/admin/resource-groups', icon: Boxes, label: 'Skupiny zdrojů' },
    ],
  },
  {
    id: 'tym', label: 'Tým a firma',
    items: [
      { to: '/admin/users', icon: Users, label: 'Uživatelé a tým' },
      { to: '/admin/firma', icon: Building2, label: 'Informace o firmě' },
      { to: '/admin/licence', icon: CreditCard, label: 'Licence a limity' },
      { to: '/admin/gdpr', icon: Shield, label: 'GDPR & Export dat' },
    ],
  },
  {
    id: 'fakturace', label: 'Fakturace a e-mail',
    items: [
      { to: '/admin/fakturace', icon: Receipt, label: 'Nastavení fakturace' },
      { to: '/admin/konfigurator', icon: Calculator, label: 'Ceník konfigurátoru' },
      { to: '/admin/smtp', icon: Mail, label: 'SMTP účty' },
      { to: '/admin/email-sablony', icon: FileCode, label: 'Emailové šablony' },
    ],
  },
  {
    id: 'system', label: 'Systém',
    items: [
      { to: '/admin/system', icon: Sliders, label: 'Systémová nastavení' },
      { to: '/admin/notifikace', icon: BellRing, label: 'Notifikace' },
      { to: '/admin/automatizace', icon: Zap, label: 'Automatizace' },
      { to: '/admin/sidebar', icon: PanelLeft, label: 'Nastavení sidebaru' },
      { to: '/admin/audit', icon: ClipboardList, label: 'Audit log' },
    ],
  },
];

const NAV_OPEN_KEY = 'hs-admin-nav-open';

function loadOpenState(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(NAV_OPEN_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function SidebarContent({ profile, onSignOut, onNavigateCatalog, onNavClick }: {
  profile: { display_name?: string; email?: string } | null;
  onSignOut: () => void;
  onNavigateCatalog: () => void;
  onNavClick?: () => void;
}) {
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(loadOpenState);

  const toggleGroup = (id: string, open: boolean) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: open };
      try { localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-navy-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-orange-500/[0.04] via-transparent to-transparent pointer-events-none" />

      <div className="px-4 py-4 border-b border-white/[0.06] relative z-10">
        <div className="flex items-center gap-3">
          <img src="/housesmartlogo.png" alt="HouseSmart" className="h-8 w-auto" />
          <div>
            <div className="text-sm font-bold text-white">HouseSmart</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-orange-400/80">Administrace</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-2.5 overflow-y-auto min-h-0 relative z-10">
        <NavLink
          to={overviewItem.to}
          end
          onClick={onNavClick}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-orange-500/15 text-orange-300 border border-orange-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
            }`
          }
        >
          <overviewItem.icon className="w-4 h-4 shrink-0" />
          {overviewItem.label}
        </NavLink>

        {NAV_GROUPS.map((group) => {
          const isActiveGroup = group.items.some((i) => location.pathname.startsWith(i.to));
          const isOpen = openGroups[group.id] ?? isActiveGroup;
          return (
            <div key={group.id} className="mt-1.5">
              <button
                onClick={() => toggleGroup(group.id, !isOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
              >
                <span className={isActiveGroup ? 'text-orange-400/80' : undefined}>{group.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
              </button>
              {isOpen && (
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onNavClick}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-orange-500/15 text-orange-300 border border-orange-500/20'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-2.5 border-t border-white/[0.06] space-y-1 relative z-10">
        <button
          onClick={() => { onNavClick?.(); onNavigateCatalog(); }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-all w-full"
        >
          <ArrowLeft className="w-4 h-4" />
          Zpět do aplikace
        </button>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {(profile?.display_name || profile?.email || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">{profile?.display_name || profile?.email}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-orange-400">Admin</div>
          </div>
          <button onClick={onSignOut} className="text-slate-500 hover:text-red-400 hover:bg-white/[0.06] rounded-lg p-1.5 transition-all">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-navy-950 flex">
      <aside className="hidden lg:flex w-64 flex-col shrink-0 h-screen sticky top-0 overflow-hidden border-r border-white/[0.06]">
        <SidebarContent
          profile={profile}
          onSignOut={handleSignOut}
          onNavigateCatalog={() => navigate('/')}
        />
      </aside>

      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-navy-900 border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-xl hover:bg-white/[0.06] transition">
            <Menu className="w-5 h-5 text-slate-300" />
          </button>
          <span className="text-sm font-bold text-white">HouseSmart Admin</span>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-backdrop-enter" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 h-full flex flex-col animate-sidebar-enter shadow-2xl overflow-hidden border-r border-white/[0.06]">
            <div className="absolute top-3 right-3 z-10">
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-xl hover:bg-white/[0.06] transition">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <SidebarContent
              profile={profile}
              onSignOut={handleSignOut}
              onNavigateCatalog={() => navigate('/')}
              onNavClick={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-auto lg:pt-0 pt-14 bg-navy-950">
        <Outlet />
      </main>
    </div>
  );
}
