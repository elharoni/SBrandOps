import React from 'react';
import { SocialPlatform } from '../../types';

export const SETUP_GUIDES: Partial<Record<SocialPlatform, {
    steps: string[];
    envVar?: string;
    docsUrl: string;
    icon: string;
    color: string;
}>> = {
    [SocialPlatform.Facebook]: {
        icon: 'fab fa-facebook',
        color: 'text-blue-500',
        docsUrl: 'https://developers.facebook.com/apps',
        envVar: 'VITE_FACEBOOK_APP_ID',
        steps: [
            'اذهب إلى developers.facebook.com وأنشئ تطبيقاً جديداً من نوع "Business"',
            'من لوحة التطبيق، انسخ "App ID" و"App Secret"',
            'في EasyPanel → Environment Variables، أضف: VITE_FACEBOOK_APP_ID = <App ID>',
            'في Supabase → Edge Functions → Secrets، أضف: FACEBOOK_APP_ID و FACEBOOK_APP_SECRET',
            'في Meta App → Settings → Basic، أضف دومين موقعك في "App Domains"',
            'تأكد أن وضع التطبيق "Live" وليس "Development" (إذا أردت تسجيل دخول مستخدمين حقيقيين)',
            'أعد النشر (Redeploy) ثم عد لتجربة الربط',
        ],
    },
    [SocialPlatform.Instagram]: {
        icon: 'fab fa-instagram',
        color: 'text-pink-500',
        docsUrl: 'https://developers.facebook.com/apps',
        envVar: 'VITE_FACEBOOK_APP_ID',
        steps: [
            'Instagram يعمل عبر Instagram Graph API (وليس Basic Display API المُوقف)',
            'استخدم نفس Facebook App — فعّل منتج "Instagram Graph API" من لوحة التطبيق',
            'تأكد أن حساب Instagram من نوع Business أو Creator وأنه مربوط بصفحة Facebook',
            'في EasyPanel، أضف VITE_FACEBOOK_APP_ID بنفس قيمة Facebook App ID',
            'في Supabase → Edge Functions → Secrets، أضف: FACEBOOK_APP_ID و FACEBOOK_APP_SECRET',
            'في Meta App → Permissions، أضف: instagram_content_publish و instagram_manage_insights',
            'أعد النشر ثم عد لتجربة ربط Instagram',
        ],
    },
    [SocialPlatform.LinkedIn]: {
        icon: 'fab fa-linkedin',
        color: 'text-blue-700',
        docsUrl: 'https://developer.linkedin.com/apps',
        steps: [
            'اذهب إلى developer.linkedin.com/apps وأنشئ تطبيقاً جديداً',
            'فعّل "Sign In with LinkedIn using OpenID Connect" و"Share on LinkedIn"',
            'أضف Redirect URL: <supabase-url>/functions/v1/linkedin-oauth-callback',
            'انسخ Client ID و Client Secret',
            'أضفهما في Supabase Edge Function Secrets كـ LINKEDIN_CLIENT_ID و LINKEDIN_CLIENT_SECRET',
        ],
    },
    [SocialPlatform.X]: {
        icon: 'fab fa-x-twitter',
        color: 'text-slate-700 dark:text-slate-300',
        docsUrl: 'https://developer.twitter.com/en/portal/dashboard',
        steps: [
            'سجّل في developer.twitter.com وأنشئ Project + App',
            'فعّل OAuth 2.0 و "Read and Write" permissions',
            'أضف Callback URL: <supabase-url>/functions/v1/twitter-oauth-callback',
            'انسخ Client ID و Client Secret (OAuth 2.0)',
            'أضفهما في Supabase Edge Function Secrets كـ TWITTER_CLIENT_ID و TWITTER_CLIENT_SECRET',
        ],
    },
    [SocialPlatform.TikTok]: {
        icon: 'fab fa-tiktok',
        color: 'text-slate-700 dark:text-slate-300',
        docsUrl: 'https://developers.tiktok.com',
        steps: [
            'اذهب إلى developers.tiktok.com وأنشئ تطبيقاً',
            'فعّل "Login Kit" و"Content Posting API"',
            'أضف Redirect URL: <supabase-url>/functions/v1/tiktok-oauth-callback',
            'انسخ Client Key و Client Secret',
            'أضفهما في Supabase Edge Function Secrets كـ TIKTOK_CLIENT_KEY و TIKTOK_CLIENT_SECRET',
        ],
    },
    [SocialPlatform.Pinterest]: {
        icon: 'fab fa-pinterest',
        color: 'text-red-600',
        docsUrl: 'https://developers.pinterest.com/apps',
        steps: [
            'اذهب إلى developers.pinterest.com/apps وأنشئ تطبيقاً',
            'فعّل "boards:read", "pins:read", "pins:write"',
            'أضف Redirect URL: <supabase-url>/functions/v1/pinterest-oauth-callback',
            'انسخ App ID و App Secret',
            'أضفهما في Supabase Edge Function Secrets كـ PINTEREST_APP_ID و PINTEREST_APP_SECRET',
        ],
    },
};

