import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../../contexts/PortalAuthContext';
import { Search, MapPin, Calendar, ChevronRight, Folder, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import StatusBadge from '../../components/ui/StatusBadge';

interface PortalProject {
  id: string;
  project_name: string;
  status: string;
  address: string;
  updated_at: string;
}

const STATUS_ACCENT: Record<string, string> = {
  lead: 'from-slate-400 to-slate-500',
  poptavka: 'from-amber-400 to-amber-500',
  design: 'from-sky-400 to-sky-500',
  quote: 'from-cyan-400 to-cyan-500',
  approval: 'from-orange-400 to-orange-500',
  in_progress: 'from-emerald-400 to-emerald-500',
  completed: 'from-green-400 to-green-500',
};

export default function PortalProjectsPage() {
  const { clientId, profile } = usePortalAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, project_name, status, address, updated_at')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });
      setProjects((data || []) as PortalProject[]);
      setLoading(false);
    })();
  }, [clientId]);

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return p.project_name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q);
  });

  const firstName = profile?.display_name?.split(' ')[0] || '';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          {firstName ? `Vítejte, ${firstName}` : 'Moje projekty'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {projects.length > 0
            ? `${projects.length} ${projects.length === 1 ? 'projekt' : projects.length < 5 ? 'projekty' : 'projektů'}`
            : 'Přehled vašich projektů'
          }
        </p>
      </div>

      {projects.length > 2 && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat projekt podle názvu nebo adresy..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-white/10 bg-white/[0.06] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all "
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 bg-navy-800/60 rounded-2xl border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <Folder className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">
            {search ? `Nic nenalezeno pro "${search}"` : 'Zatím žádné projekty'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {search ? 'Zkuste jiný hledaný výraz' : 'Projekty se zde objeví, jakmile budou přiřazeny'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((project) => {
            const accent = STATUS_ACCENT[project.status] || 'from-slate-400 to-slate-500';
            return (
              <button
                key={project.id}
                onClick={() => navigate(`/portal/projekt/${project.id}`)}
                className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] text-left hover:shadow-xl hover:border-white/[0.12] hover:-translate-y-0.5 transition-all duration-300 group overflow-hidden"
              >
                <div className={`h-1 w-full bg-gradient-to-r ${accent}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                            {project.project_name}
                          </h3>
                          <StatusBadge status={project.status} />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        {project.address && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate max-w-[200px]">{project.address}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(project.updated_at).toLocaleDateString('cs-CZ')}
                        </span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center shrink-0 group-hover:bg-blue-500/10 transition-colors">
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
