import type {
    BrandAdAccount,
    BrandAnalyticsProperty,
    BrandConnection,
    BrandSearchConsoleProperty,
    BrandWebsite,
    ConnectableBrandProvider,
} from './brandConnectionService';
import {
    saveBrandAdAccounts,
    saveBrandAnalyticsProperties,
    saveBrandSearchConsoleProperties,
    saveBrandWebsites,
    updateBrandConnectionReferences,
    upsertBrandConnectionByProvider,
} from './brandConnectionService';
import { connectShopify, runShopifyFullSync } from './shopifyIntegration';
import { connectWooCommerce, runWooFullSync } from './woocommerceIntegration';

type JsonRecord = Record<string, unknown>;

type GoogleAdsCustomerSearchResponse = {
    results?: Array<{
        customer?: {
            id?: string;
            descriptiveName?: string;
            currencyCode?: string;
        };
    }>;
};

type GA4AccountSummaryResponse = {
    accountSummaries?: Array<{
        name?: string;
        displayName?: string;
        propertySummaries?: Array<{
            property?: string;
            displayName?: string;
        }>;
    }>;
};

type GA4DataStreamsResponse = {
    dataStreams?: Array<{
        name?: string;
        displayName?: string;
        type?: string;
        webStreamData?: {
            measurementId?: string;
            defaultUri?: string;
        };
    }>;
};

type SearchConsoleSitesResponse = {
    siteEntry?: Array<{
        siteUrl?: string;
        permissionLevel?: string;
    }>;
};

type WordPressUserResponse = {
    id?: number;
    name?: string;
    slug?: string;
};

type SlackAuthTestResponse = {
    ok?: boolean;
    team?: string;
    team_id?: string;
    bot_id?: string;
    user_id?: string;
    url?: string;
    error?: string;
};

type SlackConversationInfoResponse = {
    ok?: boolean;
    channel?: {
        id?: string;
        name?: string;
    };
    error?: string;
};

type GoogleDriveAboutResponse = {
    user?: {
        displayName?: string;
        emailAddress?: string;
        permissionId?: string;
    };
};

type GoogleDriveFileResponse = {
    id?: string;
    name?: string;
    mimeType?: string;
    webViewLink?: string;
};

type FigmaMeResponse = {
    err?: string;
    user?: {
        id?: string;
        handle?: string;
        email?: string;
        img_url?: string;
    };
};

export interface GoogleAdsConnectionInput {
    accessToken: string;
    developerToken: string;
    loginCustomerId?: string;
}

export interface GA4ConnectionInput {
    accessToken: string;
}

export interface SearchConsoleConnectionInput {
    accessToken: string;
}

export interface ShopifyConnectionInput {
    shopDomain: string;
    accessToken: string;
    storeName?: string;
}

export interface WooCommerceConnectionInput {
    storeUrl: string;
    consumerKey: string;
    consumerSecret: string;
    storeName?: string;
}

export interface WordPressConnectionInput {
    siteUrl: string;
    username: string;
    appPassword: string;
    websiteName?: string;
}

export interface SlackConnectionInput {
    botToken: string;
    channelId?: string;
}

export interface ZapierConnectionInput {
    webhookUrl: string;
    workflowName?: string;
    sharedSecret?: string;
}

export interface GoogleDriveConnectionInput {
    accessToken: string;
    folderId?: string;
}

export interface FigmaConnectionInput {
    personalAccessToken: string;
    teamId?: string;
    teamName?: string;
}

export type ProviderConnectionInputMap = {
    google_ads: GoogleAdsConnectionInput;
    ga4: GA4ConnectionInput;
    search_console: SearchConsoleConnectionInput;
    shopify: ShopifyConnectionInput;
    woocommerce: WooCommerceConnectionInput;
    wordpress: WordPressConnectionInput;
    slack: SlackConnectionInput;
    zapier: ZapierConnectionInput;
    google_drive: GoogleDriveConnectionInput;
    figma: FigmaConnectionInput;
};

export interface OAuthCallbackResult {
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number;
    provider: ConnectableBrandProvider;
}

export async function initiateGoogleOAuth(brandId: string, provider: ConnectableBrandProvider): Promise<OAuthCallbackResult> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL configuration missing.');
    }

    return new Promise((resolve, reject) => {
        const authUrl = `${supabaseUrl}/functions/v1/google-oauth/init?brand_id=${encodeURIComponent(brandId)}&provider=${encodeURIComponent(provider)}`;
        const popup = window.open(authUrl, `oauth_${provider}`, 'width=600,height=700,left=300,top=100');

        if (!popup) {
            reject(new Error('Popup blocked! Please allow popups and try again.'));
            return;
        }

        let attempts = 0;
        const maxAttempts = 120; // 60 seconds

        const interval = setInterval(() => {
            attempts++;
            if (popup.closed) {
                clearInterval(interval);
                reject(new Error('Login popup was closed before completion.'));
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                popup.close();
                reject(new Error('Login timed out after 60 seconds.'));
            }
        }, 500);

        const messageHandler = (event: MessageEvent) => {
            const data = event.data;
            if (data?.type === 'OAUTH_SUCCESS' && data?.provider === provider) {
                clearInterval(interval);
                window.removeEventListener('message', messageHandler);
                resolve({
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken || null,
                    expiresIn: data.expiresIn || 3600,
                    provider,
                });
            } else if (data?.type === 'OAUTH_ERROR' && data?.provider === provider) {
                clearInterval(interval);
                window.removeEventListener('message', messageHandler);
                reject(new Error(data.error || 'OAuth flow failed'));
            }
        };

        window.addEventListener('message', messageHandler);
    });
}

