/**
 * brandConnectionService.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Brand-Centric Connection Layer
 *
 * PRINCIPLE: The Brand owns all connections. The User merely operates them.
 * Every external provider (Meta, Google, WooCommerce, etc.) connects TO the Brand,
 * not to the User. If the user leaves, the connections stay.
 *
 * PROVIDER MAP:
 *   Social:     meta | instagram | x | linkedin | tiktok | youtube | snapchat
 *   Google:     ga4 | search_console | google_ads
 *   Commerce:   woocommerce | shopify
 *   CMS:        wordpress
 */

import { supabase } from './supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────

export type Provider =
    | 'meta'       | 'instagram'  | 'x'          | 'linkedin'
    | 'tiktok'     | 'youtube'    | 'snapchat'
    | 'ga4'        | 'search_console' | 'google_ads'
    | 'woocommerce'| 'shopify'    | 'wordpress'
    | 'slack'      | 'zapier'     | 'n8n'        | 'google_drive' | 'figma';

export const BRAND_CONNECTION_PROVIDER_OWNERSHIP = {
    meta: 'social_ads',
    instagram: 'social_publishing',
    x: 'social_publishing',
    linkedin: 'social_publishing',
    tiktok: 'social_publishing',
    youtube: 'social_publishing',
    snapchat: 'social_publishing',
    ga4: 'analytics',
    search_console: 'seo',
    google_ads: 'ads',
    woocommerce: 'commerce',
    shopify: 'commerce',
    wordpress: 'cms',
    slack: 'automation',
    zapier: 'automation',
    n8n: 'automation',
    google_drive: 'files',
    figma: 'files',
} as const satisfies Record<Provider, string>;

export const CONNECTABLE_BRAND_PROVIDERS = [
    'google_ads',
    'ga4',
    'search_console',
    'shopify',
    'woocommerce',
    'wordpress',
    'slack',
    'zapier',
    'n8n',
    'google_drive',
    'figma',
] as const satisfies readonly Provider[];

export type ConnectableBrandProvider = typeof CONNECTABLE_BRAND_PROVIDERS[number];

export const STANDARD_CONNECTION_METADATA_FIELDS = [
    'display_name',
    'external_account_id',
    'linked_assets',
    'last_sync_at',
    'sync_health',
    'last_error',
] as const;

export type ConnectionStatus =
    | 'connected' | 'expired' | 'needs_reauth' | 'paused' | 'error' | 'disconnected';

export type SyncHealth = 'healthy' | 'degraded' | 'failing' | 'unknown';

export interface BrandConnection {
    id:                     string;
    brand_id:               string;
    provider:               Provider;
    provider_version:       string;
    ad_account_id?:         string | null;
    analytics_property_id?: string | null;
    search_console_property_id?: string | null;
    website_id?:            string | null;
    social_account_id?:     string | null;
    external_account_id:    string | null;
    external_account_name:  string | null;
    access_token?:          string | null;
    refresh_token?:         string | null;
    token_expires_at?:      string | null;
    status:                 ConnectionStatus;
    sync_health:            SyncHealth;
    last_error:             string | null;
    last_error_at:          string | null;
    error_count:            number;
    last_sync_at:           string | null;
    last_successful_sync_at: string | null;
    sync_frequency_minutes: number;
    sync_history:           boolean;
    sync_history_days:      number;
    scopes:                 string[] | null;
    metadata:               Record<string, unknown>;
    created_at:             string;
    updated_at:             string;
}

export interface SyncCursor {
    id:                     string;
    brand_id:               string;
    connection_id:          string;
    data_type:              string;
    last_synced_date:       string | null;
    last_synced_id:         string | null;
    next_page_token:        string | null;
    cursor_metadata:        Record<string, unknown>;
    total_records_synced:   number;
    last_sync_status:       'idle' | 'running' | 'completed' | 'failed';
    last_sync_error:        string | null;
    last_sync_at:           string | null;
    last_successful_sync_at: string | null;
}

