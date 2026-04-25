import { supabase } from './supabaseClient';
import { ScheduledPost, PostStatus, SocialPlatform, MediaItem } from '../types';

export interface CreatePostData {
    brandId: string;
    briefId?: string;
    briefTitle?: string;
    watchlistId?: string;
    content: string;
    platforms: SocialPlatform[];
    mediaUrls?: string[];
    scheduledAt?: Date;
    status?: PostStatus;
    instagramFirstComment?: string;
    locations?: Partial<Record<SocialPlatform, string>>;
}

export interface UpdatePostData {
    briefId?: string;
    briefTitle?: string;
    watchlistId?: string;
    content?: string;
    platforms?: SocialPlatform[];
    mediaUrls?: string[];
    scheduledAt?: Date;
    status?: PostStatus;
    instagramFirstComment?: string;
    locations?: Partial<Record<SocialPlatform, string>>;
}

/**
 * إنشاء منشور مجدول جديد
 */
export async function createScheduledPost(data: CreatePostData): Promise<ScheduledPost | null> {
    try {
        const { data: result, error } = await supabase
            .from('scheduled_posts')
            .insert([{
                brand_id: data.brandId,
                brief_id: data.briefId || null,
                brief_title: data.briefTitle || null,
                watchlist_id: data.watchlistId || null,
                content: data.content,
                platforms: data.platforms,
                media_urls: data.mediaUrls || [],
                scheduled_at: data.scheduledAt || null,
                status: data.status || PostStatus.Draft,
                instagram_first_comment: data.instagramFirstComment,
                locations: data.locations
            }])
            .select()
            .single();

        if (error) {
            console.error('Error creating scheduled post:', error);
            return null;
        }

        return mapDbPostToScheduledPost(result);
    } catch (error) {
        console.error('Create post error:', error);
        return null;
    }
}

/**
 * الحصول على جميع المنشورات المجدولة لبراند معين
 */
export async function getScheduledPosts(brandId: string): Promise<ScheduledPost[]> {
    try {
        const { data, error } = await supabase
            .from('scheduled_posts')
            .select('*')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching scheduled posts:', error);
            return [];
        }

        return data.map(mapDbPostToScheduledPost);
    } catch (error) {
        console.error('Fetch posts error:', error);
        return [];
    }
}

/**
 * الحصول على منشور مجدول واحد
 */
export async function getScheduledPost(postId: string): Promise<ScheduledPost | null> {
    try {
        const { data, error } = await supabase
            .from('scheduled_posts')
            .select('*')
            .eq('id', postId)
            .single();

        if (error) {
            console.error('Error fetching scheduled post:', error);
            return null;
        }

        return mapDbPostToScheduledPost(data);
    } catch (error) {
        console.error('Fetch post error:', error);
        return null;
    }
}

/**
 * تحديث منشور مجدول
 */
export async function updateScheduledPost(
    postId: string,
    updates: UpdatePostData
): Promise<ScheduledPost | null> {
    try {
        const updateData: any = {};

        if (updates.content !== undefined) updateData.content = updates.content;
        if (updates.briefId !== undefined) updateData.brief_id = updates.briefId;
        if (updates.briefTitle !== undefined) updateData.brief_title = updates.briefTitle;
        if (updates.watchlistId !== undefined) updateData.watchlist_id = updates.watchlistId;
        if (updates.platforms !== undefined) updateData.platforms = updates.platforms;
        if (updates.mediaUrls !== undefined) updateData.media_urls = updates.mediaUrls;
        if (updates.scheduledAt !== undefined) updateData.scheduled_at = updates.scheduledAt;
        if (updates.status !== undefined) updateData.status = updates.status;
        if (updates.instagramFirstComment !== undefined) updateData.instagram_first_comment = updates.instagramFirstComment;
        if (updates.locations !== undefined) updateData.locations = updates.locations;

        const { data, error } = await supabase
            .from('scheduled_posts')
            .update(updateData)
            .eq('id', postId)
            .select()
            .single();

        if (error) {
            console.error('Error updating scheduled post:', error);
            return null;
        }

        return mapDbPostToScheduledPost(data);
    } catch (error) {
        console.error('Update post error:', error);
        return null;
    }
}

/**
 * حذف منشور مجدول
 */
export async function deleteScheduledPost(postId: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('scheduled_posts')
            .delete()
            .eq('id', postId);

        if (error) {
            console.error('Error deleting scheduled post:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Delete post error:', error);
        return false;
    }
}

/**
 * الحصول على المنشورات المجدولة للنشر (التي حان وقتها)
 */
export async function getPostsDueForPublishing(): Promise<ScheduledPost[]> {
    try {
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from('scheduled_posts')
            .select('*')
            .eq('status', PostStatus.Scheduled)
            .lte('scheduled_at', now);

        if (error) {
            console.error('Error fetching posts due for publishing:', error);
            return [];
        }

        return data.map(mapDbPostToScheduledPost);
    } catch (error) {
        console.error('Fetch due posts error:', error);
        return [];
    }
}

/**
 * تحديث حالة المنشور
 */
export async function updatePostStatus(
    postId: string,
    status: PostStatus
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('scheduled_posts')
            .update({ status })
            .eq('id', postId);

        if (error) {
            console.error('Error updating post status:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Update status error:', error);
        return false;
    }
}

/**
 * الحصول على إحصائيات المنشورات
 */
export async function getPostsStats(brandId: string): Promise<{
    total: number;
    draft: number;
    scheduled: number;
    published: number;
    failed: number;
}> {
    try {
        const { data, error } = await supabase
            .from('scheduled_posts')
            .select('status')
            .eq('brand_id', brandId);

        if (error) {
            console.error('Error fetching posts stats:', error);
            return { total: 0, draft: 0, scheduled: 0, published: 0, failed: 0 };
        }

        const stats = {
            total: data.length,
            draft: 0,
            scheduled: 0,
            published: 0,
            failed: 0
        };

        data.forEach((post: any) => {
            switch (post.status) {
                case PostStatus.Draft:
                    stats.draft++;
                    break;
                case PostStatus.Scheduled:
                    stats.scheduled++;
                    break;
                case PostStatus.Published:
                    stats.published++;
                    break;
                case PostStatus.Failed:
                    stats.failed++;
                    break;
            }
        });

        return stats;
    } catch (error) {
        console.error('Fetch stats error:', error);
        return { total: 0, draft: 0, scheduled: 0, published: 0, failed: 0 };
    }
}

/**
 * تحويل بيانات قاعدة البيانات إلى ScheduledPost
 */
function mapDbPostToScheduledPost(dbPost: any): ScheduledPost {
    return {
        id: dbPost.id,
        brandId: dbPost.brand_id,
        briefId: dbPost.brief_id || undefined,
        briefTitle: dbPost.brief_title || undefined,
        watchlistId: dbPost.watchlist_id || undefined,
        content: dbPost.content || '',
        platforms: dbPost.platforms || [],
        media: (dbPost.media_urls || []).map((url: string, index: number) => ({
            id: `media-${index}`,
            type: url.includes('.mp4') || url.includes('.mov') ? 'video' : 'image',
            url: url,
            file: null as any // File object is not stored in DB
        })),
        status: dbPost.status || PostStatus.Draft,
        scheduledAt: dbPost.scheduled_at ? new Date(dbPost.scheduled_at) : null,
        instagramFirstComment: dbPost.instagram_first_comment,
        locations: dbPost.locations
    };
}
