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

        this.setState({
            error,
            errorInfo,
        });

        // Call custom error handler if provided
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }

        // Report to Sentry
        captureError(error, { componentStack: errorInfo.componentStack });
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
                <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
                    <div className="max-w-md w-full bg-dark-card border border-dark-border rounded-lg p-8 text-center animate-fade-in-up">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i className="fas fa-exclamation-triangle text-3xl text-red-500" />
                        </div>

                        <h1 className="text-2xl font-bold text-dark-text mb-2">
                            عذراً، حدث خطأ
                        </h1>

                        <p className="text-dark-text-secondary mb-6">
                            حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.
                        </p>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="mb-6 text-right">
                                <summary className="cursor-pointer text-sm text-dark-text-secondary hover:text-dark-text mb-2">
                                    عرض تفاصيل الخطأ
                                </summary>
                                <div className="bg-dark-bg border border-dark-border rounded-lg p-4 text-xs text-right overflow-auto max-h-60">
                                    <p className="font-bold text-red-500 mb-2">
                                        {this.state.error.toString()}
                                    </p>
                                    <pre className="text-dark-text-secondary whitespace-pre-wrap">
                                        {this.state.errorInfo?.componentStack}
                                    </pre>
                                </div>
                            </details>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 bg-brand-primary hover:bg-brand-secondary text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                                <i className="fas fa-redo me-2" />
                                المحاولة مرة أخرى
                            </button>

                            <button
                                onClick={() => window.location.href = '/'}
                                className="flex-1 bg-dark-bg hover:bg-dark-card border border-dark-border text-dark-text font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                                <i className="fas fa-home me-2" />
                                الصفحة الرئيسية
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
