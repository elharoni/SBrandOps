import { describe, expect, it } from 'vitest';
import type { BrandAsset, BrandConnection } from '../services/brandConnectionService';
import {
    flattenGa4Properties,
    getConnectionAssetLabels,
    getSavedWordPressCredentials,
} from '../services/providerConnectionService';

const makeConnection = (overrides: Partial<BrandConnection>): BrandConnection => ({
    id: 'conn-1',
    brand_id: 'brand-1',
    provider: 'ga4',
    provider_version: 'v1',
    external_account_id: null,
    external_account_name: null,
    access_token: null,
    refresh_token: null,
    token_expires_at: null,
    status: 'connected',
    sync_health: 'healthy',
    last_error: null,
    last_error_at: null,
    error_count: 0,
    last_sync_at: null,
    last_successful_sync_at: null,
    sync_frequency_minutes: 60,
    sync_history: true,
    sync_history_days: 90,
    scopes: [],
    metadata: {},
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
    ...overrides,
});

const makeAssets = (overrides: Partial<BrandAsset>): BrandAsset => ({
    websites: [],
    adAccounts: [],
    analyticsProperties: [],
    searchConsoleProperties: [],
    ...overrides,
});

describe('providerConnectionService', () => {
    it('flattens GA4 account summaries into property rows', () => {
        const flattened = flattenGa4Properties([
            {
                displayName: 'Main account',
                propertySummaries: [
                    { property: 'properties/1001', displayName: 'Primary property' },
                    { property: 'properties/1002' },
                ],
            },
        ]);

        expect(flattened).toEqual([
            {
                accountName: 'Main account',
                propertyId: 'properties/1001',
                propertyName: 'Primary property',
            },
            {
                accountName: 'Main account',
                propertyId: 'properties/1002',
                propertyName: 'properties/1002',
            },
        ]);
    });

    it('returns saved WordPress credentials only when all fields are available', () => {
        const credentials = getSavedWordPressCredentials(makeConnection({
            provider: 'wordpress',
            access_token: 'app-password',
            metadata: {
                website_url: 'https://example.com/',
                username: 'editor',
            },
        }));

        expect(credentials).toEqual({
            siteUrl: 'https://example.com/',
            username: 'editor',
            appPassword: 'app-password',
        });
        expect(getSavedWordPressCredentials(makeConnection({ provider: 'ga4' }))).toBeNull();
    });

    it('merges persisted assets and metadata labels for provider summaries', () => {
        const labels = getConnectionAssetLabels(
            makeConnection({
                provider: 'google_ads',
                external_account_name: 'Agency MCC',
                metadata: {
                    linked_assets: ['Campaigns'],
                },
            }),
            makeAssets({
                adAccounts: [
                    {
                        id: 'ad-1',
                        brand_id: 'brand-1',
                        provider: 'google_ads',
                        external_account_id: '1234567890',
                        account_name: 'Search account',
                        currency: 'USD',
                        status: 'active',
                        monthly_budget: null,
                    },
                ],
            }),
        );

        expect(labels).toEqual(['Agency MCC', 'Campaigns', 'Search account']);
    });
});
