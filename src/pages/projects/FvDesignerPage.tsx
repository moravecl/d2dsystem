import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sun } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import FvSection from '../../components/fv/FvSection';

interface Project {
  id: string;
  name: string;
  address: string | null;
}

export default function FvDesignerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('projects')
      .select('id, name, address')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProject(data as Project);
      });
  }, [id]);

  return (
    <div className="flex flex-col h-screen bg-white/[0.04] overflow-hidden">
      <header className="shrink-0 bg-navy-800/60 border-b border-white/[0.08] flex items-center gap-3 px-4 h-14 z-10">
        <button
          onClick={() => navigate(`/projekty/${id}?tab=navrh`)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-white/[0.08]" />

        <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
          <Sun className="w-4 h-4 text-orange-600" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white leading-tight">
            Fotovoltaický návrhář
          </div>
          {project && (
            <div className="text-xs text-slate-400 truncate leading-tight">
              {project.name}{project.address ? ` — ${project.address}` : ''}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          {id && (
            <FvSection
              projectId={id}
              projectAddress={project?.address ?? undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}