export interface SyncJob {
    id:                 string;
    brand_id:           string;
    connection_id:      string | null;
    job_type:           'full_initial' | 'incremental' | 'on_demand' | 'webhook_triggered';
    data_type:          string;
    status:             'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    sync_from:          string | null;
    sync_to:            string | null;
    records_fetched:    number;
    records_inserted:   number;
    records_updated:    number;
    records_skipped:    number;
    records_errored:    number;
    error_message:      string | null;
    queued_at:          string;
    started_at:         string | null;
    completed_at:       string | null;
    duration_seconds:   number | null;
}

export interface BrandAsset {
    websites:               BrandWebsite[];
    adAccounts:             BrandAdAccount[];
    analyticsProperties:    BrandAnalyticsProperty[];
    searchConsoleProperties: BrandSearchConsoleProperty[];
}

export interface BrandWebsite {
    id:         string;
    brand_id:   string;
    url:        string;
    domain:     string;
    platform:   string | null;
    is_primary: boolean;
    status:     string;
}

export interface BrandAdAccount {
    id:                     string;
    brand_id:               string;
    provider:               string;
    external_account_id:    string;
    account_name:           string | null;
    currency:               string;
    status:                 string;
    monthly_budget:         number | null;
}

export interface BrandAnalyticsProperty {
    id:             string;
    brand_id:       string;
    provider:       string;
    property_id:    string;
    property_name:  string | null;
    measurement_id: string | null;
    is_primary:     boolean;
    status:         string;
}

export interface BrandSearchConsoleProperty {
    id:             string;
    brand_id:       string;
    site_url:       string;
    property_type:  string;
    is_verified:    boolean;
    status:         string;
}

export interface UpsertBrandConnectionPayload {
    external_account_id: string;
    external_account_name?: string | null;
    access_token?: string | null;
    refresh_token?: string | null;
    token_expires_at?: string | null;
    scopes?: string[] | null;
    status?: ConnectionStatus;
    sync_health?: SyncHealth;
    last_error?: string | null;
    last_sync_at?: string | null;
    last_successful_sync_at?: string | null;
    metadata?: Record<string, unknown>;
}

export interface PersistedBrandAdAccountInput {
    external_account_id: string;
    account_name?: string | null;
    currency?: string | null;
    timezone?: string | null;
    status?: string;
    monthly_budget?: number | null;
}

export interface PersistedBrandAnalyticsPropertyInput {
    property_id: string;
    property_name?: string | null;
    measurement_id?: string | null;
    is_primary?: boolean;
    status?: string;
}

export interface PersistedBrandSearchConsolePropertyInput {
    site_url: string;
    property_type?: 'url' | 'domain';
    is_verified?: boolean;
    permission_level?: string | null;
    status?: string;
}

export interface PersistedBrandWebsiteInput {
    url: string;
    platform?: string | null;
    is_primary?: boolean;
    status?: string;
    metadata?: Record<string, unknown>;
}

// ─── Connection CRUD ──────────────────────────────────────────────────────

/**
 * Get all connections for a brand, optionally filtered by provider
 */
export async function getBrandConnections(
    brandId: string,
    provider?: Provider
): Promise<BrandConnection[]> {
    let query = supabase
        .from('brand_connections')
        .select('*')
        .eq('brand_id', brandId)
        .order('provider');

    if (provider) {
        query = query.eq('provider', provider);
    }

    const { data, error } = await query;
    if (error) throw new Error(`getBrandConnections: ${error.message}`);
    return (data || []) as BrandConnection[];
}

/**
 * Get a single connection by ID
 */
export async function getBrandConnection(connectionId: string): Promise<BrandConnection> {
    const { data, error } = await supabase
        .from('brand_connections')
        .select('*')
        .eq('id', connectionId)
        .single();
    if (error) throw new Error(`getBrandConnection: ${error.message}`);
    return data as BrandConnection;
}

export async function getLatestBrandConnectionForProvider(
    brandId: string,
    provider: Provider,
): Promise<BrandConnection | null> {
    const { data, error } = await supabase
        .from('brand_connections')
        .select('*')
        .eq('brand_id', brandId)
        .eq('provider', provider)
        .order('updated_at', { ascending: false })
        .limit(1);

    if (error) throw new Error(`getLatestBrandConnectionForProvider: ${error.message}`);
    return ((data || [])[0] as BrandConnection | undefined) ?? null;
}

