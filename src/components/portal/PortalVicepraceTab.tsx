import { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2, Clock, XCircle, FileText,
  ThumbsUp, ThumbsDown, ChevronDown, ChevronUp,
  AlertTriangle, Loader2, MessageSquare, User,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePortalAuth } from '../../contexts/PortalAuthContext';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';

interface VicepraceItem {
  id: string;
  viceprace_id: string;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sort_order: number;
}

interface Viceprace {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  requested_by: string;
  amount: number;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  items?: VicepraceItem[];
}

interface Props {
  projectId: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  draft: { label: 'Koncept', color: 'text-slate-400', bg: 'bg-white/[0.06]', icon: FileText },
  pending: { label: 'Ke schválení', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock },
  approved: { label: 'Schváleno', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  rejected: { label: 'Zamítnuto', color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle },
  completed: { label: 'Dokončeno', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: CheckCircle2 },
};

export default function PortalVicepraceTab({ projectId }: Props) {
  const { user } = usePortalAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Viceprace[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ item: Viceprace; action: 'approve' | 'reject' } | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [approverNames, setApproverNames] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from('viceprace')
      .select('*, viceprace_items(*)')
      .eq('project_id', projectId)
      .in('status', ['pending', 'approved', 'rejected', 'completed'])
      .order('created_at', { ascending: false });
    const mapped = (data || []).map((v: Record<string, unknown>) => ({
      ...v,
      items: (Array.isArray(v.viceprace_items) ? v.viceprace_items : [])
        .sort((a: VicepraceItem, b: VicepraceItem) => a.sort_order - b.sort_order),
    }));
    setItems(mapped as Viceprace[]);
    setLoading(false);

    const approverIds = [...new Set(
      (mapped as Viceprace[]).map(v => v.approved_by).filter(Boolean) as string[]
    )];
    if (approverIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .in('id', approverIds);
      const nameMap: Record<string, string> = {};
      (profs || []).forEach((p: Record<string, string>) => { nameMap[p.id] = p.display_name || p.email || ''; });
      setApproverNames(nameMap);
    }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalApproved = items
    .filter(i => i.status === 'approved' || i.status === 'completed')
    .reduce((s, i) => s + i.amount, 0);
  const totalPending = items
    .filter(i => i.status === 'pending')
    .reduce((s, i) => s + i.amount, 0);
  const pendingCount = items.filter(i => i.status === 'pending').length;

  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

  const handleApprove = async () => {
    if (!confirmAction || !user) return;
    setSaving(true);
    const { error } = await supabase.from('viceprace').update({
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', confirmAction.item.id);
    setSaving(false);

    if (error) {
      toast('Chyba při schvalování', 'error');
      return;
    }

    toast('Vícepráce schválená');
    setConfirmAction(null);
    loadData();
  };

  const handleReject = async () => {
    if (!confirmAction || !user) return;
    setSaving(true);
    const { error } = await supabase.from('viceprace').update({
      status: 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      description: confirmAction.item.description
        ? `${confirmAction.item.description}\n---\nDůvod zamítnutí: ${rejectionNote}`
        : `Důvod zamítnutí: ${rejectionNote}`,
      updated_at: new Date().toISOString(),
    }).eq('id', confirmAction.item.id);
    setSaving(false);

    if (error) {
      toast('Chyba při zamítání', 'error');
      return;
    }

    toast('Vícepráce zamítnutá');
    setConfirmAction(null);
    setRejectionNote('');
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="w-12 h-12 text-slate-200 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-500">Žádné vícepráce</p>
        <p className="text-xs text-slate-400 mt-1">Zatím nebyly zadány žádné vícepráce k tomuto projektu</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Celkem schváleno</div>
          <div className="text-xl font-extrabold text-emerald-400 mt-1">{fmt(totalApproved)} Kč</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {items.filter(i => i.status === 'approved' || i.status === 'completed').length} položek
          </div>
        </div>
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Čeká na schválení</div>
          <div className="text-xl font-extrabold text-amber-400 mt-1">{fmt(totalPending)} Kč</div>
          <div className="text-xs text-slate-400 mt-0.5">{pendingCount} položek</div>
        </div>
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Celkový součet</div>
          <div className="text-xl font-extrabold text-white mt-1">
            {fmt(items.reduce((s, i) => s + i.amount, 0))} Kč
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{items.length} celkem</div>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Máte {pendingCount} {pendingCount === 1 ? 'vícepráci' : 'vícepráci'} ke schválení
            </p>
            <p className="text-xs text-amber-400 mt-0.5">
              Prosím zkontrolujte položky níže a schvalte nebo zamítněte
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const st = STATUS_MAP[item.status] || STATUS_MAP.draft;
          const StIcon = st.icon;
          const isExpanded = expandedId === item.id;
          const isPending = item.status === 'pending';

          return (
            <div
              key={item.id}
              className={`bg-navy-800/60 rounded-xl border overflow-hidden transition-all duration-200 ${
                isPending
                  ? 'border-amber-200  hover:shadow-md'
                  : 'border-white/10 hover:'
              }`}
            >
              <div className="flex items-start gap-4 p-4">
                <div className={`w-10 h-10 rounded-xl ${st.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                  <StIcon className={`w-5 h-5 ${st.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${st.bg} ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">{item.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    {item.requested_by && <span>Zadal: {item.requested_by}</span>}
                    <span>{new Date(item.created_at).toLocaleDateString('cs-CZ')}</span>
                    {item.items && <span>{item.items.length} položek</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-extrabold text-white">{fmt(item.amount)} Kč</div>
                  <div className="flex items-center gap-1 mt-2 justify-end">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-slate-400 transition"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {isExpanded && item.items && item.items.length > 0 && (
                <div className="border-t border-white/[0.06] px-4 py-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-white/[0.06]">
                        <th className="pb-2 pr-3">Položka</th>
                        <th className="pb-2 pr-3 w-16">Jedn.</th>
                        <th className="pb-2 pr-3 w-20 text-right">Množství</th>
                        <th className="pb-2 pr-3 w-24 text-right">Jedn. cena</th>
                        <th className="pb-2 w-24 text-right">Celkem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {item.items.map(li => (
                        <tr key={li.id} className="hover:bg-white/[0.04]">
                          <td className="py-2 pr-3 font-medium text-slate-300">{li.name}</td>
                          <td className="py-2 pr-3 text-slate-500">{li.unit}</td>
                          <td className="py-2 pr-3 text-right text-slate-300">{li.quantity}</td>
                          <td className="py-2 pr-3 text-right text-slate-300">{fmt(li.unit_price)} Kč</td>
                          <td className="py-2 text-right font-bold text-white">{fmt(li.total_price)} Kč</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/10">
                        <td colSpan={4} className="pt-2 text-right font-bold text-slate-300 pr-3">Celkem:</td>
                        <td className="pt-2 text-right font-extrabold text-white">{fmt(item.amount)} Kč</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {isPending && (
                <div className="border-t border-amber-500/20 bg-amber-500/10 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-400">Čeká na vaše rozhodnutí</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setConfirmAction({ item, action: 'reject' }); setRejectionNote(''); }}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-400 bg-white/[0.06] border border-red-200 rounded-lg hover:bg-red-500/10 transition"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                      Zamítnout
                    </button>
                    <button
                      onClick={() => setConfirmAction({ item, action: 'approve' })}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      Schválit
                    </button>
                  </div>
                </div>
              )}

              {item.approved_by && item.approved_at && (item.status === 'approved' || item.status === 'completed') && (
                <div className="border-t border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 flex items-center gap-3">
                  <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-xs font-medium text-emerald-400">
                    Schváleno
                    {approverNames[item.approved_by] ? ` - ${approverNames[item.approved_by]}` : ''}
                  </span>
                  <span className="text-[10px] text-emerald-400">
                    {new Date(item.approved_at).toLocaleDateString('cs-CZ', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
              )}

              {item.approved_by && item.approved_at && item.status === 'rejected' && (
                <div className="border-t border-red-500/20 bg-red-500/10 px-4 py-2.5 flex items-center gap-3">
                  <User className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="text-xs font-medium text-red-400">
                    Zamítnuto
                    {approverNames[item.approved_by] ? ` - ${approverNames[item.approved_by]}` : ''}
                  </span>
                  <span className="text-[10px] text-red-400">
                    {new Date(item.approved_at).toLocaleDateString('cs-CZ', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        open={confirmAction?.action === 'approve'}
        onClose={() => setConfirmAction(null)}
        title="Potvrdit schválení"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setConfirmAction(null)}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-xl transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleApprove}
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-50"
            >
              {saving ? 'Schvaluji...' : 'Schválit'}
            </button>
          </>
        }
      >
        {confirmAction && (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Opravdu chcete schválit vícepráci <span className="font-bold">"{confirmAction.item.title}"</span>?
            </p>
            <div className="bg-white/[0.04] rounded-xl p-3 border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Částka</span>
                <span className="text-lg font-extrabold text-white">{fmt(confirmAction.item.amount)} Kč</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={confirmAction?.action === 'reject'}
        onClose={() => setConfirmAction(null)}
        title="Zamítnout vícepráci"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setConfirmAction(null)}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-xl transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleReject}
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50"
            >
              {saving ? 'Zamítám...' : 'Zamítnout'}
            </button>
          </>
        }
      >
        {confirmAction && (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Zamítnout vícepráci <span className="font-bold">"{confirmAction.item.title}"</span>
              {' '}za {fmt(confirmAction.item.amount)} Kč?
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                <MessageSquare className="w-3.5 h-3.5 inline mr-1" />
                Důvod zamítnutí (volitelné)
              </label>
              <textarea
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition resize-none"
                placeholder="Napište důvod zamítnutí..."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
