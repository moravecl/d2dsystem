import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Download, Folder, ChevronRight, Home,
  Clock, CheckCircle2, XCircle, Shield, Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePortalAuth } from '../../contexts/PortalAuthContext';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';

interface PortalFolder {
  id: string;
  parent_id: string | null;
  name: string;
  portal_visible: boolean;
}

interface PortalFile {
  id: string;
  folder_id: string | null;
  name: string;
  description: string;
  file_url: string;
  file_type: string;
  file_size: number;
  requires_approval: boolean;
  approval_status: string;
  approval_note: string;
  created_at: string;
}

const FILE_ICONS: Record<string, string> = {
  pdf: 'text-red-500', doc: 'text-blue-400', docx: 'text-blue-400',
  xls: 'text-emerald-400', xlsx: 'text-emerald-400',
  jpg: 'text-amber-500', jpeg: 'text-amber-500', png: 'text-amber-500',
  dwg: 'text-teal-600', dxf: 'text-teal-600',
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PortalFilesTab({ projectId }: { projectId: string }) {
  const { user } = usePortalAuth();
  const { toast } = useToast();

  const [folders, setFolders] = useState<PortalFolder[]>([]);
  const [files, setFiles] = useState<PortalFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'Soubory' },
  ]);

  const [approvalFile, setApprovalFile] = useState<PortalFile | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [approving, setApproving] = useState(false);

  const loadData = useCallback(async () => {
    const [foldersRes, filesRes] = await Promise.all([
      supabase.from('project_folders')
        .select('id, parent_id, name, portal_visible')
        .eq('project_id', projectId)
        .order('name'),
      supabase.from('project_files')
        .select('id, folder_id, name, description, file_url, file_type, file_size, requires_approval, approval_status, approval_note, created_at, portal_visible')
        .eq('project_id', projectId)
        .order('name'),
    ]);

    const rawFiles = (filesRes.data || []) as (PortalFile & { portal_visible: boolean })[];
    const allFolders = (foldersRes.data || []) as PortalFolder[];

    const portalFolderIds = new Set(
      allFolders.filter(f => f.portal_visible).map(f => f.id)
    );

    const allFiles = rawFiles.filter(f =>
      f.portal_visible || (f.folder_id && portalFolderIds.has(f.folder_id))
    );

    const folderIdsWithFiles = new Set(allFiles.map(f => f.folder_id).filter(Boolean));
    const relevantFolderIds = new Set<string>();

    const addAncestors = (folderId: string | null) => {
      if (!folderId) return;
      if (relevantFolderIds.has(folderId)) return;
      relevantFolderIds.add(folderId);
      const folder = allFolders.find(f => f.id === folderId);
      if (folder?.parent_id) addAncestors(folder.parent_id);
    };
    folderIdsWithFiles.forEach(id => addAncestors(id!));
    portalFolderIds.forEach(id => addAncestors(id));

    setFolders(allFolders.filter(f => relevantFolderIds.has(f.id)));
    setFiles(allFiles);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const navigateToFolder = (folderId: string | null, folderName: string) => {
    if (folderId === null) {
      setBreadcrumbs([{ id: null, name: 'Soubory' }]);
    } else {
      const idx = breadcrumbs.findIndex(b => b.id === folderId);
      if (idx >= 0) {
        setBreadcrumbs(breadcrumbs.slice(0, idx + 1));
      } else {
        setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
      }
    }
    setCurrentFolderId(folderId);
  };

  const currentFolders = folders.filter(f => f.parent_id === currentFolderId);
  const currentFiles = files.filter(f => f.folder_id === currentFolderId);

  const pendingCount = files.filter(f => f.requires_approval && f.approval_status === 'pending').length;

  const handleApproval = async (approved: boolean) => {
    if (!approvalFile || !user) return;
    setApproving(true);

    const oldStatus = approvalFile.approval_status;
    const newStatus = approved ? 'approved' : 'rejected';

    await supabase.from('project_files').update({
      approval_status: newStatus,
      approval_note: approvalNote,
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    }).eq('id', approvalFile.id);

    await supabase.from('document_audit_log').insert({
      file_id: approvalFile.id,
      project_id: projectId,
      action: approved ? 'approve' : 'reject',
      performed_by: user.id,
      performer_name: user.email || 'Klient',
      old_status: oldStatus,
      new_status: newStatus,
      note: approvalNote,
    });

    toast(approved ? 'Dokument schvalen' : 'Dokument zamitnut');
    setApprovalFile(null);
    setApprovalNote('');
    setApproving(false);
    loadData();
  };

  if (loading) {
    return <div className="h-32 bg-white/[0.06] rounded-xl animate-pulse" />;
  }

  if (files.length === 0 && folders.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
          <FileText className="w-7 h-7 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-500 mb-1">Zadne soubory</p>
        <p className="text-xs text-slate-400">K tomuto projektu zatim nebyly sdileny zadne soubory.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Shield className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <div className="text-sm font-bold text-amber-800">{pendingCount} {pendingCount === 1 ? 'dokument ceka' : 'dokumentu ceka'} na vase schvaleni</div>
            <div className="text-xs text-amber-400">Prosim zkontrolujte a schvalte ci zamitnete dokumenty</div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-sm overflow-x-auto">
        {breadcrumbs.map((bc, idx) => (
          <div key={bc.id ?? 'root'} className="flex items-center gap-1.5 shrink-0">
            {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
            <button
              onClick={() => navigateToFolder(bc.id, bc.name)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition ${
                idx === breadcrumbs.length - 1
                  ? 'font-bold text-white bg-white/[0.06]'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
              }`}
            >
              {idx === 0 && <Home className="w-3.5 h-3.5" />}
              {bc.name}
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        {currentFolders.map(folder => (
          <button
            key={folder.id}
            onClick={() => navigateToFolder(folder.id, folder.name)}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <Folder className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-sm font-semibold text-white">{folder.name}</span>
            <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
          </button>
        ))}

        {currentFiles.map(file => {
          const ext = file.file_type?.toLowerCase() || '';
          const iconColor = FILE_ICONS[ext] || 'text-slate-400';
          const isPending = file.requires_approval && file.approval_status === 'pending';
          const isApproved = file.approval_status === 'approved';
          const isRejected = file.approval_status === 'rejected';

          return (
            <div
              key={file.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition border ${
                isPending ? 'border-amber-200 bg-amber-500/10' : 'border-transparent hover:bg-white/[0.04]'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                <FileText className={`w-5 h-5 ${iconColor}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-white truncate">{file.name}</span>
                  {isPending && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 shrink-0 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" /> Ke schvaleni
                    </span>
                  )}
                  {isApproved && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 shrink-0 flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Schvaleno
                    </span>
                  )}
                  {isRejected && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 shrink-0 flex items-center gap-0.5">
                      <XCircle className="w-2.5 h-2.5" /> Zamitnuto
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400">
                  {ext.toUpperCase()} &middot; {formatSize(file.file_size)} &middot; {new Date(file.created_at).toLocaleDateString('cs-CZ')}
                  {file.description && <span className="ml-1.5 text-slate-500">- {file.description}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={file.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-blue-400 transition"
                >
                  <Download className="w-4 h-4" />
                </a>

                {isPending && (
                  <button
                    onClick={() => { setApprovalFile(file); setApprovalNote(''); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-400 bg-amber-500/20 hover:bg-amber-200 rounded-lg transition"
                  >
                    <Shield className="w-3.5 h-3.5" /> Schvalit / Zamitnout
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={!!approvalFile}
        onClose={() => setApprovalFile(null)}
        title={`Schvaleni: ${approvalFile?.name || ''}`}
        size="md"
        footer={
          <>
            <button
              onClick={() => setApprovalFile(null)}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition"
            >
              Zrusit
            </button>
            <button
              onClick={() => handleApproval(false)}
              disabled={approving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition disabled:opacity-50"
            >
              {approving && <Loader2 className="w-4 h-4 animate-spin" />}
              <XCircle className="w-4 h-4" /> Zamitnout
            </button>
            <button
              onClick={() => handleApproval(true)}
              disabled={approving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50"
            >
              {approving && <Loader2 className="w-4 h-4 animate-spin" />}
              <CheckCircle2 className="w-4 h-4" /> Schvalit
            </button>
          </>
        }
      >
        {approvalFile && (
          <div className="space-y-4">
            <div className="bg-white/[0.04] rounded-xl p-4 flex items-center gap-3">
              <FileText className="w-8 h-8 text-slate-400" />
              <div>
                <div className="text-sm font-bold text-white">{approvalFile.name}</div>
                <div className="text-xs text-slate-400">{approvalFile.file_type?.toUpperCase()} &middot; {formatSize(approvalFile.file_size)}</div>
              </div>
              <a
                href={approvalFile.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-400"
              >
                <Download className="w-3.5 h-3.5" /> Stahnout
              </a>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Komentar (volitelny)</label>
              <textarea
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                rows={3}
                placeholder="Napiste duvod schvaleni ci zamitnuti..."
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
