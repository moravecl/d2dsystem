import { useState, useEffect, useCallback, useRef } from 'react';
import { FolderPlus, Upload, Folder, Trash2, Download, ChevronRight, Home, MoreVertical, Eye, EyeOff, Shield, Clock, CheckCircle2, XCircle, Loader2, FileText, CreditCard as Edit2, Send, History, Users, Lock, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';
import FilePreviewModal from './FilePreviewModal';

interface ProjectFolder {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  created_by: string | null;
  created_at: string;
  portal_visible: boolean;
  visible_to_roles: string[];
}

interface ProjectFile {
  id: string;
  project_id: string;
  folder_id: string | null;
  name: string;
  description: string;
  file_url: string;
  file_type: string;
  file_size: number;
  requires_approval: boolean;
  approval_status: string;
  approved_at: string | null;
  approved_by: string | null;
  approval_note: string;
  portal_visible: boolean;
  uploaded_by: string | null;
  created_at: string;
}

interface AuditEntry {
  id: string;
  file_id: string | null;
  action: string;
  performed_by: string | null;
  performer_name: string;
  note: string;
  old_status: string;
  new_status: string;
  created_at: string;
}

const APPROVAL_CFG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  none: { label: 'Bez schválení', color: 'text-slate-400', bg: 'bg-white/[0.06]', icon: FileText },
  pending: { label: 'Čeká na schválení', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock },
  approved: { label: 'Schváleno', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  rejected: { label: 'Zamítnuto', color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle },
};

const FILE_ICONS: Record<string, string> = {
  pdf: 'text-red-400', doc: 'text-blue-400', docx: 'text-blue-400',
  xls: 'text-emerald-400', xlsx: 'text-emerald-400',
  jpg: 'text-amber-400', jpeg: 'text-amber-400', png: 'text-amber-400',
  dwg: 'text-teal-400', dxf: 'text-teal-400',
};

const ALL_ROLES = [
  { value: 'admin', label: 'Admin', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  { value: 'manager', label: 'Manager', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { value: 'employee', label: 'Zaměstnanec', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { value: 'user', label: 'Uživatel', color: 'bg-white/[0.06] text-slate-400 border-white/[0.08]' },
];

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  upload: { label: 'Nahráno', color: 'text-blue-400' },
  approve: { label: 'Schváleno', color: 'text-emerald-400' },
  reject: { label: 'Zamítnuto', color: 'text-red-400' },
  resend: { label: 'Znovu odesláno', color: 'text-amber-400' },
  portal_show: { label: 'Zobrazeno v portálu', color: 'text-blue-400' },
  portal_hide: { label: 'Skryto z portálu', color: 'text-slate-400' },
  delete: { label: 'Smazáno', color: 'text-red-400' },
  send_approval: { label: 'Odesláno ke schválení', color: 'text-amber-400' },
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('cs-CZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ProjectFilesTab({ projectId }: { projectId: string }) {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'Soubory' },
  ]);

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderPortalVisible, setFolderPortalVisible] = useState(false);
  const [folderRoles, setFolderRoles] = useState<string[]>(['admin', 'manager', 'employee', 'user']);
  const [editingFolder, setEditingFolder] = useState<ProjectFolder | null>(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadRequiresApproval, setUploadRequiresApproval] = useState(false);
  const [uploadPortalVisible, setUploadPortalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);

  const [contextMenu, setContextMenu] = useState<{ fileId: string } | null>(null);

  const [auditFile, setAuditFile] = useState<ProjectFile | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const userRole = profile?.role || 'user';

  const logAudit = useCallback(async (
    fileId: string | null,
    action: string,
    oldStatus = '',
    newStatus = '',
    note = '',
  ) => {
    await supabase.from('document_audit_log').insert({
      file_id: fileId,
      project_id: projectId,
      action,
      performed_by: user?.id,
      performer_name: profile?.display_name || profile?.email || '',
      old_status: oldStatus,
      new_status: newStatus,
      note,
    });
  }, [projectId, user?.id, profile?.display_name, profile?.email]);

  const loadData = useCallback(async () => {
    const [foldersRes, filesRes] = await Promise.all([
      supabase.from('project_folders').select('*').eq('project_id', projectId).order('name'),
      supabase.from('project_files').select('*').eq('project_id', projectId).order('name'),
    ]);
    const allFolders = (foldersRes.data || []) as ProjectFolder[];
    const visibleFolders = userRole === 'admin'
      ? allFolders
      : allFolders.filter(f => f.visible_to_roles?.includes(userRole));
    setFolders(visibleFolders);
    setFiles((filesRes.data || []) as ProjectFile[]);
    setLoading(false);
  }, [projectId, userRole]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

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
  const currentFolderPortalVisible = currentFolderId
    ? folders.find(f => f.id === currentFolderId)?.portal_visible ?? false
    : false;

  const openFolderModal = (folder?: ProjectFolder) => {
    if (folder) {
      setEditingFolder(folder);
      setFolderName(folder.name);
      setFolderPortalVisible(folder.portal_visible ?? false);
      setFolderRoles(folder.visible_to_roles ?? ['admin', 'manager', 'employee', 'user']);
    } else {
      setEditingFolder(null);
      setFolderName('');
      setFolderPortalVisible(false);
      setFolderRoles(['admin', 'manager', 'employee', 'user']);
    }
    setShowFolderModal(true);
  };

  const getAllDescendantFolderIds = (parentId: string): string[] => {
    const children = folders.filter(f => f.parent_id === parentId);
    return children.reduce<string[]>((acc, child) => [...acc, child.id, ...getAllDescendantFolderIds(child.id)], []);
  };

  const cascadePortalVisibility = async (folderId: string, visible: boolean) => {
    const allFolderIds = [folderId, ...getAllDescendantFolderIds(folderId)];
    await supabase.from('project_files')
      .update({ portal_visible: visible })
      .eq('project_id', projectId)
      .in('folder_id', allFolderIds);
    if (visible) {
      const childFolderIds = getAllDescendantFolderIds(folderId);
      if (childFolderIds.length > 0) {
        await supabase.from('project_folders')
          .update({ portal_visible: true })
          .in('id', childFolderIds);
      }
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;
    if (editingFolder) {
      await supabase.from('project_folders').update({
        name: folderName.trim(),
        portal_visible: folderPortalVisible,
        visible_to_roles: folderRoles,
      }).eq('id', editingFolder.id);
      if (folderPortalVisible && !editingFolder.portal_visible) {
        await cascadePortalVisibility(editingFolder.id, true);
      }
      toast('Složka aktualizována');
    } else {
      const { data: inserted } = await supabase.from('project_folders').insert({
        project_id: projectId,
        parent_id: currentFolderId,
        name: folderName.trim(),
        created_by: user?.id,
        portal_visible: folderPortalVisible,
        visible_to_roles: folderRoles,
      }).select('id').maybeSingle();
      if (inserted && folderPortalVisible) {
        await cascadePortalVisibility(inserted.id, true);
      }
      toast('Složka vytvořena');
    }
    setShowFolderModal(false);
    loadData();
  };

  const handleDeleteFolder = async (folder: ProjectFolder) => {
    const childFiles = files.filter(f => f.folder_id === folder.id);
    const childFolders = folders.filter(f => f.parent_id === folder.id);
    if (childFiles.length > 0 || childFolders.length > 0) {
      toast('Složka není prázdná. Nejdříve přesuňte nebo smažte obsah.', 'error');
      return;
    }
    if (!confirm(`Smazat slozku "${folder.name}"?`)) return;
    await supabase.from('project_folders').delete().eq('id', folder.id);
    toast('Složka smazána');
    loadData();
  };

  const uploadSingleFile = async (file: File): Promise<boolean> => {
    const fileExt = file.name.split('.').pop() || '';
    const filePath = `project-files/${projectId}/${crypto.randomUUID()}.${fileExt}`;
    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadErr) return false;

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
    const newStatus = uploadRequiresApproval ? 'pending' : 'none';

    const { data: inserted, error } = await supabase.from('project_files').insert({
      project_id: projectId,
      folder_id: currentFolderId,
      name: file.name,
      description: '',
      file_url: urlData.publicUrl,
      file_type: fileExt,
      file_size: file.size,
      requires_approval: uploadRequiresApproval,
      approval_status: newStatus,
      portal_visible: uploadPortalVisible || uploadRequiresApproval || currentFolderPortalVisible,
      uploaded_by: user?.id,
    }).select('id').maybeSingle();

    if (error) return false;
    if (inserted) await logAudit(inserted.id, 'upload', '', newStatus);
    return true;
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0 || !user) return;
    setUploading(true);
    setUploadProgress({ current: 0, total: pendingFiles.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pendingFiles.length; i++) {
      setUploadProgress({ current: i + 1, total: pendingFiles.length });
      const ok = await uploadSingleFile(pendingFiles[i]);
      if (ok) successCount++;
      else failCount++;
    }

    if (failCount > 0) {
      toast(`Nahráno ${successCount} z ${pendingFiles.length} souborů. ${failCount} selhalo.`, 'error');
    } else {
      toast(`${successCount} ${successCount === 1 ? 'soubor nahrán' : successCount < 5 ? 'soubory nahrány' : 'souborů nahráno'}`);
    }

    setShowUploadModal(false);
    resetUploadForm();
    loadData();
    setUploading(false);
  };

  const resetUploadForm = () => {
    setPendingFiles([]);
    setUploadRequiresApproval(false);
    setUploadPortalVisible(false);
    setUploadProgress({ current: 0, total: 0 });
  };

  const addFiles = (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    if (!showUploadModal) {
      resetUploadForm();
      if (currentFolderPortalVisible) setUploadPortalVisible(true);
      setShowUploadModal(true);
    }
    setPendingFiles(prev => {
      const existing = new Set(prev.map(f => `${f.name}-${f.size}-${f.lastModified}`));
      const unique = newFiles.filter(f => !existing.has(`${f.name}-${f.size}-${f.lastModified}`));
      return [...prev, ...unique];
    });
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  };

  const handleDeleteFile = async (file: ProjectFile) => {
    if (!confirm(`Smazat soubor "${file.name}"?`)) return;
    await logAudit(file.id, 'delete', file.approval_status, '', file.name);
    await supabase.from('project_files').delete().eq('id', file.id);
    toast('Soubor smazán');
    loadData();
  };

  const togglePortalVisibility = async (file: ProjectFile) => {
    const newVal = !file.portal_visible;
    await supabase.from('project_files')
      .update({ portal_visible: newVal })
      .eq('id', file.id);
    await logAudit(file.id, newVal ? 'portal_show' : 'portal_hide');
    toast(file.portal_visible ? 'Soubor skryt z portálu' : 'Soubor zobrazen v portálu');
    loadData();
  };

  const sendForApproval = async (file: ProjectFile) => {
    const oldStatus = file.approval_status;
    await supabase.from('project_files')
      .update({
        requires_approval: true,
        approval_status: 'pending',
        portal_visible: true,
      })
      .eq('id', file.id);
    await logAudit(file.id, 'send_approval', oldStatus, 'pending');
    toast('Soubor odeslán ke schválení');
    loadData();
  };

  const resendForApproval = async (file: ProjectFile) => {
    const oldStatus = file.approval_status;
    await supabase.from('project_files').update({
      approval_status: 'pending',
      approval_note: '',
      approved_at: null,
      approved_by: null,
    }).eq('id', file.id);
    await logAudit(file.id, 'resend', oldStatus, 'pending');
    toast('Znovu odesláno ke schválení');
    loadData();
  };

  const openAuditLog = async (file: ProjectFile) => {
    setAuditFile(file);
    setAuditLoading(true);
    const { data } = await supabase
      .from('document_audit_log')
      .select('*')
      .eq('file_id', file.id)
      .order('created_at', { ascending: false });
    setAuditEntries((data || []) as AuditEntry[]);
    setAuditLoading(false);
  };

  const getFolderFileCount = (folderId: string): number => {
    const directFiles = files.filter(f => f.folder_id === folderId).length;
    const childFolders = folders.filter(f => f.parent_id === folderId);
    return directFiles + childFolders.reduce((s, cf) => s + getFolderFileCount(cf.id), 0);
  };

  const toggleRole = (role: string) => {
    setFolderRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-14 bg-navy-900/50 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div
      className="space-y-4 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-30 bg-blue-500/10 border-2 border-dashed border-blue-500/40 rounded-2xl flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Upload className="w-12 h-12 text-blue-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-blue-300">Přetáhněte soubory sem</p>
            <p className="text-xs text-blue-400 mt-1">Můžete přetáhnout více souborů najednou</p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const selected = Array.from(e.target.files || []);
          if (selected.length > 0) addFiles(selected);
          e.target.value = '';
        }}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm overflow-x-auto">
          {breadcrumbs.map((bc, idx) => (
            <div key={bc.id ?? 'root'} className="flex items-center gap-1.5 shrink-0">
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
              <button
                onClick={() => navigateToFolder(bc.id, bc.name)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg transition ${
 idx === breadcrumbs.length - 1
 ? 'font-bold text-white bg-white/[0.07]'
 : 'text-slate-400 hover:text-slate-300 hover:bg-white/[0.04]'
 }`}
              >
                {idx === 0 && <Home className="w-3.5 h-3.5" />}
                {bc.name}
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => openFolderModal()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 bg-white/[0.06] hover:bg-white/[0.10] rounded-lg transition"
          >
            <FolderPlus className="w-3.5 h-3.5" /> Složka
          </button>
          <button
            onClick={() => { resetUploadForm(); if (currentFolderPortalVisible) setUploadPortalVisible(true); setShowUploadModal(true); }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500/10 rounded-lg transition"
          >
            <Upload className="w-3.5 h-3.5" /> Nahrát soubory
          </button>
        </div>
      </div>

      {currentFolders.length === 0 && currentFiles.length === 0 ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full text-center py-16 border-2 border-dashed border-white/[0.08] hover:border-blue-500/30 rounded-xl transition group cursor-pointer"
        >
          <Upload className="w-12 h-12 text-slate-400 group-hover:text-blue-400 mx-auto mb-3 transition" />
          <p className="text-sm font-medium text-slate-500 group-hover:text-blue-400 mb-1 transition">
            Přetáhněte soubory sem nebo klikněte pro výběr
          </p>
          <p className="text-xs text-slate-400">Můžete nahrát více souborů najednou</p>
        </button>
      ) : (
        <div className="space-y-1">
          {currentFolders.map(folder => (
            <div
              key={folder.id}
              className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition cursor-pointer border border-transparent hover:border-white/[0.08]"
            >
              <button
                onClick={() => navigateToFolder(folder.id, folder.name)}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Folder className="w-5 h-5 text-amber-400" />
                </div>
                <div className="min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{folder.name}</span>
                    {folder.portal_visible && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 shrink-0">Portal</span>
                    )}
                    {folder.visible_to_roles && folder.visible_to_roles.length < 4 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400 shrink-0 flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" />
                        {folder.visible_to_roles.length === 0 ? 'Omezeno' : folder.visible_to_roles.join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500">{getFolderFileCount(folder.id)} souborů</div>
                </div>
              </button>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                <button
                  onClick={() => openFolderModal(folder)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 transition"
                  title="Upravit složku"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteFolder(folder)}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {currentFiles.map(file => {
            const ext = file.file_type?.toLowerCase() || '';
            const iconColor = FILE_ICONS[ext] || 'text-slate-400';
            const approvalCfg = APPROVAL_CFG[file.approval_status] || APPROVAL_CFG.none;
            const ApprovalIcon = approvalCfg.icon;
            const folderForFile = file.folder_id ? folders.find(f => f.id === file.folder_id) : null;
            const inheritedFromFolder = folderForFile?.portal_visible ?? false;

            return (
              <div
                key={file.id}
                className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition border border-transparent hover:border-white/[0.08]"
              >
                <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                  <FileText className={`w-5 h-5 ${iconColor}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <button
                      onClick={() => setPreviewFile(file)}
                      className="text-sm font-semibold text-white truncate hover:text-blue-400 transition text-left"
                    >
                      {file.name}
                    </button>
                    {(file.portal_visible || inheritedFromFolder) && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 shrink-0">
                        Portal{inheritedFromFolder && !file.portal_visible ? ' (složka)' : ''}
                      </span>
                    )}
                    {file.requires_approval && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${approvalCfg.bg} ${approvalCfg.color} shrink-0 flex items-center gap-0.5`}>
                        <ApprovalIcon className="w-2.5 h-2.5" />
                        {approvalCfg.label}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {ext.toUpperCase()} &middot; {formatSize(file.file_size)} &middot; {new Date(file.created_at).toLocaleDateString('cs-CZ')}
                    {file.description && <span className="ml-1.5 text-slate-500">- {file.description}</span>}
                  </div>
                  {file.approval_status === 'approved' && file.approved_at && (
                    <div className="text-[10px] text-emerald-400 mt-0.5">
                      Schvaleno {formatDateTime(file.approved_at)}
                    </div>
                  )}
                  {file.approval_status === 'rejected' && file.approval_note && (
                    <div className="text-[10px] text-red-400 mt-0.5">Důvod zamítnutí: {file.approval_note}</div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setPreviewFile(file)}
                    className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-blue-400 transition opacity-0 group-hover:opacity-100"
                    title="Zobrazit náhled"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openAuditLog(file)}
                    className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-slate-300 transition opacity-0 group-hover:opacity-100"
                    title="Historie dokumentu"
                  >
                    <History className="w-4 h-4" />
                  </button>
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-blue-400 transition"
                  >
                    <Download className="w-4 h-4" />
                  </a>

                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenu(contextMenu?.fileId === file.id ? null : { fileId: file.id });
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 transition"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {contextMenu?.fileId === file.id && (
                      <div
                        className="absolute right-0 top-full mt-1 w-52 bg-navy-800 rounded-xl border border-white/[0.08] shadow-lg shadow-black/40 z-20 py-1.5 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => { openAuditLog(file); setContextMenu(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] text-left text-slate-300"
                        >
                          <History className="w-3.5 h-3.5" />
                          Historie dokumentu
                        </button>
                        {inheritedFromFolder ? (
                          <div className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-500 cursor-default">
                            <Eye className="w-3.5 h-3.5" />
                            <span>Viditelnost ze složky</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => { togglePortalVisibility(file); setContextMenu(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] text-left text-slate-300"
                          >
                            {file.portal_visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            {file.portal_visible ? 'Skrýt z portálu' : 'Zobrazit v portálu'}
                          </button>
                        )}
                        {!file.requires_approval && (
                          <button
                            onClick={() => { sendForApproval(file); setContextMenu(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] text-left text-slate-300"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Odeslat ke schválení klientovi
                          </button>
                        )}
                        {file.requires_approval && file.approval_status !== 'pending' && (
                          <button
                            onClick={async () => {
                              await resendForApproval(file);
                              setContextMenu(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] text-left text-slate-300"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            Znovu odeslat ke schválení
                          </button>
                        )}
                        <div className="border-t border-white/[0.06] my-1" />
                        <button
                          onClick={() => { handleDeleteFile(file); setContextMenu(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-500/20 text-left text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Smazat soubor
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Folder Modal */}
      <Modal
        open={showFolderModal}
        onClose={() => { setShowFolderModal(false); setEditingFolder(null); }}
        title={editingFolder ? 'Upravit složku' : 'Nová složka'}
        size="md"
        footer={
          <>
            <button onClick={() => { setShowFolderModal(false); setEditingFolder(null); }} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.07] rounded-lg transition">Zrušit</button>
            <button onClick={handleCreateFolder} disabled={!folderName.trim()} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500/10 rounded-lg transition disabled:opacity-50">
              {editingFolder ? 'Uložit' : 'Vytvořit'}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název složky</label>
            <input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Projektová dokumentace"
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
            />
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-slate-400" />
              <label className="text-xs font-semibold text-slate-400">Viditelnost dle role</label>
            </div>
            <p className="text-[10px] text-slate-500 mb-3">Kteří uživatelé mohou tuto složku vidět.</p>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map(role => {
                const selected = folderRoles.includes(role.value);
                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => toggleRole(role.value)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
 selected
 ? role.color
 : 'bg-white/[0.04] text-slate-500 border-white/[0.06] hover:border-white/[0.12]'
 }`}
                  >
                    {selected && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                    {role.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <button type="button" onClick={() => setFolderPortalVisible(!folderPortalVisible)} className="flex items-center gap-3 cursor-pointer group w-full text-left">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition shrink-0 ${
 folderPortalVisible ? 'bg-blue-600 border-blue-600' : 'border-white/20 group-hover:border-white/30'
 }`}>
                {folderPortalVisible && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </div>
              <div>
                <span className="text-sm font-medium text-white">Zobrazit v klientskem portalu</span>
                <p className="text-[10px] text-slate-500">Klient uvidí tuto složku a její soubory v portálu</p>
              </div>
            </button>
          </div>
        </div>
      </Modal>

      {/* Upload Modal */}
      <Modal
        open={showUploadModal}
        onClose={() => { if (!uploading) { setShowUploadModal(false); resetUploadForm(); } }}
        title={`Nahrát soubory${pendingFiles.length > 0 ? ` (${pendingFiles.length})` : ''}`}
        size="lg"
        footer={
          <>
            <button
              onClick={() => { setShowUploadModal(false); resetUploadForm(); }}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.07] rounded-lg transition disabled:opacity-50"
            >
              Zrušit
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || pendingFiles.length === 0}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500/10 rounded-lg transition disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {uploadProgress.current}/{uploadProgress.total}
                </>
              ) : (
                <>Nahrát {pendingFiles.length > 0 ? `(${pendingFiles.length})` : ''}</>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div
            onClick={() => { if (!uploading) fileInputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const dropped = Array.from(e.dataTransfer.files);
              if (dropped.length > 0) addFiles(dropped);
            }}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
 uploading
 ? 'border-white/[0.06] bg-white/[0.02] cursor-not-allowed'
 : 'border-white/[0.08] hover:border-blue-500/30 hover:bg-blue-500/[0.05]'
 }`}
          >
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-400">
              Klikněte nebo přetáhněte soubory sem
            </p>
            <p className="text-xs text-slate-500 mt-1">Můžete vybrat více souborů najednou</p>
          </div>

          {pendingFiles.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {pendingFiles.map((f, idx) => {
                const ext = f.name.split('.').pop()?.toLowerCase() || '';
                const iconColor = FILE_ICONS[ext] || 'text-slate-400';
                return (
                  <div
                    key={`${f.name}-${f.size}-${idx}`}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.04] group"
                  >
                    <FileText className={`w-4 h-4 shrink-0 ${iconColor}`} />
                    <span className="text-xs font-medium text-slate-300 truncate flex-1">{f.name}</span>
                    <span className="text-[10px] text-slate-500 shrink-0">{formatSize(f.size)}</span>
                    {!uploading && (
                      <button
                        onClick={() => removePendingFile(idx)}
                        className="p-0.5 rounded hover:bg-white/[0.07] text-slate-500 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Nahrávání souborů...</span>
                <span>{uploadProgress.current} z {uploadProgress.total}</span>
              </div>
              <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500/10 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => { if (!currentFolderPortalVisible) setUploadPortalVisible(!uploadPortalVisible); }}
              className={`flex items-center gap-3 group w-full text-left ${currentFolderPortalVisible ? 'opacity-70 cursor-default' : 'cursor-pointer'}`}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition shrink-0 ${
 uploadPortalVisible ? 'bg-blue-600 border-blue-600' : 'border-white/20 group-hover:border-white/30'
 }`}>
                {uploadPortalVisible && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </div>
              <div>
                <span className="text-sm font-medium text-white">Zobrazit v klientském portálu</span>
                {currentFolderPortalVisible
                  ? <p className="text-[10px] text-blue-400 font-medium">Automaticky zapnuto - složka je viditelná v portálu</p>
                  : <p className="text-[10px] text-slate-500">Klient uvidí soubory ve svém portálu</p>
                }
              </div>
            </button>

            <button type="button" onClick={() => setUploadRequiresApproval(!uploadRequiresApproval)} className="flex items-center gap-3 cursor-pointer group w-full text-left">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition shrink-0 ${
 uploadRequiresApproval ? 'bg-amber-500/10 border-amber-500' : 'border-white/20 group-hover:border-white/30'
 }`}>
                {uploadRequiresApproval && <Shield className="w-3.5 h-3.5 text-white" />}
              </div>
              <div>
                <span className="text-sm font-medium text-white">Vyžadovat schválení klientem</span>
                <p className="text-[10px] text-slate-500">Soubory budou automaticky vidět v portálu a klient je bude moci schválit či zamítnout</p>
              </div>
            </button>
          </div>
        </div>
      </Modal>

      {/* Audit Log Modal */}
      <Modal
        open={!!auditFile}
        onClose={() => setAuditFile(null)}
        title={`Historie: ${auditFile?.name || ''}`}
        size="lg"
      >
        {auditLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
          </div>
        ) : auditEntries.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">Žádné záznamy</p>
            <p className="text-xs text-slate-400 mt-1">Historie tohoto dokumentu je prázdná</p>
          </div>
        ) : (
          <div className="space-y-0">
            {auditEntries.map((entry, idx) => {
              const actionCfg = ACTION_LABELS[entry.action] || { label: entry.action, color: 'text-slate-400' };
              const isLast = idx === auditEntries.length - 1;

              return (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
 entry.action === 'approve' ? 'bg-emerald-500/10'
 : entry.action === 'reject' ? 'bg-red-500/10'
 : entry.action === 'upload' ? 'bg-blue-500/10'
 : 'bg-slate-600'
 }`} />
                    {!isLast && <div className="w-px flex-1 bg-white/[0.06] my-1" />}
                  </div>
                  <div className={`pb-4 ${isLast ? '' : ''}`}>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-xs font-bold ${actionCfg.color}`}>{actionCfg.label}</span>
                      <span className="text-[10px] text-slate-500">{formatDateTime(entry.created_at)}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {entry.performer_name || 'Neznámý uživatel'}
                    </div>
                    {entry.old_status && entry.new_status && entry.old_status !== entry.new_status && (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {APPROVAL_CFG[entry.old_status]?.label || entry.old_status} &rarr; {APPROVAL_CFG[entry.new_status]?.label || entry.new_status}
                      </div>
                    )}
                    {entry.note && (
                      <div className="text-[10px] text-slate-400 mt-1 bg-white/[0.04] rounded-lg px-2.5 py-1.5 italic">
                        {entry.note}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <FilePreviewModal
        file={previewFile}
        files={currentFiles}
        onClose={() => setPreviewFile(null)}
        onNavigate={(f) => setPreviewFile(f as ProjectFile)}
      />
    </div>
  );
}