export const SetupGuideModal: React.FC<{
    platform: SocialPlatform;
    onClose: () => void;
    ar: boolean;
}> = ({ platform, onClose, ar }) => {
    const guide = SETUP_GUIDES[platform];
    if (!guide) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-lg rounded-2xl border border-light-border dark:border-dark-border bg-white dark:bg-[#151b2a] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-light-bg dark:bg-dark-bg flex items-center justify-center">
                            <i className={`${guide.icon} ${guide.color} text-lg`} />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                                {ar ? 'إعداد مطلوب' : 'Setup Required'}
                            </p>
                            <p className="font-bold text-light-text dark:text-dark-text text-sm">
                                {ar ? `ربط ${platform}` : `Connect ${platform}`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-light-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition-all">
                        <i className="fas fa-xmark text-sm" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <i className="fas fa-triangle-exclamation text-amber-500 text-sm mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                            {ar
                                ? `ربط ${platform} يتطلب تسجيل تطبيق مطور على منصتهم الرسمية. هذه خطوة لمرة واحدة فقط.`
                                : `Connecting ${platform} requires registering a developer app. This is a one-time setup.`}
                        </p>
                    </div>

                    <div className="space-y-3">
                        <p className="text-sm font-semibold text-light-text dark:text-dark-text flex items-center gap-2">
                            <i className="fas fa-list-check text-brand-primary text-xs" />
                            {ar ? 'خطوات الإعداد:' : 'Setup Steps:'}
                        </p>
                        <ol className="space-y-2.5">
                            {guide.steps.map((step, i) => (
                                <li key={i} className="flex gap-3 text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                                    <span className="shrink-0 w-5 h-5 rounded-md bg-brand-primary/10 text-brand-primary font-bold text-[10px] flex items-center justify-center mt-0.5">
                                        {i + 1}
                                    </span>
                                    {step}
                                </li>
                            ))}
                        </ol>
                    </div>

                    {guide.envVar && (
                        <div className="p-3 rounded-xl bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border">
                            <p className="text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                {ar ? 'متغير البيئة المطلوب:' : 'Required env variable:'}
                            </p>
                            <code className="text-xs text-brand-primary font-mono">{guide.envVar}</code>
                        </div>
                    )}
                </div>

                <div className="px-6 pb-5 flex gap-3">
                    <a
                        href={guide.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary/90 transition-all"
                    >
                        <i className="fas fa-arrow-up-right-from-square text-xs" />
                        {ar ? 'افتح بوابة المطورين' : 'Open Developer Portal'}
                    </a>
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition-all"
                    >
                        {ar ? 'إغلاق' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export function needsSetupGuide(platform: SocialPlatform): boolean {
    if (platform === SocialPlatform.Facebook || platform === SocialPlatform.Instagram) {
        return !import.meta.env.VITE_FACEBOOK_APP_ID;
    }
    return platform === SocialPlatform.LinkedIn
        || platform === SocialPlatform.X
        || platform === SocialPlatform.TikTok
        || platform === SocialPlatform.Pinterest;
}
