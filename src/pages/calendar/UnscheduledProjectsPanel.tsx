import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, FolderKanban, GripVertical, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface UnscheduledProject {
  id: string;
  project_name: string;
  status: string;
  client_name?: string;
}

interface Props {
  open: boolean;
  onToggle: () => void;
  onProjectDrop: (projectId: string, date: string) => void;
  refreshKey: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Koncept',
  design: 'Návrh',
  quoted: 'Nabídnuto',
  approved: 'Schváleno',
  in_progress: 'Probíhá',
};

export default function UnscheduledProjectsPanel({ open, onToggle, refreshKey }: Props) {
  const [projects, setProjects] = useState<UnscheduledProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('projects')
        .select('id, project_name, status, client_id')
        .is('montaz_start_date', null)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (!data) { setLoading(false); return; }

      const clientIds = [...new Set(data.map((p: any) => p.client_id).filter(Boolean))];
      let clientMap = new Map<string, string>();
      if (clientIds.length > 0) {
        const { data: clients } = await supabase.from('clients').select('id, name').in('id', clientIds);
        clientMap = new Map((clients || []).map((c: any) => [c.id, c.name]));
      }

      setProjects(data.map((p: any) => ({
        id: p.id,
        project_name: p.project_name,
        status: p.status,
        client_name: p.client_id ? clientMap.get(p.client_id) : undefined,
      })));
      setLoading(false);
    })();
  }, [refreshKey]);

  const filtered = search
    ? projects.filter(p =>
        p.project_name.toLowerCase().includes(search.toLowerCase()) ||
        (p.client_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : projects;

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.setData('text/plain', projectId);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <>
      <button
        onClick={onToggle}
        className={`absolute top-3 z-20 flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border  transition-all ${
          open
            ? 'right-[296px] bg-white/[0.06] text-slate-400 border-white/10 hover:bg-white/[0.04]'
            : 'right-3 bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
        }`}
      >
        <FolderKanban className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Zakázky</span>
        {!open && projects.length > 0 && (
          <span className="ml-1 bg-white/[0.06]/20 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{projects.length}</span>
        )}
        {open ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      <div
        className={`absolute top-0 right-0 z-10 h-full bg-navy-800/60 border-l border-white/[0.08] shadow-xl transition-all duration-300 overflow-hidden ${
          open ? 'w-[280px]' : 'w-0'
        }`}
      >
        {open && (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-bold text-white mb-1">Nenaplanované zakázky</h3>
              <p className="text-[10px] text-slate-400 mb-3">Přetáhněte zakázku na datum v kalendáři</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Hledat..."
                  className="w-full pl-8 pr-3 py-2 text-xs border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading && (
                <div className="space-y-2 p-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-14 bg-white/[0.06] rounded-lg animate-pulse" />)}
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400">
                  {search ? 'Nic nenalezeno' : 'Všechny zakázky mají termín'}
                </div>
              )}

              {filtered.map(p => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={e => handleDragStart(e, p.id)}
                  className="flex items-start gap-2 p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.04]/50 hover:bg-blue-500/100/10 hover:border-blue-200 cursor-grab active:cursor-grabbing transition group"
                >
                  <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">{p.project_name}</p>
                    {p.client_name && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{p.client_name}</p>
                    )}
                    <span className="inline-block mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-500">
                      {STATUS_LABELS[p.status] || p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-white/[0.06] text-center">
              <span className="text-[10px] text-slate-400">{filtered.length} zakázek bez termínu</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
