import { SocialAsset, SocialPlatform, AssetType, AssetPurpose } from '../types';
import { supabase } from './supabaseClient';
import { checkFBSDK, ensureFBSDK } from './facebookSDK';

const getFacebookAppId = () => {
    const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
    if (!appId) {
        console.warn('VITE_FACEBOOK_APP_ID not found in .env file');
    }
    return appId || '';
};

declare global {
    interface Window {
        FB: any;
        fbAsyncInit: () => void;
    }
}

export interface AuthResponse {
    accessToken: string;
    expiresIn: number;
    platform: SocialPlatform;
    user?: { id: string; name: string; avatarUrl: string; username?: string };
}

export async function initiateSocialLogin(platform: SocialPlatform): Promise<AuthResponse> {
    if (platform === SocialPlatform.Facebook || platform === SocialPlatform.Instagram) {
        const appId = getFacebookAppId();
        if (!appId) {
            throw new Error('Facebook App ID not configured. Please add VITE_FACEBOOK_APP_ID to your .env file.');
        }

        const sdkReady = await ensureFBSDK(appId);
        if (!sdkReady || !window.FB) {
            throw new Error('Facebook SDK failed to load. Please check your internet connection and try again.');
        }

        return new Promise((resolve, reject) => {
            // Minimum scopes for page management — no App Review required for Live apps.
            // read_insights + ads_read require Advanced/Standard Access App Review → added later.
            // instagram_basic removed (deprecated by Meta since 2023).
            const scopes = platform === SocialPlatform.Facebook
                ? 'pages_show_list,pages_read_engagement,pages_manage_posts,pages_read_user_content,pages_messaging,pages_messaging_subscriptions'
                : 'pages_show_list,pages_read_engagement,instagram_content_publish,instagram_manage_insights,instagram_manage_messages';

            window.FB.login((response: any) => {
                if (!response || response.status === 'unknown') {
                    reject(new Error(
                        'فشل تسجيل الدخول عبر Facebook. ' +
                        'إذا كان التطبيق في وضع التطوير، تأكد من إضافتك كـ Tester في Meta Developer Console.'
                    ));
                    return;
                }
                if (!response.authResponse) {
                    const status = response.status ?? 'no_authResponse';
                    reject(new Error(
                        `تم رفض الإذن أو ألغى المستخدم الدخول. (status: ${status}) — ` +
                        'تأكد أن التطبيق في وضع Live وأن الصلاحيات مفعّلة في Meta.'
                    ));
                    return;
                }

                resolve({
                    accessToken: response.authResponse.accessToken,
                    expiresIn: response.authResponse.expiresIn,
                    platform,
                });
            }, { scope: scopes });
        });
    }

    // TikTok / LinkedIn / X: open the dedicated OAuth Edge Function in a popup.
    // Each EF handles /init (redirect to provider) and /callback (exchange code, postMessage token).
    const efNameMap: Record<string, string> = {
        tiktok:   'tiktok-oauth',
        linkedin: 'linkedin-oauth',
        x:        'twitter-oauth',
        twitter:  'twitter-oauth',
    };
    const efName = efNameMap[platform.toLowerCase()] ?? `${platform.toLowerCase()}-oauth`;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (!supabaseUrl) {
        throw new Error(`OAuth for ${platform} requires VITE_SUPABASE_URL to be configured.`);
    }

    return new Promise((resolve, reject) => {
        const initUrl = `${supabaseUrl}/functions/v1/${efName}/init`;
        const popup = window.open(initUrl, `${platform}_oauth`, 'width=600,height=700,left=300,top=100');

        if (!popup) {
            reject(new Error(`Popup blocked! Please allow popups for this site and try again.`));
            return;
        }

        // Poll for manual close (user dismissed without completing auth)
        const cancelInterval = setInterval(() => {
            if (popup.closed) {
                clearInterval(cancelInterval);
                window.removeEventListener('message', messageHandler);
                reject(new Error(`${platform} login was cancelled.`));
            }
        }, 500);

        // SECURITY: validate event.origin — only our Supabase Edge Function
        // should deliver OAuth tokens, not arbitrary pages in the popup's chain.
        const allowedOrigin = new URL(supabaseUrl).origin;

        const messageHandler = (event: MessageEvent) => {
            if (event.origin !== allowedOrigin) return;
            // EFs send lowercase platform values ('x', 'tiktok', 'linkedin');
            // SocialPlatform enum values are title-case — compare case-insensitively.
            const msgPlatform   = (event.data?.platform as string)?.toLowerCase();
            const thisPlatform  = platform.toLowerCase();

            if (event.data?.type === 'OAUTH_SUCCESS' && msgPlatform === thisPlatform) {
                clearInterval(cancelInterval);
                popup.close();
                window.removeEventListener('message', messageHandler);
                resolve({
                    accessToken: event.data.accessToken,
                    expiresIn:   event.data.expiresIn ?? 3600,
                    platform,
                    user:        event.data.user ?? undefined,
                });
            } else if (event.data?.type === 'OAUTH_ERROR' && msgPlatform === thisPlatform) {
                clearInterval(cancelInterval);
                popup.close();
                window.removeEventListener('message', messageHandler);
                reject(new Error(event.data.error ?? `${platform} OAuth failed.`));
            }
        };
        window.addEventListener('message', messageHandler);
    });
}

