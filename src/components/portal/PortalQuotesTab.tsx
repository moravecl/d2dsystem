import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Clock, ChevronRight, CheckCircle2, RotateCcw,
  Send, MessageSquare, Loader2, ArrowLeft, Shield, FileDown,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePortalAuth } from '../../contexts/PortalAuthContext';
import { useToast } from '../ui/Toast';
import { logAudit } from '../../lib/auditLog';
import Modal from '../ui/Modal';

interface Quote {
  id: string;
  version: number;
  quote_number: string;
  status: string;
  total_selling: number;
  created_at: string;
  sections_data: QuoteSection[];
}

interface QuoteSection {
  id: string;
  name: string;
  trade?: string;
  items: QuoteItem[];
}

interface QuoteItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  sellingPrice: number;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile_name?: string;
}

export default function PortalQuotesTab({ projectId }: { projectId: string }) {
  const { user } = usePortalAuth();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [approvalName, setApprovalName] = useState('');
  const [scopeAgreed, setScopeAgreed] = useState(false);
  const [priceAgreed, setPriceAgreed] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [approving, setApproving] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returning, setReturning] = useState(false);

  const loadQuotes = useCallback(async () => {
    const { data } = await supabase
      .from('project_quotes')
      .select('id, version, quote_number, status, total_selling, created_at, sections_data')
      .eq('project_id', projectId)
      .eq('presented_to_client', true)
      .order('version', { ascending: false });
    setQuotes((data || []) as Quote[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadQuotes(); }, [loadQuotes]);

  const loadComments = useCallback(async (quoteId: string) => {
    const { data } = await supabase
      .from('quote_comments')
      .select('id, user_id, content, created_at')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: true });

    const commentList = (data || []) as Comment[];
    const userIds = [...new Set(commentList.map(c => c.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .in('id', userIds);
      const profMap = new Map((profiles || []).map((p: any) => [p.id, p.display_name || p.email]));
      commentList.forEach(c => { c.profile_name = profMap.get(c.user_id) || ''; });
    }
    setComments(commentList);
  }, []);

  const parseSections = (raw: unknown): QuoteSection[] => {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object' && 'sections' in raw) return (raw as any).sections ?? [];
    return [];
  };

  const openQuote = (quote: Quote) => {
    setSelectedQuote({ ...quote, sections_data: parseSections(quote.sections_data) });
    loadComments(quote.id);
  };

  const handleApprove = async () => {
    if (!selectedQuote || !user) return;
    setApproving(true);

    const { error: approvalErr } = await supabase.from('quote_approvals').insert({
      quote_id: selectedQuote.id,
      status: 'approved',
      approved_by_name: approvalName,
      scope_agreed: scopeAgreed,
      price_agreed: priceAgreed,
      terms_agreed: termsAgreed,
      ip_address: '',
      created_by: user.id,
    });

    if (approvalErr) {
      toast('Chyba při schvalování', 'error');
      setApproving(false);
      return;
    }

    await supabase
      .from('project_quotes')
      .update({ status: 'approved' })
      .eq('id', selectedQuote.id);

    await logAudit('quote', selectedQuote.id, 'approved', {
      approved_by_name: approvalName,
      quote_number: selectedQuote.quote_number,
    });

    toast('Nabídka schválena');
    setShowApproveModal(false);
    setApproving(false);
    setSelectedQuote({ ...selectedQuote, status: 'approved' });
    loadQuotes();
  };

  const handleReturn = async () => {
    if (!selectedQuote || !user) return;
    setReturning(true);

    await supabase.from('quote_approvals').insert({
      quote_id: selectedQuote.id,
      status: 'returned',
      return_reason: returnReason,
      created_by: user.id,
    });

    await supabase
      .from('project_quotes')
      .update({ status: 'returned' })
      .eq('id', selectedQuote.id);

    await logAudit('quote', selectedQuote.id, 'returned', {
      reason: returnReason,
      quote_number: selectedQuote.quote_number,
    });

    toast('Nabídka vrácena k úpravě');
    setShowReturnModal(false);
    setReturning(false);
    setReturnReason('');
    setSelectedQuote({ ...selectedQuote, status: 'returned' });
    loadQuotes();
  };

  const handleSendComment = async () => {
    if (!selectedQuote || !user || !commentText.trim()) return;
    setSendingComment(true);
    const { error } = await supabase.from('quote_comments').insert({
      quote_id: selectedQuote.id,
      user_id: user.id,
      content: commentText.trim(),
    });
    if (error) {
      toast('Chyba při odesílání', 'error');
    } else {
      await logAudit('quote', selectedQuote.id, 'comment_added', {
        quote_number: selectedQuote.quote_number,
      });
      setCommentText('');
      loadComments(selectedQuote.id);
    }
    setSendingComment(false);
  };

  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');
  const isApproved = selectedQuote?.status === 'approved';

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => <div key={i} className="h-20 bg-white/[0.06] rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (selectedQuote) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedQuote(null)}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-400 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Zpět na seznam
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/10 text-sm font-semibold text-slate-300 hover:bg-white/[0.04] transition"
            >
              <FileDown className="w-4 h-4" />
              Export PDF
            </button>
          </div>
          {!isApproved && selectedQuote.status !== 'returned' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowReturnModal(true)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-extrabold text-slate-300 hover:bg-white/[0.04] transition"
              >
                <span className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Vrátit k úpravě
                </span>
              </button>
              <button
                onClick={() => setShowApproveModal(true)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-extrabold hover:bg-emerald-700 transition "
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Schválit nabídku
                </span>
              </button>
            </div>
          )}
          {isApproved && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-200">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-extrabold text-emerald-400">Schváleno</span>
            </div>
          )}
          {selectedQuote.status === 'returned' && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-200">
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-extrabold text-amber-400">Vráceno k úpravě</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mb-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-sm font-extrabold text-blue-400">{selectedQuote.quote_number}</span>
          </span>
          <span className="text-xs text-slate-500">
            v{selectedQuote.version} &middot; {new Date(selectedQuote.created_at).toLocaleDateString('cs-CZ')}
          </span>
          <span className="text-sm font-extrabold text-white ml-auto">
            {fmt(selectedQuote.total_selling)} Kč
          </span>
        </div>

        <div className="space-y-4">
          {(selectedQuote.sections_data || []).map((section) => {
            const sectionTotal = (section.items || []).reduce((s, it) => s + it.quantity * it.sellingPrice, 0);
            return (
              <div key={section.id} className="rounded-xl border border-white/10 overflow-hidden">
                <div className="px-4 py-3 bg-white/[0.04] flex items-center justify-between">
                  <span className="text-sm font-extrabold text-white">{section.name}</span>
                  <span className="text-sm font-extrabold text-slate-400">{fmt(sectionTotal)} Kč</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-2 text-left font-semibold">Položka</th>
                      <th className="px-4 py-2 text-right font-semibold">Množství</th>
                      <th className="px-4 py-2 text-right font-semibold">Cena/ks</th>
                      <th className="px-4 py-2 text-right font-semibold">Celkem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(section.items || []).map((item) => (
                      <tr key={item.id} className="border-b border-white/[0.04] hover:bg-white/[0.04]">
                        <td className="px-4 py-2 font-medium text-slate-300">{item.name}</td>
                        <td className="px-4 py-2 text-right text-slate-400">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-400">{fmt(item.sellingPrice)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-white">
                          {fmt(item.quantity * item.sellingPrice)} Kč
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.06]">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-slate-400" />
              Komentáře
            </h3>
          </div>
          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                Zatím žádné komentáře
              </p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className={`flex ${c.user_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-3.5 py-2 ${
                    c.user_id === user?.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/[0.06] text-white'
                  }`}>
                    <p className="text-xs font-semibold mb-0.5 opacity-70">{c.profile_name}</p>
                    <p className="text-sm">{c.content}</p>
                    <p className="text-[10px] opacity-50 mt-1">
                      {new Date(c.created_at).toLocaleString('cs-CZ')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          {!isApproved && (
            <div className="px-4 py-3 border-t border-white/[0.06] flex items-center gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={`Napsat komentář\u2026`}
                className="flex-1 px-3 py-2 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendComment()}
              />
              <button
                onClick={handleSendComment}
                disabled={sendingComment || !commentText.trim()}
                className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
              >
                {sendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>

        <Modal
          open={showApproveModal}
          onClose={() => setShowApproveModal(false)}
          title={`Schválení nabídky`}
          size="sm"
          footer={
            <>
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition"
              >
                Zrušit
              </button>
              <button
                onClick={handleApprove}
                disabled={approving || !approvalName.trim() || !scopeAgreed || !priceAgreed || !termsAgreed}
                className="px-5 py-2 text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50"
              >
                {approving ? 'Schvaluji...' : `Potvrdit schválení`}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Jméno a příjmení *
              </label>
              <input
                value={approvalName}
                onChange={(e) => setApprovalName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                placeholder="Jan Novák"
              />
            </div>
            <div className="space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scopeAgreed}
                  onChange={(e) => setScopeAgreed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span className="text-sm text-slate-300">Souhlasím s rozsahem prací</span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={priceAgreed}
                  onChange={(e) => setPriceAgreed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span className="text-sm text-slate-300">Souhlasím s cenou</span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span className="text-sm text-slate-300">Souhlasím s termíny</span>
              </label>
            </div>
          </div>
        </Modal>

        <Modal
          open={showReturnModal}
          onClose={() => setShowReturnModal(false)}
          title={`Vrátit k úpravě`}
          size="sm"
          footer={
            <>
              <button
                onClick={() => setShowReturnModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition"
              >
                Zrušit
              </button>
              <button
                onClick={handleReturn}
                disabled={returning || !returnReason.trim()}
                className="px-5 py-2 text-sm font-extrabold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition disabled:opacity-50"
              >
                {returning ? 'Odesílám...' : 'Odeslat'}
              </button>
            </>
          }
        >
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Důvod / komentář *
            </label>
            <textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-none"
              placeholder={`Opište, co je třeba změnit\u2026`}
            />
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Nabídky</h3>
      {quotes.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Zatím žádné nabídky</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => {
            const statusColor = q.status === 'approved'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-200'
              : q.status === 'returned'
              ? 'bg-amber-500/10 text-amber-400 border-amber-200'
              : 'bg-white/[0.04] text-slate-400 border-white/10';
            const statusLabel = q.status === 'approved' ? 'Schváleno'
              : q.status === 'returned' ? 'Vráceno'
              : 'Nová';

            return (
              <button
                key={q.id}
                onClick={() => openQuote(q)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.06] p-4 text-left hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-sm font-extrabold text-blue-400">{q.quote_number}</span>
                    </span>
                    <span className="text-xs text-slate-500">v{q.version}</span>
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${statusColor}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-extrabold text-white">{fmt(q.total_selling)} Kč</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(q.created_at).toLocaleDateString('cs-CZ')}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
