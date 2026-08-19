import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useHeader } from '../contexts/HeaderContext';
import type { WidgetId } from '../hooks/useDashboardLayout';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import { useDashboardData } from '../hooks/useDashboardData';
import DashboardGrid from '../components/dashboard/DashboardGrid';
import DashboardToolbar from '../components/dashboard/DashboardToolbar';
import HeroWidget from '../components/dashboard/widgets/HeroWidget';
import NewsEventsWidget from '../components/dashboard/widgets/NewsEventsWidget';
import StatCardsWidget from '../components/dashboard/widgets/StatCardsWidget';
import AttendanceVacationWidget from '../components/dashboard/widgets/AttendanceVacationWidget';
import PipelineInvoicesWidget from '../components/dashboard/widgets/PipelineInvoicesWidget';
import ProjectsSidebarWidget from '../components/dashboard/widgets/ProjectsSidebarWidget';
import ServiceRowWidget from '../components/dashboard/widgets/ServiceRowWidget';
import ActivityWidget from '../components/dashboard/widgets/ActivityWidget';
import MyTasksWidget from '../components/dashboard/widgets/MyTasksWidget';
import StickyNotesWidget from '../components/dashboard/widgets/StickyNotesWidget';


export default function DashboardPage() {
  const { setConfig } = useHeader();
  const layoutCtrl = useDashboardLayout();
  const { data: dashData, loading, error: loadError, retry } = useDashboardData();
  const [editMode, setEditMode] = useState(false);

  useEffect(() => { setConfig({ breadcrumbs: [{ label: 'Dashboard' }] }); }, [setConfig]);

  const renderWidget = useCallback((id: WidgetId) => {
    const props = { data: dashData, editMode };
    switch (id) {
      case 'hero': return <HeroWidget {...props} />;
      case 'news-events': return <NewsEventsWidget {...props} />;
      case 'stat-cards': return <StatCardsWidget {...props} />;
      case 'attendance-vacation': return <AttendanceVacationWidget />;
      case 'pipeline-invoices': return <PipelineInvoicesWidget {...props} />;
      case 'projects-sidebar': return <ProjectsSidebarWidget {...props} />;
      case 'service-row': return <ServiceRowWidget {...props} />;
      case 'activity': return <ActivityWidget {...props} />;
      case 'my-tasks': return <MyTasksWidget editMode={editMode} />;
      case 'sticky-notes': return <StickyNotesWidget editMode={editMode} />;

      default: return null;
    }
  }, [dashData, editMode]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">Nepodařilo se načíst dashboard</h2>
        <p className="text-sm text-slate-400 text-center max-w-md">
          Databáze může být dočasně nedostupná. Zkuste to prosím znovu.
        </p>
        <button
          onClick={retry}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-500 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Zkusit znovu
        </button>
      </div>
    );
  }

  if (loading || !layoutCtrl.loaded) {
    return (
      <div className="space-y-6">
        <div className="h-40 rounded-2xl bg-navy-700/50 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-navy-800/60 rounded-2xl border border-white/[0.06] animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="h-64 bg-navy-800/60 rounded-2xl border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-end">
        <DashboardToolbar
          editMode={editMode}
          setEditMode={setEditMode}
          hiddenWidgets={layoutCtrl.layout.hiddenWidgets}
          saving={layoutCtrl.saving}
          onToggleWidget={layoutCtrl.toggleWidget}
          onReset={layoutCtrl.resetLayout}
        />
      </div>

      {editMode && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-500/15 border border-blue-500/25 rounded-xl text-sm text-blue-300">
          <svg className="w-5 h-5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          <span className="font-medium">Přetahujte bloky pro změnu pořadí. Použijte ozubené kolečko pro skrytí/zobrazení widgetu.</span>
        </div>
      )}

      <DashboardGrid
        widgetOrder={layoutCtrl.visibleWidgets}
        editMode={editMode}
        onReorder={(from, to) => {
          const visibleIds = layoutCtrl.visibleWidgets;
          const fullOrder = layoutCtrl.layout.widgetOrder;
          const fromId = visibleIds[from];
          const toId = visibleIds[to];
          const fromFull = fullOrder.indexOf(fromId);
          const toFull = fullOrder.indexOf(toId);
          if (fromFull >= 0 && toFull >= 0) layoutCtrl.reorder(fromFull, toFull);
        }}
        renderWidget={renderWidget}
      />
    </div>
  );
}
