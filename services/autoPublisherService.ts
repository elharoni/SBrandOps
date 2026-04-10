import { getPostsDueForPublishing, updatePostStatus } from './postsService';
import { publishPost } from './socialPublishingService';
import { PostStatus } from '../types';
import { logPostActivity, ActivityAction } from './activityLogService';

/**
 * معالج النشر التلقائي للمنشورات المجدولة
 * يتم تشغيله بشكل دوري (كل دقيقة مثلاً) للتحقق من المنشورات التي حان وقت نشرها
 */
export async function processScheduledPosts(): Promise<void> {
    console.log('[Auto Publisher] Checking for posts due for publishing...');

    try {
        // الحصول على المنشورات التي حان وقت نشرها
        const postsDue = await getPostsDueForPublishing();

        if (postsDue.length === 0) {
            console.log('[Auto Publisher] No posts due for publishing.');
            return;
        }

        console.log(`[Auto Publisher] Found ${postsDue.length} posts to publish.`);

        // معالجة كل منشور
        for (const post of postsDue) {
            try {
                console.log(`[Auto Publisher] Publishing post ${post.id}...`);

                // تحديث الحالة إلى "Publishing"
                await updatePostStatus(post.id, PostStatus.Publishing);

                // محاولة النشر
                const results = await publishPost(post.brandId ?? post.id, post);

                // التحقق من النتائج
                const allSuccessful = results.every(r => r.success);
                const anySuccessful = results.some(r => r.success);

                if (allSuccessful) {
                    // نجح النشر على جميع المنصات
                    await updatePostStatus(post.id, PostStatus.Published);

                    // تسجيل النشاط
                    await logPostActivity(
                        post.id,
                        post.id,
                        ActivityAction.POST_PUBLISHED,
                        undefined,
                        { results }
                    );

                    console.log(`[Auto Publisher] Successfully published post ${post.id} to all platforms.`);
                } else if (anySuccessful) {
                    // نجح النشر على بعض المنصات فقط
                    await updatePostStatus(post.id, PostStatus.Published);

                    // تسجيل النشاط مع التفاصيل
                    await logPostActivity(
                        post.id,
                        post.id,
                        ActivityAction.POST_PUBLISHED,
                        undefined,
                        {
                            results,
                            partialSuccess: true,
                            failedPlatforms: results.filter(r => !r.success).map(r => r.platform)
                        }
                    );

                    console.warn(`[Auto Publisher] Partially published post ${post.id}. Some platforms failed.`);
                } else {
                    // فشل النشر على جميع المنصات
                    await updatePostStatus(post.id, PostStatus.Failed);

                    // تسجيل النشاط
                    await logPostActivity(
                        post.id,
                        post.id,
                        ActivityAction.POST_FAILED,
                        undefined,
                        { results }
                    );

                    console.error(`[Auto Publisher] Failed to publish post ${post.id} to any platform.`);
                }
            } catch (error) {
                console.error(`[Auto Publisher] Error processing post ${post.id}:`, error);

                // تحديث الحالة إلى Failed
                await updatePostStatus(post.id, PostStatus.Failed);

                // تسجيل النشاط
                await logPostActivity(
                    post.id,
                    post.id,
                    ActivityAction.POST_FAILED,
                    undefined,
                    { error: error instanceof Error ? error.message : 'Unknown error' }
                );
            }
        }

        console.log('[Auto Publisher] Finished processing scheduled posts.');
    } catch (error) {
        console.error('[Auto Publisher] Error in processScheduledPosts:', error);
    }
}

/**
 * بدء خدمة النشر التلقائي
 * يتم تشغيلها كل دقيقة
 */
export function startAutoPublisher(intervalMinutes: number = 1): NodeJS.Timeout {
    console.log(`[Auto Publisher] Starting auto publisher service (interval: ${intervalMinutes} minute(s))`);

    // تشغيل فوري
    processScheduledPosts();

    // تشغيل دوري
    const interval = setInterval(() => {
        processScheduledPosts();
    }, intervalMinutes * 60 * 1000);

    return interval;
}

/**
 * إيقاف خدمة النشر التلقائي
 */
export function stopAutoPublisher(interval: NodeJS.Timeout): void {
    console.log('[Auto Publisher] Stopping auto publisher service');
    clearInterval(interval);
}

/**
 * معالج Webhook من Supabase
 * يتم استدعاؤه عند إضافة أو تحديث منشور مجدول
 */
export async function handleScheduledPostWebhook(payload: any): Promise<void> {
    console.log('[Webhook] Received scheduled post webhook:', payload);

    try {
        const { type, record } = payload;

        if (type === 'INSERT' || type === 'UPDATE') {
            // التحقق من أن المنشور مجدول وحان وقته
            if (record.status === PostStatus.Scheduled) {
                const scheduledAt = new Date(record.scheduled_at);
                const now = new Date();

                if (scheduledAt <= now) {
                    console.log(`[Webhook] Post ${record.id} is due for publishing. Processing...`);

                    // معالجة المنشور
                    const post = {
                        id: record.id,
                        content: record.content,
                        platforms: record.platforms,
                        media: (record.media_urls || []).map((url: string, index: number) => ({
                            id: `media-${index}`,
                            type: url.includes('.mp4') || url.includes('.mov') ? 'video' : 'image',
                            url: url,
                            file: null as any
                        })),
                        status: record.status,
                        scheduledAt: scheduledAt,
                        instagramFirstComment: record.instagram_first_comment,
                        locations: record.locations
                    };

                    // تحديث الحالة إلى Publishing
                    await updatePostStatus(post.id, PostStatus.Publishing);

                    // النشر
                    const results = await publishPost(record.brand_id, post);

                    // تحديث الحالة بناءً على النتيجة
                    const allSuccessful = results.every(r => r.success);
                    if (allSuccessful) {
                        await updatePostStatus(post.id, PostStatus.Published);
                        await logPostActivity(
                            record.brand_id,
                            post.id,
                            ActivityAction.POST_PUBLISHED,
                            undefined,
                            { results }
                        );
                    } else {
                        await updatePostStatus(post.id, PostStatus.Failed);
                        await logPostActivity(
                            record.brand_id,
                            post.id,
                            ActivityAction.POST_FAILED,
                            undefined,
                            { results }
                        );
                    }
                }
            }
        }
    } catch (error) {
        console.error('[Webhook] Error handling webhook:', error);
    }
}

/**
 * إعداد Supabase Realtime subscription للمنشورات المجدولة
 */
export function setupRealtimeSubscription(): void {
    console.log('[Realtime] Setting up realtime subscription for scheduled posts');

    // Note: This would be implemented in the main app initialization
    // Example:
    // supabase
    //     .channel('scheduled_posts_changes')
    //     .on('postgres_changes', 
    //         { event: '*', schema: 'public', table: 'scheduled_posts' },
    //         handleScheduledPostWebhook
    //     )
    //     .subscribe();
}
