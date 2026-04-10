/**
 * hooks/useAsyncOperation.ts
 *
 * A lightweight wrapper for async operations (mutations/actions) that:
 * - Tracks loading state
 * - Catches and surfaces errors instead of swallowing them
 * - Shows consistent error messages via the notification system
 *
 * Phase 0 fix: replaces the pattern of silent try/catch with empty catch blocks.
 *
 * Usage:
 *   const { execute, isLoading, error } = useAsyncOperation();
 *   await execute(
 *     () => createBrand(name),
 *     { successMessage: 'تم إنشاء البراند', errorMessage: 'فشل إنشاء البراند' }
 *   );
 */

import { useState, useCallback } from 'react';
import { NotificationType } from '../types';

interface AsyncOperationOptions {
    /** Toast shown on success (optional) */
    successMessage?: string;
    /** Toast shown on failure. If omitted, the raw error message is used. */
    errorMessage?: string;
    /** Called with the notification type and message (usually addNotification from App.tsx) */
    notify?: (type: NotificationType, message: string) => void;
}

interface AsyncOperationResult<T> {
    /** Execute the async function with error handling */
    execute: (fn: () => Promise<T>, options?: AsyncOperationOptions) => Promise<T | null>;
    isLoading: boolean;
    /** The last error thrown, if any */
    error: Error | null;
    /** Clear the last error */
    clearError: () => void;
}

export function useAsyncOperation<T = void>(): AsyncOperationResult<T> {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (fn: () => Promise<T>, options: AsyncOperationOptions = {}): Promise<T | null> => {
            setIsLoading(true);
            setError(null);

            try {
                const result = await fn();

                if (options.successMessage && options.notify) {
                    options.notify(NotificationType.Success, options.successMessage);
                }

                return result;
            } catch (err) {
                const caught = err instanceof Error ? err : new Error(String(err));
                setError(caught);

                // Always log — never swallow silently
                console.error('[useAsyncOperation]', caught);

                if (options.notify) {
                    const msg = options.errorMessage ?? caught.message ?? 'حدث خطأ غير متوقع';
                    options.notify(NotificationType.Error, msg);
                }

                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [],
    );

    const clearError = useCallback(() => setError(null), []);

    return { execute, isLoading, error, clearError };
}
