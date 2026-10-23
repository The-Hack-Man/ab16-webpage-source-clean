import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Play, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MusicVideo } from '@/types';
import { formatDate } from '@/lib/format';
import { OFFICIAL_JAMIE_G_VIDEOS } from '@/data/officialVideos';

export function VideosPage() {
  const [videos, setVideos] = useState<MusicVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('music_videos')
        .select('*')
        .eq('status', 'published')
        .order('release_date', { ascending: false });
      setVideos(data?.length ? data as MusicVideo[] : OFFICIAL_JAMIE_G_VIDEOS);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="bg-jet text-bone min-h-screen">
      <div className="border-b border-bone/10">
        <div className="container-base py-12 lg:py-16">
          <p className="section-label text-bone/40 mb-3">Jamie G Music</p>
          <h1 className="text-display-xl">Music Videos</h1>
        </div>
      </div>

      <div className="container-base py-10">
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => <div key={i} className="aspect-video bg-charcoal animate-pulse" />)}
          </div>
        ) : videos.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((v) => <VideoCard key={v.id} video={v} />)}
          </div>
        ) : (
          <div className="border border-bone/10 py-20 text-center">
            <Play size={32} className="mx-auto text-bone/20 mb-4" />
            <h3 className="text-lg font-semibold">Videos coming soon</h3>
            <p className="mt-2 text-sm text-bone/40">Music videos will appear here once published.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function VideoDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [video, setVideo] = useState<MusicVideo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!slug) return;
      const { data } = await supabase.from('music_videos').select('*').eq('slug', slug).eq('status', 'published').maybeSingle();
      setVideo((data as MusicVideo | null) ?? OFFICIAL_JAMIE_G_VIDEOS.find((video) => video.slug === slug) ?? null);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <div className="bg-jet text-bone min-h-screen container-base py-20"><div className="aspect-video bg-charcoal animate-pulse max-w-4xl mx-auto" /></div>;

  if (!video) {
    return (
      <div className="bg-jet text-bone min-h-screen container-base py-32 text-center">
        <h1 className="text-display-lg">Video not found</h1>
        <Link to="/music/videos" className="btn-light mt-8">Back to Videos</Link>
      </div>
    );
  }

  return (
    <div className="bg-jet text-bone min-h-screen">
      <div className="container-base pt-12 pb-20">
        <Link to="/music/videos" className="inline-flex items-center gap-2 text-sm text-bone/50 hover:text-bone mb-8">
          <ArrowLeft size={16} /> All Videos
        </Link>

        {video.youtube_id && (
          <div className="aspect-video max-w-4xl mx-auto mb-8">
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${video.youtube_id}`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        <div className="max-w-4xl mx-auto">
          <h1 className="text-display-lg">{video.title}</h1>
          <p className="mt-2 text-bone/40">{formatDate(video.release_date)}</p>
          {video.description && <p className="mt-6 text-bone/70 leading-relaxed">{video.description}</p>}
        </div>
      </div>
    </div>
  );
}

function VideoCard({ video }: { video: MusicVideo }) {
  return (
    <Link to={`/music/videos/${video.slug}`} className="group block">
      <div className="relative aspect-video overflow-hidden bg-charcoal">
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
        ) : video.youtube_id ? (
          <img src={`https://img.youtube.com/vi/${video.youtube_id}/maxresdefault.jpg`} alt={video.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Play size={32} className="text-bone/20" /></div>
        )}
        <div className="absolute inset-0 bg-jet/0 group-hover:bg-jet/30 transition-colors flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-bone/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
            <Play size={22} className="text-jet ml-1" fill="currentColor" />
          </div>
        </div>
      </div>
      <h3 className="mt-4 text-sm font-semibold group-hover:underline underline-offset-2">{video.title}</h3>
      <p className="mt-1 text-xs text-bone/40">{formatDate(video.release_date)}</p>
    </Link>
  );
}
