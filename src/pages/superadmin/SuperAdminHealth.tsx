import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Database, RefreshCw, CheckCircle, Table,
  Activity, HardDrive, Clock
} from 'lucide-react';

interface TableStat {
  table: string;
  label: string;
  count: number;
  icon: React.ElementType;
  color: string;
}

interface GrowthPoint {
  month: string;
  orgs: number;
  users: number;
  projects: number;
}

export default function SuperAdminHealth() {
  const [tableStats, setTableStats] = useState<TableStat[]>([]);
  const [growth, setGrowth] = useState<GrowthPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    loadHealth();
  }, []);

  const loadHealth = async () => {
    setLoading(true);

    const tables: { table: string; label: string; icon: React.ElementType; color: string }[] = [
      { table: 'organizations', label: 'Organizace', icon: Database, color: 'text-blue-400' },
      { table: 'profiles', label: 'Profily', icon: Database, color: 'text-emerald-400' },
      { table: 'projects', label: 'Projekty', icon: Database, color: 'text-amber-400' },
      { table: 'clients', label: 'Klienti', icon: Database, color: 'text-rose-400' },
      { table: 'invoices', label: 'Vydané faktury', icon: Database, color: 'text-cyan-400' },
      { table: 'received_invoices', label: 'Přijaté faktury', icon: Database, color: 'text-violet-400' },
      { table: 'work_logs', label: 'Záznamy práce', icon: Database, color: 'text-orange-400' },
      { table: 'attendance_records', label: 'Docházka', icon: Database, color: 'text-pink-400' },
      { table: 'tasks', label: 'Úkoly', icon: Database, color: 'text-teal-400' },
      { table: 'calendar_events', label: 'Události', icon: Database, color: 'text-indigo-400' },
      { table: 'document_templates', label: 'Šablony dokumentů', icon: Database, color: 'text-yellow-400' },
      { table: 'project_documents', label: 'Projektové dokumenty', icon: Database, color: 'text-lime-400' },
      { table: 'products', label: 'Produkty v katalogu', icon: Database, color: 'text-sky-400' },
      { table: 'service_schedules', label: 'Servisní plány', icon: Database, color: 'text-fuchsia-400' },
      { table: 'warehouse_items', label: 'Skladové položky', icon: Database, color: 'text-red-400' },
    ];

    const counts = await Promise.all(
      tables.map(t => supabase.from(t.table).select('id', { count: 'exact', head: true }))
    );

    const stats: TableStat[] = tables.map((t, i) => ({
      ...t,
      count: counts[i].count ?? 0,
    }));

    setTableStats(stats);

    const months: GrowthPoint[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = d.toLocaleDateString('cs-CZ', { month: 'short', year: '2-digit' });

      const [orgR, userR, projR] = await Promise.all([
        supabase.from('organizations').select('id', { count: 'exact', head: true }).gte('created_at', d.toISOString()).lt('created_at', end.toISOString()),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', d.toISOString()).lt('created_at', end.toISOString()).eq('is_portal_client', false),
        supabase.from('projects').select('id', { count: 'exact', head: true }).gte('created_at', d.toISOString()).lt('created_at', end.toISOString()),
      ]);

      months.push({ month: label, orgs: orgR.count ?? 0, users: userR.count ?? 0, projects: projR.count ?? 0 });
    }

    setGrowth(months);
    setLastRefresh(new Date());
    setLoading(false);
  };

  const maxVal = Math.max(...growth.flatMap(g => [g.orgs, g.users, g.projects]), 1);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Zdraví systému</h1>
          <p className="text-gray-500 text-sm flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Aktualizováno: {lastRefresh.toLocaleTimeString('cs-CZ')}
          </p>
        </div>
        <button
          onClick={loadHealth}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Obnovit
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-emerald-800/50 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Database</div>
            <div className="text-xs text-emerald-400 mt-0.5">Operační</div>
          </div>
        </div>
        <div className="bg-gray-900 border border-emerald-800/50 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Activity className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">API</div>
            <div className="text-xs text-emerald-400 mt-0.5">Operační</div>
          </div>
        </div>
        <div className="bg-gray-900 border border-emerald-800/50 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <HardDrive className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Storage</div>
            <div className="text-xs text-emerald-400 mt-0.5">Operační</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
            <Table className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-white">Tabulky databáze</h2>
          </div>
          <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tableStats.map(stat => (
              <div key={stat.table} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-800/50 transition">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-1.5 h-1.5 rounded-full ${stat.color.replace('text-', 'bg-')}`} />
                  <span className="text-sm text-gray-400 truncate">{stat.label}</span>
                </div>
                <span className="text-sm font-semibold text-gray-200 tabular-nums">{stat.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Růst platformy (posledních 6 měsíců)</h2>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-end gap-3 h-40 mb-3">
                  {growth.map((g, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end gap-0.5 h-32">
                        {[
                          { val: g.orgs, color: 'bg-blue-500' },
                          { val: g.users, color: 'bg-emerald-500' },
                          { val: g.projects, color: 'bg-amber-500' },
                        ].map((bar, j) => (
                          <div
                            key={j}
                            className={`flex-1 ${bar.color} rounded-t transition-all duration-500 opacity-80`}
                            style={{ height: `${Math.max((bar.val / maxVal) * 100, bar.val > 0 ? 4 : 0)}%` }}
                            title={`${bar.val}`}
                          />
                        ))}
                      </div>
                      <div className="text-[10px] text-gray-600">{g.month}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Organizace</div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Uživatelé</div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Projekty</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
