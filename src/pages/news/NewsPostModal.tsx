import { useState, useEffect } from 'react';
import { ImagePlus, Paperclip, X, FileText, Upload } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';

export interface Attachment {
  name: string;
  url: string;
  size: number;
  mime_type: string;
}

interface PostData {
  id?: string;
  title: string;
  content: string;
  category: string;
  is_pinned: boolean;
  is_published: boolean;
  image_url: string;
  attachments: Attachment[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editData?: PostData | null;
}

const CATEGORIES = [
  { value: 'novinka', label: 'Novinka', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'oznameni', label: 'Oznámení', color: 'bg-amber-500/20 text-amber-400' },
  { value: 'tip', label: 'Tip', color: 'bg-emerald-500/20 text-emerald-400' },
  { value: 'dulezite', label: 'Důležité', color: 'bg-red-500/20 text-red-400' },
];

const emptyForm: PostData = {
  title: '',
  content: '',
  category: 'novinka',
  is_pinned: false,
  is_published: true,
  image_url: '',
  attachments: [],
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const uploadFile = async (file: File, prefix: string): Promise<{ url: string; error?: string }> => {
  const ext = file.name.split('.').pop();
  const path = `news/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('uploads').upload(path, file);
  if (error) {
    return { url: '', error: error.message };
  }
  const { data } = supabase.storage.from('uploads').getPublicUrl(path);
  return { url: data.publicUrl };
};

export default function NewsPostModal({ open, onClose, onSaved, editData }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<PostData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editData || emptyForm);
    }
  }, [open, editData]);

  const update = (key: keyof PostData, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast('Vyberte prosím obrázek', 'error');
      return;
    }
    setImageUploading(true);
    const { url, error } = await uploadFile(file, 'img');
    setImageUploading(false);
    if (error) {
      const localUrl = URL.createObjectURL(file);
      update('image_url', localUrl);
      return;
    }
    update('image_url', url);
  };

  const handleFileUpload = async (files: FileList) => {
    setFileUploading(true);
    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files)) {
      const { url, error } = await uploadFile(file, 'att');
      if (error) {
        newAttachments.push({
          name: file.name,
          url: `local://${file.name}`,
          size: file.size,
          mime_type: file.type,
        });
      } else {
        newAttachments.push({
          name: file.name,
          url,
          size: file.size,
          mime_type: file.type,
        });
      }
    }
    setFileUploading(false);
    setForm(f => ({ ...f, attachments: [...f.attachments, ...newAttachments] }));
  };

  const removeAttachment = (idx: number) => {
    setForm(f => ({ ...f, attachments: f.attachments.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      category: form.category,
      is_pinned: form.is_pinned,
      is_published: form.is_published,
      image_url: form.image_url,
      attachments: form.attachments,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editData?.id) {
      ({ error } = await supabase.from('news_posts').update(payload).eq('id', editData.id));
    } else {
      ({ error } = await supabase.from('news_posts').insert({
        ...payload,
        author_id: user?.id,
        publish_date: new Date().toISOString().split('T')[0],
      }));
    }

    setSaving(false);
    if (error) { toast('Chyba při ukládání', 'error'); return; }
    toast(editData?.id ? 'Příspěvek aktualizován' : 'Příspěvek vytvořen');
    setForm(emptyForm);
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editData?.id ? 'Upravit příspěvek' : 'Nový příspěvek'} size="lg" footer={
      <>
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
        <button onClick={handleSave} disabled={!form.title.trim() || !form.content.trim() || saving}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
          {saving ? 'Ukládám...' : editData?.id ? 'Uložit' : 'Publikovat'}
        </button>
      </>
    }>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Nadpis *</label>
          <input value={form.title} onChange={e => update('title', e.target.value)} placeholder="Nadpis příspěvku..."
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Kategorie</label>
            <select value={form.category} onChange={e => update('category', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-4 pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_pinned} onChange={e => update('is_pinned', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-400 focus:ring-blue-500/20" />
              <span className="text-sm text-slate-300">Připnout</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_published} onChange={e => update('is_published', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-400 focus:ring-blue-500/20" />
              <span className="text-sm text-slate-300">Publikovat</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Obrázek</label>
          {form.image_url ? (
            <div className="relative group rounded-xl overflow-hidden border border-white/10">
              <img
                src={form.image_url}
                alt="Náhled"
                className="w-full h-48 object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <button
                onClick={() => update('image_url', '')}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition opacity-0 group-hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-blue-300 transition cursor-pointer"
              onClick={() => document.getElementById('news-image-input')?.click()}
            >
              {imageUploading ? (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Nahrávám obrázek...
                </div>
              ) : (
                <>
                  <ImagePlus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Klikněte pro přidání obrázku</p>
                  <p className="text-xs text-slate-400 mt-1">PNG, JPG, GIF, WebP</p>
                </>
              )}
            </div>
          )}
          <input
            id="news-image-input"
            type="file"
            className="hidden"
            accept="image/*"
            onChange={e => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); e.target.value = ''; }}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Obsah *</label>
          <textarea value={form.content} onChange={e => update('content', e.target.value)} rows={6}
            placeholder="Napište obsah příspěvku..."
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none leading-relaxed" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-400">Přílohy</label>
            <button
              type="button"
              onClick={() => document.getElementById('news-file-input')?.click()}
              disabled={fileUploading}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-400 transition disabled:opacity-50"
            >
              {fileUploading ? (
                <>
                  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Nahrávám...
                </>
              ) : (
                <>
                  <Paperclip className="w-3 h-3" />
                  Přidat soubor
                </>
              )}
            </button>
          </div>
          <input
            id="news-file-input"
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.png,.jpg,.jpeg,.gif,.svg"
            onChange={e => { if (e.target.files && e.target.files.length > 0) handleFileUpload(e.target.files); e.target.value = ''; }}
          />
          {form.attachments.length > 0 && (
            <div className="space-y-1.5">
              {form.attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] group">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-300 truncate">{att.name}</div>
                    <div className="text-[10px] text-slate-400">{formatSize(att.size)}</div>
                  </div>
                  <button
                    onClick={() => removeAttachment(idx)}
                    className="p-1 rounded hover:bg-red-500/100/10 text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {form.attachments.length === 0 && (
            <div
              className="border border-dashed border-white/10 rounded-xl p-4 text-center hover:border-blue-300 transition cursor-pointer"
              onClick={() => document.getElementById('news-file-input')?.click()}
            >
              <Upload className="w-5 h-5 text-slate-300 mx-auto mb-1" />
              <p className="text-xs text-slate-400">PDF, DOCX, XLSX, obrázky...</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export { CATEGORIES };
