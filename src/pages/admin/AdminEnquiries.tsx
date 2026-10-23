import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import type { ContactEnquiry } from '@/types';

export function AdminEnquiries() {
  const [enquiries, setEnquiries] = useState<ContactEnquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase.from('contact_enquiries').select('*').order('created_at', { ascending: false });
    setEnquiries(data ?? []);
    setLoading(false);
  };

  const toggleHandled = async (id: string, handled: boolean) => {
    await supabase.from('contact_enquiries').update({ handled: !handled }).eq('id', id);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Contact Enquiries</h1>
      {loading ? (
        <div className="space-y-2">{[0,1,2].map((i) => <div key={i} className="h-24 bg-white animate-pulse rounded" />)}</div>
      ) : enquiries.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded py-16 text-center">
          <p className="text-slate-500">No enquiries yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {enquiries.map((e) => (
            <div key={e.id} className={`bg-white border rounded p-5 ${e.handled ? 'border-slate-200 opacity-60' : 'border-amber-300'}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge bg-slate-100 text-slate-600">{e.category}</span>
                    {!e.handled && <span className="badge bg-amber-100 text-amber-700">New</span>}
                  </div>
                  <p className="text-sm font-semibold">{e.name}</p>
                  <p className="text-xs text-slate-500">{e.email}</p>
                  <p className="text-sm text-slate-600 mt-2">{e.message}</p>
                  <p className="text-[11px] text-slate-400 mt-2">{formatDate(e.created_at)}</p>
                </div>
                <button onClick={() => toggleHandled(e.id, e.handled)} className="text-xs text-accent hover:underline shrink-0">
                  {e.handled ? 'Mark as new' : 'Mark handled'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
