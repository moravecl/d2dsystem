import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { computeDueStatus } from '../types/assets';
import type { DueItem, Asset } from '../types/assets';
import type { DashboardData, DashboardStats } from '../components/dashboard/dashboardTypes';

const EMPTY_STATS: DashboardStats = {
  clients: 0, projects: 0, activeProjects: 0, products: 0,
  pendingQuotes: 0, approvedQuotes: 0,
  totalInvoiced: 0, totalPaid: 0, totalOverdue: 0,
  hoursThisMonth: 0, hoursLastMonth: 0,
};

const INITIAL_DATA: DashboardData = {
  profile: null,
  stats: EMPTY_STATS,
  recentProjects: [],
  pipeline: [],
  dueAlerts: [],
  activityFeed: [],
  profiles: [],
  monthlyInvoices: [],
  serviceAlerts: [],
  openTicketsCount: 0,
  warrantyAlerts: [],
  newsPosts: [],
  newsCommentCounts: {},
  upcomingEvents: [],
  quickJobPoolCount: 0,
  quickJobAlerts: [],
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

async function safeQuery<T>(
  // Supabase builder je thenable, ne Promise - proto PromiseLike
  query: PromiseLike<{ data: unknown; error: unknown; count?: number | null }>,
  fallback: T
): Promise<{ value: T; failed: boolean; count?: number | null }> {
  try {
    const res = await query;
    if (res.error) return { value: fallback, failed: true, count: res.count };
    return { value: (res.data ?? fallback) as T, failed: false, count: res.count };
  } catch {
    return { value: fallback, failed: true };
  }
}

async function loadCoreStats() {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

  const [clients, projects, active, products, pendingQ, approvedQ, pipeline,
    invoices, payments, timeThis, timeLast] = await Promise.all([
    safeQuery(supabase.from('clients').select('id', { count: 'exact', head: true }).eq('is_active', true), null),
    safeQuery(supabase.from('projects').select('id', { count: 'exact', head: true }).not('status', 'in', '("completed","cancelled")'), null),
    safeQuery(supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'), null),
    safeQuery(supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true), null),
    safeQuery(supabase.from('project_quotes').select('id', { count: 'exact', head: true }).neq('status', 'approved'), null),
    safeQuery(supabase.from('project_quotes').select('id', { count: 'exact', head: true }).eq('status', 'approved'), null),
    safeQuery(supabase.from('projects').select('status'), [] as { status: string }[]),
    safeQuery(supabase.from('invoices').select('amount, status, created_at'), [] as { amount: number; status: string; created_at: string }[]),
    safeQuery(supabase.from('payments').select('amount'), [] as { amount: number }[]),
    safeQuery(supabase.from('time_entries').select('duration_minutes').gte('created_at', thisMonthStart), [] as { duration_minutes: number }[]),
    safeQuery(supabase.from('time_entries').select('duration_minutes').gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd), [] as { duration_minutes: number }[]),
  ]);

  const failCount = [clients, projects, active, products, invoices, pipeline].filter(r => r.failed).length;

  const invoiceRows = invoices.value || [];
  const totalInvoiced = invoiceRows.reduce((s: number, i: any) => s + (i.amount || 0), 0);
  const totalPaid = (payments.value || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const totalOverdue = invoiceRows.filter((i: any) => i.status === 'overdue').reduce((s: number, i: any) => s + (i.amount || 0), 0);
  const hoursThisMonth = (timeThis.value || []).reduce((s: number, e: any) => s + (e.duration_minutes || 0), 0);
  const hoursLastMonth = (timeLast.value || []).reduce((s: number, e: any) => s + (e.duration_minutes || 0), 0);

  const stats: DashboardStats = {
    clients: clients.count || 0,
    projects: projects.count || 0,
    activeProjects: active.count || 0,
    products: products.count || 0,
    pendingQuotes: pendingQ.count || 0,
    approvedQuotes: approvedQ.count || 0,
    totalInvoiced, totalPaid, totalOverdue, hoursThisMonth, hoursLastMonth,
  };

  const pipeMap: Record<string, number> = {};
  (pipeline.value || []).forEach((p: any) => { pipeMap[p.status] = (pipeMap[p.status] || 0) + 1; });
  const pipelineArr = Object.entries(pipeMap).map(([status, count]) => ({ status, count }));

  const monthMap: Record<string, number> = {};
  invoiceRows.forEach((inv: any) => {
    const d = new Date(inv.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap[key] = (monthMap[key] || 0) + (inv.amount || 0);
  });
  const monthlyInvoices = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, amount]) => ({ month, amount }));

  return { stats, pipeline: pipelineArr, monthlyInvoices, failCount };
}

