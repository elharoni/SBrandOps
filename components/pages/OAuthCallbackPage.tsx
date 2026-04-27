/**
 * OAuthCallbackPage
 * صفحة استقبال OAuth بعد إعادة التوجيه من أي منصة
 *
 * URL pattern: /app/oauth/callback?provider=X&code=Y&state=Z
 * Or for errors: /app/oauth/callback?provider=X&error=access_denied
 *
 * Flow:
 *  1. Parse URL params (provider, code, state, error)
 *  2. Validate state param (CSRF protection)
 *  3. Exchange code via provider-oauth-callback Edge Function
 *  4. Show AccountSelectorModal if assets need to be selected
 *  5. Redirect to /app/integrations on success
 */

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';
import { NotificationType } from '../../types';

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type CallbackStatus = 'loading' | 'selecting' | 'saving' | 'success' | 'error';

interface SelectableAsset {
    id: string;
    name: string;
    type: string;
    picture_url?: string;
    followers?: number;
}

interface OAuthCallbackPageProps {
    brandId: string;
    onNavigate: (page: string) => void;
    addNotification: (type: NotificationType, message: string) => void;
}

const PROVIDER_LABELS: Record<string, { name: string; icon: string; color: string }> = {
    facebook:       { name: 'Facebook',        icon: 'fab fa-facebook',        color: 'text-blue-500'    },
    instagram:      { name: 'Instagram',        icon: 'fab fa-instagram',       color: 'text-pink-500'    },
    google:         { name: 'Google',           icon: 'fab fa-google',          color: 'text-amber-500'   },
    ga4:            { name: 'Google Analytics', icon: 'fas fa-chart-line',      color: 'text-emerald-500' },
    search_console: { name: 'Search Console',   icon: 'fas fa-magnifying-glass-chart', color: 'text-cyan-500' },
    google_ads:     { name: 'Google Ads',       icon: 'fab fa-google',          color: 'text-amber-500'   },
    youtube:        { name: 'YouTube',          icon: 'fab fa-youtube',         color: 'text-red-500'     },
    tiktok:         { name: 'TikTok',           icon: 'fab fa-tiktok',          color: 'text-light-text dark:text-dark-text' },
    linkedin:       { name: 'LinkedIn',         icon: 'fab fa-linkedin',        color: 'text-blue-700'    },
    x:              { name: 'X',                icon: 'fab fa-x-twitter',       color: 'text-slate-300'   },
    twitter:        { name: 'X',                icon: 'fab fa-x-twitter',       color: 'text-slate-300'   },
    pinterest:      { name: 'Pinterest',        icon: 'fab fa-pinterest',       color: 'text-red-600'     },
    shopify:        { name: 'Shopify',          icon: 'fab fa-shopify',         color: 'text-green-500'   },
    wordpress:      { name: 'WordPress',        icon: 'fab fa-wordpress',       color: 'text-sky-500'     },
};

