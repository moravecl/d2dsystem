import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, MoreHorizontal, ChevronRight, User, Plus, Search } from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { useAuth } from '../../contexts/AuthContext';
import NotificationCenter from '../notifications/NotificationCenter';
import HeaderTimer from './HeaderTimer';
import HeaderMeetingIndicator from './HeaderMeetingIndicator';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { config } = useHeader();
  const { profile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pageTitle = config.breadcrumbs[config.breadcrumbs.length - 1]?.label ?? '';

  return (
    <header className="sticky top-0 z-20 glass-header">
      <div className="flex items-center justify-between h-14 px-4 lg:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1.5 min-w-0">
            {config.breadcrumbs.length > 1 ? (
              <nav className="flex items-center gap-1.5 text-sm min-w-0">
                {config.breadcrumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1.5 min-w-0">
                    {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                    {crumb.href ? (
                      <Link
                        to={crumb.href}
                        className="text-slate-500 hover:text-slate-300 transition-colors truncate"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-white font-semibold truncate">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            ) : (
              <h1 className="text-white font-semibold text-[15px] truncate">{pageTitle}</h1>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <Search className="w-4.5 h-4.5" style={{ width: '1.1rem', height: '1.1rem' }} />
          </button>

          {config.secondaryAction && (
            <button
              onClick={config.secondaryAction.onClick}
              className="hidden sm:flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-300 bg-white/[0.07] border border-white/10 rounded-xl hover:bg-white/[0.12] hover:text-white transition-all"
            >
              {config.secondaryAction.icon}
              <span>{config.secondaryAction.label}</span>
            </button>
          )}

          {config.primaryAction && (
            <button
              onClick={config.primaryAction.onClick}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl hover:from-blue-500 hover:to-cyan-400 transition-all shadow-lg shadow-blue-500/25 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{config.primaryAction.label}</span>
            </button>
          )}

          {config.menuActions && config.menuActions.length > 0 && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-navy-800/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl shadow-black/40 py-1 animate-dropdown-enter">
                  {config.menuActions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        action.onClick();
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/[0.07] transition-colors"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <HeaderMeetingIndicator />
          <HeaderTimer />
          <NotificationCenter />

          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center ml-0.5 ring-2 ring-white/10 shadow-md">
            {profile ? (
              <span className="text-xs font-bold text-white">
                {(profile.display_name || profile.email)[0].toUpperCase()}
              </span>
            ) : (
              <User className="w-3.5 h-3.5 text-white/70" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
