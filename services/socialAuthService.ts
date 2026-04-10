import { SocialAsset, SocialPlatform } from '../types';
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
            const scopes = platform === SocialPlatform.Facebook
                ? 'pages_show_list,pages_read_engagement,pages_manage_posts,pages_read_user_content,business_management'
                : 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement';

            window.FB.login((response: any) => {
                if (!response.authResponse) {
                    reject(new Error('User cancelled login or did not fully authorize.'));
                    return;
                }

                resolve({
                    accessToken: response.authResponse.accessToken,
                    expiresIn: response.authResponse.expiresIn,
                    platform,
                });
            }, { scope: scopes, auth_type: 'rerequest' });
        });
    }

    // X (Twitter) and LinkedIn: redirect through Supabase OAuth provider-oauth-callback Edge Function
    // The user completes OAuth in a popup, then the token is stored via Edge Function
    const platformLower = platform.toLowerCase().replace('x', 'twitter');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    if (!supabaseUrl) {
        throw new Error(`OAuth for ${platform} requires VITE_SUPABASE_URL to be configured.`);
    }

    return new Promise((resolve, reject) => {
        const callbackUrl = `${supabaseUrl}/functions/v1/provider-oauth-callback?provider=${platformLower}`;
        const popup = window.open(callbackUrl, `${platform}_oauth`, 'width=600,height=700,left=300,top=100');
        
        if (!popup) {
            reject(new Error(`Popup blocked! Please allow popups for this site and try again.`));
            return;
        }

        let attempts = 0;
        const maxAttempts = 120; // 60 seconds timeout

        const interval = setInterval(() => {
            attempts++;
            
            if (popup.closed) {
                clearInterval(interval);
                reject(new Error(`${platform} login was cancelled.`));
                return;
            }

            if (attempts >= maxAttempts) {
                clearInterval(interval);
                popup.close();
                reject(new Error(`${platform} login timed out after 60 seconds.`));
                return;
            }

            // Check if popup posted a message with the token
            try {
                const hash = popup.location.hash;
                if (hash && hash.includes('access_token=')) {
                    clearInterval(interval);
                    popup.close();
                    const params = new URLSearchParams(hash.substring(1));
                    const token = params.get('access_token');
                    if (token) {
                        resolve({ accessToken: token, expiresIn: 3600, platform });
                    } else {
                        reject(new Error(`Failed to extract ${platform} access token.`));
                    }
                }
            } catch {
                // Cross-origin error — popup is still on provider page, keep waiting
            }
        }, 500);

        // Listen for postMessage from callback page
        const messageHandler = (event: MessageEvent) => {
            if (event.data?.type === 'OAUTH_SUCCESS' && event.data?.platform === platform) {
                clearInterval(interval);
                popup.close();
                window.removeEventListener('message', messageHandler);
                resolve({
                    accessToken: event.data.accessToken,
                    expiresIn: event.data.expiresIn ?? 3600,
                    platform,
                });
            } else if (event.data?.type === 'OAUTH_ERROR' && event.data?.platform === platform) {
                clearInterval(interval);
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

    await new Promise(resolve => setTimeout(resolve, 1000));
    return [{
        id: `asset-${platform}-${Date.now()}`,
        name: `${platform} Demo Account`,
        category: 'Demo',
        followers: Math.floor(Math.random() * 10000),
        avatarUrl: `https://picsum.photos/seed/${platform}/100`,
    }];
}

export async function connectSelectedAssets(
    brandId: string,
    assets: SocialAsset[],
    platform: SocialPlatform,
    userToken: string,
): Promise<void> {
    const { error } = await supabase.functions.invoke('connect-accounts', {
        body: { brand_id: brandId, platform, assets, user_token: userToken },
    });

    if (error) {
        console.error('Error saving accounts via Edge:', error);
        throw new Error(`Failed to save accounts: ${(error as any).message || 'Edge error'}`);
    }
}
