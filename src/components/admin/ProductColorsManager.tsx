import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import type { ProductColor } from '../../types/database';

interface Props {
  productId: string;
}

const DEFAULT_COLORS = [
  { name: 'Bílá', hex: '#FFFFFF' },
  { name: 'Slonová kost', hex: '#FFFDD0' },
  { name: 'Antracit', hex: '#383838' },
  { name: 'Šedá', hex: '#9CA3AF' },
  { name: 'Černá', hex: '#1A1A1A' },
];

export default function ProductColorsManager({ productId }: Props) {
  const [colors, setColors] = useState<ProductColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newHex, setNewHex] = useState('#FFFFFF');
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from('product_colors')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order');
    setColors(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [productId]);

  const handleAdd = async () => {
    if (!newName.trim()) { toast('Zadejte název barvy', 'error'); return; }
    const maxOrder = colors.length > 0 ? Math.max(...colors.map((c) => c.sort_order)) + 1 : 0;
    const { error } = await supabase.from('product_colors').insert({
      product_id: productId,
      name: newName.trim(),
      hex_code: newHex,
      sort_order: maxOrder,
    });
    if (error) { toast(error.message, 'error'); return; }
    setNewName('');
    setNewHex('#FFFFFF');
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Smazat barvu? Obrázky připojené k této barvě ztratí vazbu.')) return;
    const { error } = await supabase.from('product_colors').delete().eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Barva smazána');
    load();
  };

  const handleQuickAdd = async (name: string, hex: string) => {
    if (colors.some((c) => c.name === name)) { toast('Barva už existuje', 'error'); return; }
    const maxOrder = colors.length > 0 ? Math.max(...colors.map((c) => c.sort_order)) + 1 : 0;
    const { error } = await supabase.from('product_colors').insert({
      product_id: productId,
      name,
      hex_code: hex,
      sort_order: maxOrder,
    });
    if (error) { toast(error.message, 'error'); return; }
    load();
  };

  if (loading) return <div className="text-sm text-slate-500 py-4">Načítám barvy...</div>;

  return (
    <div>
      <h4 className="font-extrabold text-white text-sm mb-3">Barevné varianty</h4>

      {colors.length > 0 && (
        <div className="space-y-2 mb-4">
          {colors.map((color) => (
            <div key={color.id} className="flex items-center gap-3 p-3 bg-white/[0.04] rounded-xl border border-white/[0.06]">
              <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
              <span
                className="w-8 h-8 rounded-lg border-2 border-white/10 shrink-0"
                style={{ backgroundColor: color.hex_code }}
              />
              <span className="font-extrabold text-white text-sm flex-1">{color.name}</span>
              <span className="text-xs text-slate-400 font-mono">{color.hex_code}</span>
              <button onClick={() => handleDelete(color.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Název barvy</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-white/10 font-semibold text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/20"
            placeholder="např. Bílá, Antracit"
          />
        </div>
        <div className="w-20">
          <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Barva</label>
          <input
            type="color"
            value={newHex}
            onChange={(e) => setNewHex(e.target.value)}
            className="w-full h-[38px] rounded-xl border border-white/10 cursor-pointer"
          />
        </div>
        <button onClick={handleAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl font-extrabold hover:bg-blue-700 transition text-sm flex items-center gap-1.5 shrink-0">
          <Plus className="w-3.5 h-3.5" /> Přidat
        </button>
      </div>

      {colors.length === 0 && (
        <div className="mt-3">
          <div className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2">Rychlé přidání</div>
          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_COLORS.map((dc) => (
              <button key={dc.name} onClick={() => handleQuickAdd(dc.name, dc.hex)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-extrabold text-slate-400 hover:bg-white/[0.04] transition">
                <span className="w-4 h-4 rounded-full border border-slate-300" style={{ backgroundColor: dc.hex }} />
                {dc.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