export interface ProviderConnectionResult {
    connection: BrandConnection;
    linkedAssetLabels: string[];
    assetCounts: {
        adAccounts?: number;
        analyticsProperties?: number;
        searchConsoleProperties?: number;
        websites?: number;
    };
}

type GA4DiscoveredProperty = {
    propertyId: string;
    propertyName: string;
    measurementId: string | null;
    websiteUrl: string | null;
};

function trimRequired(value: string, label: string): string {
    const next = value.trim();
    if (!next) {
        throw new Error(`${label} is required.`);
    }

    return next;
}

function normalizeCustomerId(value: string): string {
    return value.replace(/\D/g, '');
}

function normalizeShopDomain(value: string): string {
    const trimmed = trimRequired(value, 'Shop domain');
    return trimmed.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function normalizeWebsiteUrl(value: string, label: string): string {
    const trimmed = trimRequired(value, label);
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withScheme);
    return `${url.origin}${url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '/')}`;
}

function getFunctionsBaseUrl(): string | null {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!supabaseUrl) {
        return null;
    }

    return `${supabaseUrl.replace(/\/$/, '')}/functions/v1`;
}

function buildStandardProviderMetadata(
    brandId: string,
    provider: ConnectableBrandProvider,
    overrides: JsonRecord = {},
): JsonRecord {
    const functionsBaseUrl = getFunctionsBaseUrl();

    return {
        oauth_callback_url: functionsBaseUrl ? `${functionsBaseUrl}/provider-oauth-callback` : null,
        webhook_url: functionsBaseUrl
            ? `${functionsBaseUrl}/provider-webhook?brand_id=${encodeURIComponent(brandId)}&provider=${encodeURIComponent(provider)}`
            : null,
        provider_runtime: provider,
        configured_at: new Date().toISOString(),
        ...overrides,
    };
}

function readMetadataString(connection: BrandConnection, key: string): string | undefined {
    const value = connection.metadata?.[key];
    return typeof value === 'string' && value.trim() ? value : undefined;
}

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${fallbackMessage}: ${errorText || response.statusText}`);
    }

    return response.json() as Promise<T>;
}

async function fetchGoogleJson<T>(
    url: string,
    accessToken: string,
    init: RequestInit = {},
    extraHeaders: Record<string, string> = {},
): Promise<T> {
    const response = await fetch(url, {
        ...init,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(init.headers ?? {}),
            ...extraHeaders,
        },
    });

    return readJsonResponse<T>(response, 'Google API request failed');
}

async function fetchSlackJson<T>(endpoint: string, token: string): Promise<T> {
    const response = await fetch(`https://slack.com/api/${endpoint}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    return readJsonResponse<T>(response, 'Slack API request failed');
}

async function fetchFigmaJson<T>(endpoint: string, token: string): Promise<T> {
    const response = await fetch(`https://api.figma.com/v1/${endpoint}`, {
        headers: {
            'X-Figma-Token': token,
        },
    });

    return readJsonResponse<T>(response, 'Figma API request failed');
}

async function fetchGoogleAdsCustomer(
    accessToken: string,
    developerToken: string,
    customerId: string,
    loginCustomerId?: string,
): Promise<{ external_account_id: string; account_name: string | null; currency: string | null }> {
    const response = await fetch(`https://googleads.googleapis.com/v19/customers/${customerId}/googleAds:search`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'developer-token': developerToken,
            ...(loginCustomerId ? { 'login-customer-id': normalizeCustomerId(loginCustomerId) } : {}),
        },
        body: JSON.stringify({
            query: 'SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer LIMIT 1',
        }),
    });

    const data = await readJsonResponse<GoogleAdsCustomerSearchResponse>(response, 'Google Ads account lookup failed');
    const customer = data.results?.[0]?.customer;
    if (!customer?.id) {
        throw new Error(`Google Ads account ${customerId} did not return customer details.`);
    }

    return {
        external_account_id: String(customer.id),
        account_name: customer.descriptiveName ?? null,
        currency: customer.currencyCode ?? null,
    };
}

export function flattenGa4Properties(
    summaries: GA4AccountSummaryResponse['accountSummaries'] = [],
): Array<{ accountName: string | null; propertyId: string; propertyName: string }> {
    return summaries.flatMap((account) =>
        (account.propertySummaries ?? [])
            .filter((property): property is NonNullable<typeof property> & { property: string } => Boolean(property?.property))
            .map((property) => ({
                accountName: account.displayName ?? null,
                propertyId: property.property,
                propertyName: property.displayName ?? property.property,
            })),
    );
}