export async function upsertBrandConnectionByProvider(
    brandId: string,
    provider: Provider,
    payload: UpsertBrandConnectionPayload,
): Promise<BrandConnection> {
    const now = new Date().toISOString();
    const existing = await getLatestBrandConnectionForProvider(brandId, provider);
    const status = payload.status ?? 'connected';
    const lastError = payload.last_error ?? null;
    const nextMetadata = {
        ...(existing?.metadata ?? {}),
        ...(payload.metadata ?? {}),
        display_name: payload.external_account_name ?? payload.metadata?.display_name ?? existing?.metadata?.display_name ?? null,
        external_account_id: payload.external_account_id,
        linked_assets: payload.metadata?.linked_assets ?? existing?.metadata?.linked_assets ?? [],
        last_sync_at: payload.last_sync_at ?? existing?.last_sync_at ?? null,
        sync_health: payload.sync_health ?? existing?.sync_health ?? 'unknown',
        last_error: lastError,
    };

    const row = {
        brand_id: brandId,
        provider,
        external_account_id: payload.external_account_id,
        external_account_name: payload.external_account_name ?? existing?.external_account_name ?? null,
        access_token: payload.access_token ?? existing?.access_token ?? null,
        refresh_token: payload.refresh_token ?? existing?.refresh_token ?? null,
        token_expires_at: payload.token_expires_at ?? existing?.token_expires_at ?? null,
        scopes: payload.scopes ?? existing?.scopes ?? null,
        status,
        sync_health: payload.sync_health ?? existing?.sync_health ?? 'unknown',
        last_error: lastError,
        last_error_at: lastError ? now : null,
        error_count: lastError ? (existing?.error_count ?? 0) + 1 : 0,
        last_sync_at: payload.last_sync_at ?? existing?.last_sync_at ?? null,
        last_successful_sync_at: payload.last_successful_sync_at
            ?? (status === 'connected' ? now : existing?.last_successful_sync_at ?? null),
        metadata: nextMetadata,
        updated_at: now,
    };

    const query = existing
        ? supabase.from('brand_connections').update(row).eq('id', existing.id)
        : supabase.from('brand_connections').insert(row);

    const { data, error } = await query.select().single();
    if (error) throw new Error(`upsertBrandConnectionByProvider: ${error.message}`);

    const current = data as BrandConnection;

    const { error: archiveError } = await supabase
        .from('brand_connections')
        .update({
            status: 'disconnected',
            updated_at: now,
        })
        .eq('brand_id', brandId)
        .eq('provider', provider)
        .neq('id', current.id)
        .neq('status', 'disconnected');

    if (archiveError) {
        throw new Error(`upsertBrandConnectionByProvider archive: ${archiveError.message}`);
    }

    return current;
}

/**
 * Register a new brand connection after successful OAuth
 * Called immediately after the user grants permission
 */
export async function registerBrandConnection(
    brandId: string,
    provider: Provider,
    payload: {
        external_account_id:    string;
        external_account_name?: string;
        access_token?:          string;
        refresh_token?:         string;
        token_expires_at?:      string;
        scopes?:                string[];
        metadata?:              Record<string, unknown>;
    }
): Promise<BrandConnection> {
    return upsertBrandConnectionByProvider(brandId, provider, {
        external_account_id: payload.external_account_id,
        external_account_name: payload.external_account_name ?? null,
        access_token: payload.access_token ?? null,
        refresh_token: payload.refresh_token ?? null,
        token_expires_at: payload.token_expires_at ?? null,
        scopes: payload.scopes ?? null,
        metadata: payload.metadata ?? {},
        status: 'connected',
        sync_health: 'unknown',
    });
}

/**
 * Update connection status (e.g., after token refresh or health check)
 */
