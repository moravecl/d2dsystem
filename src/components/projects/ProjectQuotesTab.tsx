import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Plus, Clock, User as UserIcon, MessageSquare, GitBranch,
  Trash2, ChevronDown, ChevronUp, CheckCircle2, RotateCcw, Shield, Loader2,
  History, Send as SendIcon, Eye, Package, Sun, Camera, ExternalLink, ShieldAlert,
  Lock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import { logAudit } from '../../lib/auditLog';
import Modal from '../ui/Modal';
import type { Profile } from '../../types/database';
import QuoteCommentsPanel from './QuoteCommentsPanel';
import QuoteDetailView from './QuoteDetailView';
import { exportSupplierQuoteXLS, getAvailableTrades } from './supplierQuoteExport';
import type { QuoteSection, QuoteAttachment, QuoteSystemSummary } from '../catalog/quoteHelpers';
import { useNavigate } from 'react-router-dom';

interface SavedQuote {
  id: string;
  version: number;
  quote_number: string;
  note: string;
  changelog: string;
  total_selling: number;
  total_cost: number;
  status: string;
  presented_to_client: boolean;
  presented_at: string | null;
  created_by: string | null;
  created_at: string;
  source_type: string | null;
  source_metadata: Record<string, unknown> | null;
  attachments: { images?: QuoteAttachment[]; summaries?: QuoteSystemSummary[] } | null;
}

interface Approval {
  id: string;
  quote_id: string;
  status: string;
  approved_by_name: string;
  return_reason: string;
  approved_by_admin: boolean;
  admin_note: string;
  created_by: string | null;
  created_at: string;
}

interface Props {
  projectId: string;
  profiles: Profile[];
  onNewQuote: () => void;
  onOpenQuote: (quoteId: string) => void;
  refreshTrigger: number;
}

