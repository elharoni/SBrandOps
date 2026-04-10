import { supabase } from './supabaseClient';
import { SocialPlatform } from '../types';
import { buildPostAnalyticsInsertPayload, type PostAnalyticsWriteInput } from './postAnalyticsPayload';

export interface PostAnalytics extends Omit<PostAnalyticsWriteInput, 'fetchedAt'> {
    briefId?: string;
    watchlistId?: string;
    fetchedAt: Date;
}

export interface AnalyticsSummary {
    totalImpressions: number;
    totalReach: number;
    totalEngagement: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    engagementRate: number;
}

/**
 * حفظ تحليلات منشور
 */
export async function recordPostAnalytics(analytics: PostAnalytics): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('post_analytics')
            .insert([buildPostAnalyticsInsertPayload(analytics)]);

        if (error) {
            console.error('Error saving post analytics:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Save analytics error:', error);
        return false;
    }
}

export const savePostAnalytics = recordPostAnalytics;

/**
 * الحصول على تحليلات منشور معين
 */
export async function getPostAnalytics(postId: string): Promise<PostAnalytics[]> {
    try {
        const { data, error } = await supabase
            .from('post_analytics')
            .select('*')
            .eq('post_id', postId)
            .order('fetched_at', { ascending: false });

        if (error) {
            console.error('Error fetching post analytics:', error);
            return [];
        }

        return data.map(mapDbAnalyticsToPostAnalytics);
    } catch (error) {
        console.error('Fetch analytics error:', error);
        return [];
    }
}

/**
 * جلب تحليلات من Facebook/Instagram Graph API
 */
export async function fetchFacebookPostAnalytics(
    postId: string,
    accessToken: string
): Promise<Partial<PostAnalytics> | null> {
    try {
        return new Promise((resolve) => {
            if (!window.FB) {
                console.error('Facebook SDK not loaded');
                resolve(null);
                return;
            }

            window.FB.api(
                `/${postId}/insights`,
                'GET',
                {
                    metric: 'post_impressions,post_engaged_users,post_clicks',
                    access_token: accessToken
                },
                (response: any) => {
                    if (!response || response.error) {
                        console.error('FB API Error:', response?.error);
                        resolve(null);
                        return;
                    }

                    const insights = response.data;
                    const analytics: Partial<PostAnalytics> = {
                        platformPostId: postId,
                        impressions: 0,
                        engagement: 0,
                        clicks: 0
                    };

                    insights.forEach((insight: any) => {
                        switch (insight.name) {
                            case 'post_impressions':
                                analytics.impressions = insight.values[0]?.value || 0;
                                break;
                            case 'post_engaged_users':
                                analytics.engagement = insight.values[0]?.value || 0;
                                break;
                            case 'post_clicks':
                                analytics.clicks = insight.values[0]?.value || 0;
                                break;
                        }
                    });

                    resolve(analytics);
                }
            );
        });
    } catch (error) {
        console.error('Error fetching Facebook analytics:', error);
        return null;
    }
}

/**
 * جلب تحليلات من Instagram Graph API
 */
export async function fetchInstagramPostAnalytics(
    mediaId: string,
    accessToken: string
): Promise<Partial<PostAnalytics> | null> {
    try {
        return new Promise((resolve) => {
            if (!window.FB) {
                console.error('Facebook SDK not loaded');
                resolve(null);
                return;
            }

            window.FB.api(
                `/${mediaId}/insights`,
                'GET',
                {
                    metric: 'impressions,reach,engagement,likes,comments,shares,saved',
                    access_token: accessToken
                },
                (response: any) => {
                    if (!response || response.error) {
                        console.error('IG API Error:', response?.error);
                        resolve(null);
                        return;
                    }

                    const insights = response.data;
                    const analytics: Partial<PostAnalytics> = {
                        platformPostId: mediaId,
                        impressions: 0,
                        reach: 0,
                        engagement: 0,
                        likes: 0,
                        comments: 0,
                        shares: 0,
                        saves: 0
                    };

                    insights.forEach((insight: any) => {
                        const value = insight.values[0]?.value || 0;
                        switch (insight.name) {
                            case 'impressions':
                                analytics.impressions = value;
                                break;
                            case 'reach':
                                analytics.reach = value;
                                break;
                            case 'engagement':
                                analytics.engagement = value;
                                break;
                            case 'likes':
                                analytics.likes = value;
                                break;
                            case 'comments':
                                analytics.comments = value;
                                break;
                            case 'shares':
                                analytics.shares = value;
                                break;
                            case 'saved':
                                analytics.saves = value;
                                break;
                        }
                    });

                    resolve(analytics);
                }
            );
        });
    } catch (error) {
        console.error('Error fetching Instagram analytics:', error);
        return null;
    }
}