async function discoverGa4Properties(accessToken: string): Promise<GA4DiscoveredProperty[]> {
    const summary = await fetchGoogleJson<GA4AccountSummaryResponse>(
        'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
        accessToken,
    );

    const flattened = flattenGa4Properties(summary.accountSummaries);
    if (flattened.length === 0) {
        throw new Error('No GA4 properties were discovered for this Google account.');
    }

    const properties = await Promise.all(flattened.map(async (property) => {
        const dataStreams = await fetchGoogleJson<GA4DataStreamsResponse>(
            `https://analyticsadmin.googleapis.com/v1beta/${property.propertyId}/dataStreams`,
            accessToken,
        );

        const webStream = (dataStreams.dataStreams ?? []).find((stream) => stream.webStreamData?.measurementId);

        return {
            propertyId: property.propertyId,
            propertyName: property.propertyName,
            measurementId: webStream?.webStreamData?.measurementId ?? null,
            websiteUrl: webStream?.webStreamData?.defaultUri ?? null,
        };
    }));

    return properties;
}

async function discoverSearchConsoleSites(accessToken: string): Promise<SearchConsoleSitesResponse['siteEntry']> {
    const response = await fetchGoogleJson<SearchConsoleSitesResponse>(
        'https://www.googleapis.com/webmasters/v3/sites',
        accessToken,
    );

    return response.siteEntry ?? [];
}

async function validateWordPressConnection(input: WordPressConnectionInput): Promise<{ siteName: string; username: string; normalizedUrl: string }> {
    const normalizedUrl = normalizeWebsiteUrl(input.siteUrl, 'Site URL');
    const username = trimRequired(input.username, 'WordPress username');
    const appPassword = trimRequired(input.appPassword, 'WordPress application password');
    const basicToken = btoa(`${username}:${appPassword}`);

    const response = await fetch(`${normalizedUrl.replace(/\/$/, '')}/wp-json/wp/v2/users/me?context=edit`, {
        headers: {
            Authorization: `Basic ${basicToken}`,
        },
    });

    const user = await readJsonResponse<WordPressUserResponse>(response, 'WordPress credential validation failed');

    return {
        siteName: input.websiteName?.trim() || user.name || user.slug || new URL(normalizedUrl).hostname,
        username,
        normalizedUrl,
    };
}

async function persistGoogleAdsConnection(
    brandId: string,
    input: GoogleAdsConnectionInput,
): Promise<ProviderConnectionResult> {
    const accessToken = trimRequired(input.accessToken, 'Google Ads access token');
    const inputDeveloperToken = input.developerToken?.trim() || import.meta.env.VITE_GOOGLE_DEVELOPER_TOKEN;
    const developerToken = trimRequired(inputDeveloperToken || '', 'Google Ads developer token');
    const accessible = await fetchGoogleJson<{ resourceNames?: string[] }>(
        'https://googleads.googleapis.com/v19/customers:listAccessibleCustomers',
        accessToken,
        {},
        { 'developer-token': developerToken },
    );

    const customerIds = [...new Set((accessible.resourceNames ?? []).map((name) => normalizeCustomerId(name)).filter(Boolean))];
    if (customerIds.length === 0) {
        throw new Error('No accessible Google Ads customer accounts were returned.');
    }

    const discovered = await Promise.all(customerIds.map((customerId) =>
        fetchGoogleAdsCustomer(accessToken, developerToken, customerId, input.loginCustomerId),
    ));

    const savedAccounts = await saveBrandAdAccounts(brandId, 'google_ads', discovered.map((account) => ({
        external_account_id: account.external_account_id,
        account_name: account.account_name,
        currency: account.currency,
        status: 'active',
    })));

    const primary = savedAccounts[0];
    const connection = await upsertBrandConnectionByProvider(brandId, 'google_ads', {
        external_account_id: primary?.external_account_id ?? customerIds[0],
        external_account_name: primary?.account_name ?? 'Google Ads',
        access_token: accessToken,
        status: 'connected',
        sync_health: 'healthy',
        last_error: null,
        last_sync_at: new Date().toISOString(),
        metadata: buildStandardProviderMetadata(brandId, 'google_ads', {
            developer_token: developerToken,
            login_customer_id: input.loginCustomerId ? normalizeCustomerId(input.loginCustomerId) : null,
            linked_assets: savedAccounts.map((account) => account.account_name || account.external_account_id),
            account_count: savedAccounts.length,
        }),
    });

    await updateBrandConnectionReferences(connection.id, {
        ad_account_id: primary?.id ?? null,
    });

    return {
        connection,
        linkedAssetLabels: savedAccounts.map((account) => account.account_name || account.external_account_id),
        assetCounts: {
            adAccounts: savedAccounts.length,
        },
    };
}

