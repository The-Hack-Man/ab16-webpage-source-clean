import { Component, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('The application encountered a rendering error:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-bone px-6 py-20 text-jet" role="alert">
          <div className="mx-auto max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">AB16 Clothing</p>
            <h1 className="mt-4 font-display text-4xl font-bold">Something went wrong</h1>
            <p className="mt-4 text-sm text-slate-600">This page hit an unexpected error. Reload to try again.</p>
            <button className="btn-outline mt-8" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
