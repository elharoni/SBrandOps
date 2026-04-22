/**
 * Error Boundary Component
 * مكون للتعامل مع الأخطاء في React
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { captureError } from '../../services/sentryService';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    constructor(props: Props) {
        super(props);
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);

        this.setState({ error, errorInfo });

        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }

        captureError(error, { componentStack: errorInfo.componentStack });

        // Chunk load errors happen after a new deployment — stale chunk hash.
        // Auto-reload once to fetch the fresh chunks.
        const isChunkError =
            error.name === 'ChunkLoadError' ||
            error.message?.includes('Failed to fetch dynamically imported module') ||
            error.message?.includes('Importing a module script failed') ||
            error.message?.includes('Loading chunk');

        if (isChunkError) {
            const reloadKey = `chunk_reload_${Date.now()}`;
            if (!sessionStorage.getItem('chunk_reloaded')) {
                sessionStorage.setItem('chunk_reloaded', reloadKey);
                window.location.reload();
            }
        }
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="min-h-[60vh] flex items-center justify-center bg-light-bg dark:bg-dark-bg p-4">
                    <div className="max-w-sm w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-8 text-center animate-fade-in-up">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i className="fas fa-exclamation-triangle text-3xl text-red-500" />
                        </div>

                        <h1 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">
                            عذراً، حدث خطأ
                        </h1>

                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-6">
                            حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.
                        </p>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="mb-6 text-start">
                                <summary className="cursor-pointer text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text mb-2">
                                    عرض تفاصيل الخطأ
                                </summary>
                                <div className="bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl p-3 text-xs overflow-auto max-h-48">
                                    <p className="font-bold text-red-500 mb-2">{this.state.error.toString()}</p>
                                    <pre className="text-light-text-secondary dark:text-dark-text-secondary whitespace-pre-wrap text-[10px]">
                                        {this.state.errorInfo?.componentStack}
                                    </pre>
                                </div>
                            </details>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold py-2 px-4 rounded-xl text-sm transition-colors"
                            >
                                <i className="fas fa-rotate-right me-2 text-xs" />
                                المحاولة مرة أخرى
                            </button>

                            <button
                                onClick={() => window.location.href = '/'}
                                className="flex-1 bg-light-bg dark:bg-dark-bg hover:bg-light-card dark:hover:bg-dark-card border border-light-border dark:border-dark-border text-light-text dark:text-dark-text font-semibold py-2 px-4 rounded-xl text-sm transition-colors"
                            >
                                <i className="fas fa-house me-2 text-xs" />
                                الرئيسية
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

/* ==================== Async Error Boundary ==================== */
interface AsyncErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface AsyncErrorBoundaryState {
    error: Error | null;
}

export class AsyncErrorBoundary extends Component<AsyncErrorBoundaryProps, AsyncErrorBoundaryState> {
    state: AsyncErrorBoundaryState = { error: null };

    constructor(props: AsyncErrorBoundaryProps) {
        super(props);
    }

    static getDerivedStateFromError(error: Error): AsyncErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Async error:', error, errorInfo);
    }

    render() {
        if (this.state.error) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg animate-fade-in">
                    <div className="flex items-start gap-3">
                        <i className="fas fa-exclamation-circle text-red-500 text-xl mt-0.5" />
                        <div className="flex-1">
                            <h3 className="font-bold text-red-500 mb-1">فشل في تحميل البيانات</h3>
                            <p className="text-sm text-dark-text-secondary">
                                {this.state.error.message || 'حدث خطأ أثناء تحميل البيانات'}
                            </p>
                            <button
                                onClick={() => this.setState({ error: null })}
                                className="mt-3 text-sm font-semibold text-red-500 hover:text-red-400"
                            >
                                <i className="fas fa-redo me-1" />
                                إعادة المحاولة
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

/* ==================== withErrorBoundary HOC ==================== */
export function withErrorBoundary<T extends object>(
    WrappedComponent: React.ComponentType<T>,
    pageName?: string
): React.FC<T> {
    return function WithErrorBoundaryWrapper(props: T) {
        return (
            <ErrorBoundary>
                <WrappedComponent {...props} />
            </ErrorBoundary>
        );
    };
}

/* ==================== Error Fallback Component ==================== */
export const ErrorFallback: React.FC<{
    error: Error;
    resetError: () => void;
}> = ({ error, resetError }) => {
    return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-bug text-4xl text-red-500" />
                </div>

                <h2 className="text-xl font-bold text-dark-text mb-2">
                    حدث خطأ
                </h2>

                <p className="text-dark-text-secondary mb-6">
                    {error.message || 'حدث خطأ غير متوقع'}
                </p>

                <button
                    onClick={resetError}
                    className="bg-brand-primary hover:bg-brand-secondary text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                >
                    <i className="fas fa-redo me-2" />
                    إعادة المحاولة
                </button>
            </div>
        </div>
    );
};