export async function fetchAvailableAssets(platform: SocialPlatform, token: string): Promise<SocialAsset[]> {
    if (platform === SocialPlatform.Facebook) {
        if (!checkFBSDK()) {
            throw new Error('Facebook SDK not loaded');
        }

        return new Promise((resolve, reject) => {
            window.FB.api('/me/accounts', {
                access_token: token,
                fields: 'id,name,category,fan_count,access_token,picture',
            }, (response: any) => {
                if (!response || response.error) {
                    reject(new Error(response?.error?.message || 'Failed to fetch Facebook pages'));
                    return;
                }

                resolve((response.data || []).map((page: any) => ({
                    id: page.id,
                    name: page.name,
                    category: page.category || 'Page',
                    followers: page.fan_count || 0,
                    avatarUrl: page.picture?.data?.url || `https://graph.facebook.com/${page.id}/picture?type=square`,
                    accessToken: page.access_token,
                })));
            });
        });
    }

    if (platform === SocialPlatform.Instagram) {
        if (!checkFBSDK()) {
            throw new Error('Facebook SDK not loaded');
        }

        return new Promise((resolve, reject) => {
            window.FB.api('/me/accounts', { access_token: token }, (response: any) => {
                if (!response || response.error || !response.data) {
                    reject(new Error('Failed to fetch pages for Instagram'));
                    return;
                }

                const pagePromises = response.data.map((page: any) =>
                    new Promise<SocialAsset | null>(innerResolve => {
                        window.FB.api(`/${page.id}`, {
                            access_token: page.access_token,
                            fields: 'instagram_business_account{id,username,profile_picture_url,followers_count}',
                        }, (igResponse: any) => {
                            const ig = igResponse?.instagram_business_account;
                            if (!ig) {
                                innerResolve(null);
                                return;
                            }

                            innerResolve({
                                id: ig.id,
                                name: ig.username || page.name,
                                followers: ig.followers_count || 0,
                                avatarUrl: ig.profile_picture_url || `https://picsum.photos/seed/${ig.username}/100`,
                                accessToken: page.access_token,
                                pageId: page.id,
                            });
                        });
                    }),
                );

                Promise.all(pagePromises).then(results => {
                    resolve(results.filter((asset): asset is SocialAsset => asset !== null));
                });
            });
        });
    }

    // Fetch real user info from each platform's API.
    // Falls back to a minimal placeholder if the call fails (e.g. CORS in some envs).
    try {
        if (platform === SocialPlatform.X) {
            const resp = await fetch(
                'https://api.twitter.com/2/users/me?user.fields=profile_image_url,public_metrics',
                { headers: { Authorization: `Bearer ${token}` } },
            );
            const data = await resp.json();
            const u = data?.data;
            if (u?.id) {
                return [{
                    id:          u.id,
                    name:        u.name || 'X Account',
                    followers:   u.public_metrics?.followers_count || 0,
                    avatarUrl:   u.profile_image_url?.replace('_normal', '') || '',
                    accessToken: token,
                }];
            }
        }

        if (platform === SocialPlatform.LinkedIn) {
            const resp = await fetch(
                'https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))',
                { headers: { Authorization: `Bearer ${token}` } },
            );
            const profile = await resp.json();
            if (profile?.id) {
                const name     = `${profile.localizedFirstName || ''} ${profile.localizedLastName || ''}`.trim() || 'LinkedIn Account';
                const elements = profile?.profilePicture?.['displayImage~']?.elements;
                const avatarUrl = elements?.[elements.length - 1]?.identifiers?.[0]?.identifier || '';
                return [{ id: profile.id, name, followers: 0, avatarUrl, accessToken: token }];
            }
        }

        if (platform === SocialPlatform.TikTok) {
            const resp = await fetch(
                'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,follower_count',
                { headers: { Authorization: `Bearer ${token}` } },
            );
            const data = await resp.json();
            const u = data?.data?.user;
            if (u?.open_id) {
                return [{
                    id:          u.open_id,
                    name:        u.display_name || 'TikTok Account',
                    followers:   u.follower_count || 0,
                    avatarUrl:   u.avatar_url || '',
                    accessToken: token,
                }];
            }
        }
    } catch {
        // API call failed — fall through to placeholder below
    }

    // Placeholder fallback: the token is still valid for connectSelectedAssets
    return [{
        id:          `${platform.toLowerCase()}-${Date.now()}`,
        name:        `${platform} Account`,
        followers:   0,
        avatarUrl:   '',
        accessToken: token,
    }];
}