async function persistGa4Connection(
    brandId: string,
    input: GA4ConnectionInput,
): Promise<ProviderConnectionResult> {
    const accessToken = trimRequired(input.accessToken, 'GA4 access token');
    const properties = await discoverGa4Properties(accessToken);

    const savedProperties = await saveBrandAnalyticsProperties(brandId, properties.map((property, index) => ({
        property_id: property.propertyId,
        property_name: property.propertyName,
        measurement_id: property.measurementId,
        is_primary: index === 0,
        status: 'active',
    })));

    const websiteInputs = properties
        .filter((property): property is GA4DiscoveredProperty & { websiteUrl: string } => Boolean(property.websiteUrl))
        .map((property, index) => ({
            url: property.websiteUrl,
            platform: 'ga4',
            is_primary: index === 0,
            status: 'active',
        }));

    const savedWebsites = websiteInputs.length > 0 ? await saveBrandWebsites(brandId, websiteInputs) : [];
    const primaryProperty = savedProperties[0];

    const connection = await upsertBrandConnectionByProvider(brandId, 'ga4', {
        external_account_id: primaryProperty?.property_id ?? properties[0].propertyId,
        external_account_name: primaryProperty?.property_name ?? properties[0].propertyName,
        access_token: accessToken,
        status: 'connected',
        sync_health: 'healthy',
        last_error: null,
        last_sync_at: new Date().toISOString(),
        metadata: buildStandardProviderMetadata(brandId, 'ga4', {
            linked_assets: savedProperties.map((property) => property.property_name || property.property_id),
            property_count: savedProperties.length,
        }),
    });

    await updateBrandConnectionReferences(connection.id, {
        analytics_property_id: primaryProperty?.id ?? null,
        website_id: savedWebsites[0]?.id ?? null,
    });

    return {
        connection,
        linkedAssetLabels: savedProperties.map((property) => property.property_name || property.property_id),
        assetCounts: {
            analyticsProperties: savedProperties.length,
            websites: savedWebsites.length,
        },
    };
}

async function persistSearchConsoleConnection(
    brandId: string,
    input: SearchConsoleConnectionInput,
): Promise<ProviderConnectionResult> {
    const accessToken = trimRequired(input.accessToken, 'Search Console access token');
    const sites = await discoverSearchConsoleSites(accessToken);
    if (sites.length === 0) {
        throw new Error('No Search Console properties were discovered for this Google account.');
    }

    const savedProperties = await saveBrandSearchConsoleProperties(brandId, sites
        .filter((site): site is NonNullable<typeof site> & { siteUrl: string } => Boolean(site?.siteUrl))
        .map((site) => ({
            site_url: site.siteUrl,
            property_type: site.siteUrl.startsWith('sc-domain:') ? 'domain' : 'url',
            permission_level: site.permissionLevel ?? null,
            is_verified: site.permissionLevel === 'siteOwner' || site.permissionLevel === 'siteFullUser',
            status: 'active',
        })));

    const savedWebsites = await saveBrandWebsites(
        brandId,
        savedProperties
            .filter((property) => property.site_url.startsWith('http'))
            .map((property, index) => ({
                url: property.site_url,
                platform: 'search_console',
                is_primary: index === 0,
                status: 'active',
            })),
    );

    const primary = savedProperties[0];
    const connection = await upsertBrandConnectionByProvider(brandId, 'search_console', {
        external_account_id: primary?.site_url ?? sites[0]?.siteUrl ?? 'search-console',
        external_account_name: primary?.site_url ?? sites[0]?.siteUrl ?? 'Search Console',
        access_token: accessToken,
        status: 'connected',
        sync_health: 'healthy',
        last_error: null,
        last_sync_at: new Date().toISOString(),
        metadata: buildStandardProviderMetadata(brandId, 'search_console', {
            linked_assets: savedProperties.map((property) => property.site_url),
            property_count: savedProperties.length,
        }),
    });

    await updateBrandConnectionReferences(connection.id, {
        search_console_property_id: primary?.id ?? null,
        website_id: savedWebsites[0]?.id ?? null,
    });

    return {
        connection,
        linkedAssetLabels: savedProperties.map((property) => property.site_url),
        assetCounts: {
            searchConsoleProperties: savedProperties.length,
            websites: savedWebsites.length,
        },
    };
}

