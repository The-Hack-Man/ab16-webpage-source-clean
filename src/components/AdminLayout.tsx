import { NavLink, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingBag, Music, Video, Newspaper, Calendar, Settings, LogOut, Menu, Users, Tag, Mail, FileText, Shield, BrainCircuit } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const NAV = [
  { label: 'Overview', to: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Products', to: '/admin/products', icon: Package },
  { label: 'Inventory', to: '/admin/inventory', icon: Package },
  { label: 'Orders', to: '/admin/orders', icon: ShoppingBag },
  { label: 'Customers', to: '/admin/customers', icon: Users },
  { label: 'Discounts', to: '/admin/discounts', icon: Tag },
  { label: 'Releases', to: '/admin/releases', icon: Music },
  { label: 'AI Mastering', to: '/admin/ai-mastering', icon: BrainCircuit },
  { label: 'Videos', to: '/admin/videos', icon: Video },
  { label: 'News', to: '/admin/news', icon: Newspaper },
  { label: 'Events', to: '/admin/events', icon: Calendar },
  { label: 'Campaigns', to: '/admin/campaigns', icon: Tag },
  { label: 'Newsletter', to: '/admin/newsletter', icon: Mail },
  { label: 'Enquiries', to: '/admin/enquiries', icon: Mail },
  { label: 'Content', to: '/admin/content', icon: FileText },
  { label: 'Settings', to: '/admin/settings', icon: Settings },
  { label: 'Users', to: '/admin/users', icon: Users },
  { label: 'Audit Log', to: '/admin/audit-log', icon: Shield },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, loading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return <div className="min-h-screen bg-jet text-bone flex items-center justify-center" role="status">Restoring secure session…</div>;
  }

  if (!session || !isAdmin) {
    return (
      <div className="min-h-screen bg-jet text-bone flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center py-16">
          <Shield size={40} className="mx-auto text-bone/30 mb-4" strokeWidth={1} />
          <h1 className="text-display-lg text-bone">Admin Access</h1>
          <p className="mt-3 text-bone/50">{session ? 'Your account does not have administrator access.' : 'Sign in to access the dashboard.'}</p>
          <Link to="/account/login" className="btn-light mt-6">Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-jet text-bone z-40 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-bone/10">
          <Link to="/admin" className="font-display font-extrabold text-lg">AB16 Admin</Link>
          <p className="text-[10px] uppercase tracking-widest text-bone/40 mt-1">Control Centre</p>
        </div>

        <nav className="p-3 overflow-y-auto h-[calc(100vh-140px)]">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded transition-colors mb-0.5 ${
                  isActive ? 'bg-bone/10 text-bone' : 'text-bone/60 hover:text-bone hover:bg-bone/5'
                }`
              }
            >
              <item.icon size={16} strokeWidth={1.5} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-bone/10">
          <button onClick={handleSignOut} className="flex items-center gap-3 px-3 py-2.5 text-sm text-bone/60 hover:text-bone w-full">
            <LogOut size={16} strokeWidth={1.5} /> Sign Out
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-jet/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
          <div className="flex items-center justify-between px-6 h-14">
            <button className="lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
            <p className="text-sm text-slate-500 truncate">{session.user.email}</p>
            <Link to="/" className="text-xs font-medium text-accent hover:underline">View Site →</Link>
          </div>
        </header>

        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
