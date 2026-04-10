/**
 * Sentry Error Monitoring Service
 * خدمة مراقبة الأخطاء
 */

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENV = import.meta.env.MODE ?? 'development';

/**
 * Initialize Sentry — call once in main.tsx before rendering
 */
export function initSentry(): void {
    if (!SENTRY_DSN) {
        console.info('[Sentry] DSN not set — monitoring disabled. Add VITE_SENTRY_DSN to .env to enable.');
        return;
    }

    Sentry.init({
        dsn: SENTRY_DSN,
        environment: ENV,
        release: import.meta.env.VITE_APP_VERSION ?? '1.0.0',

        // Performance Monitoring
        tracesSampleRate: ENV === 'production' ? 0.2 : 1.0,

        // Session Replay (errors only in production)
        replaysSessionSampleRate: 0.0,
        replaysOnErrorSampleRate: ENV === 'production' ? 1.0 : 0.0,

        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                maskAllText: true,
                blockAllMedia: true,
            }),
        ],

        // Filter out noise
        ignoreErrors: [
            'ResizeObserver loop limit exceeded',
            'Non-Error exception captured',
            /Network request failed/i,
            /Load failed/i,
        ],

        beforeSend(event, hint) {
            // Strip PII from breadcrumbs
            if (event.request?.cookies) delete event.request.cookies;
            if (event.request?.headers?.['Authorization']) {
                event.request.headers['Authorization'] = '[Redacted]';
            }
            return event;
        },
    });

    console.info(`[Sentry] Initialized — env: ${ENV}`);
}

/**
 * Identify the logged-in user for better error attribution
 */
export function setSentryUser(user: { id: string; email?: string; name?: string } | null): void {
    if (!SENTRY_DSN) return;
    if (user) {
        Sentry.setUser({ id: user.id, email: user.email, username: user.name });
    } else {
        Sentry.setUser(null);
    }
}

/**
 * Set active brand context on every brand switch
 */
export function setSentryBrandContext(brandId: string, brandName: string): void {
    if (!SENTRY_DSN) return;
    Sentry.setContext('brand', { id: brandId, name: brandName });
    Sentry.setTag('brand_id', brandId);
}

/**
 * Manually capture an error (use in catch blocks where you don't re-throw)
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
    if (!SENTRY_DSN) {
        console.error('[Sentry] Captured (no DSN):', error, context);
        return;
    }
    Sentry.withScope(scope => {
        if (context) scope.setExtras(context);
        Sentry.captureException(error);
    });
}

/**
 * Capture a breadcrumb (custom event for debugging)
 */
export function captureBreadcrumb(message: string, data?: Record<string, unknown>): void {
    if (!SENTRY_DSN) return;
    Sentry.addBreadcrumb({ message, data, level: 'info' });
}

export { Sentry };