async function persistShopifyConnection(
    brandId: string,
    input: ShopifyConnectionInput,
): Promise<ProviderConnectionResult> {
    const shopDomain = normalizeShopDomain(input.shopDomain);
    const accessToken = trimRequired(input.accessToken, 'Shopify access token');
    const storeConnection = await connectShopify(brandId, shopDomain, accessToken, input.storeName?.trim() || undefined);
    if (!storeConnection) {
        throw new Error('Shopify store connection could not be created.');
    }

    const syncResult = await runShopifyFullSync(brandId, storeConnection.id, shopDomain, accessToken);
    const savedWebsites = await saveBrandWebsites(brandId, [{
        url: `https://${shopDomain}/`,
        platform: 'shopify',
        is_primary: true,
        status: 'active',
    }]);

    const connection = await upsertBrandConnectionByProvider(brandId, 'shopify', {
        external_account_id: shopDomain,
        external_account_name: input.storeName?.trim() || shopDomain,
        access_token: accessToken,
        status: syncResult.errors.length > 0 ? 'error' : 'connected',
        sync_health: syncResult.errors.length > 0 ? 'degraded' : 'healthy',
        last_error: syncResult.errors[0] ?? null,
        last_sync_at: new Date().toISOString(),
        metadata: buildStandardProviderMetadata(brandId, 'shopify', {
            store_connection_id: storeConnection.id,
            website_url: `https://${shopDomain}/`,
            linked_assets: [input.storeName?.trim() || shopDomain],
            customers_processed: syncResult.customersProcessed,
            orders_processed: syncResult.ordersProcessed,
        }),
    });

    await updateBrandConnectionReferences(connection.id, {
        website_id: savedWebsites[0]?.id ?? null,
    });

    return {
        connection,
        linkedAssetLabels: [input.storeName?.trim() || shopDomain],
        assetCounts: {
            websites: savedWebsites.length,
        },
    };
}

async function persistWooCommerceConnection(
    brandId: string,
    input: WooCommerceConnectionInput,
): Promise<ProviderConnectionResult> {
    const storeUrl = normalizeWebsiteUrl(input.storeUrl, 'WooCommerce store URL');
    const consumerKey = trimRequired(input.consumerKey, 'WooCommerce consumer key');
    const consumerSecret = trimRequired(input.consumerSecret, 'WooCommerce consumer secret');
    const storeConnection = await connectWooCommerce(brandId, storeUrl, consumerKey, consumerSecret, input.storeName?.trim() || undefined);
    if (!storeConnection) {
        throw new Error('WooCommerce store connection could not be created.');
    }

    const syncResult = await runWooFullSync(brandId, storeConnection.id, storeUrl, consumerKey, consumerSecret);
    const savedWebsites = await saveBrandWebsites(brandId, [{
        url: storeUrl,
        platform: 'woocommerce',
        is_primary: true,
        status: 'active',
    }]);

    const connection = await upsertBrandConnectionByProvider(brandId, 'woocommerce', {
        external_account_id: new URL(storeUrl).hostname,
        external_account_name: input.storeName?.trim() || new URL(storeUrl).hostname,
        access_token: consumerKey,
        refresh_token: consumerSecret,
        status: syncResult.errors.length > 0 ? 'error' : 'connected',
        sync_health: syncResult.errors.length > 0 ? 'degraded' : 'healthy',
        last_error: syncResult.errors[0] ?? null,
        last_sync_at: new Date().toISOString(),
        metadata: buildStandardProviderMetadata(brandId, 'woocommerce', {
            store_connection_id: storeConnection.id,
            website_url: storeUrl,
            linked_assets: [input.storeName?.trim() || new URL(storeUrl).hostname],
            customers_processed: syncResult.customersProcessed,
            orders_processed: syncResult.ordersProcessed,
        }),
    });

    await updateBrandConnectionReferences(connection.id, {
        website_id: savedWebsites[0]?.id ?? null,
    });

    return {
        connection,
        linkedAssetLabels: [input.storeName?.trim() || new URL(storeUrl).hostname],
        assetCounts: {
            websites: savedWebsites.length,
        },
    };
}

async function persistWordPressConnection(
    brandId: string,
    input: WordPressConnectionInput,
): Promise<ProviderConnectionResult> {
    const validated = await validateWordPressConnection(input);
    const savedWebsites = await saveBrandWebsites(brandId, [{
        url: validated.normalizedUrl,
        platform: 'wordpress',
        is_primary: true,
        status: 'active',
    }]);

    const connection = await upsertBrandConnectionByProvider(brandId, 'wordpress', {
        external_account_id: new URL(validated.normalizedUrl).hostname,
        external_account_name: validated.siteName,
        access_token: trimRequired(input.appPassword, 'WordPress application password'),
        status: 'connected',
        sync_health: 'healthy',
        last_error: null,
        last_sync_at: new Date().toISOString(),
        metadata: buildStandardProviderMetadata(brandId, 'wordpress', {
            username: validated.username,
            website_url: validated.normalizedUrl,
            linked_assets: [validated.siteName, new URL(validated.normalizedUrl).hostname],
        }),
    });

    await updateBrandConnectionReferences(connection.id, {
        website_id: savedWebsites[0]?.id ?? null,
    });

    return {
        connection,
        linkedAssetLabels: [validated.siteName],
        assetCounts: {
            websites: savedWebsites.length,
        },
    };
}

