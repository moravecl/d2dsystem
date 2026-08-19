import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, CheckCircle2, Circle, MessageSquare, Send, Trash2,
  ChevronDown, ChevronRight, Loader2, AlertCircle, X,
  Paperclip, FileText, Image, Download, File,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
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
  resolved_by: string | null;
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

const STATUS_FILTER = [
  { key: 'all', label: 'Vše' },
  { key: 'open', label: 'Otevřené' },
  { key: 'resolved', label: 'Vyřešené' },
];

export default function ProjectRemarksTab({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [comments, setComments] = useState<Record<string, RemarkComment[]>>({});
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({});
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [adding, setAdding] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [sendingComment, setSendingComment] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState<string | null>(null);
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
      list.forEach(r => { if (r.created_by) userIds.add(r.created_by); if (r.resolved_by) userIds.add(r.resolved_by); });
      (commentsData || []).forEach((c: RemarkComment) => { if (c.created_by) userIds.add(c.created_by); });

      if (userIds.size > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(userIds));
        const map: Record<string, string> = {};
        (profilesData || []).forEach((p: ProfileName) => { map[p.id] = p.full_name || 'Neznámý'; });
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
        uploaded_by: user?.id,
        uploaded_by_portal: false,
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
      created_by: user?.id,
      created_by_portal: false,
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

  const toggleStatus = async (remark: Remark) => {
    const newStatus = remark.status === 'open' ? 'resolved' : 'open';
    const update: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === 'resolved') {
      update.resolved_at = new Date().toISOString();
      update.resolved_by = user?.id;
    } else {
      update.resolved_at = null;
      update.resolved_by = null;
    }
    await supabase.from('project_remarks').update(update).eq('id', remark.id);
    setRemarks(prev => prev.map(r =>
      r.id === remark.id ? { ...r, status: newStatus, resolved_at: update.resolved_at as string | null, resolved_by: update.resolved_by as string | null } : r
    ));
  };

  const deleteRemark = async (id: string) => {
    await supabase.from('project_remarks').delete().eq('id', id);
    setRemarks(prev => prev.filter(r => r.id !== id));
    const cCopy = { ...comments };
    delete cCopy[id];
    setComments(cCopy);
    const aCopy = { ...attachments };
    delete aCopy[id];
    setAttachments(aCopy);
  };

  const deleteAttachment = async (attachmentId: string, remarkId: string) => {
    await supabase.from('project_remark_attachments').delete().eq('id', attachmentId);
    setAttachments(prev => ({
      ...prev,
      [remarkId]: (prev[remarkId] || []).filter(a => a.id !== attachmentId),
    }));
  };

  const handleSendComment = async (remarkId: string) => {
    const text = (commentTexts[remarkId] || '').trim();
    if (!text) return;
    setSendingComment(remarkId);
    const { data, error } = await supabase.from('project_remark_comments').insert({
      remark_id: remarkId,
      text,
      created_by: user?.id,
      created_by_portal: false,
    }).select('*').single();

    if (error) {
      toast('Chyba při odesílání komentáře', 'error');
    } else {
      setComments(prev => ({
        ...prev,
        [remarkId]: [...(prev[remarkId] || []), data as RemarkComment],
      }));
      if (user?.id && !profiles[user.id]) {
        const { data: p } = await supabase.from('profiles').select('id, full_name').eq('id', user.id).maybeSingle();
        if (p) setProfiles(prev => ({ ...prev, [p.id]: p.full_name || 'Neznámý' }));
      }
      setCommentTexts(prev => ({ ...prev, [remarkId]: '' }));
    }
    setSendingComment(null);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const filtered = remarks.filter(r => filter === 'all' || r.status === filter);
  const openCount = remarks.filter(r => r.status === 'open').length;
  const resolvedCount = remarks.filter(r => r.status === 'resolved').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-amber-400">{openCount} otevřených</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">{resolvedCount} vyřešených</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {STATUS_FILTER.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 text-xs font-semibold transition ${
                  filter === f.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/[0.06]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Přidat
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white">Nová připomínka</h4>
            <button onClick={() => { setShowForm(false); setNewTitle(''); setNewDescription(''); setPendingFiles([]); }} className="p-1 rounded hover:bg-white/[0.06] text-slate-400 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Název připomínky..."
            className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
            autoFocus
          />
          <textarea
            value={newDescription}
            onChange={e => setNewDescription(e.target.value)}
            placeholder="Popis (volitelně)..."
            rows={2}
            className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition resize-none"
          />
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => {
            if (e.target.files) { setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value = ''; }
          }} />
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-white/10 text-xs font-semibold text-slate-400 hover:text-blue-400 hover:border-blue-500/30 transition">
              <Paperclip className="w-3 h-3" /> Přílohy
            </button>
            {pendingFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/[0.04] border border-white/[0.06] text-xs text-slate-300">
                <span className="truncate max-w-[120px]">{f.name}</span>
                <button onClick={() => removePendingFile(i)} className="text-slate-500 hover:text-red-400"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !newTitle.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Odeslat
          </button>
        </div>
      )}

      <input ref={attachInputRef} type="file" multiple className="hidden" onChange={e => {
        if (e.target.files && attachTarget) { handleAttachToExisting(attachTarget, e.target.files); e.target.value = ''; }
      }} />

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-400">
            {remarks.length === 0 ? 'Zatím žádné připomínky' : 'Žádné připomínky v tomto filtru'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(remark => {
            const isExpanded = expandedId === remark.id;
            const remarkComments = comments[remark.id] || [];
            const remarkAttachments = attachments[remark.id] || [];
            const commentCount = remarkComments.length;
            const attachCount = remarkAttachments.length;
            const displayTitle = remark.title || remark.text;

            return (
              <div
                key={remark.id}
                className={`rounded-xl border transition-all group ${
                  remark.status === 'resolved' ? 'bg-white/[0.02] border-white/[0.05]' : 'bg-white/[0.04] border-white/[0.08]'
                }`}
              >
                <div className="flex items-start gap-3 p-4">
                  <button onClick={() => toggleStatus(remark)} className="mt-0.5 shrink-0 transition-transform hover:scale-110">
                    {remark.status === 'resolved'
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      : <Circle className="w-5 h-5 text-slate-500 hover:text-blue-400 transition-colors" />
                    }
                  </button>

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : remark.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className={`text-sm font-semibold leading-relaxed ${
                      remark.status === 'resolved' ? 'text-slate-500 line-through' : 'text-white'
                    }`}>
                      {displayTitle}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] text-slate-500">
                      <span className={remark.created_by_portal ? 'text-amber-400 font-semibold' : ''}>
                        {remark.created_by_portal ? 'Klient' : (profiles[remark.created_by || ''] || 'Tým')}
                      </span>
                      <span>{new Date(remark.created_at).toLocaleDateString('cs-CZ')}</span>
                      {remark.description && <span className="text-slate-600">+ Popis</span>}
                      {commentCount > 0 && (
                        <span className="flex items-center gap-1 text-blue-400 font-semibold">
                          <MessageSquare className="w-2.5 h-2.5" /> {commentCount}
                        </span>
                      )}
                      {attachCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Paperclip className="w-2.5 h-2.5" /> {attachCount}
                        </span>
                      )}
                      {remark.status === 'resolved' && remark.resolved_at && (
                        <span className="text-emerald-500/70">
                          Vyřešeno {new Date(remark.resolved_at).toLocaleDateString('cs-CZ')}
                          {remark.resolved_by && profiles[remark.resolved_by] ? ` (${profiles[remark.resolved_by]})` : ''}
                        </span>
                      )}
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : remark.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-white/[0.06] transition"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => deleteRemark(remark.id)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-white/[0.06] px-4 py-3 space-y-4 animate-fade-in">
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
                                    <img src={att.file_url} alt={att.file_name} className="max-h-40 rounded-lg border border-white/[0.08] object-contain" />
                                  </a>
                                )}
                                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] group/att">
                                  <Icon className="w-4 h-4 text-blue-400 shrink-0" />
                                  <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-300 truncate flex-1 hover:text-blue-400 transition">{att.file_name}</a>
                                  <span className="text-[10px] text-slate-500 shrink-0">{formatFileSize(att.file_size)}</span>
                                  <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-400 transition shrink-0"><Download className="w-3.5 h-3.5" /></a>
                                  <button onClick={() => deleteAttachment(att.id, remark.id)} className="text-slate-600 hover:text-red-400 transition shrink-0 opacity-0 group-hover/att:opacity-100"><Trash2 className="w-3 h-3" /></button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => { setAttachTarget(remark.id); attachInputRef.current?.click(); }}
                      disabled={uploadingAttachment === remark.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-white/10 text-xs font-semibold text-slate-400 hover:text-blue-400 hover:border-blue-500/30 transition"
                    >
                      {uploadingAttachment === remark.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
                      {uploadingAttachment === remark.id ? 'Nahrávám...' : 'Přidat přílohu'}
                    </button>

                    <div className="border-t border-white/[0.06] pt-3">
                      {remarkComments.length > 0 && (
                        <div className="space-y-2.5 pl-8 mb-3">
                          {remarkComments.map(c => (
                            <div key={c.id} className="flex gap-2.5">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                c.created_by_portal ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                              }`}>
                                {c.created_by_portal ? 'K' : (profiles[c.created_by || ''] || 'T').charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-slate-300">
                                    {c.created_by_portal ? 'Klient' : (profiles[c.created_by || ''] || 'Tým')}
                                  </span>
                                  <span className="text-[10px] text-slate-600">
                                    {new Date(c.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">{c.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2 pl-8">
                        <input
                          value={commentTexts[remark.id] || ''}
                          onChange={e => setCommentTexts(prev => ({ ...prev, [remark.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(remark.id); } }}
                          placeholder="Napsat komentář..."
                          className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition"
                        />
                        <button
                          onClick={() => handleSendComment(remark.id)}
                          disabled={sendingComment === remark.id || !(commentTexts[remark.id] || '').trim()}
                          className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40"
                        >
                          {sendingComment === remark.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
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
