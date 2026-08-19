import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const ALL_WIDGET_IDS = [
  'hero',
  'news-events',
  'stat-cards',
  'attendance-vacation',
  'pipeline-invoices',
  'projects-sidebar',
  'service-row',
  'activity',
  'my-tasks',
  'sticky-notes',
] as const;

export type WidgetId = (typeof ALL_WIDGET_IDS)[number];

export const WIDGET_LABELS: Record<WidgetId, string> = {
  'hero': 'Uvítací banner',
  'news-events': 'Nástěnka a události',
  'stat-cards': 'Statistiky',
  'attendance-vacation': 'Docházka a dovolená',
  'pipeline-invoices': 'Pipeline a fakturace',
  'projects-sidebar': 'Projekty a boční panel',
  'service-row': 'Servisy a záruky',
  'activity': 'Poslední aktivita',
  'my-tasks': 'Moje úkoly',
  'sticky-notes': 'Lístečky',
};

interface LayoutState {
  widgetOrder: WidgetId[];
  hiddenWidgets: WidgetId[];
}

export function useDashboardLayout() {
  const { user } = useAuth();
  const [layout, setLayout] = useState<LayoutState>({
    widgetOrder: [...ALL_WIDGET_IDS],
    hiddenWidgets: [],
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('dashboard_layouts')
          .select('widget_order, hidden_widgets')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;
        if (data) {
          const order = (data.widget_order as string[]).filter(id =>
            ALL_WIDGET_IDS.includes(id as WidgetId)
          ) as WidgetId[];
          const missing = ALL_WIDGET_IDS.filter(id => !order.includes(id));
          setLayout({
            widgetOrder: [...order, ...missing],
            hiddenWidgets: (data.hidden_widgets as string[]).filter(id =>
              ALL_WIDGET_IDS.includes(id as WidgetId)
            ) as WidgetId[],
          });
        }
      } catch {
        // use default layout on error
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const persist = useCallback(
    (next: LayoutState) => {
      if (!user) return;
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      setSaving(true);
      saveTimeout.current = setTimeout(async () => {
        await supabase.from('dashboard_layouts').upsert(
          {
            user_id: user.id,
            widget_order: next.widgetOrder,
            hidden_widgets: next.hiddenWidgets,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
        setSaving(false);
      }, 600);
    },
    [user]
  );

  const reorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      setLayout(prev => {
        const arr = [...prev.widgetOrder];
        const [moved] = arr.splice(fromIndex, 1);
        arr.splice(toIndex, 0, moved);
        const next = { ...prev, widgetOrder: arr };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const toggleWidget = useCallback(
    (widgetId: WidgetId) => {
      setLayout(prev => {
        const hidden = prev.hiddenWidgets.includes(widgetId)
          ? prev.hiddenWidgets.filter(id => id !== widgetId)
          : [...prev.hiddenWidgets, widgetId];
        const next = { ...prev, hiddenWidgets: hidden };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const resetLayout = useCallback(() => {
    const next: LayoutState = {
      widgetOrder: [...ALL_WIDGET_IDS],
      hiddenWidgets: [],
    };
    setLayout(next);
    persist(next);
  }, [persist]);

  const visibleWidgets = layout.widgetOrder.filter(
    id => !layout.hiddenWidgets.includes(id)
  );

  return {
    layout,
    visibleWidgets,
    loaded,
    saving,
    reorder,
    toggleWidget,
    resetLayout,
  };
}