async function persistSlackConnection(
    brandId: string,
    input: SlackConnectionInput,
): Promise<ProviderConnectionResult> {
    const botToken = trimRequired(input.botToken, 'Slack bot token');
    const auth = await fetchSlackJson<SlackAuthTestResponse>('auth.test', botToken);
    if (!auth.ok || !auth.team_id) {
        throw new Error(auth.error ? `Slack validation failed: ${auth.error}` : 'Slack validation failed.');
    }

    let channelName: string | null = null;
    const channelId = input.channelId?.trim() || null;
    if (channelId) {
        const info = await fetchSlackJson<SlackConversationInfoResponse>(`conversations.info?channel=${encodeURIComponent(channelId)}`, botToken);
        if (!info.ok) {
            throw new Error(info.error ? `Slack channel lookup failed: ${info.error}` : 'Slack channel lookup failed.');
        }
        channelName = info.channel?.name ?? channelId;
    }

    const linkedAssets = [auth.team, channelName].filter((value): value is string => Boolean(value));
    const connection = await upsertBrandConnectionByProvider(brandId, 'slack', {
        external_account_id: auth.team_id,
        external_account_name: auth.team ?? 'Slack workspace',
        access_token: botToken,
        status: 'connected',
        sync_health: 'healthy',
        last_error: null,
        last_sync_at: new Date().toISOString(),
        metadata: buildStandardProviderMetadata(brandId, 'slack', {
            workspace_url: auth.url ?? null,
            bot_id: auth.bot_id ?? null,
            user_id: auth.user_id ?? null,
            channel_id: channelId,
            channel_name: channelName,
            linked_assets: linkedAssets,
        }),
    });

    return {
        connection,
        linkedAssetLabels: linkedAssets.length > 0 ? linkedAssets : [auth.team ?? auth.team_id],
        assetCounts: {},
    };
}

async function persistZapierConnection(
    brandId: string,
    input: ZapierConnectionInput,
): Promise<ProviderConnectionResult> {
    const webhookUrl = trimRequired(input.webhookUrl, 'Zapier webhook URL');
    const normalizedWebhookUrl = normalizeWebsiteUrl(webhookUrl, 'Zapier webhook URL');
    const host = new URL(normalizedWebhookUrl).hostname;
    const workflowName = input.workflowName?.trim() || 'Zapier workflow';
    const linkedAssets = [workflowName, host];

    const connection = await upsertBrandConnectionByProvider(brandId, 'zapier', {
        external_account_id: host,
        external_account_name: workflowName,
        status: 'connected',
        sync_health: 'healthy',
        last_error: null,
        last_sync_at: new Date().toISOString(),
        metadata: buildStandardProviderMetadata(brandId, 'zapier', {
            inbound_webhook_url: normalizedWebhookUrl,
            shared_secret: input.sharedSecret?.trim() || null,
            linked_assets: linkedAssets,
        }),
    });

    return {
        connection,
        linkedAssetLabels: linkedAssets,
        assetCounts: {},
    };
}

