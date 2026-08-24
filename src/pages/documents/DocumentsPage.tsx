import { useState, useEffect, useCallback, useRef } from 'react';
import { FolderPlus, Upload, Folder, Trash2, Download, ChevronRight, Home, MoreVertical, Eye, Loader2, FileText, CreditCard as Edit2, X, Search, Building2, Star, StarOff, Tag, FolderInput, ExternalLink, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import FilePreviewModal from '../../components/projects/FilePreviewModal';

interface CompanyFolder {
  id: string;
  organization_id: string;
  parent_id: string | null;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface CompanyFile {
  id: string;
  organization_id: string;
  folder_id: string | null;
  name: string;
  description: string;
  file_url: string;
  file_type: string;
  file_size: number;
  tags: string[];
  is_pinned: boolean;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectFileRow {
  id: string;
  name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at: string;
  project_id: string;
  folder_id: string | null;
}

interface ProjectFolderRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
}

interface ProjectRow {
  id: string;
  name: string;
  project_name: string;
  client_name: string;
  status: string;
}

const FILE_ICONS: Record<string, string> = {
  pdf: 'text-red-500', doc: 'text-blue-400', docx: 'text-blue-400',
  xls: 'text-emerald-400', xlsx: 'text-emerald-400',
  jpg: 'text-amber-500', jpeg: 'text-amber-500', png: 'text-amber-500',
  gif: 'text-amber-500', webp: 'text-amber-500', svg: 'text-teal-500',
  dwg: 'text-teal-600', dxf: 'text-teal-600',
  zip: 'text-slate-500', rar: 'text-slate-500',
  mp4: 'text-rose-500', mov: 'text-rose-500',
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ARCHIVED_STATUSES = ['completed', 'cancelled'];

type BrowseMode = 'company' | 'projects-list' | 'archive-list' | 'project-files';

export default function DocumentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();

  const [folders, setFolders] = useState<CompanyFolder[]>([]);
  const [files, setFiles] = useState<CompanyFile[]>([]);
  const [loading, setLoading] = useState(true);

  const [browseMode, setBrowseMode] = useState<BrowseMode>('company');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string; mode: BrowseMode }[]>([
    { id: null, name: 'Dokumenty', mode: 'company' },
  ]);

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<CompanyFolder | null>(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewFile, setPreviewFile] = useState<CompanyFile | null>(null);
  const [contextMenu, setContextMenu] = useState<{ fileId: string } | null>(null);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectFiles, setProjectFiles] = useState<ProjectFileRow[]>([]);
  const [projectFolders, setProjectFolders] = useState<ProjectFolderRow[]>([]);
  const [projectFolderId, setProjectFolderId] = useState<string | null>(null);
  const [projectFilesLoading, setProjectFilesLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CompanyFile[]>([]);
  const [searchProjectResults, setSearchProjectResults] = useState<(ProjectFileRow & { project_name: string })[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const [showTagsModal, setShowTagsModal] = useState<CompanyFile | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);

  const [showMoveModal, setShowMoveModal] = useState<CompanyFile | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);

  const [renameFile, setRenameFile] = useState<CompanyFile | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const activeProjects = projects.filter(p => !ARCHIVED_STATUSES.includes(p.status));
  const archivedProjects = projects.filter(p => ARCHIVED_STATUSES.includes(p.status));

  const loadData = useCallback(async () => {
    if (!organization?.id) return;
    const [foldersRes, filesRes, projectsRes] = await Promise.all([
      supabase.from('company_folders').select('*').eq('organization_id', organization.id).order('sort_order').order('name'),
      supabase.from('company_files').select('*').eq('organization_id', organization.id).order('name'),
      supabase.from('projects').select('id, name, project_name, client_name, status').eq('organization_id', organization.id).order('created_at', { ascending: false }),
    ]);
    setFolders((foldersRes.data || []) as CompanyFolder[]);
    setFiles((filesRes.data || []) as CompanyFile[]);
    setProjects((projectsRes.data || []) as ProjectRow[]);
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const navigateToFolder = (folderId: string | null, name: string) => {
    setSearchQuery('');
    setBrowseMode('company');
    setActiveProjectId(null);
    setProjectFolderId(null);
    if (folderId === null) {
      setBreadcrumbs([{ id: null, name: 'Dokumenty', mode: 'company' }]);
    } else {
      const idx = breadcrumbs.findIndex(b => b.id === folderId);
      if (idx >= 0) {
        setBreadcrumbs(breadcrumbs.slice(0, idx + 1));
      } else {
        setBreadcrumbs([...breadcrumbs, { id: folderId, name, mode: 'company' }]);
      }
    }
    setCurrentFolderId(folderId);
  };

  const navigateToProjectsList = () => {
    setSearchQuery('');
    setBrowseMode('projects-list');
    setActiveProjectId(null);
    setCurrentFolderId(null);
    setProjectFolderId(null);
    setBreadcrumbs([
      { id: null, name: 'Dokumenty', mode: 'company' },
      { id: '__projects__', name: 'Projekty', mode: 'projects-list' },
    ]);
  };

  const navigateToArchiveList = () => {
    setSearchQuery('');
    setBrowseMode('archive-list');
    setActiveProjectId(null);
    setCurrentFolderId(null);
    setProjectFolderId(null);
    setBreadcrumbs([
      { id: null, name: 'Dokumenty', mode: 'company' },
      { id: '__projects__', name: 'Projekty', mode: 'projects-list' },
      { id: '__archive__', name: 'Archiv', mode: 'archive-list' },
    ]);
  };

  const navigateToProject = async (project: ProjectRow, fromArchive: boolean) => {
    setSearchQuery('');
    setBrowseMode('project-files');
    setActiveProjectId(project.id);
    setCurrentFolderId(null);
    setProjectFolderId(null);

    const baseCrumbs: { id: string | null; name: string; mode: BrowseMode }[] = [
      { id: null, name: 'Dokumenty', mode: 'company' },
      { id: '__projects__', name: 'Projekty', mode: 'projects-list' },
    ];
    if (fromArchive) {
      baseCrumbs.push({ id: '__archive__', name: 'Archiv', mode: 'archive-list' });
    }
    baseCrumbs.push({ id: project.id, name: project.project_name || project.name, mode: 'project-files' });
    setBreadcrumbs(baseCrumbs);

    setProjectFilesLoading(true);
    const [filesRes, foldersRes] = await Promise.all([
      supabase.from('project_files')
        .select('id, name, file_url, file_type, file_size, created_at, project_id, folder_id')
        .eq('project_id', project.id)
        .order('name'),
      supabase.from('project_folders')
        .select('id, project_id, parent_id, name, created_at')
        .eq('project_id', project.id)
        .order('name'),
    ]);
    setProjectFiles((filesRes.data || []) as ProjectFileRow[]);
    setProjectFolders((foldersRes.data || []) as ProjectFolderRow[]);
    setProjectFilesLoading(false);
  };

  const navigateToProjectFolder = (folder: ProjectFolderRow) => {
    setProjectFolderId(folder.id);
    const existingIdx = breadcrumbs.findIndex(b => b.id === folder.id);
    if (existingIdx >= 0) {
      setBreadcrumbs(breadcrumbs.slice(0, existingIdx + 1));
    } else {
      setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name, mode: 'project-files' }]);
    }
  };

  const handleBreadcrumbClick = (bc: { id: string | null; name: string; mode: BrowseMode }, idx: number) => {
    if (bc.mode === 'company') {
      navigateToFolder(bc.id, bc.name);
    } else if (bc.mode === 'projects-list') {
      navigateToProjectsList();
    } else if (bc.mode === 'archive-list') {
      navigateToArchiveList();
    } else if (bc.mode === 'project-files') {
      if (bc.id === activeProjectId) {
        setProjectFolderId(null);
        setBreadcrumbs(breadcrumbs.slice(0, idx + 1));
      } else {
        setProjectFolderId(bc.id);
        setBreadcrumbs(breadcrumbs.slice(0, idx + 1));
      }
    }
  };

  const currentFolders = browseMode === 'company' ? folders.filter(f => f.parent_id === currentFolderId) : [];
  const currentFiles = browseMode === 'company' ? files.filter(f => f.folder_id === currentFolderId) : [];
  const showProjectsVirtualFolder = browseMode === 'company' && currentFolderId === null;

  const currentProjectFolders = browseMode === 'project-files'
    ? projectFolders.filter(f => f.parent_id === projectFolderId)
    : [];
  const currentProjectFiles = browseMode === 'project-files'
    ? projectFiles.filter(f => f.folder_id === projectFolderId)
    : [];

  const openFolderModal = (folder?: CompanyFolder) => {
    if (folder) {
      setEditingFolder(folder);
      setFolderName(folder.name);
    } else {
      setEditingFolder(null);
      setFolderName('');
    }
    setShowFolderModal(true);
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim() || !organization?.id) return;
    if (editingFolder) {
      await supabase.from('company_folders').update({ name: folderName.trim(), updated_at: new Date().toISOString() }).eq('id', editingFolder.id);
      toast('Složka aktualizována');
    } else {
      await supabase.from('company_folders').insert({
        organization_id: organization.id,
        parent_id: currentFolderId,
        name: folderName.trim(),
        created_by: user?.id,
      });
      toast('Složka vytvořena');
    }
    setShowFolderModal(false);
    loadData();
  };

  const handleDeleteFolder = async (folder: CompanyFolder) => {
    const childFiles = files.filter(f => f.folder_id === folder.id);
    const childFolders = folders.filter(f => f.parent_id === folder.id);
    if (childFiles.length > 0 || childFolders.length > 0) {
      toast('Složka není prázdná. Nejdříve přesuňte nebo smažte obsah.', 'error');
      return;
    }
    if (!confirm(`Smazat složku "${folder.name}"?`)) return;
    await supabase.from('company_folders').delete().eq('id', folder.id);
    toast('Složka smazána');
    loadData();
  };

  const getFolderFileCount = (folderId: string): number => {
    const directFiles = files.filter(f => f.folder_id === folderId).length;
    const childFolders = folders.filter(f => f.parent_id === folderId);
    return directFiles + childFolders.reduce((s, cf) => s + getFolderFileCount(cf.id), 0);
  };

  const getProjectFolderFileCount = (folderId: string): number => {
    const directFiles = projectFiles.filter(f => f.folder_id === folderId).length;
    const childFolders = projectFolders.filter(f => f.parent_id === folderId);
    return directFiles + childFolders.reduce((s, cf) => s + getProjectFolderFileCount(cf.id), 0);
  };

  const resetUploadForm = () => {
    setPendingFiles([]);
    setUploadProgress({ current: 0, total: 0 });
  };

  const addFiles = (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    if (!showUploadModal) {
      resetUploadForm();
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

  const uploadSingleFile = async (file: File): Promise<boolean> => {
    if (!organization?.id) return false;
    const fileExt = file.name.split('.').pop() || '';
    const filePath = `company-docs/${organization.id}/${currentFolderId || 'root'}/${crypto.randomUUID()}.${fileExt}`;
    const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, file);
    if (uploadErr) return false;

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
    const { error } = await supabase.from('company_files').insert({
      organization_id: organization.id,
      folder_id: currentFolderId,
      name: file.name,
      file_url: urlData.publicUrl,
      file_type: fileExt,
      file_size: file.size,
      uploaded_by: user?.id,
    });
    return !error;
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
      if (ok) successCount++; else failCount++;
    }

    if (failCount > 0) {
      toast(`Nahráno ${successCount} z ${pendingFiles.length}. ${failCount} selhalo.`, 'error');
    } else {
      toast(`${successCount} ${successCount === 1 ? 'soubor nahrán' : successCount < 5 ? 'soubory nahrány' : 'souborů nahráno'}`);
    }

    setShowUploadModal(false);
    resetUploadForm();
    loadData();
    setUploading(false);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) addFiles(dropped);
  };

  const handleDeleteFile = async (file: CompanyFile) => {
    if (!confirm(`Smazat soubor "${file.name}"?`)) return;
    await supabase.from('company_files').delete().eq('id', file.id);
    toast('Soubor smazán');
    loadData();
  };

  const handleTogglePin = async (file: CompanyFile) => {
    await supabase.from('company_files').update({ is_pinned: !file.is_pinned, updated_at: new Date().toISOString() }).eq('id', file.id);
    toast(file.is_pinned ? 'Odebráno z oblíbených' : 'Přidáno do oblíbených');
    loadData();
  };

  const openTagsModal = (file: CompanyFile) => {
    setShowTagsModal(file);
    setEditTags([...(file.tags || [])]);
    setTagInput('');
  };

  const handleSaveTags = async () => {
    if (!showTagsModal) return;
    await supabase.from('company_files').update({ tags: editTags, updated_at: new Date().toISOString() }).eq('id', showTagsModal.id);
    setShowTagsModal(null);
    toast('Tagy uloženy');
    loadData();
  };

  const openMoveModal = (file: CompanyFile) => {
    setShowMoveModal(file);
    setMoveTargetId(file.folder_id);
  };

  const handleMoveFile = async () => {
    if (!showMoveModal) return;
    await supabase.from('company_files').update({ folder_id: moveTargetId, updated_at: new Date().toISOString() }).eq('id', showMoveModal.id);
    setShowMoveModal(null);
    toast('Soubor přesunut');
    loadData();
  };

  const openRenameModal = (file: CompanyFile) => {
    setRenameFile(file);
    setRenameValue(file.name);
  };

  const handleRename = async () => {
    if (!renameFile || !renameValue.trim()) return;
    await supabase.from('company_files').update({ name: renameValue.trim(), updated_at: new Date().toISOString() }).eq('id', renameFile.id);
    setRenameFile(null);
    toast('Soubor přejmenován');
    loadData();
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || !organization?.id) {
      setSearchResults([]);
      setSearchProjectResults([]);
      return;
    }
    setIsSearching(true);
    const pattern = `%${query}%`;

    const [companyRes, projectRes] = await Promise.all([
      supabase.from('company_files').select('*').eq('organization_id', organization.id)
        .or(`name.ilike.${pattern},tags.cs.{${query.toLowerCase()}}`)
        .order('created_at', { ascending: false }).limit(30),
      supabase.from('project_files').select('id, name, file_url, file_type, file_size, created_at, project_id, folder_id')
        .ilike('name', pattern).limit(20),
    ]);

    setSearchResults((companyRes.data || []) as CompanyFile[]);

    if (projectRes.data && projectRes.data.length > 0) {
      const projectIds = [...new Set(projectRes.data.map((f: ProjectFileRow) => f.project_id))];
      const { data: projectNames } = await supabase.from('projects').select('id, project_name, name').in('id', projectIds);
      const nameMap = new Map((projectNames || []).map((p: { id: string; project_name: string; name: string }) => [p.id, p.project_name || p.name]));
      setSearchProjectResults(projectRes.data.map((f: ProjectFileRow) => ({ ...f, project_name: nameMap.get(f.project_id) || 'Projekt' })));
    } else {
      setSearchProjectResults([]);
    }
    setIsSearching(false);
  }, [organization?.id]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!searchQuery.trim()) { setSearchResults([]); setSearchProjectResults([]); return; }
    searchTimeout.current = setTimeout(() => handleSearch(searchQuery), 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery, handleSearch]);

  const isSearchActive = searchQuery.trim().length > 0;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-14 bg-white/[0.06] rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div
      className="space-y-4 relative"
      onDragEnter={browseMode === 'company' ? handleDragEnter : undefined}
      onDragLeave={browseMode === 'company' ? handleDragLeave : undefined}
      onDragOver={browseMode === 'company' ? (e) => { e.preventDefault(); e.stopPropagation(); } : undefined}
      onDrop={browseMode === 'company' ? handleDrop : undefined}
    >
      {isDragging && browseMode === 'company' && (
        <div className="absolute inset-0 z-30 bg-blue-500/10/90 border-2 border-dashed border-blue-400 rounded-2xl flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Upload className="w-12 h-12 text-blue-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-blue-400">Přetáhněte soubory sem</p>
            <p className="text-xs text-blue-500 mt-1">Můžete přetáhnout více souborů najednou</p>
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
            <div key={`${bc.id ?? 'root'}-${idx}`} className="flex items-center gap-1.5 shrink-0">
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
              <button
                onClick={() => handleBreadcrumbClick(bc, idx)}
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

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hledat..."
              className="w-44 lg:w-56 pl-8 pr-7 py-2 text-xs border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white/[0.06]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded hover:bg-white/[0.06]">
                <X className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>
          {browseMode === 'company' && (
            <>
              <button
                onClick={() => openFolderModal()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-400 bg-white/[0.06] hover:bg-white/[0.08] rounded-lg transition"
              >
                <FolderPlus className="w-3.5 h-3.5" /> Složka
              </button>
              <button
                onClick={() => { resetUploadForm(); setShowUploadModal(true); }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
              >
                <Upload className="w-3.5 h-3.5" /> Nahrát soubory
              </button>
            </>
          )}
        </div>
      </div>

      {isSearchActive ? (
        <SearchResultsList
          query={searchQuery}
          companyFiles={searchResults}
          projectFiles={searchProjectResults}
          isSearching={isSearching}
          onPreviewCompany={(f) => setPreviewFile(f)}
          onPreviewProject={(f) => setPreviewFile({ id: f.id, organization_id: '', folder_id: null, name: f.name, description: '', file_url: f.file_url, file_type: f.file_type, file_size: f.file_size, tags: [], is_pinned: false, uploaded_by: null, created_at: f.created_at, updated_at: '' })}
        />
      ) : browseMode === 'projects-list' ? (
        <div className="space-y-1">
          {archivedProjects.length > 0 && (
            <div
              className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition cursor-pointer border border-transparent hover:border-white/10"
              onClick={navigateToArchiveList}
            >
              <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5 text-slate-400" />
              </div>
              <div className="min-w-0 text-left">
                <span className="text-sm font-semibold text-white">Archiv</span>
                <div className="text-[10px] text-slate-400">{archivedProjects.length} archivovaných projektů</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
            </div>
          )}
          <ProjectsList projects={activeProjects} onSelect={(p) => navigateToProject(p, false)} />
        </div>
      ) : browseMode === 'archive-list' ? (
        <ProjectsList projects={archivedProjects} onSelect={(p) => navigateToProject(p, true)} emptyLabel="Žádné archivované projekty" />
      ) : browseMode === 'project-files' ? (
        <ProjectFilesBrowser
          folders={currentProjectFolders}
          files={currentProjectFiles}
          loading={projectFilesLoading}
          projectId={activeProjectId}
          onNavigateFolder={navigateToProjectFolder}
          onPreview={(f) => setPreviewFile({ id: f.id, organization_id: '', folder_id: null, name: f.name, description: '', file_url: f.file_url, file_type: f.file_type, file_size: f.file_size, tags: [], is_pinned: false, uploaded_by: null, created_at: f.created_at, updated_at: '' })}
          onOpenProject={() => { if (activeProjectId) navigate(`/projekty/${activeProjectId}`); }}
          getFolderFileCount={getProjectFolderFileCount}
        />
      ) : currentFolders.length === 0 && currentFiles.length === 0 && !showProjectsVirtualFolder ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full text-center py-16 border-2 border-dashed border-white/10 hover:border-blue-300 rounded-xl transition group cursor-pointer"
        >
          <Upload className="w-12 h-12 text-slate-200 group-hover:text-blue-400 mx-auto mb-3 transition" />
          <p className="text-sm font-medium text-slate-400 group-hover:text-blue-400 mb-1 transition">
            Přetáhněte soubory sem nebo klikněte pro výběr
          </p>
          <p className="text-xs text-slate-300">Můžete nahrát více souborů najednou</p>
        </button>
      ) : (
        <div className="space-y-1">
          {showProjectsVirtualFolder && (
            <div
              className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition cursor-pointer border border-transparent hover:border-white/10"
              onClick={navigateToProjectsList}
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-blue-500" />
              </div>
              <div className="min-w-0 text-left">
                <span className="text-sm font-semibold text-white">Projektové soubory</span>
                <div className="text-[10px] text-slate-400">{projects.length} projektů</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
            </div>
          )}

          {currentFolders.map(folder => (
            <div
              key={folder.id}
              className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition cursor-pointer border border-transparent hover:border-white/10"
            >
              <button
                onClick={() => navigateToFolder(folder.id, folder.name)}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Folder className="w-5 h-5 text-amber-500" />
                </div>
                <div className="min-w-0 text-left">
                  <span className="text-sm font-semibold text-white truncate block">{folder.name}</span>
                  <div className="text-[10px] text-slate-400">{getFolderFileCount(folder.id)} souborů</div>
                </div>
              </button>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                <button
                  onClick={() => openFolderModal(folder)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 transition"
                  title="Upravit složku"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteFolder(folder)}
                  className="p-1.5 rounded-lg hover:bg-red-500/100/10 text-slate-400 hover:text-red-500 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {currentFiles.map(file => {
            const ext = file.file_type?.toLowerCase() || file.name.split('.').pop()?.toLowerCase() || '';
            const iconColor = FILE_ICONS[ext] || 'text-slate-400';

            return (
              <div
                key={file.id}
                className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition border border-transparent hover:border-white/10"
              >
                <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
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
                    {file.is_pinned && (
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                    )}
                    {file.tags.length > 0 && file.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-500 shrink-0">{tag}</span>
                    ))}
                    {file.tags.length > 2 && (
                      <span className="text-[9px] text-slate-400">+{file.tags.length - 2}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {ext.toUpperCase()} &middot; {formatSize(file.file_size)} &middot; {new Date(file.created_at).toLocaleDateString('cs-CZ')}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setPreviewFile(file)}
                    className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-blue-400 transition opacity-0 group-hover:opacity-100"
                    title="Zobrazit náhled"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-blue-400 transition"
                  >
                    <Download className="w-4 h-4" />
                  </a>

                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenu(contextMenu?.fileId === file.id ? null : { fileId: file.id });
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 transition"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {contextMenu?.fileId === file.id && (
                      <div
                        className="absolute right-0 top-full mt-1 w-52 bg-navy-800/60 rounded-xl border border-white/[0.08] shadow-lg z-20 py-1.5 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => { handleTogglePin(file); setContextMenu(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] text-left text-slate-300"
                        >
                          {file.is_pinned ? <StarOff className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
                          {file.is_pinned ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
                        </button>
                        <button
                          onClick={() => { openTagsModal(file); setContextMenu(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] text-left text-slate-300"
                        >
                          <Tag className="w-3.5 h-3.5" />
                          Spravovat štítky
                        </button>
                        <button
                          onClick={() => { openRenameModal(file); setContextMenu(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] text-left text-slate-300"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Přejmenovat
                        </button>
                        <button
                          onClick={() => { openMoveModal(file); setContextMenu(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] text-left text-slate-300"
                        >
                          <FolderInput className="w-3.5 h-3.5" />
                          Přesunout do složky
                        </button>
                        <div className="border-t border-white/[0.06] my-1" />
                        <button
                          onClick={() => { handleDeleteFile(file); setContextMenu(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-500/100/10 text-left text-red-400"
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

          {currentFolders.length === 0 && currentFiles.length === 0 && !showProjectsVirtualFolder && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full text-center py-16 border-2 border-dashed border-white/10 hover:border-blue-300 rounded-xl transition group cursor-pointer"
            >
              <Upload className="w-12 h-12 text-slate-200 group-hover:text-blue-400 mx-auto mb-3 transition" />
              <p className="text-sm font-medium text-slate-400 group-hover:text-blue-400 mb-1 transition">
                Přetáhněte soubory sem nebo klikněte pro výběr
              </p>
            </button>
          )}
        </div>
      )}

      <Modal
        open={showFolderModal}
        onClose={() => { setShowFolderModal(false); setEditingFolder(null); }}
        title={editingFolder ? 'Upravit složku' : 'Nová složka'}
        size="md"
        footer={
          <>
            <button onClick={() => { setShowFolderModal(false); setEditingFolder(null); }} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
            <button onClick={handleCreateFolder} disabled={!folderName.trim()} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
              {editingFolder ? 'Uložit' : 'Vytvořit'}
            </button>
          </>
        }
      >
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název složky</label>
          <input
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Např. Smlouvy, BOZP, Certifikace..."
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
          />
        </div>
      </Modal>

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
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition disabled:opacity-50"
            >
              Zrušit
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || pendingFiles.length === 0}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{uploadProgress.current}/{uploadProgress.total}</>
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
              uploading ? 'border-white/10 bg-white/[0.04] cursor-not-allowed' : 'border-white/10 hover:border-blue-300 hover:bg-blue-500/100/10/30'
            }`}
          >
            <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-500">Klikněte nebo přetáhněte soubory sem</p>
            <p className="text-xs text-slate-400 mt-1">Můžete vybrat více souborů najednou</p>
          </div>

          {pendingFiles.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {pendingFiles.map((f, idx) => {
                const ext = f.name.split('.').pop()?.toLowerCase() || '';
                const iconColor = FILE_ICONS[ext] || 'text-slate-400';
                return (
                  <div key={`${f.name}-${f.size}-${idx}`} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.04] group">
                    <FileText className={`w-4 h-4 shrink-0 ${iconColor}`} />
                    <span className="text-xs font-medium text-slate-300 truncate flex-1">{f.name}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">{formatSize(f.size)}</span>
                    {!uploading && (
                      <button onClick={() => removePendingFile(idx)} className="p-0.5 rounded hover:bg-white/[0.08] text-slate-400 hover:text-red-500 transition opacity-0 group-hover:opacity-100">
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
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Nahrávání souborů...</span>
                <span>{uploadProgress.current} z {uploadProgress.total}</span>
              </div>
              <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500/100 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!showTagsModal}
        onClose={() => setShowTagsModal(null)}
        title={`Tagy: ${showTagsModal?.name || ''}`}
        size="md"
        footer={
          <>
            <button onClick={() => setShowTagsModal(null)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
            <button onClick={handleSaveTags} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition">Uložit</button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const val = tagInput.trim().toLowerCase();
                  if (val && !editTags.includes(val)) {
                    setEditTags([...editTags, val]);
                    setTagInput('');
                  }
                }
              }}
              placeholder="Přidat štítek a stisknout Enter..."
              className="flex-1 px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              autoFocus
            />
          </div>
          {editTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {editTags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.06] text-slate-400 text-xs font-medium rounded-lg">
                  {tag}
                  <button onClick={() => setEditTags(editTags.filter(t => t !== tag))} className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/[0.08] transition">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-2">Zatím žádné štítky</p>
          )}
        </div>
      </Modal>

      <Modal
        open={!!showMoveModal}
        onClose={() => setShowMoveModal(null)}
        title="Přesunout do složky"
        size="md"
        footer={
          <>
            <button onClick={() => setShowMoveModal(null)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
            <button onClick={handleMoveFile} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition">Přesunout</button>
          </>
        }
      >
        <div className="space-y-1 max-h-60 overflow-y-auto">
          <button
            onClick={() => setMoveTargetId(null)}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition text-left ${
              moveTargetId === null ? 'bg-blue-500/10 text-blue-400 font-semibold' : 'text-slate-300 hover:bg-white/[0.04]'
            }`}
          >
            <Home className="w-4 h-4" /> Kořen (bez složky)
          </button>
          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => setMoveTargetId(f.id)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition text-left ${
                moveTargetId === f.id ? 'bg-blue-500/10 text-blue-400 font-semibold' : 'text-slate-300 hover:bg-white/[0.04]'
              }`}
            >
              <Folder className="w-4 h-4 text-amber-500" /> {f.name}
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={!!renameFile}
        onClose={() => setRenameFile(null)}
        title="Přejmenovat soubor"
        size="sm"
        footer={
          <>
            <button onClick={() => setRenameFile(null)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
            <button onClick={handleRename} disabled={!renameValue.trim()} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">Uložit</button>
          </>
        }
      >
        <input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }}
        />
      </Modal>

      <FilePreviewModal
        file={previewFile}
        files={currentFiles}
        onClose={() => setPreviewFile(null)}
        onNavigate={(f) => setPreviewFile(f as CompanyFile)}
      />
    </div>
  );
}

function ProjectsList({ projects, onSelect, emptyLabel }: { projects: ProjectRow[]; onSelect: (p: ProjectRow) => void; emptyLabel?: string }) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-16">
        <Building2 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-400">{emptyLabel || 'Žádné projekty'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {projects.map(p => (
        <div
          key={p.id}
          onClick={() => onSelect(p)}
          className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition cursor-pointer border border-transparent hover:border-white/10"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-blue-500" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-white truncate block">{p.project_name || p.name}</span>
            {p.client_name && <div className="text-[10px] text-slate-400">{p.client_name}</div>}
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </div>
      ))}
    </div>
  );
}

function ProjectFilesBrowser({
  folders, files, loading, onNavigateFolder, onPreview, onOpenProject, getFolderFileCount,
}: {
  folders: ProjectFolderRow[];
  files: ProjectFileRow[];
  loading: boolean;
  projectId: string | null;
  onNavigateFolder: (f: ProjectFolderRow) => void;
  onPreview: (f: ProjectFileRow) => void;
  onOpenProject: () => void;
  getFolderFileCount: (folderId: string) => number;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-14 bg-white/[0.06] rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <button
          onClick={onOpenProject}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/100/10 px-3 py-1.5 rounded-lg transition"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Otevřít projekt
        </button>
      </div>

      {folders.length === 0 && files.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-400">Tato složka je prázdná</p>
          <button onClick={onOpenProject} className="mt-3 text-xs text-blue-400 hover:text-blue-400 font-medium">
            Přejít na projekt
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {folders.map(folder => (
            <div
              key={folder.id}
              onClick={() => onNavigateFolder(folder)}
              className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition cursor-pointer border border-transparent hover:border-white/10"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Folder className="w-5 h-5 text-amber-500" />
              </div>
              <div className="min-w-0 text-left flex-1">
                <span className="text-sm font-semibold text-white truncate block">{folder.name}</span>
                <div className="text-[10px] text-slate-400">{getFolderFileCount(folder.id)} souborů</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          ))}

          {files.map(file => {
            const ext = file.file_type?.toLowerCase() || file.name.split('.').pop()?.toLowerCase() || '';
            const iconColor = FILE_ICONS[ext] || 'text-slate-400';

            return (
              <div
                key={file.id}
                className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition border border-transparent hover:border-white/10"
              >
                <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                  <FileText className={`w-5 h-5 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => onPreview(file)}
                    className="text-sm font-semibold text-white truncate hover:text-blue-400 transition text-left block"
                  >
                    {file.name}
                  </button>
                  <div className="text-[10px] text-slate-400">
                    {ext.toUpperCase()} &middot; {formatSize(file.file_size)} &middot; {new Date(file.created_at).toLocaleDateString('cs-CZ')}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onPreview(file)}
                    className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-blue-400 transition opacity-0 group-hover:opacity-100"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-blue-400 transition"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SearchResultsList({
  query, companyFiles, projectFiles, isSearching, onPreviewCompany, onPreviewProject,
}: {
  query: string;
  companyFiles: CompanyFile[];
  projectFiles: (ProjectFileRow & { project_name: string })[];
  isSearching: boolean;
  onPreviewCompany: (f: CompanyFile) => void;
  onPreviewProject: (f: ProjectFileRow & { project_name: string }) => void;
}) {
  if (isSearching) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const total = companyFiles.length + projectFiles.length;

  if (total === 0) {
    return (
      <div className="text-center py-16">
        <Search className="w-12 h-12 text-slate-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-400">Žádné výsledky pro "{query}"</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        {total} {total === 1 ? 'výsledek' : 'výsledků'} pro "{query}"
      </p>

      {companyFiles.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Firemní dokumenty</div>
          <div className="space-y-1">
            {companyFiles.map(file => {
              const ext = file.file_type?.toLowerCase() || file.name.split('.').pop()?.toLowerCase() || '';
              const iconColor = FILE_ICONS[ext] || 'text-slate-400';
              return (
                <div
                  key={file.id}
                  onClick={() => onPreviewCompany(file)}
                  className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition cursor-pointer border border-transparent hover:border-white/10"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                    <FileText className={`w-5 h-5 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-white truncate">{file.name}</span>
                      {file.is_pinned && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {ext.toUpperCase()} &middot; {formatSize(file.file_size)}
                      {file.tags.length > 0 && (
                        <> &middot; {file.tags.slice(0, 3).join(', ')}</>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {projectFiles.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Projektové soubory</div>
          <div className="space-y-1">
            {projectFiles.map(file => {
              const ext = file.file_type?.toLowerCase() || file.name.split('.').pop()?.toLowerCase() || '';
              const iconColor = FILE_ICONS[ext] || 'text-slate-400';
              return (
                <div
                  key={file.id}
                  onClick={() => onPreviewProject(file)}
                  className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition cursor-pointer border border-transparent hover:border-white/10"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <FileText className={`w-5 h-5 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-white truncate block">{file.name}</span>
                    <div className="text-[10px] text-slate-400">
                      <span className="text-blue-500 font-medium">{file.project_name}</span> &middot; {ext.toUpperCase()} &middot; {formatSize(file.file_size)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
