import { useState, useEffect } from 'react';
import { Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import type { ProductColor, ProductImage } from '../../types/database';

interface Props {
  productId: string;
}

export default function ProductImagesManager({ productId }: Props) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [colors, setColors] = useState<ProductColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [newColorId, setNewColorId] = useState<string>('');
  const { toast } = useToast();

  const load = async () => {
    const [imgsRes, colorsRes] = await Promise.all([
      supabase.from('product_images')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order'),
      supabase.from('product_colors')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order'),
    ]);
    setImages(imgsRes.data ?? []);
    setColors(colorsRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [productId]);

  const handleAdd = async () => {
    if (!newUrl.trim()) { toast('Zadejte URL obrázku', 'error'); return; }
    const maxOrder = images.length > 0 ? Math.max(...images.map((i) => i.sort_order)) + 1 : 0;
    const { error } = await supabase.from('product_images').insert({
      product_id: productId,
      image_url: newUrl.trim(),
      color_id: newColorId || null,
      sort_order: maxOrder,
    });
    if (error) { toast(error.message, 'error'); return; }
    setNewUrl('');
    setNewColorId('');
    toast('Obrázek přidán');
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Smazat obrázek?')) return;
    const { error } = await supabase.from('product_images').delete().eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Obrázek smazán');
    load();
  };

  const handleColorChange = async (imgId: string, colorId: string) => {
    const { error } = await supabase.from('product_images')
      .update({ color_id: colorId || null })
      .eq('id', imgId);
    if (error) { toast(error.message, 'error'); return; }
    load();
  };

  const colorName = (colorId: string | null) => {
    if (!colorId) return null;
    return colors.find((c) => c.id === colorId);
  };

  if (loading) return <div className="text-sm text-slate-500 py-4">Načítám obrázky...</div>;

  return (
    <div>
      <h4 className="font-extrabold text-white text-sm mb-3">
        Galerie obrázků
        <span className="text-slate-400 font-semibold ml-2">({images.length})</span>
      </h4>

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {images.map((img) => {
            const col = colorName(img.color_id);
            return (
              <div key={img.id} className="group relative rounded-xl border border-white/10 overflow-hidden bg-white/[0.04]">
                <img src={img.image_url} alt="" className="w-full aspect-square object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <select
                    value={img.color_id ?? ''}
                    onChange={(e) => handleColorChange(img.id, e.target.value)}
                    className="w-full px-2 py-1 rounded-lg text-xs font-extrabold bg-white/[0.06] border-0 focus:outline-none"
                  >
                    <option value="">Bez barvy (společné)</option>
                    {colors.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => handleDelete(img.id)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {col && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-white/[0.06] text-xs font-extrabold text-slate-300 shadow">
                    <span className="w-3 h-3 rounded-full border border-slate-300" style={{ backgroundColor: col.hex_code }} />
                    {col.name}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {images.length === 0 && (
        <div className="bg-white/[0.04] rounded-xl border-2 border-dashed border-white/10 p-6 text-center mb-4">
          <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <div className="text-sm font-extrabold text-slate-500">Zatím žádné obrázky</div>
          <div className="text-xs text-slate-400 mt-1">Přidejte URL obrázku níže</div>
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">URL obrázku</label>
          <input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-white/10 font-semibold text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/20"
            placeholder="https://..."
          />
        </div>
        {colors.length > 0 && (
          <div className="w-40">
            <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Barva</label>
            <select
              value={newColorId}
              onChange={(e) => setNewColorId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/10 font-extrabold text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/20"
            >
              <option value="">Společné (vše)</option>
              {colors.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
        <button onClick={handleAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl font-extrabold hover:bg-blue-700 transition text-sm flex items-center gap-1.5 shrink-0">
          <Plus className="w-3.5 h-3.5" /> Přidat
        </button>
      </div>
    </div>
  );
}
