/**
 * Configuration Manager
 * إدارة الإعدادات والمتغيرات البيئية
 *
 * SECURITY NOTE:
 * Only PUBLIC identifiers (App IDs, Client IDs) belong here.
 * ALL secrets (App Secret, Client Secret, API Secret, Bearer Token)
 * must live exclusively in Supabase Edge Function environment variables.
 * Never prefix a secret with VITE_ — it will be bundled into the client JS.
 */

export interface AppConfig {
    supabase: {
        url: string;
        anonKey: string;
    };
    social: {
        /** Public App ID used to load the Facebook JS SDK — safe to expose */
        facebook: {
            appId: string;
        };
        /** Public OAuth Client ID — safe to expose */
        instagram: {
            clientId: string;
        };
        /** Public Consumer Key (API Key) — safe to expose; secret stays on server */
        twitter: {
            apiKey?: string;
        };
        /** Public OAuth Client ID — safe to expose */
        linkedin: {
            clientId?: string;
        };
        /** Public Client Key — safe to expose */
        tiktok: {
            clientKey?: string;
        };
    };
    app: {
        url: string;
        apiUrl: string;
        environment: 'development' | 'staging' | 'production';
    };
}

/**
 * الحصول على الإعدادات من المتغيرات البيئية
 */
export function getConfig(): AppConfig {
    return {
        supabase: {
            url: import.meta.env.VITE_SUPABASE_URL || '',
            anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        social: {
            facebook: {
                appId: import.meta.env.VITE_FACEBOOK_APP_ID || '',
                // appSecret is intentionally absent — lives in Edge Function env only
            },
            instagram: {
                clientId: import.meta.env.VITE_INSTAGRAM_CLIENT_ID || '',
                // clientSecret is intentionally absent — lives in Edge Function env only
            },
            twitter: {
                apiKey: import.meta.env.VITE_TWITTER_API_KEY,
                // apiSecret and bearerToken are intentionally absent — server-side only
            },
            linkedin: {
                clientId: import.meta.env.VITE_LINKEDIN_CLIENT_ID,
                // clientSecret is intentionally absent — lives in Edge Function env only
            },
            tiktok: {
                clientKey: import.meta.env.VITE_TIKTOK_CLIENT_KEY,
                // clientSecret is intentionally absent — lives in Edge Function env only
            },
        },
        app: {
            url: import.meta.env.VITE_APP_URL || 'http://localhost:3000',
            apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
            environment: (import.meta.env.MODE as any) || 'development',
        },
    };
}

/**
 * التحقق من صحة الإعدادات المطلوبة
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
    const config = getConfig();
    const errors: string[] = [];

    // التحقق من Supabase
    if (!config.supabase.url) {
        errors.push('VITE_SUPABASE_URL is required');
    }
    if (!config.supabase.anonKey) {
        errors.push('VITE_SUPABASE_ANON_KEY is required');
    }

    // التحقق من Facebook (اختياري)
    if (!config.social.facebook.appId) {
        console.warn('VITE_FACEBOOK_APP_ID is not set. Facebook features will be limited.');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * طباعة معلومات الإعدادات (للتطوير فقط)
 */
export function logConfig(): void {
    const config = getConfig();

    console.group('🔧 Application Configuration');
    console.log('Environment:', config.app.environment);
    console.log('App URL:', config.app.url);
    console.log('API URL:', config.app.apiUrl);
    console.log('Supabase URL:', config.supabase.url);
    console.log('Supabase Key:', config.supabase.anonKey ? '✓ Set' : '✗ Missing');
    console.log('Gemini API Key:', 'managed server-side via Admin > AI Keys');
    console.log('Facebook App ID:', config.social.facebook.appId ? '✓ Set' : '✗ Missing');
    console.groupEnd();

    // التحقق من الصحة
    const validation = validateConfig();
    if (!validation.valid) {
        console.group('⚠️ Configuration Errors');
        validation.errors.forEach(error => console.error(error));
        console.groupEnd();
    }
}

/**
 * الحصول على إعداد معين
 */
export function getConfigValue<T = any>(path: string, defaultValue?: T): T | undefined {
    const config = getConfig();
    const keys = path.split('.');
    let value: any = config;

    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return defaultValue;
        }
    }

    return value as T;
}

/**
 * التحقق من وجود ميزة معينة
 */
export function isFeatureEnabled(feature: string): boolean {
    switch (feature) {
        case 'facebook':
            return !!getConfigValue('social.facebook.appId');
        case 'instagram':
            return !!getConfigValue('social.instagram.clientId');
        case 'twitter':
            return !!getConfigValue('social.twitter.apiKey');
        case 'linkedin':
            return !!getConfigValue('social.linkedin.clientId');
        case 'tiktok':
            return !!getConfigValue('social.tiktok.clientKey');
        case 'ai':
            return true; // AI key managed server-side; feature always available if proxy is deployed
        default:
            return false;
    }
}

// تصدير instance واحد من الإعدادات
export const config = getConfig();