export default function ProjectQuotesTab({ projectId, profiles, onNewQuote, onOpenQuote, refreshTrigger }: Props) {
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [approvals, setApprovals] = useState<Record<string, Approval[]>>({});
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveQuote, setApproveQuote] = useState<SavedQuote | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [approving, setApproving] = useState(false);

  const [showPresentModal, setShowPresentModal] = useState(false);
  const [presentQuote, setPresentQuote] = useState<SavedQuote | null>(null);
  const [presenting, setPresenting] = useState(false);

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierQuote, setSupplierQuote] = useState<SavedQuote | null>(null);
  const [availableTrades, setAvailableTrades] = useState<string[]>([]);
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [linkedQuoteIds, setLinkedQuoteIds] = useState<Set<string>>(new Set());

  const loadQuotes = useCallback(async () => {
    const { data } = await supabase
      .from('project_quotes')
      .select('id, version, quote_number, note, changelog, total_selling, total_cost, status, presented_to_client, presented_at, created_by, created_at, source_type, source_metadata, attachments')
      .eq('project_id', projectId)
      .order('version', { ascending: false });
    setQuotes((data || []) as SavedQuote[]);
    setLoading(false);
  }, [projectId]);

  const loadCommentCounts = useCallback(async (quoteIds: string[]) => {
    if (quoteIds.length === 0) return;
    const { data } = await supabase
      .from('quote_comments')
      .select('quote_id')
      .in('quote_id', quoteIds);
    const counts: Record<string, number> = {};
    (data || []).forEach((r: any) => {
      counts[r.quote_id] = (counts[r.quote_id] || 0) + 1;
    });
    setCommentCounts(counts);
  }, []);

  const loadApprovals = useCallback(async (quoteIds: string[]) => {
    if (quoteIds.length === 0) return;
    const { data } = await supabase
      .from('quote_approvals')
      .select('*')
      .in('quote_id', quoteIds)
      .order('created_at', { ascending: false });
    const map: Record<string, Approval[]> = {};
    (data || []).forEach((a: any) => {
      if (!map[a.quote_id]) map[a.quote_id] = [];
      map[a.quote_id].push(a as Approval);
    });
    setApprovals(map);
  }, []);

  useEffect(() => { loadQuotes(); }, [loadQuotes, refreshTrigger]);

  useEffect(() => {
    supabase.from('jobs').select('quote_id, included_quote_ids').eq('project_id', projectId)
      .then(({ data }) => {
        const ids = new Set<string>();
        for (const job of (data || [])) {
          if (job.quote_id) ids.add(job.quote_id);
          if (Array.isArray(job.included_quote_ids)) {
            for (const qid of job.included_quote_ids) { if (qid) ids.add(qid); }
          }
        }
        setLinkedQuoteIds(ids);
      });
  }, [projectId, quotes]);

  useEffect(() => {
    if (quotes.length > 0) {
      const ids = quotes.map(q => q.id);
      loadCommentCounts(ids);
      loadApprovals(ids);
    }
  }, [quotes, loadCommentCounts, loadApprovals]);

  const getProfileName = (userId: string | null) => {
    if (!userId) return '';
    const p = profiles.find(pr => pr.id === userId);
    return p?.display_name || p?.email || '';
  };

  const handleDelete = async (quote: SavedQuote) => {
    if (linkedQuoteIds.has(quote.id)) {
      toast('Tato nabídka je napojena na aktivní zakázku. Nejprve ji odpojte z realizace.', 'error');
      return;
    }
    if (!confirm(`Smazat nabídku ${quote.quote_number}?`)) return;
    const { error } = await supabase.from('project_quotes').delete().eq('id', quote.id);
    if (error) {
      toast('Chyba', 'error');
      return;
    }
    toast('Nabídka smazána');
    loadQuotes();
  };

  const handlePresent = async () => {
    if (!presentQuote || !user) return;
    setPresenting(true);
    const { error } = await supabase
      .from('project_quotes')
      .update({
        presented_to_client: true,
        presented_at: new Date().toISOString(),
        status: presentQuote.status === 'new' || !presentQuote.status ? 'presented' : presentQuote.status,
      })
      .eq('id', presentQuote.id);

    if (error) {
      toast('Chyba', 'error');
      setPresenting(false);
      return;
    }

    await logAudit('quote', presentQuote.id, 'presented_to_client', {
      quote_number: presentQuote.quote_number,
    });

    toast('Nabídka předložena klientovi');
    setShowPresentModal(false);
    setPresentQuote(null);
    setPresenting(false);
    loadQuotes();
  };

  const handleAdminApprove = async () => {
    if (!approveQuote || !user) return;
    setApproving(true);

    const { error: approvalErr } = await supabase.from('quote_approvals').insert({
      quote_id: approveQuote.id,
      status: 'approved',
      approved_by_name: getProfileName(user.id) || 'Admin',
      approved_by_admin: true,
      admin_note: adminNote || 'Schváleno adminem bez klienta',
      scope_agreed: true,
      price_agreed: true,
      terms_agreed: true,
      created_by: user.id,
    });

    if (approvalErr) {
      toast('Chyba', 'error');
      setApproving(false);
      return;
    }

    await supabase
      .from('project_quotes')
      .update({ status: 'approved' })
      .eq('id', approveQuote.id);

    await logAudit('quote', approveQuote.id, 'admin_approved', {
      quote_number: approveQuote.quote_number,
      admin_note: adminNote,
    });

    toast('Nabídka schválena');
    setShowApproveModal(false);
    setAdminNote('');
    setApproveQuote(null);
    setApproving(false);
    loadQuotes();
  };

  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

  const statusBadge = (quote: SavedQuote) => {
    const { status, presented_to_client } = quote;
    if (status === 'approved') return (
      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-2.5 h-2.5" /> Schváleno
      </span>
    );
    if (status === 'returned') return (
      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
        <RotateCcw className="w-2.5 h-2.5" /> Vráceno
      </span>
    );
    if (presented_to_client || status === 'presented') return (
      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
        <Eye className="w-2.5 h-2.5" /> Předloženo
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-slate-400 bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 rounded-full">
        Rozpracovaná
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => <div key={i} className="h-20 bg-navy-900/50 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Nabídky</h3>
          <p className="text-xs text-slate-400 mt-1">Cenové nabídky vytvořené z návrhu projektu</p>
        </div>
        <button
          onClick={onNewQuote}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2.5 rounded-xl font-extrabold hover:from-blue-500 hover:to-blue-600 transition-all shadow-blue-600/20 text-sm"
        >
          <Plus className="w-4 h-4" /> Nová nabídka
        </button>
      </div>

      {quotes.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-white/[0.08] rounded-xl">
          <FileText className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">Zatím žádné nabídky</p>
          <p className="text-xs text-slate-500 mt-1">Klikněte na "Nová nabídka" pro vytvoření</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((quote) => {
            const date = new Date(quote.created_at);
            const dateStr = date.toLocaleDateString('cs-CZ');
            const timeStr = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
            const authorName = getProfileName(quote.created_by);
            const profit = quote.total_selling - quote.total_cost;
            const margin = quote.total_selling > 0 ? (profit / quote.total_selling) * 100 : 0;
            const quoteApprovals = approvals[quote.id] || [];
            const canApprove = quote.status !== 'approved';
            const canPresent = !quote.presented_to_client && quote.status !== 'approved';

            const quoteSummaries = (quote.attachments?.summaries ?? []) as QuoteSystemSummary[];
            const quoteImages = (quote.attachments?.images ?? []) as QuoteAttachment[];
            const thumbnails = quoteImages.filter(a =>
              (a.imageData?.startsWith('http') || a.imageData?.startsWith('data:'))
            ).slice(0, 3);
            const sourceMeta = quote.source_metadata as Record<string, unknown> | null;

            return (
              <div
                key={quote.id}
                className="rounded-xl border border-white/[0.08] bg-navy-800/60 backdrop-blur-sm hover:shadow-black/20 transition-all duration-200 overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => onOpenQuote(quote.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <FileText className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-sm font-extrabold text-blue-400">{quote.quote_number}</span>
                        </span>
                        <span className="text-xs font-semibold text-slate-500">v{quote.version}</span>
                        {statusBadge(quote)}
                        {quote.source_type === 'fve' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                            <Sun className="w-2.5 h-2.5" /> FVE
                          </span>
                        )}
                        {quote.source_type === 'camera' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full">
                            <Camera className="w-2.5 h-2.5" /> Kamery
                          </span>
                        )}
                        {quote.source_type === 'eps' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                            <ShieldAlert className="w-2.5 h-2.5" /> EPS
                          </span>
                        )}
                        {quote.source_type === 'mixed' && (
                          <>
                            {(sourceMeta as any)?.fvDesignId && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                                <Sun className="w-2.5 h-2.5" /> FVE
                              </span>
                            )}
                            {(sourceMeta as any)?.cameraDesignId && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full">
                                <Camera className="w-2.5 h-2.5" /> Kamery
                              </span>
                            )}
                            {(sourceMeta as any)?.epsDesignId && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                                <ShieldAlert className="w-2.5 h-2.5" /> EPS
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {dateStr} {timeStr}
                        </span>
                        {authorName && (
                          <span className="flex items-center gap-1">
                            <UserIcon className="w-3 h-3" />
                            {authorName}
                          </span>
                        )}
                        {quote.presented_at && (
                          <span className="flex items-center gap-1 text-blue-400">
                            <SendIcon className="w-3 h-3" />
                            Předloženo {new Date(quote.presented_at).toLocaleDateString('cs-CZ')}
                          </span>
                        )}
                      </div>

                      {quoteSummaries.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {quoteSummaries.map((summary, sIdx) => {
                            const colorMap: Record<string, { bg: string; border: string; text: string; icon: typeof Sun }> = {
                              fve: { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.2)', text: 'text-orange-400', icon: Sun },
                              camera: { bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.2)', text: 'text-sky-400', icon: Camera },
                              eps: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', text: 'text-red-400', icon: ShieldAlert },
                            };
                            const c = colorMap[summary.type] || colorMap.camera;
                            const SummaryIcon = c.icon;
                            const entries = Object.entries(summary.data || {}).slice(0, 6);
                            return (
                              <div key={sIdx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px]"
                                style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                                <SummaryIcon className={`w-3 h-3 ${c.text} shrink-0`} />
                                <div className="flex items-center gap-2 flex-wrap">
                                  {entries.map(([key, val]) => (
                                    <span key={key} className="font-semibold text-slate-300">
                                      <span className="text-slate-500 font-normal">{key}: </span>{val}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {thumbnails.length > 0 && (
                        <div className="mt-2 flex items-center gap-1.5">
                          {thumbnails.map((thumb) => (
                            <div key={thumb.id} className="w-14 h-10 rounded-lg overflow-hidden border border-white/[0.08] shrink-0">
                              <img src={thumb.imageData} alt={thumb.label} className="w-full h-full object-cover" />
                            </div>
                          ))}
                          {quoteImages.length > 3 && (
                            <span className="text-[10px] text-slate-500 font-semibold ml-1">
                              +{quoteImages.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {quote.note && (
                        <div className="mt-2 flex items-start gap-1.5">
                          <MessageSquare className="w-3 h-3 text-slate-500 mt-0.5 shrink-0" />
                          <p className="text-xs text-slate-400">{quote.note}</p>
                        </div>
                      )}

                      {quote.changelog && (
                        <div className="mt-1.5 flex items-start gap-1.5">
                          <GitBranch className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                          <p className="text-xs text-amber-400">{quote.changelog}</p>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 text-right space-y-2">
                      <div className="text-lg font-extrabold text-white">
                        {fmt(quote.total_selling)} Kč
                      </div>
                      <div className="text-xs text-blue-400 font-semibold">
                        Zisk: {fmt(profit)} Kč ({margin.toFixed(1)}%)
                      </div>
                      <div className="flex items-center gap-1.5 justify-end">
                        {canPresent && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPresentQuote(quote);
                              setShowPresentModal(true);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-extrabold hover:bg-blue-500/10 transition"
                          >
                            <SendIcon className="w-3 h-3" /> Předložit
                          </button>
                        )}
                        {canApprove && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setApproveQuote(quote);
                              setShowApproveModal(true);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-extrabold hover:bg-emerald-700 transition"
                          >
                            <Shield className="w-3 h-3" /> Schválit
                          </button>
                        )}
                      </div>
                      {sourceMeta && (
                        <div className="flex items-center gap-1.5 justify-end mt-1">
                          {((sourceMeta as any).fvDesignId || quote.source_type === 'fve') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/projekty/${projectId}/fv-navrh`);
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-extrabold text-orange-400 bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition"
                              title="Otevřít FVE konfigurátor"
                            >
                              <ExternalLink className="w-2.5 h-2.5" /> FVE návrhář
                            </button>
                          )}
                          {((sourceMeta as any).cameraDesignId || quote.source_type === 'camera') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/projekty/${projectId}/kamerovy-system`);
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-extrabold text-sky-400 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 transition"
                              title="Otevřít kamerový konfigurátor"
                            >
                              <ExternalLink className="w-2.5 h-2.5" /> Kamery návrhář
                            </button>
                          )}
                          {((sourceMeta as any).epsDesignId || quote.source_type === 'eps') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/projekty/${projectId}/eps-navrh`);
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-extrabold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition"
                              title="Otevřít EPS konfigurátor"
                            >
                              <ExternalLink className="w-2.5 h-2.5" /> EPS návrhář
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-4 py-2 border-t border-white/[0.06] bg-white/[0.04] flex items-center gap-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedDetail(expandedDetail === quote.id ? null : quote.id);
                      if (expandedComments === quote.id) setExpandedComments(null);
                      if (expandedHistory === quote.id) setExpandedHistory(null);
                    }}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition font-semibold"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Soupis
                    {expandedDetail === quote.id
                      ? <ChevronUp className="w-3 h-3" />
                      : <ChevronDown className="w-3 h-3" />
                    }
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedComments(expandedComments === quote.id ? null : quote.id);
                      if (expandedHistory === quote.id) setExpandedHistory(null);
                      if (expandedDetail === quote.id) setExpandedDetail(null);
                    }}
                    className="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1.5 transition font-semibold"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Komentáře
                    {(commentCounts[quote.id] || 0) > 0 && (
                      <span className="bg-blue-500/20 text-blue-400 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                        {commentCounts[quote.id]}
                      </span>
                    )}
                    {expandedComments === quote.id
                      ? <ChevronUp className="w-3 h-3" />
                      : <ChevronDown className="w-3 h-3" />
                    }
                  </button>

                  {quoteApprovals.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedHistory(expandedHistory === quote.id ? null : quote.id);
                        if (expandedComments === quote.id) setExpandedComments(null);
                      }}
                      className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition font-semibold"
                    >
                      <History className="w-3.5 h-3.5" />
                      Historie
                      <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                        {quoteApprovals.length}
                      </span>
                      {expandedHistory === quote.id
                        ? <ChevronUp className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />
                      }
                    </button>
                  )}

                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const { data } = await supabase
                        .from('project_quotes')
                        .select('sections_data')
                        .eq('id', quote.id)
                        .single();
                      if (data?.sections_data) {
                        const sections = (Array.isArray(data.sections_data) ? data.sections_data : []) as QuoteSection[];
                        const trades = getAvailableTrades(sections);
                        setAvailableTrades(trades);
                        setSelectedTrades([]);
                        setSupplierQuote(quote);
                        setShowSupplierModal(true);
                      }
                    }}
                    className="text-xs text-slate-400 hover:text-purple-400 flex items-center gap-1.5 transition font-semibold"
                  >
                    <Package className="w-3.5 h-3.5" />
                    Poptávka
                  </button>

                  <div className="ml-auto flex items-center gap-2">
                    {linkedQuoteIds.has(quote.id) && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-slate-500 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded-full">
                        <Lock className="w-2.5 h-2.5" /> Napojena
                      </span>
                    )}
                    {quote.created_by === user?.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(quote); }}
                        disabled={linkedQuoteIds.has(quote.id)}
                        className={`text-xs flex items-center gap-1 transition ${
                          linkedQuoteIds.has(quote.id)
                            ? 'text-slate-600 cursor-not-allowed'
                            : 'text-slate-500 hover:text-red-400'
                        }`}
                        title={linkedQuoteIds.has(quote.id) ? 'Nelze smazat - napojeno na zakázku' : 'Smazat nabídku'}
                      >
                        <Trash2 className="w-3 h-3" /> Smazat
                      </button>
                    )}
                  </div>
                </div>

                {expandedDetail === quote.id && (
                  <QuoteDetailView quoteId={quote.id} />
                )}

                {expandedComments === quote.id && (
                  <QuoteCommentsPanel quoteId={quote.id} />
                )}

                {expandedHistory === quote.id && (
                  <div className="border-t border-white/[0.06] p-3 space-y-2">
                    {quoteApprovals.map((a) => (
                      <div key={a.id} className={`rounded-lg px-3 py-2 text-xs ${
 a.status === 'approved'
 ? 'bg-emerald-500/10 border border-emerald-500/20'
 : 'bg-amber-500/10 border border-amber-500/20'
 }`}>
                        <div className="flex items-center gap-2 mb-1">
                          {a.status === 'approved' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          <span className="font-extrabold text-white">
                            {a.status === 'approved' ? 'Schváleno' : 'Vráceno'}
                          </span>
                          {a.approved_by_admin && (
                            <span className="text-[9px] font-extrabold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
                              Admin
                            </span>
                          )}
                          <span className="text-slate-500 ml-auto">
                            {new Date(a.created_at).toLocaleString('cs-CZ')}
                          </span>
                        </div>
                        {a.approved_by_name && (
                          <p className="text-slate-400">Schválil: {a.approved_by_name}</p>
                        )}
                        {a.admin_note && (
                          <p className="text-blue-400 mt-0.5">{a.admin_note}</p>
                        )}
                        {a.return_reason && (
                          <p className="text-amber-400 mt-0.5">Důvod: {a.return_reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={showPresentModal}
        onClose={() => { setShowPresentModal(false); setPresentQuote(null); }}
        title="Předložit nabídku klientovi"
        size="sm"
        footer={
          <>
            <button
              onClick={() => { setShowPresentModal(false); setPresentQuote(null); }}
              className="px-4 py-2 text-sm text-slate-400 hover:bg-white/[0.07] rounded-lg transition"
            >
              Zrušit
            </button>
            <button
              onClick={handlePresent}
              disabled={presenting}
              className="px-5 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-500/10 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {presenting && <Loader2 className="w-4 h-4 animate-spin" />}
              Předložit
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
            <p className="text-xs text-blue-300 font-semibold">
              Po předložení bude nabídka viditelná klientovi v jeho portálu. Klient ji bude moci schválit nebo vrátit s komentářem.
            </p>
          </div>
          {presentQuote && (
            <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] p-3">
              <p className="text-sm font-extrabold text-white">{presentQuote.quote_number}</p>
              <p className="text-xs text-slate-400 mt-0.5">{fmt(presentQuote.total_selling)} Kč</p>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={showApproveModal}
        onClose={() => { setShowApproveModal(false); setApproveQuote(null); }}
        title="Schválit nabídku (admin)"
        size="sm"
        footer={
          <>
            <button
              onClick={() => { setShowApproveModal(false); setApproveQuote(null); }}
              className="px-4 py-2 text-sm text-slate-400 hover:bg-white/[0.07] rounded-lg transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleAdminApprove}
              disabled={approving}
              className="px-5 py-2 text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {approving && <Loader2 className="w-4 h-4 animate-spin" />}
              Schválit
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
            <p className="text-xs text-amber-300 font-semibold">
              Toto schválení bude označeno jako provedené adminem bez podpisu klienta.
            </p>
          </div>
          {approveQuote && (
            <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] p-3">
              <p className="text-sm font-extrabold text-white">{approveQuote.quote_number}</p>
              <p className="text-xs text-slate-400 mt-0.5">{fmt(approveQuote.total_selling)} Kč</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Poznámka (volitelně)
            </label>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={3}
              placeholder={'Např. "Schváleno na základě telefonického souhlasu klienta"'}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={showSupplierModal}
        onClose={() => { setShowSupplierModal(false); setSupplierQuote(null); setSelectedTrades([]); }}
        title="Poptávka dodavatele"
        size="sm"
        footer={
          <>
            <button
              onClick={() => { setShowSupplierModal(false); setSupplierQuote(null); setSelectedTrades([]); }}
              className="px-4 py-2 text-sm text-slate-400 hover:bg-white/[0.07] rounded-lg transition"
            >
              Zrušit
            </button>
            <button
              onClick={async () => {
                if (!supplierQuote || selectedTrades.length === 0) return;
                const { data: projectData } = await supabase
                  .from('projects')
                  .select('name, client_name')
                  .eq('id', projectId)
                  .single();
                const { data: quoteData } = await supabase
                  .from('project_quotes')
                  .select('sections_data')
                  .eq('id', supplierQuote.id)
                  .single();
                if (projectData && quoteData?.sections_data) {
                  const sections = (Array.isArray(quoteData.sections_data) ? quoteData.sections_data : []) as QuoteSection[];
                  exportSupplierQuoteXLS({
                    sections,
                    trades: selectedTrades,
                    projectName: projectData.name,
                    clientName: projectData.client_name || 'Klient',
                    quoteNumber: supplierQuote.quote_number,
                  });
                  toast('Export dokončen', 'success');
                  setShowSupplierModal(false);
                  setSupplierQuote(null);
                  setSelectedTrades([]);
                }
              }}
              disabled={selectedTrades.length === 0}
              className="px-5 py-2 text-sm font-extrabold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition disabled:opacity-50"
            >
              Exportovat XLS
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3">
            <p className="text-xs text-purple-300 font-semibold">
              Vyberte obory, pro které chcete vytvořit poptávku dodavatele. Export bude obsahovat seznam materiálů a zařízení z vybrané nabídky.
            </p>
          </div>
          {supplierQuote && (
            <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] p-3">
              <p className="text-sm font-extrabold text-white">{supplierQuote.quote_number}</p>
              <p className="text-xs text-slate-400 mt-0.5">{fmt(supplierQuote.total_selling)} Kč</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">
              Vyberte obory
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTrades.includes('Vše')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTrades(['Vše']);
                    } else {
                      setSelectedTrades([]);
                    }
                  }}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-slate-300 font-medium">Všechny obory</span>
              </label>
              {availableTrades.map(trade => (
                <label key={trade} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTrades.includes(trade) || selectedTrades.includes('Vše')}
                    disabled={selectedTrades.includes('Vše')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTrades([...selectedTrades.filter(t => t !== 'Vše'), trade]);
                      } else {
                        setSelectedTrades(selectedTrades.filter(t => t !== trade));
                      }
                    }}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 disabled:opacity-50"
                  />
                  <span className="text-sm text-slate-300">{trade}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
