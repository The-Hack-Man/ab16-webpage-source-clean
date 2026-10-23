import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Order } from '@/types';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      navigate('/account');
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 block mb-2">Email</label>
          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field pl-11" placeholder="your@email.com" />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 block mb-2">Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field pl-11" placeholder="••••••••" />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Signing in…' : <>Sign In <ArrowRight size={14} /></>}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Don't have an account? <Link to="/account/register" className="link-underline font-medium text-jet">Create one</Link>
      </p>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      navigate('/account');
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Join AB16 for order history, wishlists, and faster checkout">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 block mb-2">Full Name</label>
          <div className="relative">
            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field pl-11" placeholder="Your name" />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 block mb-2">Email</label>
          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field pl-11" placeholder="your@email.com" />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 block mb-2">Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field pl-11" placeholder="Min 6 characters" minLength={6} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating account…' : <>Create Account <ArrowRight size={14} /></>}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account? <Link to="/account/login" className="link-underline font-medium text-jet">Sign in</Link>
      </p>
    </AuthLayout>
  );
}

export function AccountPage() {
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="bg-bone min-h-screen container-base py-20"><div className="h-8 bg-slate-100 animate-pulse w-48" /></div>;

  if (!session) {
    return (
      <div className="bg-bone min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center py-16">
          <User size={40} className="mx-auto text-slate-300 mb-4" strokeWidth={1} />
          <h1 className="text-display-lg">Your Account</h1>
          <p className="mt-3 text-slate-500">Sign in to view your orders, wishlist, and account details.</p>
          <div className="mt-8 flex flex-col gap-3">
            <Link to="/account/login" className="btn-primary">Sign In</Link>
            <Link to="/account/register" className="btn-outline">Create Account</Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="bg-bone min-h-screen">
      <div className="container-base py-12 lg:py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="section-label mb-2">Account</p>
            <h1 className="text-display-lg">Welcome back</h1>
            <p className="mt-2 text-sm text-slate-500">{session.user.email}</p>
          </div>
          <button onClick={handleSignOut} className="btn-outline">Sign Out</button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AccountCard title="Order History" desc="View and track your orders" to="/account/orders" />
          <AccountCard title="Wishlist" desc="Your saved items" to="/wishlist" />
          <AccountCard title="Profile" desc="Manage your details and preferences" to="/account" />
        </div>

        <div className="mt-8">
          <OrderHistory email={session.user.email ?? ''} />
        </div>
      </div>
    </div>
  );
}

function AccountCard({ title, desc, to }: { title: string; desc: string; to: string }) {
  return (
    <Link to={to} className="group border border-jet/10 p-6 hover:bg-jet hover:text-bone transition-all duration-300">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-slate-400 group-hover:text-bone/50 mt-1">{desc}</p>
    </Link>
  );
}

function OrderHistory({ email }: { email: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('orders').select('*').eq('email', email).order('created_at', { ascending: false });
      setOrders(data as unknown as Order[] ?? []);
      setLoading(false);
    })();
  }, [email]);

  if (loading) return <p className="text-sm text-slate-400">Loading orders…</p>;

  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-4">Recent Orders</h2>
      {orders.length === 0 ? (
        <div className="border border-jet/10 py-12 text-center">
          <p className="text-sm text-slate-400">No orders yet.</p>
          <Link to="/shop" className="btn-outline mt-4">Start Shopping</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="border border-jet/10 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{o.order_number}</p>
                <p className="text-xs text-slate-400">{new Date(o.created_at).toLocaleDateString('en-GB')}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">£{(o.total / 100).toFixed(2)}</p>
                <span className="text-[10px] uppercase tracking-wider text-slate-400">{o.payment_status} · {o.fulfilment_status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-bone min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full py-16">
        <Link to="/" className="block mb-8">
          <span className="font-display font-extrabold text-xl">AB16</span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.3em] opacity-50 ml-2">Clothing</span>
        </Link>
        <h1 className="text-display-lg">{title}</h1>
        <p className="mt-2 text-sm text-slate-500 mb-8">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
