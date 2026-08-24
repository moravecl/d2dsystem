import { useState } from 'react';
import { ArrowLeft, Check, Eye, EyeOff, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import type { Inspiration } from '../../types/database';
import RichTextEditor from './RichTextEditor';

interface Props {
  inspiration: Inspiration | null;
  onSave: () => void;
  onCancel: () => void;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function InspirationForm({ inspiration, onSave, onCancel }: Props) {
  const isEdit = !!inspiration;
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: inspiration?.title ?? '',
    slug: inspiration?.slug ?? '',
    excerpt: inspiration?.excerpt ?? '',
    content: inspiration?.content ?? '',
    cover_image: inspiration?.cover_image ?? '',
    is_published: inspiration?.is_published ?? false,
  });

  const set = (key: string, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const handleTitleChange = (title: string) => {
    set('title', title);
    if (!isEdit) set('slug', slugify(title));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast('Vyplňte název', 'error'); return; }
    if (!form.slug.trim()) { toast('Slug je povinný', 'error'); return; }

    setSaving(true);
    const payload = {
      title: form.title,
      slug: form.slug,
      excerpt: form.excerpt,
      content: form.content,
      cover_image: form.cover_image,
      is_published: form.is_published,
      author_id: user?.id ?? null,
      published_at: form.is_published ? (inspiration?.published_at ?? new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    };

    if (isEdit) {
      const { error } = await supabase.from('inspirations').update(payload).eq('id', inspiration.id);
      if (error) { toast(error.message, 'error'); setSaving(false); return; }
      toast('Článek uložen');
    } else {
      const { error } = await supabase.from('inspirations').insert(payload);
      if (error) { toast(error.message, 'error'); setSaving(false); return; }
      toast('Článek vytvořen');
    }
    setSaving(false);
    onSave();
  };

  return (
    <div className="p-8">
      <button onClick={onCancel} className="flex items-center gap-2 text-sm font-extrabold text-slate-500 hover:text-slate-300 mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> Zpět na seznam
      </button>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 space-y-5">
            <div>
              <input
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full text-3xl font-extrabold text-white bg-transparent border-0 outline-none placeholder:text-slate-300"
                placeholder="Nadpis článku..."
              />
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-extrabold text-slate-400">Slug:</span>
                <input
                  value={form.slug}
                  onChange={(e) => set('slug', e.target.value)}
                  className="text-xs font-mono text-slate-500 bg-white/[0.04] px-2 py-1 rounded-lg border border-white/10 flex-1 max-w-md"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1.5">
                Krátký popis (zobrazuje se v seznamu)
              </label>
              <textarea
                value={form.excerpt}
                onChange={(e) => set('excerpt', e.target.value)}
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-white/10 font-semibold text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/20 resize-none"
                placeholder="Stručný popis o čem článek je..."
              />
            </div>

            <div>
              <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1.5">
                Obsah
              </label>
              <RichTextEditor value={form.content} onChange={(html) => set('content', html)} />
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-navy-800/60 rounded-2xl border border-white/[0.06] p-5 space-y-4 sticky top-6">
              <h4 className="font-extrabold text-white text-sm">Nastavení</h4>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">
                  Titulní obrázek
                </label>
                <input
                  value={form.cover_image}
                  onChange={(e) => set('cover_image', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/10 font-semibold text-xs focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                  placeholder="https://..."
                />
                {form.cover_image ? (
                  <img src={form.cover_image} alt="cover" className="mt-3 w-full h-32 object-cover rounded-xl border border-white/[0.06]" />
                ) : (
                  <div className="mt-3 w-full h-32 rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-slate-200" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 py-2">
                <button
                  type="button"
                  onClick={() => set('is_published', !form.is_published)}
                  className={`relative w-12 h-7 rounded-full transition ${form.is_published ? 'bg-emerald-500' : 'bg-white/[0.08]'}`}
                >
                  <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white/[0.06] shadow transition ${form.is_published ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
                <span className="text-sm font-extrabold text-slate-300 flex items-center gap-1.5">
                  {form.is_published ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                  {form.is_published ? 'Publikováno' : 'Koncept'}
                </span>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 text-white py-3 rounded-xl font-extrabold hover:bg-blue-700 transition shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" /> {saving ? 'Ukládám...' : isEdit ? 'Uložit změny' : 'Vytvořit článek'}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="bg-navy-800/60 border border-white/[0.08] text-slate-300 py-3 rounded-xl font-extrabold hover:bg-white/[0.04] transition"
                >
                  Zrušit
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
