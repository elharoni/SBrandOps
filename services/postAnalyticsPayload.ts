import { SocialPlatform } from '../types';

export interface PostAnalyticsWriteInput {
    postId: string;
    brandId?: string;
    briefId?: string;
    watchlistId?: string;
    platform: SocialPlatform;
    platformPostId?: string;
    impressions?: number;
    reach?: number;
    engagement?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    clicks?: number;
    saves?: number;
    videoViews?: number;
    fetchedAt?: Date | string;
}

export interface PostAnalyticsInsertPayload {
    post_id: string;
    brand_id?: string;
    brief_id: string | null;
    watchlist_id: string | null;
    platform: SocialPlatform;
    platform_post_id: string | null;
    impressions: number;
    reach: number;
    engagement: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    saves: number;
    video_views: number;
    fetched_at: string;
}

function normalizeDate(value?: Date | string): string {
    if (!value) {
        return new Date().toISOString();
    }

    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function buildPostAnalyticsInsertPayload(input: PostAnalyticsWriteInput): PostAnalyticsInsertPayload {
    return {
        post_id: input.postId,
        ...(input.brandId ? { brand_id: input.brandId } : {}),
        brief_id: input.briefId ?? null,
        watchlist_id: input.watchlistId ?? null,
        platform: input.platform,
        platform_post_id: input.platformPostId ?? null,
        impressions: input.impressions ?? 0,
        reach: input.reach ?? 0,
        engagement: input.engagement ?? 0,
        likes: input.likes ?? 0,
        comments: input.comments ?? 0,
        shares: input.shares ?? 0,
        clicks: input.clicks ?? 0,
        saves: input.saves ?? 0,
        video_views: input.videoViews ?? 0,
        fetched_at: normalizeDate(input.fetchedAt),
    };
}
