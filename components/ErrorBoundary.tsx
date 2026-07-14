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
    console.error('[Pulsar ErrorBoundary] Uncaught rendering error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isDev = process.env.NODE_ENV === 'development';
      return (
        <div className="min-h-screen bg-[#121212] text-text-primary font-mono flex items-center justify-center p-6 select-none">
          <div className="w-full max-w-lg border border-border-default bg-[#161616] p-6 rounded shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-2 text-status-red">
              <Terminal className="w-5 h-5" />
              <span className="font-bold tracking-wider">FATAL: SYSTEM CRASH</span>
            </div>
            
            <p className="text-xs text-text-muted leading-relaxed font-sans">
              An unexpected client-side error occurred in the React rendering tree.
              Please reload the page or report the diagnostic trace below.
            </p>

            <div className="w-full bg-black/60 border border-border-default/45 p-3 rounded text-[11px] leading-relaxed overflow-x-auto max-h-48 text-status-red font-mono select-all">
              <span className="font-bold text-[#e6e8e6]">{this.state.error?.toString() || 'Unknown Error'}</span>
              {isDev && this.state.errorInfo && (
                <pre className="mt-2 text-text-muted text-[10px] whitespace-pre-wrap font-mono">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div className="flex justify-end mt-2">
              <Button
                variant="ghost"
                onClick={handleReload}
                className="text-xs flex items-center gap-1.5 h-9"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Interface</span>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.children;
  }
}