export async function updateConnectionStatus(
    connectionId: string,
    update: {
        status?:        ConnectionStatus;
        sync_health?:   SyncHealth;
        last_error?:    string | null;
        access_token?:  string;
        refresh_token?: string;
        token_expires_at?: string;
    }
): Promise<void> {
    const now = new Date().toISOString();
    const current = await getBrandConnection(connectionId);
    const { error } = await supabase
        .from('brand_connections')
        .update({
            ...(update.status !== undefined ? { status: update.status } : {}),
            ...(update.sync_health !== undefined ? { sync_health: update.sync_health } : {}),
            ...(update.last_error !== undefined ? { last_error: update.last_error } : {}),
            ...(update.last_error !== undefined ? { last_error_at: update.last_error ? now : null } : {}),
            ...(update.last_error !== undefined
                ? { error_count: update.last_error ? current.error_count + 1 : 0 }
                : {}),
            ...(update.access_token !== undefined ? { access_token: update.access_token } : {}),
            ...(update.refresh_token !== undefined ? { refresh_token: update.refresh_token } : {}),
            ...(update.token_expires_at !== undefined ? { token_expires_at: update.token_expires_at } : {}),
            ...(update.status === 'connected' ? { last_successful_sync_at: now } : {}),
            updated_at: now,
        })
        .eq('id', connectionId);
    if (error) throw new Error(`updateConnectionStatus: ${error.message}`);
}

