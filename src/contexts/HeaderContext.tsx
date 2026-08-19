import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface HeaderAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
}

interface HeaderConfig {
  breadcrumbs: BreadcrumbItem[];
  primaryAction?: HeaderAction;
  secondaryAction?: HeaderAction;
  menuActions?: HeaderAction[];
  fullBleed?: boolean;
  hideHeader?: boolean;
}

interface HeaderContextValue {
  config: HeaderConfig;
  setConfig: (config: HeaderConfig) => void;
}

const HeaderContext = createContext<HeaderContextValue | undefined>(undefined);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<HeaderConfig>({ breadcrumbs: [] });

  const setConfig = useCallback((c: HeaderConfig) => {
    setConfigState(c);
  }, []);

  return (
    <HeaderContext.Provider value={{ config, setConfig }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const ctx = useContext(HeaderContext);
  if (!ctx) throw new Error('useHeader must be used within HeaderProvider');
  return ctx;
}