export async function connectSelectedAssets(
    brandId: string,
    assets: SocialAsset[],
    platform: SocialPlatform,
    userToken: string,
    options?: {
        defaultPurposes?: AssetPurpose[];
        defaultAssetType?: AssetType;
        market?: string;
    },
): Promise<void> {
    // Force-refresh JWT — Facebook OAuth popup can stale the in-memory session.
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
        console.error('[connect-accounts] refreshSession failed:', refreshError.message);
        throw new Error(`انتهت الجلسة: ${refreshError.message} — يرجى تسجيل الدخول مرة أخرى.`);
    }
    const jwt = refreshData.session?.access_token;
    if (!jwt) throw new Error('Not authenticated. Please sign in again.');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const functionUrl = `${supabaseUrl}/functions/v1/connect-accounts`;

    const payload = {
        brand_id:           brandId,
        platform,
        assets,
        user_token:         userToken,
        default_purposes:   options?.defaultPurposes ?? ['publishing', 'analytics'],
        default_asset_type: options?.defaultAssetType,
        default_market:     options?.market,
    };

    // Use raw fetch to bypass supabase-js v2 functions wrapper quirks
    // and guarantee the correct JWT is sent as Authorization header.
    let response: Response;
    try {
        response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`,
                'apikey': supabaseAnonKey,
            },
            body: JSON.stringify(payload),
        });
    } catch (networkErr) {
        console.error('[connect-accounts] network error:', networkErr);
        throw new Error(`خطأ في الشبكة — تعذّر الوصول إلى Edge Function: ${(networkErr as Error).message}`, { cause: networkErr });
    }

    if (!response.ok) {
        let serverMsg = `HTTP ${response.status}`;
        try {
            const contentType = response.headers.get('content-type') ?? '';
            if (contentType.includes('application/json')) {
                const data = await response.json() as Record<string, unknown>;
                serverMsg = typeof data.error === 'string'
                    ? `${response.status}: ${data.error}`
                    : `${response.status}: ${JSON.stringify(data)}`;
            } else {
                const text = await response.text();
                serverMsg = `${response.status}: ${text.substring(0, 300)}`;
            }
        } catch {
            // ignore body parse error
        }
        console.error('[connect-accounts] server error:', serverMsg);
        throw new Error(serverMsg);
    }
}

/** جلب كل الأصول المربوطة ببراند من integration_health view */
export async function fetchConnectedAssets(brandId: string) {
    const { data, error } = await supabase
        .from('integration_health')
        .select('*')
        .eq('brand_id', brandId)
        .order('platform', { ascending: true });

    if (error) throw error;
    return data ?? [];
}

/** تحديث وظائف أصل موجود */
export async function updateAssetPurposes(
    assetId: string,
    purposes: AssetPurpose[],
    market?: string,
): Promise<void> {
    const { error } = await supabase
        .from('social_accounts')
        .update({ purposes, market: market ?? null, updated_at: new Date().toISOString() })
        .eq('id', assetId);

    if (error) throw error;
}

/** حفظ نتيجة مطابقة الصفحة مع البراند بعد تأكيد المستخدم */
export async function saveMatchScore(
    brandId: string,
    platform: SocialPlatform,
    externalAccountId: string,
    matchScore: number,
): Promise<void> {
    const { error } = await supabase
        .from('social_accounts')
        .update({
            match_score: Math.round(Math.min(100, Math.max(0, matchScore))),
            confirmed_by_user: true,
            confirmed_at: new Date().toISOString(),
        })
        .eq('brand_id', brandId)
        .eq('platform', platform)
        .eq('external_account_id', externalAccountId);

    if (error) console.warn('saveMatchScore failed:', error.message);
}
