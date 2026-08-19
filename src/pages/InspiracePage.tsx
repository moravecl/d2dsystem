import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, ArrowRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Inspiration } from '../types/database';

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-navy-800/60 rounded-3xl overflow-hidden  border border-white/[0.06]">
          <div className="h-56 bg-white/[0.06] animate-skeleton" />
          <div className="p-6 space-y-3">
            <div className="h-3 w-20 bg-white/[0.06] rounded animate-skeleton" />
            <div className="h-5 w-4/5 bg-white/[0.06] rounded animate-skeleton" />
            <div className="h-3 w-full bg-white/[0.06] rounded animate-skeleton" />
            <div className="h-3 w-3/4 bg-white/[0.06] rounded animate-skeleton" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InspiracePage() {
  const [posts, setPosts] = useState<Inspiration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('inspirations')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false });
      if (dbError) throw dbError;
      setPosts(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst články');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPosts(); }, []);

  return (
    <div className="bg-white/[0.04] min-h-screen">
      <header className="bg-white/[0.06] border-b sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 text-slate-300 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
            <img src="/housesmartlogo.png" alt="HouseSmart" className="h-8 w-auto" />
          </Link>
          <div className="text-sm font-extrabold text-white">Inspirace</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Inspirace z realizací</h1>
          <p className="text-base text-slate-500 mt-3 max-w-lg mx-auto leading-relaxed">
            Podívejte se, jak naše řešení vypadají v praxi. Reálné instalace, které mohou inspirovat váš projekt.
          </p>
        </div>

        {loading ? (
          <SkeletonCards />
        ) : error ? (
          <div className="bg-navy-800/60 rounded-3xl border border-red-500/20  p-10 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 mx-auto flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-lg font-extrabold text-white">Chyba při načítání</h2>
            <p className="text-sm text-slate-500 mt-2">{error}</p>
            <button onClick={fetchPosts} className="mt-5 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-extrabold hover:bg-blue-700 transition inline-flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Zkusit znovu
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-navy-800/60 rounded-3xl border border-white/[0.06]  p-10 text-center max-w-md mx-auto">
            <h3 className="text-lg font-extrabold text-white">Zatím žádné články</h3>
            <p className="text-sm text-slate-500 mt-2">Inspirace se připravují, zkuste to později.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/inspirace/${post.slug}`}
                className="group bg-navy-800/60 rounded-3xl overflow-hidden  border border-white/[0.06] hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="relative h-56 overflow-hidden bg-white/[0.06]">
                  {post.cover_image ? (
                    <img
                      src={post.cover_image}
                      alt={post.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/[0.06]">
                      <span className="text-slate-300 text-4xl font-extrabold">HS</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-extrabold">
                    <Calendar className="w-3.5 h-3.5" />
                    {post.published_at
                      ? new Date(post.published_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })
                      : 'Koncept'}
                  </div>
                  <h2 className="text-lg font-extrabold text-white mt-2 leading-snug">{post.title}</h2>
                  <p className="text-sm text-slate-500 mt-2 line-clamp-3">{post.excerpt}</p>
                  <div className="mt-4 text-sm font-extrabold text-blue-400 flex items-center gap-1.5 group-hover:gap-3 transition-all">
                    Číst dál <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
