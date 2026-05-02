import { AdAccount, AdPlatform, AccountStatus } from '../types';
import { supabase } from './supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MetaAdAccountOption {
    id: string;
    name: string;
    currency: string;
}

export type ConnectMetaAdsResult =
    | { type: 'success' }
    | { type: 'error'; error: string }
    | { type: 'pick'; accounts: MetaAdAccountOption[]; accessToken: string; confirmedBrandId: string; pageId?: string };

// ── DB row → AdAccount mapper ─────────────────────────────────────────────────

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

    const token = row.oauth_tokens as Record<string, unknown> | null ?? null;
    const expiresAt = token?.expires_at as string | null ?? null;
    const expiringSoon = expiresAt
        ? new Date(expiresAt).getTime() < Date.now() + 7 * 24 * 60 * 60 * 1000
        : false;

    return {
        id:               String(row.id),
        platform:         providerToplatform[String(row.provider)] ?? AdPlatform.Meta,
        name:             String(row.name),
        accountId:        String(row.external_id),
        status:           healthToStatus(String(row.connection_health ?? 'disconnected')),
        currency:         row.currency ? String(row.currency) : undefined,
        connectedAt:      row.connected_at ? String(row.connected_at) : null,
        pageId:           row.page_id ? String(row.page_id) : null,
        pixelId:          row.pixel_id ? String(row.pixel_id) : null,
        tokenExpiresAt:   expiresAt,
        tokenExpiringSoon: expiringSoon,
    };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getAdAccounts(brandId: string): Promise<AdAccount[]> {
    const { data, error } = await supabase
        .from('ad_accounts')
        .select('id, provider, external_id, name, connection_health, currency, connected_at, page_id, pixel_id, oauth_tokens!token_ref(expires_at, is_valid)')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[adAccountService] getAdAccounts error:', error.message);
        return [];
    }

    return (data ?? []).map(mapRow);
}

/**
 * Opens the Meta Ads OAuth popup.
 * - Single account  → saves immediately, returns { type: 'success' }
 * - Multiple accounts → returns { type: 'pick', accounts, accessToken, … } for UI picker
 * - Error            → returns { type: 'error', error }
 */
export async function connectMetaAdAccount(
    brandId: string,
    supabaseUrl: string,
): Promise<ConnectMetaAdsResult> {
    const initUrl = `${supabaseUrl}/functions/v1/meta-ads-oauth/init?brand_id=${encodeURIComponent(brandId)}`;

    return new Promise((resolve) => {
        const popup = window.open(initUrl, 'meta_ads_oauth', 'width=600,height=700,noopener');

        if (!popup) {
            resolve({ type: 'error', error: 'Popup blocked — please allow popups for this site.' });
            return;
        }

        const timeout = setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve({ type: 'error', error: 'OAuth timed out. Please try again.' });
        }, 5 * 60 * 1000);

        const handler = async (event: MessageEvent) => {
            if (event.data?.provider !== 'meta_ads') return;

            window.removeEventListener('message', handler);
            clearTimeout(timeout);

            if (event.data.type === 'OAUTH_ERROR') {
                resolve({ type: 'error', error: event.data.error ?? 'OAuth failed' });
                return;
            }

            const { accessToken, adAccounts, pages, brandId: confirmedBrandId } = event.data;

            if (!accessToken || !adAccounts?.length) {
                resolve({ type: 'error', error: 'No ad accounts returned from Meta.' });
                return;
            }

            // Multiple accounts → let UI show picker
            if (adAccounts.length > 1) {
                resolve({
                    type: 'pick',
                    accounts: adAccounts as MetaAdAccountOption[],
                    accessToken,
                    confirmedBrandId: confirmedBrandId ?? brandId,
                    pageId: pages?.[0]?.id,
                });
                return;
            }

            // Single account → save immediately
            const result = await saveMetaAdSelection(
                confirmedBrandId ?? brandId,
                supabaseUrl,
                { accessToken, adAccount: adAccounts[0], pageId: pages?.[0]?.id },
            );
            resolve(result);
        };

        window.addEventListener('message', handler);
    });
}

/**
 * Finalises the connection after the user picks an account from the picker.
 */
export async function saveMetaAdSelection(
    brandId: string,
    supabaseUrl: string,
    opts: { accessToken: string; adAccount: MetaAdAccountOption; pageId?: string },
): Promise<{ type: 'success' } | { type: 'error'; error: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { type: 'error', error: 'Session expired — please log in again.' };

    try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/meta-ads-connect`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({
                brand_id:        brandId,
                access_token:    opts.accessToken,
                ad_account_id:   opts.adAccount.id,
                ad_account_name: opts.adAccount.name,
                currency:        opts.adAccount.currency,
                page_id:         opts.pageId ?? null,
            }),
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
            return { type: 'error', error: err.error ?? `HTTP ${resp.status}` };
        }

        window.dispatchEvent(new CustomEvent('META_ADS_CONNECTED', { detail: { brandId } }));
        return { type: 'success' };
    } catch (err) {
        return { type: 'error', error: String(err) };
    }
}

/**
 * Disconnects the Meta Ads account for the given brand.
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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
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

/** @deprecated Use connectMetaAdAccount() instead. */
export async function linkAdAccount(_platform: AdPlatform, currentAccounts: AdAccount[]): Promise<AdAccount[]> {
    return [...currentAccounts];
}
