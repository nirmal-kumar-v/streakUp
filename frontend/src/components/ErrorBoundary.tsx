import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('StreakUp ErrorBoundary caught an unhandled component error:', error, errorInfo);
    // If chunk load failed due to a new deployment, auto-reload once to fetch fresh assets
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      /loading chunk/i.test(error?.message || '') ||
      /failed to fetch dynamically imported module/i.test(error?.message || '');

    if (isChunkError && !sessionStorage.getItem('streakup_chunk_boundary_reload')) {
      sessionStorage.setItem('streakup_chunk_boundary_reload', 'true');
      window.location.reload();
    }
  }

  public handleReset = () => {
    sessionStorage.removeItem('streakup_chunk_boundary_reload');
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-3xl p-8 shadow-panel text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-flame-500/15 border border-flame-500/30 text-flame-500 mb-4 shadow-sm shadow-flame-500/20">
              <AlertCircle className="w-7 h-7 text-flame-500" />
            </div>

            <h2 className="text-xl font-black text-zinc-100 tracking-tight mb-2">
              {this.props.fallbackTitle || 'Unable to Load Page'}
            </h2>

            <p className="text-xs text-dark-muted mb-6 leading-relaxed">
              We encountered a temporary network or rendering delay. Your session and habits remain completely secure.
            </p>

            {this.state.error && (
              <div className="mb-6 p-3 bg-dark-surface border border-dark-border rounded-xl text-left">
                <p className="text-[11px] font-mono text-zinc-400 break-words line-clamp-3">
                  {this.state.error.message || String(this.state.error)}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-flame-500 hover:bg-flame-400 text-zinc-950 text-xs font-bold transition-all shadow-md shadow-flame-500/20"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>

              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-dark-surface hover:bg-dark-border border border-dark-border text-zinc-300 text-xs font-bold transition-all"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Go to Home</span>
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
