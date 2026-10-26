import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The app root element is missing.');
}

const root = createRoot(rootElement);

function showStartupError(message: string) {
  root.render(
    <main className="min-h-screen bg-bone px-6 py-20 text-jet" role="alert">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">AB16 Clothing</p>
        <h1 className="mt-4 font-display text-4xl font-bold">We’re having trouble loading the site</h1>
        <p className="mt-4 text-sm text-slate-600">{message}</p>
        <button className="btn-outline mt-8" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    </main>,
  );
}

async function startApp() {
  const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = import.meta.env;

  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
    showStartupError('The site is temporarily unavailable. Please try again later.');
    return;
  }

  try {
    const [appModule, authModule, cartModule, boundaryModule] = await Promise.all([
      import('./App.tsx'),
      import('@/context/AuthContext'),
      import('@/context/CartContext'),
      import('@/components/AppErrorBoundary'),
    ]);

    const App = appModule.default;
    const { AuthProvider } = authModule;
    const { CartProvider } = cartModule;
    const { AppErrorBoundary } = boundaryModule;

    root.render(
      <StrictMode>
        <AppErrorBoundary>
          <AuthProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </AuthProvider>
        </AppErrorBoundary>
      </StrictMode>,
    );
  } catch {
    showStartupError('The site could not connect to its required services. Please try again later.');
  }
}

void startApp();