/**
 * الحصول على ملخص التحليلات لبراند معين
 */
export async function getBrandAnalyticsSummary(
    brandId: string,
    startDate?: Date,
    endDate?: Date
): Promise<AnalyticsSummary> {
    try {
        let query = supabase
            .from('post_analytics')
            .select('*, scheduled_posts!inner(brand_id)')
            .eq('scheduled_posts.brand_id', brandId);

        if (startDate) {
            query = query.gte('fetched_at', startDate.toISOString());
        }

        if (endDate) {
            query = query.lte('fetched_at', endDate.toISOString());
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching brand analytics:', error);
            return getEmptySummary();
        }

        if (!data || data.length === 0) {
            return getEmptySummary();
        }

        const summary: AnalyticsSummary = {
            totalImpressions: 0,
            totalReach: 0,
            totalEngagement: 0,
            totalLikes: 0,
            totalComments: 0,
            totalShares: 0,
            engagementRate: 0
        };

        data.forEach((analytics: any) => {
            summary.totalImpressions += analytics.impressions || 0;
            summary.totalReach += analytics.reach || 0;
            summary.totalEngagement += analytics.engagement || 0;
            summary.totalLikes += analytics.likes || 0;
            summary.totalComments += analytics.comments || 0;
            summary.totalShares += analytics.shares || 0;
        });

        // حساب معدل التفاعل
        if (summary.totalImpressions > 0) {
            summary.engagementRate = (summary.totalEngagement / summary.totalImpressions) * 100;
        }

        return summary;
    } catch (error) {
        console.error('Fetch summary error:', error);
        return getEmptySummary();
    }
}

/**
 * الحصول على أفضل المنشورات أداءً
 */
export async function getTopPerformingPosts(
    brandId: string,
    limit: number = 10
): Promise<any[]> {
    try {
        const { data, error } = await supabase
            .from('post_analytics')
            .select('*, scheduled_posts!inner(brand_id, content)')
            .eq('scheduled_posts.brand_id', brandId)
            .order('engagement', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching top posts:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Fetch top posts error:', error);
        return [];
    }
}

/**
 * Helper functions
 */
function mapDbAnalyticsToPostAnalytics(dbAnalytics: any): PostAnalytics {
    return {
        postId: dbAnalytics.post_id,
        brandId: dbAnalytics.brand_id || undefined,
        briefId: dbAnalytics.brief_id || undefined,
        watchlistId: dbAnalytics.watchlist_id || undefined,
        platform: dbAnalytics.platform,
        platformPostId: dbAnalytics.platform_post_id,
        impressions: dbAnalytics.impressions || 0,
        reach: dbAnalytics.reach || 0,
        engagement: dbAnalytics.engagement || 0,
        likes: dbAnalytics.likes || 0,
        comments: dbAnalytics.comments || 0,
        shares: dbAnalytics.shares || 0,
        clicks: dbAnalytics.clicks || 0,
        saves: dbAnalytics.saves || 0,
        videoViews: dbAnalytics.video_views || 0,
        fetchedAt: new Date(dbAnalytics.fetched_at)
    };
}

function getEmptySummary(): AnalyticsSummary {
    return {
        totalImpressions: 0,
        totalReach: 0,
        totalEngagement: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        engagementRate: 0
    };
}

// Extend window interface for FB SDK
declare global {
    interface Window {
        FB: any;
    }
}
