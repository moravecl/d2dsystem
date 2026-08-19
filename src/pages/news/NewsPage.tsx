import { useEffect, useState } from 'react';
import {
  Newspaper, Plus, Search, Pin, Pencil, Trash2, MessageCircle,
  Send, ChevronDown, Filter, FileText, Download, Image as ImageIcon, Maximize2, X,
} from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import NewsPostModal, { CATEGORIES } from './NewsPostModal';
import type { Attachment } from './NewsPostModal';

interface NewsPost {
  id: string;
  title: string;
  content: string;
  category: string;
  is_pinned: boolean;
  author_id: string | null;
  publish_date: string;
  created_at: string;
  image_url: string;
  attachments: Attachment[];
}

interface Comment {
  id: string;
  news_post_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
}

interface ProfileRef {
  id: string;
  display_name: string | null;
  email: string;
}

export default function NewsPage() {
  const { setConfig } = useHeader();
  const { user, isAdmin } = useAuth();
  const { isManager } = useOrganization();
  const { toast } = useToast();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<ProfileRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editPost, setEditPost] = useState<any>(null);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => { setConfig({ breadcrumbs: [{ label: 'Nástěnka' }] }); }, [setConfig]);

  const load = async () => {
    const [postsRes, commentsRes, profRes] = await Promise.all([
      supabase.from('news_posts').select('*').eq('is_published', true).order('is_pinned', { ascending: false }).order('publish_date', { ascending: false }),
      supabase.from('news_comments').select('*').order('created_at', { ascending: true }),
      supabase.from('profiles').select('id, display_name, email'),
    ]);
    setPosts((postsRes.data || []) as NewsPost[]);
    setComments((commentsRes.data || []) as Comment[]);
    setProfiles((profRes.data || []) as ProfileRef[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const canWrite = isAdmin || isManager;
  const getProfileName = (id: string | null) => {
    if (!id) return 'Neznámý';
    const p = profiles.find(pr => pr.id === id);
    return p?.display_name || p?.email || 'Neznámý';
  };
  const getInitial = (id: string | null) => getProfileName(id)[0]?.toUpperCase() || '?';
  const getCatInfo = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];
  const getPostComments = (postId: string) => comments.filter(c => c.news_post_id === postId);

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat tento příspěvek?')) return;
    const { error } = await supabase.from('news_posts').delete().eq('id', id);
    if (error) { toast('Chyba', 'error'); return; }
    toast('Příspěvek smazán');
    load();
  };

  const handleEdit = (post: NewsPost) => {
    setEditPost({
      id: post.id,
      title: post.title,
      content: post.content,
      category: post.category,
      is_pinned: post.is_pinned,
      is_published: true,
      image_url: post.image_url || '',
      attachments: Array.isArray(post.attachments) ? post.attachments : [],
    });
    setShowModal(true);
  };

  const handleAddComment = async (postId: string) => {
    const text = commentText[postId]?.trim();
    if (!text) return;
    const { error } = await supabase.from('news_comments').insert({
      news_post_id: postId,
      author_id: user?.id,
      content: text,
    });
    if (error) { toast('Chyba při přidávání komentáře', 'error'); return; }
    setCommentText(prev => ({ ...prev, [postId]: '' }));
    load();
  };

  const handleDeleteComment = async (id: string) => {
    await supabase.from('news_comments').delete().eq('id', id);
    load();
  };

  const filtered = posts.filter(p => {
    if (filterCat && p.category !== filterCat) return false;
    if (search) {
      const s = search.toLowerCase();
      return p.title.toLowerCase().includes(s) || p.content.toLowerCase().includes(s);
    }
    return true;
  });

  const timeSince = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'právě teď';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `před ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `před ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `před ${days}d`;
    return new Date(date).toLocaleDateString('cs-CZ');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat příspěvky..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div className="relative">
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="appearance-none pl-8 pr-8 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white/[0.06]">
              <option value="">Všechny kategorie</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>
        {canWrite && (
          <button onClick={() => { setEditPost(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">
            <Plus className="w-4 h-4" /> Nový příspěvek
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-16 text-center">
          <Newspaper className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-400 mb-1">Žádné příspěvky</h3>
          <p className="text-sm text-slate-400 mb-4">Nástěnka je zatím prázdná</p>
          {canWrite && (
            <button onClick={() => { setEditPost(null); setShowModal(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition">
              <Plus className="w-4 h-4" /> Nový příspěvek
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(post => {
            const catInfo = getCatInfo(post.category);
            const postComments = getPostComments(post.id);
            const isExpanded = expandedPost === post.id;

            return (
              <div key={post.id} className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden  hover:shadow-slate-100 transition-all duration-200">
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-lg shadow-blue-500/20">
                      {getInitial(post.author_id)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">{getProfileName(post.author_id)}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${catInfo.color}`}>{catInfo.label}</span>
                        {post.is_pinned && <Pin className="w-3 h-3 text-amber-500" />}
                        <span className="text-[10px] text-slate-400 ml-auto">{timeSince(post.created_at)}</span>
                      </div>
                      <h3 className="text-base font-bold text-white mt-1">{post.title}</h3>
                    </div>
                    {(post.author_id === user?.id || isAdmin) && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleEdit(post)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-slate-400 transition">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(post.id)} className="p-1.5 rounded-lg hover:bg-red-500/100/10 text-slate-400 hover:text-red-500 transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  {post.image_url && (
                    <div className="ml-[52px] mb-3 relative group/img rounded-xl overflow-hidden border border-white/[0.06] cursor-pointer"
                      onClick={() => setLightboxUrl(post.image_url)}>
                      <img
                        src={post.image_url}
                        alt={post.title}
                        className="w-full max-h-80 object-cover transition-transform duration-300 group-hover/img:scale-[1.02]"
                        onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                        <div className="p-2 rounded-full bg-white/[0.06]/80 shadow-lg opacity-0 group-hover/img:opacity-100 transition-opacity">
                          <Maximize2 className="w-4 h-4 text-slate-300" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap ml-[52px]">
                    {post.content}
                  </div>

                  {Array.isArray(post.attachments) && post.attachments.length > 0 && (
                    <div className="ml-[52px] mt-3 flex flex-wrap gap-2">
                      {post.attachments.map((att: Attachment, idx: number) => {
                        const isImage = att.mime_type?.startsWith('image/');
                        return isImage ? (
                          <button
                            key={idx}
                            onClick={() => setLightboxUrl(att.url)}
                            className="group/att relative w-20 h-20 rounded-lg overflow-hidden border border-white/[0.06] hover:ring-2 hover:ring-blue-500/20 transition"
                          >
                            <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover/att:bg-black/20 transition-colors flex items-center justify-center">
                              <Maximize2 className="w-3.5 h-3.5 text-white opacity-0 group-hover/att:opacity-100 transition drop-shadow" />
                            </div>
                          </button>
                        ) : (
                          <a
                            key={idx}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10 transition group/att"
                          >
                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-xs font-medium text-slate-300 truncate max-w-[120px]">{att.name}</span>
                            <Download className="w-3 h-3 text-slate-300 group-hover/att:text-blue-500 transition shrink-0" />
                          </a>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-4 ml-[52px] pt-3 border-t border-white/[0.06]">
                    <button onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-400 transition">
                      <MessageCircle className="w-3.5 h-3.5" />
                      {postComments.length > 0 ? `${postComments.length} komentářů` : 'Komentovat'}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-white/[0.06] bg-white/[0.04]/50">
                    {postComments.length > 0 && (
                      <div className="divide-y divide-white/[0.06]/80">
                        {postComments.map(c => (
                          <div key={c.id} className="flex items-start gap-3 px-5 py-3">
                            <div className="w-7 h-7 rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0 mt-0.5">
                              {getInitial(c.author_id)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-300">{getProfileName(c.author_id)}</span>
                                <span className="text-[10px] text-slate-400">{timeSince(c.created_at)}</span>
                              </div>
                              <p className="text-sm text-slate-400 mt-0.5">{c.content}</p>
                            </div>
                            {(c.author_id === user?.id || isAdmin) && (
                              <button onClick={() => handleDeleteComment(c.id)} className="p-1 rounded hover:bg-red-500/100/10 text-slate-300 hover:text-red-500 transition shrink-0">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 px-5 py-3 border-t border-white/[0.06]">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                        {(getProfileName(user?.id ?? null))[0]?.toUpperCase() || '?'}
                      </div>
                      <input
                        value={commentText[post.id] || ''}
                        onChange={e => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                        placeholder="Napište komentář..."
                        className="flex-1 px-3 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white/[0.06]"
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(post.id); } }}
                      />
                      <button onClick={() => handleAddComment(post.id)}
                        disabled={!commentText[post.id]?.trim()}
                        className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50">
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/[0.06]/10 text-white hover:bg-white/[0.06]/20 transition z-10"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Náhled"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      <NewsPostModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditPost(null); }}
        onSaved={load}
        editData={editPost}
      />
    </div>
  );
}
