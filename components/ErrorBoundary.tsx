'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Terminal, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Quark ErrorBoundary] Uncaught rendering error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isDev = process.env.NODE_ENV === 'development';
      return (
        <div className="min-h-screen bg-bg-base text-fg-primary font-mono flex items-center justify-center p-6 select-none">
          <div className="w-full max-w-lg border border-border bg-bg-elevated p-6 rounded shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-2 text-decay">
              <Terminal className="w-5 h-5" />
              <span className="type-uppercase-label">System crash</span>
            </div>
            
            <p className="text-caption text-fg-muted leading-relaxed font-sans">
              An unexpected error occurred. Reload or report the trace below.
            </p>

            <div className="w-full bg-bg-base/60 border border-border/45 p-3 rounded text-caption leading-relaxed overflow-x-auto max-h-48 text-decay font-mono select-all">
              <span className="font-bold text-fg-primary">{this.state.error?.toString() || 'Unknown error'}</span>
              {isDev && this.state.errorInfo && (
                <pre className="mt-2 text-fg-muted text-micro whitespace-pre-wrap font-mono">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div className="flex justify-end mt-2">
              <Button
                variant="ghost"
                onClick={this.handleReload}
                className="text-caption flex items-center gap-1.5 h-9"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload</span>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
