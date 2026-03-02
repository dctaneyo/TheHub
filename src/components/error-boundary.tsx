"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React error boundary that catches render errors in child components.
 * Prevents the entire app from crashing to a white screen — critical for 24/7 kiosks.
 * Auto-retries after 10 seconds so kiosks recover without manual intervention.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught render error:", error, errorInfo);

    // Auto-recover after 10 seconds (kiosk resilience)
    this.retryTimeout = setTimeout(() => {
      this.setState({ hasError: false, error: null });
    }, 10000);
  }

  componentWillUnmount() {
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
  }

  handleRetry = () => {
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-8">
          <div className="max-w-md text-center space-y-6">
            <div className="flex items-center justify-center">
              <div className="h-20 w-20 rounded-3xl bg-red-500 flex items-center justify-center shadow-2xl shadow-red-300 dark:shadow-red-900">
                <span className="text-3xl font-black text-white">!</span>
              </div>
            </div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              The Hub encountered an unexpected error. It will auto-recover in a few seconds.
            </p>
            {this.state.error && (
              <pre className="text-xs text-left bg-slate-200 dark:bg-slate-800 rounded-xl p-4 overflow-auto max-h-32 text-slate-600 dark:text-slate-400">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-6 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors"
              >
                Retry Now
              </button>
              <button
                onClick={this.handleReload}
                className="px-6 py-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                Reload Page
              </button>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Auto-retrying in 10 seconds…
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
