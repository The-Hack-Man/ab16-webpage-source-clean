import { Link } from 'react-router-dom';

export function AdminPlaceholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{title}</h1>
      <div className="bg-white border border-slate-200 rounded p-12 text-center">
        <p className="text-slate-500 mb-4">{desc}</p>
        <p className="text-sm text-slate-400">This section is part of the full admin system. Data tables and forms are ready to be connected here.</p>
        <Link to="/admin" className="btn-outline mt-6">Back to Dashboard</Link>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="bg-bone min-h-screen flex items-center justify-center px-4">
      <div className="text-center py-16">
        <p className="text-display-2xl font-display font-extrabold text-jet">404</p>
        <h1 className="text-display-lg mt-4">Page not found</h1>
        <p className="mt-3 text-slate-500">The page you're looking for doesn't exist or has moved.</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/" className="btn-primary">Back Home</Link>
          <Link to="/shop" className="btn-outline">Browse Shop</Link>
        </div>
      </div>
    </div>
  );
}

export function WishlistPage() {
  return (
    <div className="bg-bone min-h-screen">
      <div className="container-base py-16">
        <h1 className="text-display-xl mb-8">Wishlist</h1>
        <div className="border border-jet/10 py-16 text-center">
          <p className="text-slate-400">Your wishlist is empty.</p>
          <p className="text-sm text-slate-400 mt-2">Sign in and save items by tapping the heart icon on any product.</p>
          <Link to="/shop" className="btn-primary mt-6">Browse Shop</Link>
        </div>
      </div>
    </div>
  );
}
