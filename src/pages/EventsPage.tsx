import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Ticket } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDateLong } from '@/lib/format';

interface EventItem {
  id: string;
  name: string;
  venue: string | null;
  city: string | null;
  event_date: string | null;
  event_image_url: string | null;
  ticket_url: string | null;
  status: string;
}

export function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('events').select('*').eq('status', 'published').order('event_date', { ascending: true });
      setEvents(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="bg-bone min-h-screen">
      <div className="border-b border-jet/10">
        <div className="container-base py-12 lg:py-16">
          <p className="section-label mb-3">Jamie G Music</p>
          <h1 className="text-display-xl">Events & Live Appearances</h1>
        </div>
      </div>

      <div className="container-base py-10">
        {loading ? (
          <div className="space-y-4">{[0, 1].map((i) => <div key={i} className="h-40 bg-slate-100 animate-pulse" />)}</div>
        ) : events.length > 0 ? (
          <div className="space-y-4">
            {events.map((ev) => (
              <div key={ev.id} className="border border-jet/10 grid sm:grid-cols-[auto,1fr,auto] gap-6 p-5 lg:p-6 items-center hover:border-jet/20 transition-colors">
                <div className="text-center sm:text-left">
                  {ev.event_date && (
                    <>
                      <div className="text-2xl font-display font-bold">{new Date(ev.event_date).getDate()}</div>
                      <div className="text-xs uppercase tracking-widest text-slate-400">{new Date(ev.event_date).toLocaleDateString('en-GB', { month: 'short' })}</div>
                    </>
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{ev.name}</h2>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
                    {ev.venue && <span className="flex items-center gap-1"><MapPin size={12} /> {ev.venue}</span>}
                    {ev.city && <span>{ev.city}</span>}
                    {ev.event_date && <span className="flex items-center gap-1"><Calendar size={12} /> {formatDateLong(ev.event_date)}</span>}
                  </div>
                </div>
                {ev.ticket_url && (
                  <a href={ev.ticket_url} target="_blank" rel="noopener noreferrer" className="btn-primary whitespace-nowrap">
                    <Ticket size={14} /> Get Tickets
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-jet/10 py-20 text-center">
            <Calendar size={32} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold">No events scheduled</h3>
            <p className="mt-2 text-sm text-slate-400">Live appearances will appear here once confirmed.</p>
            <Link to="/music" className="btn-outline mt-6">Back to Music</Link>
          </div>
        )}
      </div>
    </div>
  );
}
