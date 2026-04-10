import { SocialPlatform, ScheduledPost } from '../types';
import { supabase } from './supabaseClient';

interface PublishResult {
    platform: SocialPlatform;
    success: boolean;
    postId?: string;
    error?: string;
}

/**
 * Publishes a post by calling the server-side Edge Function (publish-now).
 * This avoids exposing tokens/secrets in the client and centralizes retries.
 */
export async function publishPost(brandId: string, post: ScheduledPost): Promise<PublishResult[]> {
    try {
        const { data, error } = await supabase.functions.invoke('publish-now', {
            body: {
                brand_id: brandId,
                post: {
                    content: post.content,
                    platforms: post.platforms,
                    media_urls: post.media?.map(m => m.url) || [],
                    instagram_first_comment: post.instagramFirstComment || undefined,
                    scheduled_at: post.scheduledAt ? new Date(post.scheduledAt).toISOString() : undefined,
                }
            }
        });
        if (error) {
            console.error('Edge publish-now error:', error);
            return post.platforms.map(p => ({ platform: p, success: false, error: (error as any).message || 'Edge error' }));
        }
        const results = (data as any[]) || [];
        return results.map(r => ({
            platform: r.platform as SocialPlatform,
            success: !!r.success,
            postId: r.post_id,
            error: r.error
        }));
    } catch (e: any) {
        console.error('publishPost via Edge failed:', e);
        return post.platforms.map(p => ({ platform: p, success: false, error: e?.message || 'Unknown error' }));
    }
}

// Legacy client-side publishers removed.