import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, FileText, Layers, Map,
  FolderOpen, MessageSquare, Wrench, PackageCheck, MapPin, Receipt, Files, Shield, AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePortalAuth } from '../../contexts/PortalAuthContext';
import StatusBadge from '../../components/ui/StatusBadge';
import PortalQuotesTab from '../../components/portal/PortalQuotesTab';
import PortalDocumentsTab from '../../components/portal/PortalDocumentsTab';
import PortalFloorplanTab from '../../components/portal/PortalFloorplanTab';
import PortalSelectionTab from '../../components/portal/PortalSelectionTab';
import PortalCommentsSection from '../../components/portal/PortalCommentsSection';
import PortalVicepraceTab from '../../components/portal/PortalVicepraceTab';
import PortalInvoicesTab from '../../components/portal/PortalInvoicesTab';
import PortalFilesTab from '../../components/portal/PortalFilesTab';
import PortalServiceTab from '../../components/portal/PortalServiceTab';
import PortalRemarksTab from '../../components/portal/PortalRemarksTab';

interface ProjectData {
  id: string;
  project_name: string;
  status: string;
  address: string;
  client_id: string;
}

const portalTabs = [
  { key: 'quotes', label: 'Nabídky', icon: FileText },
  { key: 'selection', label: 'Výběr', icon: Layers },
  { key: 'floorplan', label: 'Půdorys', icon: Map },
  { key: 'documents', label: 'Dokumenty', icon: FolderOpen },
  { key: 'files', label: 'Soubory', icon: Files },
  { key: 'comments', label: 'Komentáře', icon: MessageSquare },
  { key: 'invoices', label: 'Faktury', icon: Receipt },
  { key: 'viceprace', label: 'Vícepráce', icon: Wrench },
  { key: 'service', label: 'Servis', icon: Shield },
  { key: 'remarks', label: 'Připomínky', icon: AlertCircle },
  { key: 'handover', label: 'Předání', icon: PackageCheck },
];

export default function PortalProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clientId, user: portalUser } = usePortalAuth();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('quotes');

  const loadProject = useCallback(async () => {
    if (!id || !clientId) return;
    const { data } = await supabase
      .from('projects')
      .select('id, project_name, status, address, client_id')
      .eq('id', id)
      .eq('client_id', clientId)
      .maybeSingle();
    setProject(data as ProjectData | null);
    setLoading(false);
  }, [id, clientId]);

  useEffect(() => { loadProject(); }, [loadProject]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <span className="text-sm text-slate-400 font-medium">Načítání projektu...</span>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
          <FolderOpen className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-500">Projekt nenalezen</p>
        <button onClick={() => navigate('/portal')} className="text-sm text-blue-400 mt-3 hover:underline font-medium">
          Zpět na projekty
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate('/portal')}
          className="w-9 h-9 rounded-xl bg-navy-800/60 border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.04] hover:border-white/[0.12] transition-all shrink-0 mt-0.5"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              {project.project_name}
            </h1>
            <StatusBadge status={project.status} />
          </div>
          {project.address && (
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />
              {project.address}
            </p>
          )}
        </div>
      </div>

      <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
        <div className="border-b border-white/[0.06] px-2 py-2 relative">
          <nav className="flex gap-1 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {portalTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[rgba(255,255,255,0.06)] to-transparent pointer-events-none rounded-r-2xl" />
        </div>

        <div className="p-6">
          {activeTab === 'quotes' && (
            <PortalQuotesTab projectId={project.id} />
          )}
          {activeTab === 'selection' && (
            <PortalSelectionTab projectId={project.id} />
          )}
          {activeTab === 'floorplan' && (
            <PortalFloorplanTab projectId={project.id} />
          )}
          {activeTab === 'documents' && (
            <PortalDocumentsTab projectId={project.id} />
          )}
          {activeTab === 'files' && (
            <PortalFilesTab projectId={project.id} />
          )}
          {activeTab === 'comments' && portalUser && (
            <PortalCommentsSection projectId={project.id} userId={portalUser.id} />
          )}
          {activeTab === 'invoices' && (
            <PortalInvoicesTab projectId={project.id} clientId={project.client_id} />
          )}
          {activeTab === 'viceprace' && (
            <PortalVicepraceTab projectId={project.id} />
          )}
          {activeTab === 'service' && (
            <PortalServiceTab projectId={project.id} />
          )}
          {activeTab === 'remarks' && portalUser && (
            <PortalRemarksTab projectId={project.id} userId={portalUser.id} />
          )}
          {activeTab === 'handover' && (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                <PackageCheck className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-400">Předání bude brzy k dispozici</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
