import { AdAccount, AdPlatform, AccountStatus } from '../types';
import { supabase } from './supabaseClient';

// ── DB row → AdAccount type mapper ───────────────────────────────────────────

function mapRow(row: Record<string, unknown>): AdAccount {
    const providerToplatform: Record<string, AdPlatform> = {
        meta:       AdPlatform.Meta,
        google_ads: AdPlatform.Google,
        tiktok_ads: AdPlatform.TikTok,
    };

    const healthToStatus = (health: string): AccountStatus => {
        if (health === 'healthy')      return AccountStatus.Connected;
        if (health === 'degraded')     return AccountStatus.NeedsReauth;
        if (health === 'disconnected') return AccountStatus.NeedsReauth;
        return AccountStatus.NeedsReauth;
    };

    return {
        id:        String(row.id),
        platform:  providerToplatform[String(row.provider)] ?? AdPlatform.Meta,
        name:      String(row.name),
        accountId: String(row.external_id),
        status:    healthToStatus(String(row.connection_health ?? 'disconnected')),
    };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns all ad accounts linked to the given brand.
 */
export async function getAdAccounts(brandId: string): Promise<AdAccount[]> {
    const { data, error } = await supabase
        .from('ad_accounts')
        .select('id, provider, external_id, name, connection_health')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[adAccountService] getAdAccounts error:', error.message);
        return [];
    }

    return (data ?? []).map(mapRow);
}

/**
 * Opens the Meta Ads OAuth popup for the given brand.
 * Returns a promise that resolves with the updated account list once the
 * user selects an ad account and the meta-ads-connect EF saves it.
 *
 * Emits a window message of type 'META_ADS_CONNECTED' on success.
 */
export async function connectMetaAdAccount(
    brandId: string,
    supabaseUrl: string,
): Promise<{ success: boolean; error?: string }> {
    const initUrl = `${supabaseUrl}/functions/v1/meta-ads-oauth/init?brand_id=${encodeURIComponent(brandId)}`;

    return new Promise((resolve) => {
        const popup = window.open(initUrl, 'meta_ads_oauth', 'width=600,height=700,noopener');

        if (!popup) {
            resolve({ success: false, error: 'Popup blocked — please allow popups for this site.' });
            return;
        }

        const timeout = setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve({ success: false, error: 'OAuth timed out. Please try again.' });
        }, 5 * 60 * 1000); // 5-minute timeout

        const handler = async (event: MessageEvent) => {
            if (event.data?.provider !== 'meta_ads') return;

            window.removeEventListener('message', handler);
            clearTimeout(timeout);

            if (event.data.type === 'OAUTH_ERROR') {
                resolve({ success: false, error: event.data.error ?? 'OAuth failed' });
                return;
            }

            // OAUTH_SUCCESS — save via meta-ads-connect EF
            const { accessToken, adAccounts, pages, brandId: confirmedBrandId } = event.data;

            if (!accessToken || !adAccounts?.length) {
                resolve({ success: false, error: 'No ad accounts returned from Meta.' });
                return;
            }

            // Use the first (active) ad account — UI can let operator choose later
            const selectedAccount = adAccounts[0];
            const selectedPage    = pages?.[0];

            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                resolve({ success: false, error: 'Session expired — please log in again.' });
                return;
            }

            try {
                const resp = await fetch(`${supabaseUrl}/functions/v1/meta-ads-connect`, {
                    method:  'POST',
                    headers: {
                        'Content-Type':  'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        brand_id:        confirmedBrandId ?? brandId,
                        access_token:    accessToken,
                        ad_account_id:   selectedAccount.id,
                        ad_account_name: selectedAccount.name,
                        currency:        selectedAccount.currency,
                        page_id:         selectedPage?.id ?? null,
                    }),
                });

                if (!resp.ok) {
                    const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
                    resolve({ success: false, error: err.error ?? `HTTP ${resp.status}` });
                    return;
                }

                window.dispatchEvent(new CustomEvent('META_ADS_CONNECTED', { detail: { brandId } }));
                resolve({ success: true });
            } catch (err) {
                resolve({ success: false, error: String(err) });
            }
        };

        window.addEventListener('message', handler);
    });
}

/**
 * Disconnects the Meta Ads account for the given brand.
 * Calls DELETE /meta-ads-connect which nulls the token and marks connection_health = 'disconnected'.
 */
export async function disconnectMetaAdAccount(
    brandId: string,
    supabaseUrl: string,
): Promise<{ success: boolean; error?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { success: false, error: 'Session expired — please log in again.' };

    try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/meta-ads-connect`, {
            method: 'DELETE',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ brand_id: brandId }),
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
            return { success: false, error: err.error ?? `HTTP ${resp.status}` };
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
}

/**
 * Legacy shim — kept to avoid breaking any callers that still use linkAdAccount.
 * @deprecated Use connectMetaAdAccount() instead.
 */
export async function linkAdAccount(
    _platform: AdPlatform,
    currentAccounts: AdAccount[],
): Promise<AdAccount[]> {
    return [...currentAccounts];
}
