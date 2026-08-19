import { useEffect, useState, useMemo } from 'react';
import {
  BookOpen, Plus, Search, FileText, Download, Trash2,
  Pin, PinOff, Pencil, FolderOpen, Upload, X, Tag,
  ChevronRight, Folder, ArrowLeft, Eye, Grid3X3, List,
} from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import PdfViewerModal from './PdfViewerModal';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface KnowledgeFile {
  id: string;
  title: string;
  description: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  category_id: string | null;
  uploaded_by: string | null;
  tags: string[];
  is_pinned: boolean;
  download_count: number;
  created_at: string;
  updated_at: string;
}

interface ProfileRef {
  id: string;
  display_name: string | null;
  email: string;
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FILE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  'application/pdf': { bg: 'bg-red-900/30', text: 'text-red-400', label: 'PDF' },
  'image/': { bg: 'bg-blue-900/30', text: 'text-blue-400', label: 'IMG' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml': { bg: 'bg-blue-900/30', text: 'text-blue-400', label: 'DOCX' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml': { bg: 'bg-emerald-900/30', text: 'text-emerald-400', label: 'XLSX' },
  'application/msword': { bg: 'bg-blue-900/30', text: 'text-blue-400', label: 'DOC' },
  'text/': { bg: 'bg-white/[0.06]/[0.06]', text: 'text-slate-400', label: 'TXT' },
};

const getFileStyle = (mime: string) => {
  for (const [key, val] of Object.entries(FILE_COLORS)) {
    if (mime.startsWith(key)) return val;
  }
  return { bg: 'bg-white/[0.06]/[0.06]', text: 'text-slate-400', label: 'FILE' };
};

const FOLDER_COLORS = [
  { bg: 'bg-blue-900/30', icon: 'text-blue-400', border: 'border-blue-500/20' },
  { bg: 'bg-emerald-900/30', icon: 'text-emerald-400', border: 'border-emerald-500/20' },
  { bg: 'bg-amber-900/30', icon: 'text-amber-400', border: 'border-amber-500/20' },
  { bg: 'bg-cyan-900/30', icon: 'text-cyan-400', border: 'border-cyan-500/20' },
  { bg: 'bg-rose-900/30', icon: 'text-rose-400', border: 'border-rose-500/20' },
  { bg: 'bg-teal-900/30', icon: 'text-teal-400', border: 'border-teal-500/20' },
  { bg: 'bg-white/[0.06]/[0.04]', icon: 'text-slate-400', border: 'border-white/[0.08]' },
];

const getFolderColor = (idx: number) => FOLDER_COLORS[idx % FOLDER_COLORS.length];

export default function KnowledgePage() {
  const { setConfig } = useHeader();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [profiles, setProfiles] = useState<ProfileRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showUpload, setShowUpload] = useState(false);
  const [showEdit, setShowEdit] = useState<KnowledgeFile | null>(null);
  const [showCatManager, setShowCatManager] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => { setConfig({ breadcrumbs: [{ label: 'Znalostní báze' }] }); }, [setConfig]);

  const load = async () => {
    const [fRes, cRes, pRes] = await Promise.all([
      supabase.from('knowledge_files').select('*').order('is_pinned', { ascending: false }).order('updated_at', { ascending: false }),
      supabase.from('knowledge_categories').select('id, name, color').eq('is_active', true).order('sort_order'),
      supabase.from('profiles').select('id, display_name, email'),
    ]);
    setFiles((fRes.data || []) as KnowledgeFile[]);
    setCategories((cRes.data || []) as Category[]);
    setProfiles((pRes.data || []) as ProfileRef[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getCatName = (id: string | null) => categories.find(c => c.id === id)?.name || '';
  const getCatColor = (id: string | null) => categories.find(c => c.id === id)?.color || 'bg-white/[0.06] text-slate-400';
  const getProfileName = (id: string | null) => {
    if (!id) return '';
    const p = profiles.find(pr => pr.id === id);
    return p?.display_name || p?.email || '';
  };

  const togglePin = async (file: KnowledgeFile) => {
    await supabase.from('knowledge_files').update({ is_pinned: !file.is_pinned }).eq('id', file.id);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat tento soubor?')) return;
    const { error } = await supabase.from('knowledge_files').delete().eq('id', id);
    if (error) { toast('Chyba při mazání', 'error'); return; }
    toast('Soubor smazán');
    load();
  };

  const isValidUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');

  const handleOpen = async (file: KnowledgeFile) => {
    if (!isValidUrl(file.file_url)) {
      toast('Tento soubor nemá platnou URL. Nahrajte ho prosím znovu.', 'error');
      return;
    }
    await supabase.from('knowledge_files').update({ download_count: file.download_count + 1 }).eq('id', file.id);
    if (file.mime_type === 'application/pdf') {
      setPdfPreview({ url: file.file_url, title: file.title || file.file_name });
    } else {
      window.open(file.file_url, '_blank');
    }
  };

  const handleDownload = async (file: KnowledgeFile) => {
    if (!isValidUrl(file.file_url)) {
      toast('Tento soubor nemá platnou URL. Nahrajte ho prosím znovu.', 'error');
      return;
    }
    await supabase.from('knowledge_files').update({ download_count: file.download_count + 1 }).eq('id', file.id);
    window.open(file.file_url, '_blank');
  };

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { uncategorized: 0 };
    categories.forEach(c => { counts[c.id] = 0; });
    files.forEach(f => {
      if (f.category_id && counts[f.category_id] !== undefined) {
        counts[f.category_id]++;
      } else {
        counts.uncategorized++;
      }
    });
    return counts;
  }, [files, categories]);

  const filtered = useMemo(() => {
    let result = files;
    if (activeFolder === 'uncategorized') {
      result = result.filter(f => !f.category_id);
    } else if (activeFolder) {
      result = result.filter(f => f.category_id === activeFolder);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(f =>
        f.title.toLowerCase().includes(s) || f.description.toLowerCase().includes(s)
        || f.file_name.toLowerCase().includes(s) || f.tags.some(t => t.toLowerCase().includes(s))
      );
    }
    return result;
  }, [files, activeFolder, search]);

  const activeFolderName = activeFolder === 'uncategorized'
    ? 'Nezařazené'
    : categories.find(c => c.id === activeFolder)?.name || '';

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-navy-700/50 rounded-2xl border border-white/[0.08] animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat soubory, tagy..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          </div>
          <div className="flex items-center gap-1 border border-white/10 rounded-xl p-0.5">
            <button onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition ${viewMode === 'grid' ? 'bg-white/[0.06]/[0.07] text-white' : 'text-slate-400 hover:text-slate-300'}`}>
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition ${viewMode === 'list' ? 'bg-white/[0.06]/[0.07] text-white' : 'text-slate-400 hover:text-slate-300'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => setShowCatManager(true)}
              className="flex items-center gap-2 px-3 py-2.5 border border-white/10 bg-white/[0.06]/[0.07] text-slate-400 rounded-xl text-sm font-medium hover:bg-white/[0.06]/[0.04] transition">
              <FolderOpen className="w-4 h-4" /> Kategorie
            </button>
          )}
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">
            <Upload className="w-4 h-4" /> Nahrát soubor
          </button>
        </div>
      </div>

      {!activeFolder && !search && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {categories.map((cat, idx) => {
            const fc = getFolderColor(idx);
            const count = folderCounts[cat.id] || 0;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveFolder(cat.id)}
                className={`group flex flex-col items-center gap-2 p-5 rounded-2xl border ${fc.border} ${fc.bg}  hover:shadow-black/20 transition-all duration-200 hover:-translate-y-0.5`}
              >
                <Folder className={`w-10 h-10 ${fc.icon} transition-transform group-hover:scale-110`} />
                <span className="text-sm font-semibold text-white text-center leading-tight">{cat.name}</span>
                <span className="text-[10px] font-medium text-slate-500">{count} {count === 1 ? 'soubor' : count < 5 ? 'soubory' : 'souborů'}</span>
              </button>
            );
          })}
          {folderCounts.uncategorized > 0 && (
            <button
              onClick={() => setActiveFolder('uncategorized')}
              className="group flex flex-col items-center gap-2 p-5 rounded-2xl border border-white/[0.08] bg-white/[0.06]/[0.04]  hover:shadow-black/20 transition-all duration-200 hover:-translate-y-0.5"
            >
              <Folder className="w-10 h-10 text-slate-400 transition-transform group-hover:scale-110" />
              <span className="text-sm font-semibold text-slate-300 text-center leading-tight">Nezařazené</span>
              <span className="text-[10px] font-medium text-slate-500">{folderCounts.uncategorized} souborů</span>
            </button>
          )}
        </div>
      )}

      {activeFolder && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveFolder(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/[0.06]/[0.04] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Všechny složky
          </button>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-white">{activeFolderName}</span>
          <span className="text-xs text-slate-500 ml-1">({filtered.length})</span>
        </div>
      )}

      {(activeFolder || search) && (
        <>
          {filtered.length === 0 ? (
            <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-16 text-center">
              <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-400 mb-1">Žádné soubory</h3>
              <p className="text-sm text-slate-500 mb-4">
                {search ? 'Žádný soubor neodpovídá hledání' : 'Tato složka je zatím prázdná'}
              </p>
              <button onClick={() => setShowUpload(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition">
                <Upload className="w-4 h-4" /> Nahrát soubor
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map(file => {
                const style = getFileStyle(file.mime_type);
                const isPdf = file.mime_type === 'application/pdf';
                return (
                  <div
                    key={file.id}
                    className="group bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden  hover:shadow-black/20 transition-all duration-200 hover:-translate-y-0.5 flex flex-col"
                  >
                    <button
                      onClick={() => handleOpen(file)}
                      className="flex flex-col items-center justify-center p-6 pb-4 text-center flex-1"
                    >
                      <div className={`w-14 h-14 rounded-2xl ${style.bg} flex items-center justify-center mb-3 transition-transform group-hover:scale-110`}>
                        <FileText className={`w-7 h-7 ${style.text}`} />
                      </div>
                      <h4 className="text-sm font-semibold text-white line-clamp-2 group-hover:text-blue-400 transition-colors">
                        {file.title || file.file_name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                        <span>{style.label}</span>
                        <span>{formatSize(file.file_size)}</span>
                      </div>
                      {file.is_pinned && (
                        <Pin className="w-3 h-3 text-amber-500 mt-1.5" />
                      )}
                      {isPdf && (
                        <div className="flex items-center gap-1 mt-2 text-[10px] font-medium text-blue-400">
                          <Eye className="w-3 h-3" />
                          Náhled
                        </div>
                      )}
                    </button>
                    {file.category_id && !activeFolder && (
                      <div className="px-3 pb-2 text-center">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${getCatColor(file.category_id)}`}>
                          {getCatName(file.category_id)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-0.5 border-t border-white/[0.06] py-2 px-3">
                      <button onClick={() => handleDownload(file)} className="p-1.5 rounded-lg hover:bg-blue-500/100/100/20 text-slate-400 hover:text-blue-400 transition" title="Stáhnout">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => togglePin(file)} className="p-1.5 rounded-lg hover:bg-amber-500/100/100/20 text-slate-400 hover:text-amber-400 transition" title={file.is_pinned ? 'Odepnout' : 'Připnout'}>
                        {file.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setShowEdit(file)} className="p-1.5 rounded-lg hover:bg-white/[0.06]/[0.08] text-slate-400 hover:text-slate-300 transition" title="Upravit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {(file.uploaded_by === user?.id || isAdmin) && (
                        <button onClick={() => handleDelete(file.id)} className="p-1.5 rounded-lg hover:bg-red-500/100/100/20 text-slate-400 hover:text-red-400 transition" title="Smazat">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
              <div className="divide-y divide-white/[0.06]">
                {filtered.map(file => {
                  const style = getFileStyle(file.mime_type);
                  const isPdf = file.mime_type === 'application/pdf';
                  return (
                    <div key={file.id} className="group flex items-center gap-4 px-5 py-4 hover:bg-white/[0.06]/[0.04] transition-colors">
                      <button
                        onClick={() => handleOpen(file)}
                        className={`w-10 h-10 rounded-xl ${style.bg} flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}
                      >
                        <FileText className={`w-5 h-5 ${style.text}`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          {file.is_pinned && <Pin className="w-3 h-3 text-amber-500 shrink-0" />}
                          <button onClick={() => handleOpen(file)} className="text-sm font-semibold text-white hover:text-blue-400 transition truncate text-left">
                            {file.title || file.file_name}
                          </button>
                          {file.category_id && !activeFolder && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getCatColor(file.category_id)}`}>
                              {getCatName(file.category_id)}
                            </span>
                          )}
                          {isPdf && (
                            <span className="text-[10px] font-medium text-blue-400 flex items-center gap-0.5">
                              <Eye className="w-3 h-3" /> Náhled
                            </span>
                          )}
                        </div>
                        {file.description && <p className="text-xs text-slate-500 line-clamp-1 mb-1">{file.description}</p>}
                        <div className="flex items-center gap-3 text-[10px] text-slate-500">
                          <span>{file.file_name}</span>
                          <span>{formatSize(file.file_size)}</span>
                          <span>{getProfileName(file.uploaded_by)}</span>
                          <span>{new Date(file.created_at).toLocaleDateString('cs-CZ')}</span>
                          {file.download_count > 0 && <span>{file.download_count}x staženo</span>}
                        </div>
                        {file.tags.length > 0 && (
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {file.tags.map(t => (
                              <span key={t} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-white/[0.06]/[0.07] text-slate-400">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                        <button onClick={() => handleDownload(file)} className="p-1.5 rounded-lg hover:bg-blue-500/100/100/20 text-slate-400 hover:text-blue-400 transition" title="Stáhnout">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => togglePin(file)} className="p-1.5 rounded-lg hover:bg-amber-500/100/100/20 text-slate-400 hover:text-amber-400 transition" title={file.is_pinned ? 'Odepnout' : 'Připnout'}>
                          {file.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => setShowEdit(file)} className="p-1.5 rounded-lg hover:bg-white/[0.06]/[0.08] text-slate-400 hover:text-slate-300 transition" title="Upravit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {(file.uploaded_by === user?.id || isAdmin) && (
                          <button onClick={() => handleDelete(file.id)} className="p-1.5 rounded-lg hover:bg-red-500/100/100/20 text-slate-400 hover:text-red-400 transition" title="Smazat">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {!activeFolder && !search && files.length === 0 && categories.length === 0 && (
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-16 text-center">
          <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-400 mb-1">Znalostní báze je prázdná</h3>
          <p className="text-sm text-slate-500 mb-4">Vytvořte kategorie a nahrajte první dokumenty</p>
          <div className="flex items-center justify-center gap-3">
            {isAdmin && (
              <button onClick={() => setShowCatManager(true)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-white/10 bg-white/[0.06]/[0.07] text-slate-400 rounded-xl text-sm font-semibold hover:bg-white/[0.06]/[0.04] transition">
                <FolderOpen className="w-4 h-4" /> Vytvořit kategorie
              </button>
            )}
            <button onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition">
              <Upload className="w-4 h-4" /> Nahrát soubor
            </button>
          </div>
        </div>
      )}

      {pdfPreview && (
        <PdfViewerModal url={pdfPreview.url} title={pdfPreview.title} onClose={() => setPdfPreview(null)} />
      )}

      {showUpload && (
        <UploadModal categories={categories} defaultCategory={activeFolder !== 'uncategorized' ? activeFolder : null} onClose={() => setShowUpload(false)} onSaved={() => { setShowUpload(false); load(); }} />
      )}

      {showEdit && (
        <EditFileModal file={showEdit} categories={categories} onClose={() => setShowEdit(null)} onSaved={() => { setShowEdit(null); load(); }} />
      )}

      {showCatManager && (
        <CategoryManagerModal categories={categories} onClose={() => setShowCatManager(false)} onSaved={load} />
      )}
    </div>
  );
}

function UploadModal({ categories, defaultCategory, onClose, onSaved }: { categories: Category[]; defaultCategory: string | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(defaultCategory || '');
  const [tagsInput, setTagsInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file || !title.trim()) return;
    setUploading(true);

    const ext = file.name.split('.').pop();
    const path = `knowledge/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('uploads').upload(path, file);

    if (uploadErr) {
      setUploading(false);
      toast('Chyba při nahrávání souboru: ' + uploadErr.message, 'error');
      return;
    }

    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
    const { error } = await supabase.from('knowledge_files').insert({
      title: title.trim(),
      description,
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_size: file.size,
      mime_type: file.type,
      category_id: categoryId || null,
      uploaded_by: user?.id,
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
    });
    setUploading(false);
    if (error) { toast('Chyba při ukládání', 'error'); return; }
    toast('Soubor nahrán');
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title="Nahrát soubor" size="md" footer={
      <>
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 bg-white/[0.06]/[0.07] border border-white/10 hover:bg-white/[0.06]/[0.04] rounded-lg transition">Zrušit</button>
        <button onClick={handleUpload} disabled={!file || !title.trim() || uploading}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
          {uploading ? 'Nahrávám...' : 'Nahrát'}
        </button>
      </>
    }>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Soubor *</label>
          <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-blue-500/40 transition cursor-pointer"
            onClick={() => document.getElementById('knowledge-file-input')?.click()}>
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-medium text-white">{file.name}</span>
                <span className="text-xs text-slate-500">({formatSize(file.size)})</span>
                <button onClick={e => { e.stopPropagation(); setFile(null); }} className="p-0.5 hover:bg-white/[0.06]/[0.08] rounded"><X className="w-3.5 h-3.5 text-slate-400" /></button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Klikněte pro výběr souboru</p>
                <p className="text-xs text-slate-500 mt-1">PDF, DOCX, XLSX, obrázky...</p>
              </>
            )}
          </div>
          <input id="knowledge-file-input" type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.svg" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Název dokumentu"
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Kategorie</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <option value="">-- Bez kategorie --</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Tagy (oddělené čárkou)</label>
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-slate-400 shrink-0" />
            <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="instalace, bezpečnost, návod..."
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Krátký popis obsahu..."
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none" />
        </div>
      </div>
    </Modal>
  );
}

function EditFileModal({ file, categories, onClose, onSaved }: { file: KnowledgeFile; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState(file.title);
  const [description, setDescription] = useState(file.description);
  const [categoryId, setCategoryId] = useState(file.category_id || '');
  const [tagsInput, setTagsInput] = useState(file.tags.join(', '));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('knowledge_files').update({
      title: title.trim(),
      description,
      category_id: categoryId || null,
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      updated_at: new Date().toISOString(),
    }).eq('id', file.id);
    setSaving(false);
    if (error) { toast('Chyba', 'error'); return; }
    toast('Uloženo');
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title="Upravit soubor" size="md" footer={
      <>
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 bg-white/[0.06]/[0.07] border border-white/10 hover:bg-white/[0.06]/[0.04] rounded-lg transition">Zrušit</button>
        <button onClick={handleSave} disabled={!title.trim() || saving}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
          {saving ? 'Ukládám...' : 'Uložit'}
        </button>
      </>
    }>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název *</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Kategorie</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <option value="">-- Bez kategorie --</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Tagy</label>
          <input value={tagsInput} onChange={e => setTagsInput(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none" />
        </div>
      </div>
    </Modal>
  );
}

function CategoryManagerModal({ categories: initial, onClose, onSaved }: { categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [categories, setCategories] = useState(initial);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('bg-white/[0.06] text-slate-300');

  const colorOptions = [
    'bg-blue-500/20 text-blue-400',
    'bg-emerald-500/20 text-emerald-400',
    'bg-red-500/20 text-red-400',
    'bg-amber-500/20 text-amber-400',
    'bg-cyan-500/20 text-cyan-700',
    'bg-white/[0.06] text-slate-300',
    'bg-rose-100 text-rose-700',
    'bg-teal-100 text-teal-700',
  ];

  const addCategory = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('knowledge_categories').insert({
      name: newName.trim(),
      color: newColor,
      sort_order: categories.length,
    });
    if (error) { toast('Chyba', 'error'); return; }
    setNewName('');
    const { data } = await supabase.from('knowledge_categories').select('id, name, color').eq('is_active', true).order('sort_order');
    setCategories((data || []) as Category[]);
    onSaved();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Smazat kategorii?')) return;
    await supabase.from('knowledge_categories').update({ is_active: false }).eq('id', id);
    setCategories(prev => prev.filter(c => c.id !== id));
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title="Správa kategorií" size="md">
      <div className="space-y-4">
        <div className="space-y-2">
          {categories.map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.06]/[0.04] border border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.color}`}>{c.name}</span>
              </div>
              <button onClick={() => deleteCategory(c.id)} className="p-1 rounded hover:bg-red-500/100/100/20 text-slate-400 hover:text-red-400 transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nová kategorie..."
            className="flex-1 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            onKeyDown={e => { if (e.key === 'Enter') addCategory(); }} />
          <select value={newColor} onChange={e => setNewColor(e.target.value)}
            className="px-2 py-2 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            {colorOptions.map(c => <option key={c} value={c}>{c.includes('blue') ? 'Modrá' : c.includes('emerald') ? 'Zelená' : c.includes('red') ? 'Červená' : c.includes('amber') ? 'Žlutá' : c.includes('cyan') ? 'Tyrkysová' : c.includes('rose') ? 'Růžová' : c.includes('teal') ? 'Zelenomodrá' : 'Šedá'}</option>)}
          </select>
          <button onClick={addCategory} disabled={!newName.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
