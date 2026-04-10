/**
 * Error Handling Service
 * خدمة شاملة لمعالجة الأخطاء وتسجيلها
 */

import { createActivityLog, ActivityAction } from './activityLogService';

export enum ErrorCategory {
    NETWORK = 'network',
    AUTHENTICATION = 'authentication',
    AUTHORIZATION = 'authorization',
    VALIDATION = 'validation',
    DATABASE = 'database',
    API = 'api',
    STORAGE = 'storage',
    UNKNOWN = 'unknown'
}

export interface AppError {
    category: ErrorCategory;
    message: string;
    code?: string;
    details?: any;
    timestamp: Date;
    stack?: string;
}

export interface ErrorHandler {
    handle(error: any): AppError;
    log(error: AppError): void;
    notify(error: AppError): void;
}

/**
 * تحويل أي خطأ إلى AppError
 */
export function normalizeError(error: any): AppError {
    const timestamp = new Date();

    // Supabase errors
    if (error?.code && error?.message) {
        return {
            category: categorizeSupabaseError(error.code),
            message: error.message,
            code: error.code,
            details: error.details || error.hint,
            timestamp,
            stack: error.stack
        };
    }

    // Network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
            category: ErrorCategory.NETWORK,
            message: 'Network error. Please check your connection.',
            details: error.message,
            timestamp,
            stack: error.stack
        };
    }

    // Standard errors
    if (error instanceof Error) {
        return {
            category: ErrorCategory.UNKNOWN,
            message: error.message,
            timestamp,
            stack: error.stack
        };
    }

    // String errors
    if (typeof error === 'string') {
        return {
            category: ErrorCategory.UNKNOWN,
            message: error,
            timestamp
        };
    }

    // Unknown errors
    return {
        category: ErrorCategory.UNKNOWN,
        message: 'An unknown error occurred',
        details: error,
        timestamp
    };
}

/**
 * تصنيف أخطاء Supabase
 */
function categorizeSupabaseError(code: string): ErrorCategory {
    if (code.startsWith('PGRST')) {
        // PostgREST errors
        if (code === 'PGRST301') return ErrorCategory.AUTHENTICATION;
        if (code === 'PGRST116') return ErrorCategory.AUTHORIZATION;
        return ErrorCategory.DATABASE;
    }

    if (code.startsWith('23')) {
        // PostgreSQL constraint violations
        return ErrorCategory.VALIDATION;
    }

    if (code.startsWith('42')) {
        // PostgreSQL syntax errors
        return ErrorCategory.DATABASE;
    }

    return ErrorCategory.DATABASE;
}

/**
 * تسجيل الخطأ في Console
 */
export function logError(error: AppError): void {
    console.group(`🔴 Error [${error.category}]`);
    console.error('Message:', error.message);
    if (error.code) console.error('Code:', error.code);
    if (error.details) console.error('Details:', error.details);
    console.error('Timestamp:', error.timestamp.toISOString());
    if (error.stack) console.error('Stack:', error.stack);
    console.groupEnd();
}

/**
 * تسجيل الخطأ في قاعدة البيانات
 */
export async function persistError(
    error: AppError,
    brandId?: string,
    userId?: string
): Promise<void> {
    try {
        if (brandId) {
            await createActivityLog({
                brandId,
                userId,
                action: ActivityAction.POST_FAILED, // أو نوع آخر حسب السياق
                metadata: {
                    error: {
                        category: error.category,
                        message: error.message,
                        code: error.code,
                        details: error.details,
                        timestamp: error.timestamp
                    }
                }
            });
        }
    } catch (e) {
        console.error('Failed to persist error:', e);
    }
}

/**
 * إظهار رسالة خطأ للمستخدم
 */
export function getUserFriendlyMessage(error: AppError): string {
    switch (error.category) {
        case ErrorCategory.NETWORK:
            return 'حدث خطأ في الاتصال. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.';

        case ErrorCategory.AUTHENTICATION:
            return 'انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.';

        case ErrorCategory.AUTHORIZATION:
            return 'ليس لديك صلاحية للقيام بهذا الإجراء.';

        case ErrorCategory.VALIDATION:
            return error.message || 'البيانات المدخلة غير صحيحة. يرجى المراجعة والمحاولة مرة أخرى.';

        case ErrorCategory.DATABASE:
            return 'حدث خطأ في قاعدة البيانات. يرجى المحاولة مرة أخرى لاحقاً.';

        case ErrorCategory.API:
            return 'حدث خطأ في الاتصال بالخدمة. يرجى المحاولة مرة أخرى.';

        case ErrorCategory.STORAGE:
            return 'حدث خطأ في رفع الملف. يرجى التحقق من حجم الملف ونوعه.';

        default:
            return error.message || 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
    }
}

/**
 * معالج أخطاء شامل
 */
export class GlobalErrorHandler implements ErrorHandler {
    private isDevelopment: boolean;

    constructor(isDevelopment: boolean = false) {
        this.isDevelopment = isDevelopment;
    }

    handle(error: any): AppError {
        const appError = normalizeError(error);
        this.log(appError);
        return appError;
    }

    log(error: AppError): void {
        if (this.isDevelopment) {
            logError(error);
        } else {
            // في الإنتاج، يمكن إرسال الأخطاء إلى خدمة مثل Sentry
            console.error(`[${error.category}] ${error.message}`);
        }
    }

    notify(error: AppError): void {
        // يمكن إضافة إشعارات للمستخدم هنا
        // مثل Toast notifications
        console.warn('Error notification:', getUserFriendlyMessage(error));
    }
}

/**
 * معالج أخطاء async/await
 */
export async function handleAsync<T>(
    promise: Promise<T>,
    errorHandler?: (error: AppError) => void
): Promise<[T | null, AppError | null]> {
    try {
        const data = await promise;
        return [data, null];
    } catch (error) {
        const appError = normalizeError(error);
        if (errorHandler) {
            errorHandler(appError);
        } else {
            logError(appError);
        }
        return [null, appError];
    }
}

/**
 * Retry logic للعمليات الفاشلة
 */
export async function retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
): Promise<T> {
    let lastError: any;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            if (i < maxRetries - 1) {
                console.log(`Retry ${i + 1}/${maxRetries} after ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                delayMs *= 2; // Exponential backoff
            }
        }
    }

    throw lastError;
}

/**
 * تحقق من نوع الخطأ
 */
export function isNetworkError(error: any): boolean {
    const appError = normalizeError(error);
    return appError.category === ErrorCategory.NETWORK;
}

export function isAuthError(error: any): boolean {
    const appError = normalizeError(error);
    return appError.category === ErrorCategory.AUTHENTICATION;
}

export function isValidationError(error: any): boolean {
    const appError = normalizeError(error);
    return appError.category === ErrorCategory.VALIDATION;
}

// تصدير instance عام
export const errorHandler = new GlobalErrorHandler(
    import.meta.env.MODE === 'development'
);
