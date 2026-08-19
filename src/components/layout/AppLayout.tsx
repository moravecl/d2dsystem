import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import AnnouncementBanner from './AnnouncementBanner';
import { HeaderProvider, useHeader } from '../../contexts/HeaderContext';
import TourManager from '../tour/TourManager';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useActivityTracking } from '../../hooks/useActivityTracking';

function LayoutInner() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { config } = useHeader();
  const { profile } = useAuth();
  const { organization } = useOrganization();
  useActivityTracking(profile?.id ?? null, organization?.id ?? null);

  const fullBleed = config.fullBleed ?? false;
  const hideHeader = config.hideHeader ?? false;

  return (
    <div className={`relative deep-bg ${fullBleed ? 'h-screen' : 'min-h-screen'}`}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div
        className={`transition-all duration-300 ${
          collapsed ? 'lg:ml-[72px]' : 'lg:ml-64'
        } ${fullBleed ? 'flex flex-col h-full' : ''}`}
      >
        {!hideHeader && <Header onMenuClick={() => setMobileOpen(true)} />}
        {!hideHeader && <AnnouncementBanner />}
        <main className={fullBleed ? 'flex-1 overflow-hidden' : 'p-4 lg:p-6 animate-fade-in'}>
          <Outlet />
        </main>
      </div>

      <TourManager />
    </div>
  );
}

export default function AppLayout() {
  return (
    <HeaderProvider>
      <LayoutInner />
    </HeaderProvider>
  );
}