export const OAuthCallbackPage: React.FC<OAuthCallbackPageProps> = ({
    brandId,
    onNavigate,
    addNotification,
}) => {
    const { language }    = useLanguage();
    const ar              = language === 'ar';
    const [status, setStatus]    = useState<CallbackStatus>('loading');
    const [error, setError]      = useState<string | null>(null);
    const [provider, setProvider] = useState<string>('');
    const [availableAssets, setAvailableAssets] = useState<SelectableAsset[]>([]);
    const [selectedAssets, setSelectedAssets]   = useState<Set<string>>(new Set());
    const executed = useRef(false);

    // ── Parse params and execute OAuth callback ────────────────────────────────
    useEffect(() => {
        if (executed.current) return;
        executed.current = true;

        const params   = new URLSearchParams(window.location.search);
        const prov     = params.get('provider') ?? params.get('platform') ?? '';
        const code     = params.get('code');
        const stateRaw = params.get('state');
        const errorParam = params.get('error');
        const errorDesc  = params.get('error_description');

        setProvider(prov);

        if (errorParam) {
            const msg = errorDesc ?? errorParam;
            setError(ar
                ? `تم إلغاء الاتصال أو رُفض الطلب: ${msg}`
                : `Connection cancelled or denied: ${msg}`
            );
            setStatus('error');
            return;
        }

        if (!prov || !code) {
            setError(ar ? 'معاملات OAuth غير مكتملة.' : 'Incomplete OAuth parameters.');
            setStatus('error');
            return;
        }

        // Validate state (CSRF)
        if (stateRaw) {
            try {
                const stateObj = JSON.parse(atob(stateRaw));
                const isExpired = stateObj.expires && Date.now() > stateObj.expires;
                if (isExpired) {
                    setError(ar ? 'انتهت صلاحية طلب الاتصال. يرجى المحاولة مجدداً.' : 'OAuth state expired. Please try again.');
                    setStatus('error');
                    return;
                }
            } catch {
                // State might not be JSON-encoded (some providers just pass through a nonce)
            }
        }

        exchangeCode(prov, code, stateRaw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function exchangeCode(prov: string, code: string, state: string | null) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setError(ar ? 'غير مسجّل الدخول. يرجى تسجيل الدخول أولاً.' : 'Not logged in. Please log in first.');
                setStatus('error');
                return;
            }

            // Step 1: Exchange code with Edge Function
            const resp = await fetch(`${SUPABASE_URL}/functions/v1/google-oauth`, {
                method: 'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey':        SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                    brand_id: brandId,
                    provider: prov,
                    code,
                    state,
                    redirect_uri: `${window.location.origin}/app/oauth/callback`,
                }),
            });

            const result = await resp.json();

            if (!resp.ok || result.error) {
                throw new Error(result.error ?? `HTTP ${resp.status}`);
            }

            // Step 2: If provider returns selectable assets (pages, ad accounts, etc.)
            if (result.available_assets && result.available_assets.length > 0) {
                setAvailableAssets(result.available_assets);
                setSelectedAssets(new Set(result.available_assets.map((a: SelectableAsset) => a.id)));
                setStatus('selecting');
                return;
            }

            // No assets to select — done
            handleSuccess(prov);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Unknown error';
            setError(msg);
            setStatus('error');
        }
    }

    async function confirmAssetSelection() {
        if (selectedAssets.size === 0) return;
        setStatus('saving');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const assets = availableAssets.filter(a => selectedAssets.has(a.id));

            const resp = await fetch(`${SUPABASE_URL}/functions/v1/connect-accounts`, {
                method: 'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey':        SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                    brand_id: brandId,
                    platform: provider,
                    assets:   assets.map(a => ({ id: a.id, name: a.name, followers: a.followers })),
                }),
            });

            const result = await resp.json();
            if (!resp.ok || result.error) throw new Error(result.error ?? `HTTP ${resp.status}`);

            handleSuccess(provider);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Unknown error';
            setError(msg);
            setStatus('error');
        }
    }

    function handleSuccess(prov: string) {
        const label = PROVIDER_LABELS[prov]?.name ?? prov;
        addNotification(NotificationType.Success, ar
            ? `تم ربط ${label} بنجاح!`
            : `${label} connected successfully!`
        );
        setStatus('success');
        // Redirect after short delay
        setTimeout(() => onNavigate('integrations'), 2000);
    }

    const providerInfo = PROVIDER_LABELS[provider] ?? { name: provider, icon: 'fas fa-plug', color: 'text-brand-primary' };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="flex min-h-screen items-center justify-center bg-light-bg dark:bg-dark-bg p-6" dir={ar ? 'rtl' : 'ltr'}>
            <div className="w-full max-w-md">

                {/* Loading */}
                {status === 'loading' && (
                    <div className="rounded-3xl border border-light-border bg-light-card p-8 text-center shadow-xl dark:border-dark-border dark:bg-dark-card">
                        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/10">
                            <i className={`${providerInfo.icon} text-2xl ${providerInfo.color}`} />
                        </div>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">
                            {ar ? `جاري ربط ${providerInfo.name}…` : `Connecting ${providerInfo.name}…`}
                        </h2>
                        <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            {ar ? 'يتم معالجة بيانات الاتصال بأمان.' : 'Processing your connection securely.'}
                        </p>
                        <div className="mt-6 flex justify-center">
                            <i className="fas fa-circle-notch fa-spin text-2xl text-brand-primary" />
                        </div>
                    </div>
                )}

                {/* Asset Selection */}
                {status === 'selecting' && (
                    <div className="rounded-3xl border border-light-border bg-light-card p-8 shadow-xl dark:border-dark-border dark:bg-dark-card">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary/10 shrink-0">
                                <i className={`${providerInfo.icon} text-xl ${providerInfo.color}`} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-light-text dark:text-dark-text">
                                    {ar ? 'اختر الحسابات' : 'Select Accounts'}
                                </h2>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                    {ar
                                        ? `اختر الحسابات من ${providerInfo.name} التي تريد ربطها`
                                        : `Choose which ${providerInfo.name} accounts to connect`
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {availableAssets.map(asset => {
                                const isSelected = selectedAssets.has(asset.id);
                                return (
                                    <button
                                        key={asset.id}
                                        onClick={() => setSelectedAssets(prev => {
                                            const next = new Set(prev);
                                            if (next.has(asset.id)) next.delete(asset.id);
                                            else next.add(asset.id);
                                            return next;
                                        })}
                                        className={`w-full flex items-center gap-3 rounded-2xl border p-3 text-start transition-all ${
                                            isSelected
                                                ? 'border-brand-primary bg-brand-primary/8'
                                                : 'border-light-border hover:border-brand-primary/50 bg-light-bg dark:bg-dark-bg dark:border-dark-border'
                                        }`}
                                    >
                                        {asset.picture_url ? (
                                            <img src={asset.picture_url} alt={asset.name}
                                                className="h-10 w-10 rounded-xl object-cover shrink-0" />
                                        ) : (
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-light-card dark:bg-dark-card shrink-0">
                                                <i className={`${providerInfo.icon} ${providerInfo.color}`} />
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-light-text dark:text-dark-text">
                                                {asset.name}
                                            </p>
                                            <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                                {asset.type}
                                                {asset.followers ? ` · ${Intl.NumberFormat('ar-EG', { notation: 'compact' }).format(asset.followers)}` : ''}
                                            </p>
                                        </div>
                                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                                            isSelected ? 'border-brand-primary bg-brand-primary' : 'border-light-border dark:border-dark-border'
                                        }`}>
                                            {isSelected && <i className="fas fa-check text-[8px] text-white" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-5 flex gap-3">
                            <button
                                onClick={confirmAssetSelection}
                                disabled={selectedAssets.size === 0}
                                className="flex-1 rounded-2xl bg-brand-primary py-3 text-sm font-semibold text-white shadow-primary-glow transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {ar
                                    ? `ربط ${selectedAssets.size} حساب`
                                    : `Connect ${selectedAssets.size} account${selectedAssets.size !== 1 ? 's' : ''}`
                                }
                            </button>
                            <button
                                onClick={() => onNavigate('integrations')}
                                className="rounded-2xl border border-light-border px-4 py-3 text-sm font-medium text-light-text-secondary transition-colors hover:bg-light-bg dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg"
                            >
                                {ar ? 'إلغاء' : 'Cancel'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Saving */}
                {status === 'saving' && (
                    <div className="rounded-3xl border border-light-border bg-light-card p-8 text-center shadow-xl dark:border-dark-border dark:bg-dark-card">
                        <i className="fas fa-circle-notch fa-spin text-3xl text-brand-primary mb-4 block" />
                        <h2 className="text-lg font-bold text-light-text dark:text-dark-text">
                            {ar ? 'جاري حفظ الاتصال…' : 'Saving connection…'}
                        </h2>
                        <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            {ar ? 'يتم تشفير البيانات وحفظها بأمان.' : 'Encrypting and saving securely.'}
                        </p>
                    </div>
                )}

                {/* Success */}
                {status === 'success' && (
                    <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/5 p-8 text-center shadow-xl">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15">
                            <i className="fas fa-circle-check text-3xl text-emerald-500" />
                        </div>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">
                            {ar ? 'تم الربط بنجاح!' : 'Connected successfully!'}
                        </h2>
                        <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            {ar
                                ? `تم ربط ${providerInfo.name} بالبراند. يتم التحويل…`
                                : `${providerInfo.name} has been connected. Redirecting…`
                            }
                        </p>
                        <div className="mt-4 flex justify-center">
                            <i className="fas fa-circle-notch fa-spin text-brand-primary" />
                        </div>
                    </div>
                )}

                {/* Error */}
                {status === 'error' && (
                    <div className="rounded-3xl border border-rose-500/25 bg-rose-500/5 p-8 text-center shadow-xl">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/15">
                            <i className="fas fa-circle-xmark text-3xl text-rose-500" />
                        </div>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">
                            {ar ? 'فشل الاتصال' : 'Connection failed'}
                        </h2>
                        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
                            {error}
                        </p>
                        <div className="mt-6 flex flex-col gap-3">
                            <button
                                onClick={() => window.history.back()}
                                className="rounded-2xl bg-brand-primary py-3 text-sm font-semibold text-white"
                            >
                                {ar ? 'المحاولة مجدداً' : 'Try again'}
                            </button>
                            <button
                                onClick={() => onNavigate('integrations')}
                                className="rounded-2xl border border-light-border py-3 text-sm font-medium text-light-text-secondary dark:border-dark-border dark:text-dark-text-secondary"
                            >
                                {ar ? 'العودة للتكاملات' : 'Back to integrations'}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
