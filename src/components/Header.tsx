import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Search, ShoppingBag, User, ChevronRight, BrainCircuit } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { AB16Logo, JamieGLogo } from '@/components/Logo';
import { supabase } from '@/lib/supabase';

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Shop', to: '/shop' },
  { label: 'New Arrivals', to: '/shop/new-arrivals' },
  { label: 'Collections', to: '/shop/collections' },
  { label: 'Music', to: '/music' },
  { label: 'Releases', to: '/music/releases' },
  { label: 'Videos', to: '/music/videos' },
  { label: 'Mastering', to: '/master', icon: BrainCircuit },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
];


export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { count } = useCart();

  // Determine if we're on a dark page (hero) — header is transparent over home hero
  const isHome = location.pathname === '/';
  const isTransparent = isHome && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const headerBg = isTransparent ? 'bg-transparent' : 'bg-jet/95 backdrop-blur-md';
  const textColor = isTransparent ? 'text-bone' : 'text-bone';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <>
      {/* Announcement bar */}
      <AnnouncementBar />

      <header className={`sticky top-0 z-50 ${headerBg} transition-all duration-500 ease-out-expo`}>
        <div className="container-base">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Left: mobile menu + desktop nav */}
            <div className="flex items-center gap-6">
              <button
                className={`2xl:hidden ${textColor}`}
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
                aria-expanded={mobileOpen}
                aria-controls="mobile-navigation"
              >
                <Menu size={22} strokeWidth={1.5} />
              </button>

               <nav className="hidden 2xl:flex items-center gap-7">
                {NAV_LINKS.slice(0, 5).map((link) => (
                  <DesktopNavLink key={link.to} {...link} textColor={textColor} />
                ))}
              </nav>
            </div>

            {/* Center: logo */}
            <AB16Logo variant="light" className="absolute left-1/2 -translate-x-1/2" />

            {/* Right: nav + actions */}
            <div className="flex items-center gap-5">
              <nav className="hidden 2xl:flex items-center gap-7">
                {NAV_LINKS.slice(5).map((link) => (
                  <DesktopNavLink key={link.to} {...link} textColor={textColor} />
                ))}
              </nav>

              <button
                className={`${textColor} transition-opacity hover:opacity-60`}
                onClick={() => setSearchOpen((s) => !s)}
                aria-label="Search"
              >
                <Search size={20} strokeWidth={1.5} />
              </button>

              <Link
                to="/account"
                className={`${textColor} transition-opacity hover:opacity-60 hidden sm:block`}
                aria-label="Account"
              >
                <User size={20} strokeWidth={1.5} />
              </Link>

              <Link
                to="/bag"
                className={`${textColor} relative transition-opacity hover:opacity-60`}
                aria-label="Shopping bag"
              >
                <ShoppingBag size={20} strokeWidth={1.5} />
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-accent text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {count}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="absolute top-full left-0 w-full bg-jet border-t border-bone/10 animate-fade-in">
            <div className="container-base py-5">
              <form onSubmit={handleSearch} className="flex items-center gap-3">
                <Search size={20} className="text-bone/50" strokeWidth={1.5} />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products, releases, videos…"
                  className="flex-1 bg-transparent text-bone text-sm placeholder:text-bone/40 focus:outline-none"
                />
                <button type="button" onClick={() => setSearchOpen(false)} className="text-bone/50 hover:text-bone">
                  <X size={18} />
                </button>
              </form>
            </div>
          </div>
        )}
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] 2xl:hidden">
          <div className="absolute inset-0 bg-jet/60 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)} />
          <div id="mobile-navigation" role="dialog" aria-modal="true" aria-label="Site navigation" className="absolute left-0 top-0 h-full w-[88%] max-w-sm bg-jet text-bone shadow-2xl flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-6 h-16 border-b border-bone/10">
              <AB16Logo variant="light" />
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" autoFocus>
                <X size={22} strokeWidth={1.5} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-4">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-4 py-3.5 text-sm font-medium transition-colors ${
                      isActive ? 'text-bone bg-bone/10' : 'text-bone/70 hover:text-bone hover:bg-bone/5'
                    }`
                  }
                >
                  {link.label}
                  <ChevronRight size={16} className="opacity-30" />
                </NavLink>
              ))}

              <div className="hairline my-4" />

                <Link to="/account" className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-bone/70 hover:text-bone">
                <User size={18} strokeWidth={1.5} /> Account
              </Link>
                <Link to="/bag" className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-bone/70 hover:text-bone">
                <ShoppingBag size={18} strokeWidth={1.5} /> Shopping Bag {count > 0 && `(${count})`}
              </Link>
            </nav>

            <div className="px-6 py-5 border-t border-bone/10">
              <div className="flex items-center gap-3 mb-3">
                <JamieGLogo variant="light" />
              </div>
              <p className="text-xs text-bone/40">Independent streetwear & music. Aberdeen.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DesktopNavLink({ label, to, textColor, icon: Icon }: { label: string; to: string; textColor: string; icon?: React.ElementType }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] ${textColor} transition-opacity hover:opacity-60 relative ${
          isActive ? 'opacity-100' : 'opacity-75'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {Icon && <Icon size={14} />}
          {label}
          <span
            className={`absolute -bottom-1 left-0 h-px bg-accent transition-all duration-300 ease-out-expo ${
              isActive ? 'w-full opacity-100' : 'w-0 opacity-0 group-hover:w-full group-hover:opacity-60'
            }`}
          />
        </>
      )}
    </NavLink>
  );
}

function AnnouncementBar() {
  const [text, setText] = useState('');
  const [active, setActive] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('site_settings').select('announcement_text, announcement_active').limit(1).maybeSingle();
      if (error) console.error('Could not load announcement settings:', error.message);
      if (data) {
        setActive(data.announcement_active);
        if (data.announcement_text) setText(data.announcement_text);
      }
      setLoaded(true);
    })();
  }, []);

  if (!loaded || !active) return null;

  return (
    <div className="border-b border-jet/10 bg-bone text-jet py-2 text-center">
      <div className="container-base">
        <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.12em] sm:tracking-[0.2em] leading-relaxed">
          {text}
        </p>
      </div>
    </div>
  );
}
