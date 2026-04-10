/// <reference types="vite/client" />

/**
 * SECURITY: Only PUBLIC identifiers are typed here.
 * Secrets (App Secret, Client Secret, API Secret, Bearer Token, Service Role Key)
 * must NEVER be prefixed with VITE_ — they belong in Edge Function environment only.
 */
interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_GEMINI_API_KEY: string;
    // Social — public App/Client IDs only
    readonly VITE_FACEBOOK_APP_ID: string;
    readonly VITE_INSTAGRAM_CLIENT_ID: string;
    readonly VITE_TWITTER_API_KEY?: string;
    readonly VITE_LINKEDIN_CLIENT_ID?: string;
    readonly VITE_TIKTOK_CLIENT_KEY?: string;
    // App
    readonly VITE_APP_URL: string;
    readonly VITE_API_URL: string;
    readonly VITE_SENTRY_DSN?: string;
    readonly VITE_APP_VERSION?: string;
    // Paddle price references (public — used to initiate checkout only)
    readonly VITE_PADDLE_ENV?: string;
    readonly VITE_PADDLE_STARTER_MONTHLY_PRICE_ID?: string;
    readonly VITE_PADDLE_STARTER_YEARLY_PRICE_ID?: string;
    readonly VITE_PADDLE_GROWTH_MONTHLY_PRICE_ID?: string;
    readonly VITE_PADDLE_GROWTH_YEARLY_PRICE_ID?: string;
    readonly VITE_PADDLE_AGENCY_MONTHLY_PRICE_ID?: string;
    readonly VITE_PADDLE_AGENCY_YEARLY_PRICE_ID?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
