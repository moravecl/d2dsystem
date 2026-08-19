import { useState, useEffect, useCallback } from 'react';
import { Package, ArrowUpFromLine } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';

interface Transaction {
  id: string;
  item_id: string;
  quantity: number;
  note: string;
  type: string;
  created_at: string;
}

interface WarehouseItem { id: string; name: string; unit: string; quantity: number; }

export default function ProjectWarehouseTab({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ item_id: '', quantity: 1, note: '' });

  const load = useCallback(async () => {
    const [transRes, itemsRes] = await Promise.all([
      supabase.from('warehouse_transactions').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('warehouse_items').select('id, name, unit, quantity').eq('is_active', true).order('name'),
    ]);
    setTransactions((transRes.data || []) as Transaction[]);
    setItems((itemsRes.data || []) as WarehouseItem[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const getItemName = (id: string) => items.find(i => i.id === id)?.name || '';
  const getItemUnit = (id: string) => items.find(i => i.id === id)?.unit || 'ks';

  const handleIssue = async () => {
    if (!form.item_id || form.quantity <= 0) return;
    const { error } = await supabase.from('warehouse_transactions').insert({
      item_id: form.item_id, project_id: projectId, type: 'out',
      quantity: form.quantity, note: form.note, created_by: user!.id,
    });
    if (error) { toast('Chyba', 'error'); return; }

    const item = items.find(i => i.id === form.item_id);
    if (item) {
      await supabase.from('warehouse_items').update({ quantity: Math.max(0, item.quantity - form.quantity), updated_at: new Date().toISOString() }).eq('id', form.item_id);
    }
    toast('Material vydan');
    setShowModal(false);
    load();
  };

  if (loading) return <div className="animate-pulse h-32 bg-white/[0.06] rounded-lg" />;

  const totalItems = transactions.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{totalItems} výdejek na tento projekt</span>
        <button onClick={() => { setForm({ item_id: '', quantity: 1, note: '' }); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition">
          <ArrowUpFromLine className="w-4 h-4" /> Vydat material
        </button>
      </div>

      <div className="space-y-1.5">
        {transactions.map(t => (
          <div key={t.id} className="flex items-center gap-4 p-3 rounded-lg border border-white/[0.06] hover:bg-white/[0.04] transition">
            <Package className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">{getItemName(t.item_id)}</div>
              <div className="text-xs text-slate-400">{t.note || '-'} &middot; {new Date(t.created_at).toLocaleDateString('cs-CZ')}</div>
            </div>
            <span className="text-sm font-bold text-red-400">-{t.quantity} {getItemUnit(t.item_id)}</span>
          </div>
        ))}
        {transactions.length === 0 && (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Žádné výdeje materiálu</p>
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Vydat material" size="sm" footer={
        <>
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={handleIssue} disabled={!form.item_id || form.quantity <= 0} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">Vydat</button>
        </>
      }>
        <div className="space-y-4">
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Položka *</label>
            <select value={form.item_id} onChange={e => setForm({ ...form, item_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              <option value="">Vyberte...</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit})</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Množství</label><input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámka</label><input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" /></div>
        </div>
      </Modal>
    </div>
  );
}
