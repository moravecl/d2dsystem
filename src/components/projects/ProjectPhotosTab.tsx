import { useState, useEffect, useCallback } from 'react';
import { Camera, Plus, Trash2, Image, Filter } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';

interface Photo {
  id: string;
  project_id: string;
  phase: string;
  description: string;
  url: string;
  uploaded_by: string;
  created_at: string;
}

const PHASES: Record<string, { label: string; color: string }> = {
  before: { label: 'Před', color: 'bg-amber-500/20 text-amber-400' },
  during: { label: 'Průběh', color: 'bg-blue-500/20 text-blue-400' },
  after: { label: 'Po', color: 'bg-emerald-500/20 text-emerald-400' },
};

export default function ProjectPhotosTab({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<string>('');
  const [form, setForm] = useState({ url: '', phase: 'during', description: '' });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('project_photos')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    setPhotos((data || []) as Photo[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.url.trim()) return;
    const { error } = await supabase.from('project_photos').insert({
      project_id: projectId,
      phase: form.phase,
      description: form.description,
      url: form.url,
      uploaded_by: user!.id,
    });
    if (error) { toast('Chyba', 'error'); return; }
    toast('Foto přidáno');
    setShowModal(false);
    setForm({ url: '', phase: 'during', description: '' });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Smazat foto?')) return;
    await supabase.from('project_photos').delete().eq('id', id);
    toast('Foto smazáno');
    load();
  };

  const filtered = filter ? photos.filter(p => p.phase === filter) : photos;

  if (loading) {
    return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="aspect-square bg-white/[0.06] rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select value={filter} onChange={e => setFilter(e.target.value)} className="text-sm border border-white/[0.08] rounded-lg px-3 py-1.5 bg-white/[0.06] focus:outline-none">
            <option value="">Všechny fáze</option>
            {Object.entries(PHASES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <span className="text-xs text-slate-400">{filtered.length} fotek</span>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition">
          <Plus className="w-4 h-4" /> Přidat foto
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Camera className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Žádná fotodokumentace</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(photo => {
            const phase = PHASES[photo.phase] || PHASES.during;
            return (
              <div key={photo.id} className="group relative rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.06] cursor-pointer transition" onClick={() => setPreviewUrl(photo.url)}>
                <div className="aspect-square bg-white/[0.08] flex items-center justify-center">
                  <img src={photo.url} alt={photo.description} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <Image className="w-8 h-8 text-slate-300 absolute" />
                </div>
                <div className="absolute top-2 left-2">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${phase.color}`}>{phase.label}</span>
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }} className="p-1.5 rounded-lg bg-white/10 text-red-500 hover:bg-red-500/10 transition shadow">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {photo.description && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                    <p className="text-[10px] text-white font-medium truncate">{photo.description}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <img src={previewUrl} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Přidat foto" size="md" footer={
        <>
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={handleAdd} disabled={!form.url.trim()} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">Přidat</button>
        </>
      }>
        <div className="space-y-4">
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">URL obrázku *</label><input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Fáze</label>
            <select value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              {Object.entries(PHASES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" /></div>
        </div>
      </Modal>
    </div>
  );
}
