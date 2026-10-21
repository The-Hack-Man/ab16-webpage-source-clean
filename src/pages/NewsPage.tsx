import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { NewsArticle } from '@/types';
import { formatDateLong } from '@/lib/format';

export function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('news_articles').select('*').eq('status', 'published').order('published_at', { ascending: false });
      setArticles(data as NewsArticle[] ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="bg-bone min-h-screen">
      <div className="border-b border-jet/10">
        <div className="container-base py-12 lg:py-16">
          <p className="section-label mb-3">Jamie G Music</p>
          <h1 className="text-display-xl">News & Updates</h1>
        </div>
      </div>

      <div className="container-base py-10">
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-6">{[0, 1].map((i) => <div key={i} className="aspect-[16/9] bg-slate-100 animate-pulse" />)}</div>
        ) : articles.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-6 lg:gap-8">
            {articles.map((a) => (
              <Link key={a.id} to={`/music/news/${a.slug}`} className="group block">
                <div className="aspect-[16/9] overflow-hidden bg-slate-100 mb-4">
                  {a.cover_image_url && <img src={a.cover_image_url} alt={a.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />}
                </div>
                <p className="text-xs text-slate-400 mb-2">{formatDateLong(a.published_at)}</p>
                <h2 className="text-lg font-semibold group-hover:underline underline-offset-2">{a.title}</h2>
                {a.excerpt && <p className="mt-2 text-sm text-slate-500 line-clamp-2">{a.excerpt}</p>}
              </Link>
            ))}
          </div>
        ) : (
          <div className="border border-jet/10 py-20 text-center">
            <Calendar size={32} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold">No news yet</h3>
            <p className="mt-2 text-sm text-slate-400">Updates will appear here once published.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!slug) return;
      const { data } = await supabase.from('news_articles').select('*').eq('slug', slug).eq('status', 'published').maybeSingle();
      setArticle(data as NewsArticle | null);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <div className="container-base py-20"><div className="h-8 bg-slate-100 animate-pulse max-w-2xl mb-4" /><div className="h-4 bg-slate-100 animate-pulse w-1/3 mb-8" /><div className="h-64 bg-slate-100 animate-pulse" /></div>;

  if (!article) {
    return (
      <div className="container-base py-32 text-center">
        <h1 className="text-display-lg">Article not found</h1>
        <Link to="/music/news" className="btn-primary mt-8">Back to News</Link>
      </div>
    );
  }

  return (
    <div className="bg-bone min-h-screen">
      <article className="container-narrow py-12 lg:py-16">
        <Link to="/music/news" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-jet mb-8">
          <ArrowLeft size={16} /> All News
        </Link>
        <p className="text-xs text-slate-400 mb-3">{formatDateLong(article.published_at)}{article.author ? ` · ${article.author}` : ''}</p>
        <h1 className="text-display-lg mb-8">{article.title}</h1>
        {article.cover_image_url && <img src={article.cover_image_url} alt={article.title} className="w-full aspect-[16/9] object-cover mb-8" />}
        <div className="prose prose-sm max-w-none">
          {article.body.split('\n').map((p, i) => <p key={i} className="text-slate-700 leading-relaxed mb-4">{p}</p>)}
        </div>
      </article>
    </div>
  );
}
