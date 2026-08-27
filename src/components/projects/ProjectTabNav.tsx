import { useState, useRef, useEffect } from 'react';
import {
  ClipboardList,
  Paintbrush,
  HardHat,
  FileText,
  DollarSign,
  Wrench,
  Mail,
  MessageSquare,
  ChevronDown,
  X,
  Check,
  AlertTriangle,
} from 'lucide-react';

export interface WorkflowBadgeData {
  designElementCount?: number;
  unassignedCount?: number;
  warningCount?: number;
  quotesCount?: number;
}

export interface TabGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  tabs: { key: string; label: string }[];
}

export const projectTabGroups: TabGroup[] = [
  {
    key: 'zaklad',
    label: 'Základ',
    icon: <ClipboardList className="w-4 h-4" />,
    tabs: [
      { key: 'overview', label: 'Přehled' },
      { key: 'specs', label: 'Specifikace' },
    ],
  },
  {
    key: 'navrh',
    label: 'Návrh',
    icon: <Paintbrush className="w-4 h-4" />,
    tabs: [
      { key: 'design', label: 'Návrh' },
      { key: 'assignments', label: 'Přiřazení' },
      { key: 'selection', label: 'Souhrn' },
      { key: 'konfigurator', label: 'Předběžná nabídka' },
      { key: 'quotes', label: 'Nabídky' },
    ],
  },
  {
    key: 'realizace',
    label: 'Realizace',
    icon: <HardHat className="w-4 h-4" />,
    tabs: [
      { key: 'execution', label: 'Realizace' },
      { key: 'viceprace', label: 'Vícepráce' },
      { key: 'quickjobs', label: 'Dílčí práce' },
      { key: 'tasks', label: 'Úkoly' },
      { key: 'time', label: 'Čas' },
      { key: 'protocols', label: 'Protokoly' },
    ],
  },
  {
    key: 'dokumenty',
    label: 'Dokumenty',
    icon: <FileText className="w-4 h-4" />,
    tabs: [
      { key: 'documents', label: 'Dokumenty' },
      { key: 'files', label: 'Soubory' },
      { key: 'photos', label: 'Fotky' },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: <DollarSign className="w-4 h-4" />,
    tabs: [
      { key: 'finance', label: 'Finance' },
      { key: 'warehouse', label: 'Sklad' },
    ],
  },
  {
    key: 'schuzky',
    label: 'Schůzky',
    icon: <MessageSquare className="w-4 h-4" />,
    tabs: [{ key: 'meetings', label: 'Schůzky' }],
  },
  {
    key: 'email',
    label: 'E-mail',
    icon: <Mail className="w-4 h-4" />,
    tabs: [{ key: 'email', label: 'E-mail' }],
  },
  {
    key: 'servis',
    label: 'Servis',
    icon: <Wrench className="w-4 h-4" />,
    tabs: [
      { key: 'service', label: 'Servis' },
      { key: 'remarks', label: 'Připomínky' },
    ],
  },
];

function findGroupForTab(tabKey: string): TabGroup | undefined {
  return projectTabGroups.find((g) => g.tabs.some((t) => t.key === tabKey));
}

function findTabLabel(tabKey: string): string {
  for (const g of projectTabGroups) {
    const t = g.tabs.find((t) => t.key === tabKey);
    if (t) return t.label;
  }
  return tabKey;
}

interface Props {
  active: string;
  onChange: (key: string) => void;
  workflowBadges?: WorkflowBadgeData;
}

function TabBadge({ tabKey, badges }: { tabKey: string; badges?: WorkflowBadgeData }) {
  if (!badges) return null;

  if (tabKey === 'design') {
    if (badges.designElementCount && badges.designElementCount > 0) {
      return (
        <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold">
          {badges.designElementCount}
        </span>
      );
    }
    return null;
  }

  if (tabKey === 'assignments') {
    if (badges.unassignedCount && badges.unassignedCount > 0) {
      return (
        <span className="ml-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
          <AlertTriangle className="w-2.5 h-2.5" />
          {badges.unassignedCount}
        </span>
      );
    }
    if (badges.designElementCount && badges.designElementCount > 0 && badges.unassignedCount === 0) {
      return (
        <span className="ml-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
          <Check className="w-2.5 h-2.5" />
        </span>
      );
    }
    return null;
  }

  if (tabKey === 'selection') {
    if (badges.warningCount && badges.warningCount > 0) {
      return (
        <span className="ml-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
          {badges.warningCount}
        </span>
      );
    }
    return null;
  }

  if (tabKey === 'quotes') {
    if (badges.quotesCount && badges.quotesCount > 0) {
      return (
        <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
          {badges.quotesCount}
        </span>
      );
    }
    return null;
  }

  return null;
}

export default function ProjectTabNav({ active, onChange, workflowBadges }: Props) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [mobileOpen]);

  const activeGroup = findGroupForTab(active);
  const activeLabel = findTabLabel(active);

  const handleSelect = (tabKey: string) => {
    onChange(tabKey);
    setOpenGroup(null);
    setMobileOpen(false);
  };

  return (
    <>
      <div className="hidden md:block border-b border-white/[0.07]" ref={navRef}>
        <nav className="flex items-center px-1">
          {projectTabGroups.map((group) => {
            const isActiveGroup = activeGroup?.key === group.key;
            const isSingleTab = group.tabs.length === 1;
            const isOpen = openGroup === group.key;

            return (
              <div key={group.key} className="relative">
                <button
                  onClick={() => {
                    if (isSingleTab) {
                      handleSelect(group.tabs[0].key);
                      return;
                    }
                    setOpenGroup(isOpen ? null : group.key);
                  }}
                  className={`relative flex items-center gap-1.5 px-3.5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    isActiveGroup
                      ? 'text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {group.icon}
                  <span>{group.label}</span>
                  {!isSingleTab && (
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  )}
                  {isActiveGroup && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </button>

                {isOpen && !isSingleTab && (
                  <div className="absolute top-full left-0 z-50 mt-0.5 min-w-[180px] py-1 bg-navy-800/90 backdrop-blur-sm rounded-xl border border-white/10 shadow-lg animate-dropdown-enter">
                    {group.tabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => handleSelect(tab.key)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                          active === tab.key
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'text-slate-400 hover:bg-white/[0.07] hover:text-slate-300'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <TabBadge tabKey={tab.key} badges={workflowBadges} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="md:hidden border-b border-white/[0.07] px-3 py-2">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.07] border border-white/10 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.12] active:bg-white/[0.15]"
        >
          <span className="flex items-center gap-2">
            {activeGroup?.icon}
            <span>
              {activeGroup?.label}
              {activeGroup && activeGroup.tabs.length > 1 && (
                <span className="text-slate-500 font-normal"> / {activeLabel}</span>
              )}
            </span>
          </span>
          <ChevronDown className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-backdrop-enter"
            onClick={() => setMobileOpen(false)}
          />

          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] bg-navy-900 rounded-t-2xl shadow-2xl overflow-y-auto animate-sheet-up">
            <div className="sticky top-0 bg-navy-900/95 backdrop-blur-sm border-b border-white/[0.08] px-5 py-4 flex items-center justify-between z-10">
              <h3 className="text-base font-bold text-white">Navigace projektu</h3>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/[0.07] transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-4 pb-8 space-y-1">
              {projectTabGroups.map((group) => (
                <div key={group.key} className="mb-2">
                  <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {group.icon}
                    {group.label}
                  </div>
                  {group.tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => handleSelect(tab.key)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                        active === tab.key
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:bg-white/[0.07] active:bg-white/[0.12]'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <TabBadge tabKey={tab.key} badges={workflowBadges} />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