async function persistGoogleDriveConnection(
    brandId: string,
    input: GoogleDriveConnectionInput,
): Promise<ProviderConnectionResult> {
    const accessToken = trimRequired(input.accessToken, 'Google Drive access token');
    const about = await fetchGoogleJson<GoogleDriveAboutResponse>(
        'https://www.googleapis.com/drive/v3/about?fields=user',
        accessToken,
    );

    const displayName = about.user?.displayName?.trim() || about.user?.emailAddress?.trim() || 'Google Drive';
    const externalId = about.user?.permissionId?.trim() || about.user?.emailAddress?.trim() || displayName;

    let folderName: string | null = null;
    const folderId = input.folderId?.trim() || null;
    if (folderId) {
        const folder = await fetchGoogleJson<GoogleDriveFileResponse>(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,webViewLink`,
            accessToken,
        );
        folderName = folder.name?.trim() || folderId;
    }

    const linkedAssets = [displayName, folderName].filter((value): value is string => Boolean(value));
    const connection = await upsertBrandConnectionByProvider(brandId, 'google_drive', {
        external_account_id: externalId,
        external_account_name: displayName,
        access_token: accessToken,
        status: 'connected',
        sync_health: 'healthy',
        last_error: null,
        last_sync_at: new Date().toISOString(),
        metadata: buildStandardProviderMetadata(brandId, 'google_drive', {
            drive_email: about.user?.emailAddress ?? null,
            folder_id: folderId,
            folder_name: folderName,
            linked_assets: linkedAssets,
        }),
    });

    return {
        connection,
        linkedAssetLabels: linkedAssets,
        assetCounts: {},
    };
}

async function persistFigmaConnection(
    brandId: string,
    input: FigmaConnectionInput,
): Promise<ProviderConnectionResult> {
    const personalAccessToken = trimRequired(input.personalAccessToken, 'Figma personal access token');
    const me = await fetchFigmaJson<FigmaMeResponse>('me', personalAccessToken);
    if (me.err || !me.user?.id) {
        throw new Error(me.err ? `Figma validation failed: ${me.err}` : 'Figma validation failed.');
    }

    const accountName = me.user.handle?.trim() || me.user.email?.trim() || 'Figma workspace';
    const teamId = input.teamId?.trim() || null;
    const teamName = input.teamName?.trim() || null;
    const linkedAssets = [accountName, teamName].filter((value): value is string => Boolean(value));

    const connection = await upsertBrandConnectionByProvider(brandId, 'figma', {
        external_account_id: me.user.id,
        external_account_name: accountName,
        access_token: personalAccessToken,
        status: 'connected',
        sync_health: 'healthy',
        last_error: null,
        last_sync_at: new Date().toISOString(),
        metadata: buildStandardProviderMetadata(brandId, 'figma', {
            team_id: teamId,
            team_name: teamName,
            figma_email: me.user.email ?? null,
            linked_assets: linkedAssets,
        }),
    });

    return {
        connection,
        linkedAssetLabels: linkedAssets.length > 0 ? linkedAssets : [accountName],
        assetCounts: {},
    };
}

export async function connectProvider<TProvider extends ConnectableBrandProvider>(
    brandId: string,
    provider: TProvider,
    input: ProviderConnectionInputMap[TProvider],
): Promise<ProviderConnectionResult> {
    switch (provider) {
        case 'google_ads':
            return persistGoogleAdsConnection(brandId, input as ProviderConnectionInputMap['google_ads']);
        case 'ga4':
            return persistGa4Connection(brandId, input as ProviderConnectionInputMap['ga4']);
        case 'search_console':
            return persistSearchConsoleConnection(brandId, input as ProviderConnectionInputMap['search_console']);
        case 'shopify':
            return persistShopifyConnection(brandId, input as ProviderConnectionInputMap['shopify']);
        case 'woocommerce':
            return persistWooCommerceConnection(brandId, input as ProviderConnectionInputMap['woocommerce']);
        case 'wordpress':
            return persistWordPressConnection(brandId, input as ProviderConnectionInputMap['wordpress']);
        case 'slack':
            return persistSlackConnection(brandId, input as ProviderConnectionInputMap['slack']);
        case 'zapier':
            return persistZapierConnection(brandId, input as ProviderConnectionInputMap['zapier']);
        case 'google_drive':
            return persistGoogleDriveConnection(brandId, input as ProviderConnectionInputMap['google_drive']);
        case 'figma':
            return persistFigmaConnection(brandId, input as ProviderConnectionInputMap['figma']);
        default:
            throw new Error(`Provider ${provider satisfies never} is not supported.`);
    }
}

function buildRefreshInput(connection: BrandConnection): ProviderConnectionInputMap[ConnectableBrandProvider] {
    switch (connection.provider) {
        case 'google_ads':
            return {
                accessToken: trimRequired(connection.access_token ?? '', 'Google Ads access token'),
                developerToken: trimRequired(readMetadataString(connection, 'developer_token') ?? '', 'Google Ads developer token'),
                loginCustomerId: readMetadataString(connection, 'login_customer_id'),
            };
        case 'ga4':
            return {
                accessToken: trimRequired(connection.access_token ?? '', 'GA4 access token'),
            };
        case 'search_console':
            return {
                accessToken: trimRequired(connection.access_token ?? '', 'Search Console access token'),
            };
        case 'shopify':
            return {
                shopDomain: trimRequired(connection.external_account_id ?? '', 'Shopify shop domain'),
                accessToken: trimRequired(connection.access_token ?? '', 'Shopify access token'),
                storeName: connection.external_account_name ?? undefined,
            };
        case 'woocommerce':
            return {
                storeUrl: trimRequired(readMetadataString(connection, 'website_url') ?? connection.external_account_id ?? '', 'WooCommerce store URL'),
                consumerKey: trimRequired(connection.access_token ?? '', 'WooCommerce consumer key'),
                consumerSecret: trimRequired(connection.refresh_token ?? '', 'WooCommerce consumer secret'),
                storeName: connection.external_account_name ?? undefined,
            };
        case 'wordpress':
            return {
                siteUrl: trimRequired(readMetadataString(connection, 'website_url') ?? connection.external_account_id ?? '', 'WordPress site URL'),
                username: trimRequired(readMetadataString(connection, 'username') ?? '', 'WordPress username'),
                appPassword: trimRequired(connection.access_token ?? '', 'WordPress application password'),
                websiteName: connection.external_account_name ?? undefined,
            };
        case 'slack':
            return {
                botToken: trimRequired(connection.access_token ?? '', 'Slack bot token'),
                channelId: readMetadataString(connection, 'channel_id'),
            };
        case 'zapier':
            return {
                webhookUrl: trimRequired(readMetadataString(connection, 'inbound_webhook_url') ?? '', 'Zapier webhook URL'),
                workflowName: connection.external_account_name ?? undefined,
                sharedSecret: readMetadataString(connection, 'shared_secret'),
            };
        case 'google_drive':
            return {
                accessToken: trimRequired(connection.access_token ?? '', 'Google Drive access token'),
                folderId: readMetadataString(connection, 'folder_id'),
            };
        case 'figma':
            return {
                personalAccessToken: trimRequired(connection.access_token ?? '', 'Figma personal access token'),
                teamId: readMetadataString(connection, 'team_id'),
                teamName: readMetadataString(connection, 'team_name') || undefined,
            };
        default:
            throw new Error(`Provider ${connection.provider} cannot be refreshed.`);
    }
}

export async function refreshProviderConnection(
    brandId: string,
    connection: BrandConnection,
): Promise<ProviderConnectionResult> {
    if (!(
        connection.provider === 'google_ads'
        || connection.provider === 'ga4'
        || connection.provider === 'search_console'
        || connection.provider === 'shopify'
        || connection.provider === 'woocommerce'
        || connection.provider === 'wordpress'
        || connection.provider === 'slack'
        || connection.provider === 'zapier'
        || connection.provider === 'google_drive'
        || connection.provider === 'figma'
    )) {
        throw new Error(`Provider ${connection.provider} does not support refresh.`);
    }

    return connectProvider(
        brandId,
        connection.provider,
        buildRefreshInput(connection) as ProviderConnectionInputMap[typeof connection.provider],
    );
}

export function getSavedWordPressCredentials(connection: BrandConnection): {
    siteUrl: string;
    username: string;
    appPassword: string;
} | null {
    if (connection.provider !== 'wordpress') {
        return null;
    }

    const siteUrl = readMetadataString(connection, 'website_url');
    const username = readMetadataString(connection, 'username');
    const appPassword = connection.access_token ?? '';

    if (!siteUrl || !username || !appPassword) {
        return null;
    }

    return {
        siteUrl,
        username,
        appPassword,
    };
}

export function getReferencedAnalyticsProperty(
    connection: BrandConnection | null | undefined,
    assets: { analyticsProperties?: BrandAnalyticsProperty[] } | null,
): BrandAnalyticsProperty | null {
    if (!assets?.analyticsProperties?.length) {
        return null;
    }

    if (connection?.analytics_property_id) {
        const exact = assets.analyticsProperties.find((property) => property.id === connection.analytics_property_id);
        if (exact) {
            return exact;
        }
    }

    return assets.analyticsProperties.find((property) => property.is_primary) ?? assets.analyticsProperties[0] ?? null;
}

export function getReferencedSearchConsoleProperty(
    connection: BrandConnection | null | undefined,
    assets: { searchConsoleProperties?: BrandSearchConsoleProperty[] } | null,
): BrandSearchConsoleProperty | null {
    if (!assets?.searchConsoleProperties?.length) {
        return null;
    }

    if (connection?.search_console_property_id) {
        const exact = assets.searchConsoleProperties.find((property) => property.id === connection.search_console_property_id);
        if (exact) {
            return exact;
        }
    }

    return assets.searchConsoleProperties.find((property) => property.is_verified) ?? assets.searchConsoleProperties[0] ?? null;
}

export function getReferencedWebsite(
    connection: BrandConnection | null | undefined,
    assets: { websites?: BrandWebsite[] } | null,
    provider?: string,
): BrandWebsite | null {
    if (!assets?.websites?.length) {
        return null;
    }

    if (connection?.website_id) {
        const exact = assets.websites.find((website) => website.id === connection.website_id);
        if (exact) {
            return exact;
        }
    }

    if (provider) {
        const scoped = assets.websites.find((website) => (website.platform || '').toLowerCase() === provider.toLowerCase());
        if (scoped) {
            return scoped;
        }
    }

    return assets.websites.find((website) => website.is_primary) ?? assets.websites[0] ?? null;
}

export function getConnectionAssetLabels(
    connection: BrandConnection,
    assets: {
        adAccounts?: BrandAdAccount[];
        analyticsProperties?: BrandAnalyticsProperty[];
        searchConsoleProperties?: BrandSearchConsoleProperty[];
        websites?: BrandWebsite[];
    } | null,
): string[] {
    const labels = new Set<string>();

    if (connection.external_account_name) {
        labels.add(connection.external_account_name);
    }

    const metadataLabels = connection.metadata?.linked_assets;
    if (Array.isArray(metadataLabels)) {
        for (const label of metadataLabels) {
            if (typeof label === 'string' && label.trim()) {
                labels.add(label);
            }
        }
    }

    if (!assets) {
        return Array.from(labels).slice(0, 4);
    }

    if (connection.provider === 'google_ads') {
        for (const account of assets.adAccounts ?? []) {
            if (account.provider === 'google_ads') {
                labels.add(account.account_name || account.external_account_id);
            }
        }
    }

    if (connection.provider === 'ga4') {
        for (const property of assets.analyticsProperties ?? []) {
            if (property.provider === 'ga4') {
                labels.add(property.property_name || property.property_id);
            }
        }
    }

    if (connection.provider === 'search_console') {
        for (const property of assets.searchConsoleProperties ?? []) {
            labels.add(property.site_url);
        }
    }

    if (connection.provider === 'shopify' || connection.provider === 'woocommerce' || connection.provider === 'wordpress') {
        for (const website of assets.websites ?? []) {
            if ((website.platform || '').toLowerCase() === connection.provider) {
                labels.add(website.domain);
            }
        }
    }

    return Array.from(labels).slice(0, 4);
}