async function loadContentData() {
  const [recent, due, audit, profiles] = await Promise.all([
    safeQuery(
      supabase.from('projects')
        .select('id, project_name, client_name, status, address, deadline, updated_at')
        .order('updated_at', { ascending: false })
        .limit(6),
      [] as any[]
    ),
    safeQuery(
      supabase.from('due_items')
        .select('*, assets(id, name, asset_type)')
        .neq('status', 'completed')
        .order('due_date', { ascending: true })
        .limit(50),
      [] as any[]
    ),
    safeQuery(
      supabase.from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15),
      [] as any[]
    ),
    safeQuery(
      supabase.from('profiles').select('id, display_name, email'),
      [] as any[]
    ),
  ]);

  const dueAlerts = ((due.value || []) as unknown as (DueItem & { assets: Asset })[])
    .map(d => ({ ...d, asset: d.assets }))
    .filter(d => { const s = computeDueStatus(d); return s === 'overdue' || s === 'upcoming'; })
    .slice(0, 5);

  return {
    recentProjects: recent.value || [],
    dueAlerts,
    activityFeed: audit.value || [],
    profiles: profiles.value || [],
  };
}

async function loadServiceData() {
  const inThreeMonths = new Date();
  inThreeMonths.setMonth(inThreeMonths.getMonth() + 3);

  const [sched, ticketsCount, devices] = await Promise.all([
    safeQuery(
      supabase.from('service_schedules')
        .select('id, next_date, service_type_id, project_id, is_active')
        .eq('is_active', true)
        .lte('next_date', inThreeMonths.toISOString().slice(0, 10))
        .order('next_date')
        .limit(10),
      [] as any[]
    ),
    safeQuery(
      supabase.from('service_tickets')
        .select('id', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress']),
      null
    ),
    safeQuery(
      supabase.from('installed_devices')
        .select('id, name, warranty_end_date, project_id')
        .not('warranty_end_date', 'is', null)
        .lte('warranty_end_date', inThreeMonths.toISOString().slice(0, 10))
        .order('warranty_end_date')
        .limit(10),
      [] as any[]
    ),
  ]);

  const schedRows = sched.value || [];
  const devRows = devices.value || [];
  let serviceAlerts: DashboardData['serviceAlerts'] = [];
  let warrantyAlerts: DashboardData['warrantyAlerts'] = [];

  if (schedRows.length > 0 || devRows.length > 0) {
    const projectIds = [...new Set([...schedRows.map((s: any) => s.project_id), ...devRows.map((d: any) => d.project_id)])].filter(Boolean);
    const typeIds = [...new Set(schedRows.map((s: any) => s.service_type_id))].filter(Boolean);
    const [projNames, typeNames] = await Promise.all([
      projectIds.length > 0
        ? safeQuery(supabase.from('projects').select('id, project_name').in('id', projectIds), [] as any[])
        : { value: [] as any[], failed: false },
      typeIds.length > 0
        ? safeQuery(supabase.from('service_types').select('id, name').in('id', typeIds), [] as any[])
        : { value: [] as any[], failed: false },
    ]);
    const projMap = Object.fromEntries((projNames.value || []).map((p: any) => [p.id, p.project_name]));
    const typeMap = Object.fromEntries((typeNames.value || []).map((t: any) => [t.id, t.name]));
    serviceAlerts = schedRows.map((s: any) => ({
      id: s.id, type_name: typeMap[s.service_type_id] || '',
      project_name: projMap[s.project_id] || '', next_date: s.next_date, project_id: s.project_id,
    }));
    warrantyAlerts = devRows.map((d: any) => ({
      id: d.id, name: d.name, warranty_end_date: d.warranty_end_date,
      project_id: d.project_id, project_name: projMap[d.project_id] || '',
    }));
  }

  const [qjPoolCount, qjRecent] = await Promise.all([
    safeQuery(
      supabase.from('quick_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pool'),
      [] as any[]
    ),
    safeQuery(
      supabase.from('quick_jobs')
        .select('id, title, client_name, client_id, priority, status, scheduled_date')
        .in('status', ['pool', 'claimed', 'scheduled', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(5),
      [] as any[]
    ),
  ]);

  const qjRows = qjRecent.value || [];
  let quickJobAlerts: DashboardData['quickJobAlerts'] = [];
  if (qjRows.length > 0) {
    const cIds = [...new Set(qjRows.filter((q: any) => q.client_id).map((q: any) => q.client_id))];
    let cMap = new Map<string, string>();
    if (cIds.length > 0) {
      const cRes = await safeQuery(supabase.from('clients').select('id, name').in('id', cIds), [] as any[]);
      cMap = new Map((cRes.value || []).map((c: any) => [c.id, c.name]));
    }
    quickJobAlerts = qjRows.map((q: any) => ({
      id: q.id,
      title: q.title,
      client_name: q.client_id ? cMap.get(q.client_id) || q.client_name : q.client_name || '',
      priority: q.priority,
      status: q.status,
      scheduled_date: q.scheduled_date,
    }));
  }

  return {
    serviceAlerts, openTicketsCount: ticketsCount.count || 0, warrantyAlerts,
    quickJobPoolCount: qjPoolCount.count || 0,
    quickJobAlerts,
  };
}

async function loadNewsEvents() {
  const today = new Date().toISOString().split('T')[0];

  const [news, events, eventTypes] = await Promise.all([
    safeQuery(
      supabase.from('news_posts')
        .select('id, title, content, category, is_pinned, author_id, created_at, image_url')
        .eq('is_published', true)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(4),
      [] as any[]
    ),
    safeQuery(
      supabase.from('events')
        .select('id, title, start_date, start_time, all_day, location, event_type_id')
        .gte('start_date', today)
        .order('start_date')
        .order('start_time')
        .limit(5),
      [] as any[]
    ),
    safeQuery(
      supabase.from('event_types').select('id, name, color').eq('is_active', true),
      [] as any[]
    ),
  ]);

  const etMap = Object.fromEntries((eventTypes.value || []).map((t: any) => [t.id, t]));
  const upcomingEvents = (events.value || []).map((ev: any) => ({
    ...ev,
    event_type_name: etMap[ev.event_type_id]?.name || '',
    event_type_color: etMap[ev.event_type_id]?.color || 'bg-slate-100 text-slate-600',
  }));

  const newsPosts = news.value || [];
  let newsCommentCounts: Record<string, number> = {};
  if (newsPosts.length > 0) {
    const postIds = newsPosts.map((p: any) => p.id);
    const { data: commData } = await supabase.from('news_comments').select('news_post_id').in('news_post_id', postIds);
    const counts: Record<string, number> = {};
    (commData || []).forEach((c: any) => { counts[c.news_post_id] = (counts[c.news_post_id] || 0) + 1; });
    newsCommentCounts = counts;
  }

  return { newsPosts, newsCommentCounts, upcomingEvents };
}

export function useDashboardData() {
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardData>(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const retryCountRef = useRef(0);
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;
    retryCountRef.current = 0;

    async function load() {
      if (cancelled) return;
      setError(false);

      try {
        const [core, content] = await Promise.all([
          loadCoreStats(),
          loadContentData(),
        ]);

        if (cancelled) return;

        if (core.failCount >= 4 && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          retryTimer = setTimeout(load, RETRY_DELAY);
          return;
        }

        if (core.failCount >= 4) {
          setError(true);
          setLoading(false);
          return;
        }

        setData(prev => ({
          ...prev,
          profile,
          stats: core.stats,
          pipeline: core.pipeline,
          monthlyInvoices: core.monthlyInvoices,
          ...content,
        }));
        setLoading(false);

        if (cancelled) return;

        const [service, news] = await Promise.all([
          loadServiceData(),
          loadNewsEvents(),
        ]);

        if (cancelled) return;

        setData(prev => ({
          ...prev,
          ...service,
          ...news,
        }));
      } catch {
        if (cancelled) return;
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          retryTimer = setTimeout(load, RETRY_DELAY);
          return;
        }
        setError(true);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; clearTimeout(retryTimer); };
  }, [retryTrigger]);

  useEffect(() => {
    if (profile) setData(prev => ({ ...prev, profile }));
  }, [profile]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(false);
    setRetryTrigger(c => c + 1);
  }, []);

  return { data, loading, error, retry };
}
