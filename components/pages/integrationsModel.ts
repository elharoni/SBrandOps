import { AccountStatus, type SocialAccount } from '../../types';
import type { BrandConnection, Provider } from '../../services/brandConnectionService';

export type IntegrationSectionId =
    | 'publishing'
    | 'ads'
    | 'analytics'
    | 'automation'
    | 'files'
    | 'commerce';

const CONNECTION_SECTION_BY_PROVIDER: Record<Provider, IntegrationSectionId> = {
    meta: 'ads',
    instagram: 'publishing',
    x: 'publishing',
    linkedin: 'publishing',
    tiktok: 'publishing',
    youtube: 'publishing',
    snapchat: 'publishing',
    ga4: 'analytics',
    search_console: 'analytics',
    google_ads: 'ads',
    woocommerce: 'commerce',
    shopify: 'commerce',
    wordpress: 'commerce',
    slack: 'automation',
    zapier: 'automation',
    google_drive: 'files',
    figma: 'files',
};

export function getConnectionSection(provider: Provider): IntegrationSectionId {
    return CONNECTION_SECTION_BY_PROVIDER[provider];
}

export function groupConnectionsBySection(connections: BrandConnection[]): Record<IntegrationSectionId, BrandConnection[]> {
    const grouped: Record<IntegrationSectionId, BrandConnection[]> = {
        publishing: [],
        ads: [],
        analytics: [],
        automation: [],
        files: [],
        commerce: [],
    };

    for (const connection of connections) {
        grouped[getConnectionSection(connection.provider)].push(connection);
    }

    return grouped;
}

export function isLiveOperationalConnection(connection: BrandConnection): boolean {
    return connection.status !== 'disconnected';
}

export function hasLiveProviderConnection(
    brandConnections: BrandConnection[],
    providers: Provider[],
): boolean {
    return brandConnections.some((connection) =>
        providers.includes(connection.provider) && isLiveOperationalConnection(connection),
    );
}

export function countLiveOperationalConnections(
    socialAccounts: SocialAccount[],
    brandConnections: BrandConnection[],
): number {
    return socialAccounts.length + brandConnections.filter(isLiveOperationalConnection).length;
}

export function countConnectionsNeedingAttention(
    socialAccounts: SocialAccount[],
    brandConnections: BrandConnection[],
): number {
    const socialAttention = socialAccounts.filter((account) => account.status !== AccountStatus.Connected).length;
    const connectionAttention = brandConnections.filter((connection) => {
        if (connection.status === 'disconnected') {
            return false;
        }

        if (connection.status !== 'connected') {
            return true;
        }

        return connection.sync_health === 'degraded'
            || connection.sync_health === 'failing'
            || Boolean(connection.last_error);
    }).length;

    return socialAttention + connectionAttention;
}

export function countRecentlySyncedConnections(
    brandConnections: BrandConnection[],
    now: Date = new Date(),
    thresholdHours = 24,
): number {
    const threshold = now.getTime() - thresholdHours * 60 * 60 * 1000;

    return brandConnections.filter((connection) => {
        if (!isLiveOperationalConnection(connection) || !connection.last_sync_at) {
            return false;
        }

        return new Date(connection.last_sync_at).getTime() >= threshold;
    }).length;
}