export async function updateBrandConnectionReferences(
    connectionId: string,
    refs: {
        ad_account_id?: string | null;
        analytics_property_id?: string | null;
        search_console_property_id?: string | null;
        website_id?: string | null;
    },
): Promise<void> {
    const { error } = await supabase
        .from('brand_connections')
        .update({
            ...refs,
            updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId);

    if (error) throw new Error(`updateBrandConnectionReferences: ${error.message}`);
}

/**
 * Disconnect (soft-delete) a brand connection
 */
export async function disconnectBrandConnection(connectionId: string): Promise<void> {
    const { error } = await supabase
        .from('brand_connections')
        .update({
            status:         'disconnected',
            access_token:   null,
            refresh_token:  null,
            updated_at:     new Date().toISOString(),
        })
        .eq('id', connectionId);
    if (error) throw new Error(`disconnectBrandConnection: ${error.message}`);
}

/**
 * Get a summary of all provider connections for a brand (for the Integrations page)
 */
export async function getBrandConnectionsOverview(brandId: string): Promise<{
    provider:           Provider;
    status:             ConnectionStatus;
    sync_health:        SyncHealth;
    last_sync_at:       string | null;
    error_count:        number;
    external_account_name: string | null;
}[]> {
    const { data, error } = await supabase
        .from('brand_connections')
        .select('provider, status, sync_health, last_sync_at, error_count, external_account_name')
        .eq('brand_id', brandId)
        .neq('status', 'disconnected')
        .order('provider');
    if (error) throw new Error(`getBrandConnectionsOverview: ${error.message}`);
    return (data || []) as any;
}

// ─── Brand Assets ─────────────────────────────────────────────────────────

/**
 * Get all assets for a brand
 */
export async function getBrandAssets(brandId: string): Promise<BrandAsset> {
    const [websites, adAccounts, analyticsProperties, searchConsoleProperties] =
        await Promise.all([
            supabase.from('brand_websites').select('*').eq('brand_id', brandId).eq('status', 'active'),
            supabase.from('brand_ad_accounts').select('*').eq('brand_id', brandId).eq('status', 'active'),
            supabase.from('brand_analytics_properties').select('*').eq('brand_id', brandId).eq('status', 'active'),
            supabase.from('brand_search_console_properties').select('*').eq('brand_id', brandId).eq('status', 'active'),
        ]);

    return {
        websites:               (websites.data || [])               as BrandWebsite[],
        adAccounts:             (adAccounts.data || [])             as BrandAdAccount[],
        analyticsProperties:    (analyticsProperties.data || [])    as BrandAnalyticsProperty[],
        searchConsoleProperties:(searchConsoleProperties.data || []) as BrandSearchConsoleProperty[],
    };
}

/**
 * Register a brand website
 */
export async function registerBrandWebsite(
    brandId: string,
    url: string,
    platform?: string,
    isPrimary?: boolean
): Promise<BrandWebsite> {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    const { data, error } = await supabase
        .from('brand_websites')
        .upsert({ brand_id: brandId, url, domain, platform, is_primary: isPrimary ?? false }, {
            onConflict: 'brand_id,domain',
        })
        .select()
        .single();
    if (error) throw new Error(`registerBrandWebsite: ${error.message}`);
    return data as BrandWebsite;
}

export async function saveBrandWebsites(
    brandId: string,
    websites: PersistedBrandWebsiteInput[],
): Promise<BrandWebsite[]> {
    if (websites.length === 0) {
        return [];
    }

    const rows = websites.map((website) => {
        const normalizedUrl = website.url.startsWith('http') ? website.url : `https://${website.url}`;
        const domain = new URL(normalizedUrl).hostname.replace(/^www\./, '');

        return {
            brand_id: brandId,
            url: normalizedUrl,
            domain,
            platform: website.platform ?? null,
            is_primary: website.is_primary ?? false,
            status: website.status ?? 'active',
            metadata: website.metadata ?? {},
        };
    });

    const { data, error } = await supabase
        .from('brand_websites')
        .upsert(rows, {
            onConflict: 'brand_id,domain',
        })
        .select();

    if (error) throw new Error(`saveBrandWebsites: ${error.message}`);
    return (data || []) as BrandWebsite[];
}

export async function saveBrandAdAccounts(
    brandId: string,
    provider: Provider,
    accounts: PersistedBrandAdAccountInput[],
): Promise<BrandAdAccount[]> {
    const now = new Date().toISOString();
    const { error: disableError } = await supabase
        .from('brand_ad_accounts')
        .update({
            status: 'disabled',
            updated_at: now,
        })
        .eq('brand_id', brandId)
        .eq('provider', provider);

    if (disableError) throw new Error(`saveBrandAdAccounts disable: ${disableError.message}`);

    if (accounts.length === 0) {
        return [];
    }

    const { data, error } = await supabase
        .from('brand_ad_accounts')
        .upsert(accounts.map((account) => ({
            brand_id: brandId,
            provider,
            external_account_id: account.external_account_id,
            account_name: account.account_name ?? null,
            currency: account.currency ?? 'USD',
            timezone: account.timezone ?? null,
            status: account.status ?? 'active',
            monthly_budget: account.monthly_budget ?? null,
        })), {
            onConflict: 'brand_id,provider,external_account_id',
        })
        .select();

    if (error) throw new Error(`saveBrandAdAccounts: ${error.message}`);
    return (data || []) as BrandAdAccount[];
}

/**
 * Register a GA4 analytics property
 */
export async function registerAnalyticsProperty(
    brandId: string,
    propertyId: string,
    propertyName?: string,
    measurementId?: string
): Promise<BrandAnalyticsProperty> {
    const { data, error } = await supabase
        .from('brand_analytics_properties')
        .upsert({
            brand_id:       brandId,
            provider:       'ga4',
            property_id:    propertyId,
            property_name:  propertyName,
            measurement_id: measurementId,
        }, { onConflict: 'brand_id,provider,property_id' })
        .select()
        .single();
    if (error) throw new Error(`registerAnalyticsProperty: ${error.message}`);
    return data as BrandAnalyticsProperty;
}

export async function saveBrandAnalyticsProperties(
    brandId: string,
    properties: PersistedBrandAnalyticsPropertyInput[],
): Promise<BrandAnalyticsProperty[]> {
    const now = new Date().toISOString();
    const { error: disableError } = await supabase
        .from('brand_analytics_properties')
        .update({
            status: 'inactive',
            updated_at: now,
        })
        .eq('brand_id', brandId)
        .eq('provider', 'ga4');

    if (disableError) throw new Error(`saveBrandAnalyticsProperties disable: ${disableError.message}`);

    if (properties.length === 0) {
        return [];
    }

    const { data, error } = await supabase
        .from('brand_analytics_properties')
        .upsert(properties.map((property) => ({
            brand_id: brandId,
            provider: 'ga4',
            property_id: property.property_id,
            property_name: property.property_name ?? null,
            measurement_id: property.measurement_id ?? null,
            is_primary: property.is_primary ?? false,
            status: property.status ?? 'active',
        })), {
            onConflict: 'brand_id,provider,property_id',
        })
        .select();

    if (error) throw new Error(`saveBrandAnalyticsProperties: ${error.message}`);
    return (data || []) as BrandAnalyticsProperty[];
}

/**
 * Register a Search Console property
 */
export async function registerSearchConsoleProperty(
    brandId: string,
    siteUrl: string,
    propertyType: 'url' | 'domain' = 'url'
): Promise<BrandSearchConsoleProperty> {
    const { data, error } = await supabase
        .from('brand_search_console_properties')
        .upsert({
            brand_id:      brandId,
            site_url:      siteUrl,
            property_type: propertyType,
            is_verified:   false,
        }, { onConflict: 'brand_id,site_url' })
        .select()
        .single();
    if (error) throw new Error(`registerSearchConsoleProperty: ${error.message}`);
    return data as BrandSearchConsoleProperty;
}

export async function saveBrandSearchConsoleProperties(
    brandId: string,
    properties: PersistedBrandSearchConsolePropertyInput[],
): Promise<BrandSearchConsoleProperty[]> {
    const now = new Date().toISOString();
    const { error: disableError } = await supabase
        .from('brand_search_console_properties')
        .update({
            status: 'inactive',
            updated_at: now,
        })
        .eq('brand_id', brandId);

    if (disableError) throw new Error(`saveBrandSearchConsoleProperties disable: ${disableError.message}`);

    if (properties.length === 0) {
        return [];
    }

    const { data, error } = await supabase
        .from('brand_search_console_properties')
        .upsert(properties.map((property) => ({
            brand_id: brandId,
            site_url: property.site_url,
            property_type: property.property_type ?? 'url',
            permission_level: property.permission_level ?? null,
            is_verified: property.is_verified ?? false,
            status: property.status ?? 'active',
            verified_at: property.is_verified ? now : null,
        })), {
            onConflict: 'brand_id,site_url',
        })
        .select();

    if (error) throw new Error(`saveBrandSearchConsoleProperties: ${error.message}`);
    return (data || []) as BrandSearchConsoleProperty[];
}

// ─── Sync Cursor Management ───────────────────────────────────────────────

/**
 * Get or initialize a sync cursor for a connection + data_type
 */
export async function getOrCreateSyncCursor(
    brandId:        string,
    connectionId:   string,
    dataType:       string
): Promise<SyncCursor> {
    const { data, error } = await supabase
        .from('sync_cursors')
        .select('*')
        .eq('connection_id', connectionId)
        .eq('data_type', dataType)
        .single();

    if (!error && data) return data as SyncCursor;

    // Create if not found
    const { data: created, error: createError } = await supabase
        .from('sync_cursors')
        .insert({ brand_id: brandId, connection_id: connectionId, data_type: dataType })
        .select()
        .single();

    if (createError) throw new Error(`getOrCreateSyncCursor: ${createError.message}`);
    return created as SyncCursor;
}

/**
 * Update cursor state after a successful sync batch
 */
export async function advanceSyncCursor(
    cursorId: string,
    update: {
        last_synced_date?:    string;
        last_synced_id?:      string;
        next_page_token?:     string | null;
        cursor_metadata?:     Record<string, unknown>;
        records_delta?:       number;
        status:               'running' | 'completed' | 'failed';
        error?:               string | null;
    }
): Promise<void> {
    const { error } = await supabase
        .from('sync_cursors')
        .update({
            ...(update.last_synced_date !== undefined  ? { last_synced_date:  update.last_synced_date  } : {}),
            ...(update.last_synced_id   !== undefined  ? { last_synced_id:    update.last_synced_id    } : {}),
            ...(update.next_page_token  !== undefined  ? { next_page_token:   update.next_page_token   } : {}),
            ...(update.cursor_metadata  !== undefined  ? { cursor_metadata:   update.cursor_metadata   } : {}),
            last_sync_status:   update.status,
            last_sync_at:       new Date().toISOString(),
            ...(update.status === 'completed' ? { last_successful_sync_at: new Date().toISOString() } : {}),
            ...(update.error !== undefined   ? { last_sync_error: update.error } : {}),
        })
        .eq('id', cursorId);
    if (error) throw new Error(`advanceSyncCursor: ${error.message}`);
}

// ─── Sync Jobs ────────────────────────────────────────────────────────────

/**
 * Create a sync job record (before starting the actual sync)
 */
export async function createSyncJob(
    brandId:        string,
    connectionId:   string | null,
    dataType:       string,
    jobType:        SyncJob['job_type'] = 'incremental',
    dateRange?: { from: string; to: string }
): Promise<SyncJob> {
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase
        .from('sync_jobs')
        .insert({
            brand_id:       brandId,
            connection_id:  connectionId,
            job_type:       jobType,
            data_type:      dataType,
            status:         'pending',
            sync_from:      dateRange?.from ?? null,
            sync_to:        dateRange?.to   ?? null,
            triggered_by:   user?.user?.id ?? null,
        })
        .select()
        .single();
    if (error) throw new Error(`createSyncJob: ${error.message}`);
    return data as SyncJob;
}

/**
 * Update a sync job as it progresses
 */
export async function updateSyncJob(
    jobId:  string,
    update: {
        status?:            SyncJob['status'];
        records_fetched?:   number;
        records_inserted?:  number;
        records_updated?:   number;
        records_skipped?:   number;
        records_errored?:   number;
        error_message?:     string | null;
        started_at?:        string;
        completed_at?:      string;
    }
): Promise<void> {
    const { error } = await supabase
        .from('sync_jobs')
        .update(update)
        .eq('id', jobId);
    if (error) throw new Error(`updateSyncJob: ${error.message}`);
}

/**
 * Get recent sync jobs for a brand
 */
export async function getRecentSyncJobs(
    brandId:    string,
    limit:      number = 20
): Promise<SyncJob[]> {
    const { data, error } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('brand_id', brandId)
        .order('queued_at', { ascending: false })
        .limit(limit);
    if (error) throw new Error(`getRecentSyncJobs: ${error.message}`);
    return (data || []) as SyncJob[];
}

// ─── Brand Setup Helpers ──────────────────────────────────────────────────

/**
 * Complete brand setup: seed system roles + create default cursors
 * Call after brand creation
 */
export async function completeBrandSetup(brandId: string): Promise<void> {
    // Seed RBAC roles via DB function
    const { error } = await supabase.rpc('seed_brand_system_roles', { p_brand_id: brandId });
    if (error) {
        console.warn('seed_brand_system_roles warning:', error.message);
        // Non-blocking — brand is still usable
    }
}

/**
 * Get brand RBAC roles
 */
export async function getBrandRoles(brandId: string): Promise<{
    id:             string;
    name:           string;
    display_name:   string;
    permissions:    Record<string, Record<string, boolean>>;
    is_system_role: boolean;
}[]> {
    const { data, error } = await supabase
        .from('brand_roles')
        .select('id, name, display_name, permissions, is_system_role')
        .eq('brand_id', brandId)
        .order('name');
    if (error) throw new Error(`getBrandRoles: ${error.message}`);
    return (data || []) as any;
}

/**
 * Check if current user has a specific permission on a brand
 */
export async function checkBrandPermission(
    brandId:    string,
    domain:     string,    // e.g. 'ads_ops'
    action:     string     // e.g. 'create'
): Promise<boolean> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return false;

    // Super admin always passes
    const isSuperAdmin = user.user.user_metadata?.role === 'super_admin';
    if (isSuperAdmin) return true;

    // Get user's role in this brand
    const { data: membership } = await supabase
        .from('team_members')
        .select('role')
        .eq('brand_id', brandId)
        .eq('user_id', user.user.id)
        .eq('status', 'active')
        .single();

    if (!membership) {
        // Check if user is the brand owner
        const { data: brand } = await supabase
            .from('brands')
            .select('user_id')
            .eq('id', brandId)
            .single();
        if (brand?.user_id === user.user.id) return true;
        return false;
    }

    // Get permissions for this role
    const { data: role } = await supabase
        .from('brand_roles')
        .select('permissions')
        .eq('brand_id', brandId)
        .eq('name', membership.role)
        .single();

    if (!role?.permissions) return false;
    return Boolean((role.permissions as any)[domain]?.[action]);
}
