import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Inspiration } from '../types/database';
import { sanitizeHtml } from '../lib/sanitize';

function ArticleSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="h-8 w-3/4 bg-white/[0.06] rounded animate-skeleton" />
      <div className="h-4 w-1/3 bg-white/[0.06] rounded animate-skeleton" />
      <div className="h-72 bg-white/[0.06] rounded-3xl animate-skeleton" />
      <div className="space-y-3">
        <div className="h-4 w-full bg-white/[0.06] rounded animate-skeleton" />
        <div className="h-4 w-5/6 bg-white/[0.06] rounded animate-skeleton" />
        <div className="h-4 w-4/5 bg-white/[0.06] rounded animate-skeleton" />
        <div className="h-4 w-full bg-white/[0.06] rounded animate-skeleton" />
      </div>
    </div>
  );
}

export default function InspirationDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Inspiration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPost = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('inspirations')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();
      if (dbError) throw dbError;
      setPost(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst článek');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPost(); }, [slug]);

  const safeContent = useMemo(() => {
    if (!post?.content) return '';
    return sanitizeHtml(post.content);
  }, [post?.content]);

  return (
    <div className="bg-white/[0.04] min-h-screen">
      <header className="bg-white/[0.06] border-b sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/inspirace" className="flex items-center gap-3 text-slate-300 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
            <img src="/housesmartlogo.png" alt="HouseSmart" className="h-8 w-auto" />
          </Link>
          <Link to="/inspirace" className="text-sm font-extrabold text-blue-400 hover:underline">
            Všechny články
          </Link>
        </div>
      </header>

      {loading ? (
        <ArticleSkeleton />
      ) : error ? (
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="bg-navy-800/60 rounded-3xl border border-red-500/20  p-10">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 mx-auto flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-lg font-extrabold text-white">Chyba</h2>
            <p className="text-sm text-slate-500 mt-2">{error}</p>
            <button onClick={fetchPost} className="mt-5 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-extrabold hover:bg-blue-700 transition inline-flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Zkusit znovu
            </button>
          </div>
        </div>
      ) : !post ? (
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="bg-navy-800/60 rounded-3xl border border-white/[0.06]  p-10">
            <h2 className="text-lg font-extrabold text-white">Článek nenalezen</h2>
            <p className="text-sm text-slate-500 mt-2">Hledaný článek neexistuje nebo byl odstraněn.</p>
            <Link to="/inspirace" className="mt-5 inline-block bg-blue-600 text-white px-6 py-2.5 rounded-xl font-extrabold hover:bg-blue-700 transition">
              Zpět na inspirace
            </Link>
          </div>
        </div>
      ) : (
        <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          {post.cover_image && (
            <div className="rounded-3xl overflow-hidden mb-8 shadow-lg">
              <img src={post.cover_image} alt={post.title} className="w-full h-auto max-h-[450px] object-cover" />
            </div>
          )}

          <div className="flex items-center gap-3 text-sm text-slate-400 font-extrabold mb-4">
            <Calendar className="w-4 h-4" />
            {post.published_at
              ? new Date(post.published_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })
              : 'Koncept'}
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight tracking-tight">{post.title}</h1>

          {post.excerpt && (
            <p className="text-lg text-slate-500 mt-4 leading-relaxed">{post.excerpt}</p>
          )}

          <div
            className="mt-8 prose prose-slate max-w-none prose-headings:font-extrabold prose-a:text-blue-400 prose-img:rounded-2xl prose-img:shadow-lg"
            dangerouslySetInnerHTML={{ __html: safeContent }}
          />

          <div className="mt-12 pt-8 border-t border-white/10">
            <Link to="/inspirace" className="inline-flex items-center gap-2 text-sm font-extrabold text-blue-400 hover:underline">
              <ArrowLeft className="w-4 h-4" /> Zpět na všechny články
            </Link>
          </div>
        </article>
      )}
    </div>
  );
}
