import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, CheckCircle2, Circle, MessageSquare, Send,
  ChevronDown, ChevronRight, Loader2, ClipboardList, Clock,
  Paperclip, X, FileText, Image, Download, File,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';

interface Attachment {
  id: string;
  remark_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  content_type: string;
  uploaded_by_portal: boolean;
  created_at: string;
}

interface Remark {
  id: string;
  project_id: string;
  title: string;
  text: string;
  description: string;
  status: 'open' | 'resolved';
  created_by: string | null;
  created_by_portal: boolean;
  resolved_at: string | null;
  sort_order: number;
  created_at: string;
}

interface RemarkComment {
  id: string;
  remark_id: string;
  text: string;
  created_by: string | null;
  created_by_portal: boolean;
  created_at: string;
}

interface ProfileName {
  id: string;
  full_name: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return Image;
  if (contentType.includes('pdf')) return FileText;
  return File;
}

export default function PortalRemarksTab({ projectId, userId }: { projectId: string; userId: string }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [comments, setComments] = useState<Record<string, RemarkComment[]>>({});
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({});
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [adding, setAdding] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [sendingComment, setSendingComment] = useState<string | null>(null);

  const [uploadingAttachment, setUploadingAttachment] = useState<string | null>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [attachTarget, setAttachTarget] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const { data: remarksData } = await supabase
      .from('project_remarks')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order')
      .order('created_at', { ascending: true });

    const list = (remarksData || []) as Remark[];
    setRemarks(list);

    if (list.length > 0) {
      const remarkIds = list.map(r => r.id);

      const { data: commentsData } = await supabase
        .from('project_remark_comments')
        .select('*')
        .in('remark_id', remarkIds)
        .order('created_at', { ascending: true });

      const grouped: Record<string, RemarkComment[]> = {};
      for (const c of (commentsData || []) as RemarkComment[]) {
        if (!grouped[c.remark_id]) grouped[c.remark_id] = [];
        grouped[c.remark_id].push(c);
      }
      setComments(grouped);

      const { data: attachData } = await supabase
        .from('project_remark_attachments')
        .select('*')
        .in('remark_id', remarkIds)
        .order('created_at', { ascending: true });

      const attachGrouped: Record<string, Attachment[]> = {};
      for (const a of (attachData || []) as Attachment[]) {
        if (!attachGrouped[a.remark_id]) attachGrouped[a.remark_id] = [];
        attachGrouped[a.remark_id].push(a);
      }
      setAttachments(attachGrouped);

      const userIds = new Set<string>();
      list.forEach(r => { if (r.created_by) userIds.add(r.created_by); });
      (commentsData || []).forEach((c: RemarkComment) => { if (c.created_by) userIds.add(c.created_by); });

      if (userIds.size > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(userIds));
        const map: Record<string, string> = {};
        (profilesData || []).forEach((p: ProfileName) => { map[p.id] = p.full_name || ''; });
        setProfiles(map);
      }
    }

    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const uploadFile = async (file: File, remarkId: string): Promise<Attachment | null> => {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `remarks/${remarkId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('uploads')
      .upload(path, file, { contentType: file.type });

    if (uploadErr) return null;

    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);

    const { data: row, error: insertErr } = await supabase
      .from('project_remark_attachments')
      .insert({
        remark_id: remarkId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        content_type: file.type,
        uploaded_by: userId,
        uploaded_by_portal: true,
      })
      .select('*')
      .single();

    if (insertErr) return null;
    return row as Attachment;
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);

    const { data: remarkRow, error } = await supabase.from('project_remarks').insert({
      project_id: projectId,
      title: newTitle.trim(),
      text: newTitle.trim(),
      description: newDescription.trim(),
      created_by: userId,
      created_by_portal: true,
      sort_order: remarks.length,
    }).select('*').single();

    if (error || !remarkRow) {
      toast('Chyba při přidávání', 'error');
      setAdding(false);
      return;
    }

    if (pendingFiles.length > 0) {
      for (const file of pendingFiles) {
        await uploadFile(file, remarkRow.id);
      }
    }

    setNewTitle('');
    setNewDescription('');
    setPendingFiles([]);
    setShowForm(false);
    await loadData();
    setAdding(false);
  };

  const handleAttachToExisting = async (remarkId: string, files: FileList) => {
    setUploadingAttachment(remarkId);
    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files)) {
      const att = await uploadFile(file, remarkId);
      if (att) newAttachments.push(att);
    }
    if (newAttachments.length > 0) {
      setAttachments(prev => ({
        ...prev,
        [remarkId]: [...(prev[remarkId] || []), ...newAttachments],
      }));
    }
    setUploadingAttachment(null);
    setAttachTarget(null);
  };

  const handleSendComment = async (remarkId: string) => {
    const text = (commentTexts[remarkId] || '').trim();
    if (!text) return;
    setSendingComment(remarkId);
    const { data, error } = await supabase.from('project_remark_comments').insert({
      remark_id: remarkId,
      text,
      created_by: userId,
      created_by_portal: true,
    }).select('*').single();

    if (error) {
      toast('Chyba při odesílání', 'error');
    } else {
      setComments(prev => ({
        ...prev,
        [remarkId]: [...(prev[remarkId] || []), data as RemarkComment],
      }));
      setCommentTexts(prev => ({ ...prev, [remarkId]: '' }));
    }
    setSendingComment(null);
  };

  const getAuthorLabel = (createdBy: string | null, isPortal: boolean) => {
    if (isPortal) return 'Vy';
    if (createdBy && profiles[createdBy]) return profiles[createdBy];
    return 'Tým';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const openCount = remarks.filter(r => r.status === 'open').length;
  const resolvedCount = remarks.filter(r => r.status === 'resolved').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Celkem</div>
          <div className="text-xl font-extrabold text-white mt-1">{remarks.length}</div>
          <div className="text-xs text-slate-400 mt-0.5">připomínek</div>
        </div>
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Otevřených</div>
          <div className="text-xl font-extrabold text-amber-400 mt-1">{openCount}</div>
          <div className="text-xs text-slate-400 mt-0.5">čeká na vyřešení</div>
        </div>
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Vyřešených</div>
          <div className="text-xl font-extrabold text-emerald-400 mt-1">{resolvedCount}</div>
          <div className="text-xs text-slate-400 mt-0.5">dokončeno</div>
        </div>
      </div>

      {openCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-400">
              Máte {openCount} otevřených připomínek
            </p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              Tým na nich pracuje. Můžete přidat další nebo komentovat stávající.
            </p>
          </div>
        </div>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Nová připomínka
        </button>
      ) : (
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Nová připomínka</h3>
            <button onClick={() => { setShowForm(false); setNewTitle(''); setNewDescription(''); setPendingFiles([]); }} className="p-1 rounded-lg hover:bg-white/[0.06] text-slate-400 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název *</label>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Krátký popis připomínky..."
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/[0.06] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis (volitelně)</label>
            <textarea
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="Podrobnější popis co je potřeba změnit nebo opravit..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/[0.06] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Přílohy</label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => {
                if (e.target.files) {
                  setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/15 text-xs font-semibold text-slate-400 hover:text-blue-400 hover:border-blue-500/30 transition w-full justify-center"
            >
              <Paperclip className="w-3.5 h-3.5" />
              Přidat soubory (fotky, dokumenty...)
            </button>

            {pendingFiles.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {pendingFiles.map((file, i) => {
                  const Icon = getFileIcon(file.type);
                  return (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                      <Icon className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="text-xs text-slate-300 truncate flex-1">{file.name}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">{formatFileSize(file.size)}</span>
                      <button onClick={() => removePendingFile(i)} className="p-0.5 rounded hover:bg-white/[0.06] text-slate-500 hover:text-red-400 transition shrink-0">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={handleAdd}
            disabled={adding || !newTitle.trim()}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {adding ? 'Odesílám...' : 'Odeslat připomínku'}
          </button>
        </div>
      )}

      <input
        ref={attachInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files && attachTarget) {
            handleAttachToExisting(attachTarget, e.target.files);
            e.target.value = '';
          }
        }}
      />

      {remarks.length === 0 && !showForm ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-sm font-bold text-slate-400">Zatím žádné připomínky</p>
          <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
            Klikněte na tlačítko výše a přidejte svou první připomínku.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {remarks.map(remark => {
            const isExpanded = expandedId === remark.id;
            const remarkComments = comments[remark.id] || [];
            const remarkAttachments = attachments[remark.id] || [];
            const commentCount = remarkComments.length;
            const attachCount = remarkAttachments.length;
            const isResolved = remark.status === 'resolved';
            const displayTitle = remark.title || remark.text;

            return (
              <div
                key={remark.id}
                className={`bg-navy-800/60 rounded-xl border overflow-hidden transition-all ${
                  isResolved ? 'border-white/[0.05] opacity-70' : 'border-white/[0.10]'
                }`}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : remark.id)}
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.02] transition"
                >
                  <div className="mt-0.5 shrink-0">
                    {isResolved ? (
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                        <Circle className="w-4 h-4 text-amber-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold leading-relaxed ${
                      isResolved ? 'text-slate-500 line-through' : 'text-white'
                    }`}>
                      {displayTitle}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        remark.created_by_portal ? 'bg-blue-500/15 text-blue-400' : 'bg-white/[0.06] text-slate-400'
                      }`}>
                        {getAuthorLabel(remark.created_by, remark.created_by_portal)}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(remark.created_at).toLocaleDateString('cs-CZ')}
                      </span>
                      {commentCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                          <MessageSquare className="w-2.5 h-2.5" /> {commentCount}
                        </span>
                      )}
                      {attachCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-white/[0.06] px-1.5 py-0.5 rounded">
                          <Paperclip className="w-2.5 h-2.5" /> {attachCount}
                        </span>
                      )}
                      {isResolved && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                          Vyřešeno
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 mt-1">
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-slate-400" />
                      : <ChevronRight className="w-4 h-4 text-slate-400" />
                    }
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/[0.06] bg-white/[0.02] animate-fade-in">
                    <div className="p-4 space-y-4">
                      {remark.description && (
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Popis</div>
                          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{remark.description}</p>
                        </div>
                      )}

                      {remarkAttachments.length > 0 && (
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Přílohy</div>
                          <div className="space-y-1.5">
                            {remarkAttachments.map(att => {
                              const Icon = getFileIcon(att.content_type);
                              const isImage = att.content_type.startsWith('image/');
                              return (
                                <div key={att.id}>
                                  {isImage && (
                                    <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="block mb-1.5">
                                      <img src={att.file_url} alt={att.file_name} className="max-h-48 rounded-lg border border-white/[0.08] object-contain" />
                                    </a>
                                  )}
                                  <a
                                    href={att.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition group"
                                  >
                                    <Icon className="w-4 h-4 text-blue-400 shrink-0" />
                                    <span className="text-xs text-slate-300 truncate flex-1 group-hover:text-blue-400 transition">{att.file_name}</span>
                                    <span className="text-[10px] text-slate-500 shrink-0">{formatFileSize(att.file_size)}</span>
                                    <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttachTarget(remark.id);
                          attachInputRef.current?.click();
                        }}
                        disabled={uploadingAttachment === remark.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/10 text-xs font-semibold text-slate-400 hover:text-blue-400 hover:border-blue-500/30 transition"
                      >
                        {uploadingAttachment === remark.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Paperclip className="w-3.5 h-3.5" />
                        )}
                        {uploadingAttachment === remark.id ? 'Nahrávám...' : 'Přidat přílohu'}
                      </button>

                      <div className="border-t border-white/[0.06] pt-4">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                          Komentáře ({commentCount})
                        </div>
                        {remarkComments.length > 0 ? (
                          <div className="space-y-3 mb-3">
                            {remarkComments.map(c => (
                              <div key={c.id} className="flex gap-3">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                  c.created_by_portal ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                                }`}>
                                  {c.created_by_portal ? 'V' : (profiles[c.created_by || ''] || 'T').charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0 bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-slate-300">
                                      {getAuthorLabel(c.created_by, c.created_by_portal)}
                                    </span>
                                    <span className="text-[10px] text-slate-600">
                                      {new Date(c.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className="text-sm text-slate-300 leading-relaxed">{c.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 mb-3">Zatím žádné komentáře</p>
                        )}

                        <div className="flex gap-2">
                          <input
                            value={commentTexts[remark.id] || ''}
                            onChange={e => setCommentTexts(prev => ({ ...prev, [remark.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(remark.id); } }}
                            placeholder="Napsat komentář..."
                            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
                          />
                          <button
                            onClick={() => handleSendComment(remark.id)}
                            disabled={sendingComment === remark.id || !(commentTexts[remark.id] || '').trim()}
                            className="px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 shrink-0"
                          >
                            {sendingComment === remark.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Send className="w-4 h-4" />
                            }
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
