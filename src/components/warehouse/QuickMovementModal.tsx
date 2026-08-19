import { useState, useEffect } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Package, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface WarehouseItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  location: string;
  qr_code: string;
}

interface Project {
  id: string;
  project_name: string;
}

interface QuickMovementModalProps {
  qrCode: string | null;
  onClose: () => void;
  onSuccess: () => void;
  onContinueScanning: () => void;
}

export default function QuickMovementModal({
  qrCode,
  onClose,
  onSuccess,
  onContinueScanning,
}: QuickMovementModalProps) {
  const { user } = useAuth();
  const [item, setItem] = useState<WarehouseItem | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [type, setType] = useState<'in' | 'out'>('out');
  const [quantity, setQuantity] = useState(1);
  const [projectId, setProjectId] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!qrCode) return;

    const loadData = async () => {
      setLoading(true);
      setNotFound(false);

      const [itemRes, projectsRes] = await Promise.all([
        supabase
          .from('warehouse_items')
          .select('id, name, sku, unit, quantity, location, qr_code')
          .or(`qr_code.eq.${qrCode},id.eq.${qrCode}`)
          .eq('is_active', true)
          .maybeSingle(),
        supabase
          .from('projects')
          .select('id, project_name')
          .neq('status', 'cancelled')
          .order('project_name'),
      ]);

      if (itemRes.data) {
        setItem(itemRes.data as WarehouseItem);
      } else {
        setNotFound(true);
      }

      setProjects((projectsRes.data || []) as Project[]);
      setLoading(false);
    };

    loadData();
  }, [qrCode]);

  const handleSave = async () => {
    if (!item || !user || quantity <= 0) return;

    setSaving(true);

    const { error: transError } = await supabase.from('warehouse_transactions').insert({
      item_id: item.id,
      project_id: projectId || null,
      type,
      quantity,
      note: note || (type === 'in' ? 'QR naskladneni' : 'QR vyskladneni'),
      created_by: user.id,
    });

    if (transError) {
      setSaving(false);
      return;
    }

    const newQty =
      type === 'in'
        ? item.quantity + quantity
        : Math.max(0, item.quantity - quantity);

    await supabase
      .from('warehouse_items')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', item.id);

    setSaving(false);
    onSuccess();
    setQuantity(1);
    setProjectId('');
    setNote('');
    onContinueScanning();
  };

  if (!qrCode) return null;

  return (
    <Modal
      open={!!qrCode}
      onClose={onClose}
      title="Skladovy pohyb"
      size="md"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.04] rounded-lg transition"
          >
            Zrusit
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !item || quantity <= 0}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Ulozit a pokracovat
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : notFound ? (
        <div className="text-center py-8">
          <Package className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400 mb-2">Polozka nenalezena</p>
          <p className="text-xs text-slate-500">Kod: {qrCode}</p>
          <button
            onClick={onContinueScanning}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
          >
            Zkusit znovu
          </button>
        </div>
      ) : item ? (
        <div className="space-y-5">
          <div className="bg-navy-700/50 rounded-xl p-4 border border-white/[0.08]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white truncate">{item.name}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  {item.sku && <span>SKU: {item.sku}</span>}
                  {item.location && <span>Umisteni: {item.location}</span>}
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-slate-400">Aktualni stav: </span>
                  <span className="font-bold text-white">
                    {item.quantity} {item.unit}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setType('in')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition font-semibold ${
                type === 'in'
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                  : 'bg-white/[0.04] border-white/10 text-slate-400 hover:border-white/20'
              }`}
            >
              <ArrowDownToLine className="w-5 h-5" />
              Naskladnit
            </button>
            <button
              onClick={() => setType('out')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition font-semibold ${
                type === 'out'
                  ? 'bg-red-500/10 border-red-500 text-red-400'
                  : 'bg-white/[0.04] border-white/10 text-slate-400 hover:border-white/20'
              }`}
            >
              <ArrowUpFromLine className="w-5 h-5" />
              Vyskladnit
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Mnozstvi *
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-12 h-12 rounded-xl bg-white/[0.06] border border-white/10 text-white font-bold text-xl hover:bg-white/[0.08] transition"
              >
                -
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                className="flex-1 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.06] text-white text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-12 h-12 rounded-xl bg-white/[0.06] border border-white/10 text-white font-bold text-xl hover:bg-white/[0.08] transition"
              >
                +
              </button>
            </div>
            <div className="text-xs text-slate-500 mt-1 text-center">
              {item.unit}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Projekt (volitelne)
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">Bez projektu</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Poznamka
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Volitelna poznamka..."
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
