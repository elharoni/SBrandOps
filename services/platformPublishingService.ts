import { SocialPlatform, ScheduledPost } from '../types';

export interface TwitterPublishResult {
    success: boolean;
    tweetId?: string;
    error?: string;
}

/**
 * النشر على X (Twitter) باستخدام Twitter API v2
 */
export async function publishToTwitter(
    accessToken: string,
    post: ScheduledPost
): Promise<TwitterPublishResult> {
    try {
        const apiUrl = 'https://api.twitter.com/2/tweets';

        // إعداد البيانات
        const tweetData: any = {
            text: post.content
        };

        // إضافة الميديا إذا كانت موجودة
        if (post.media && post.media.length > 0) {
            // Note: يجب رفع الميديا أولاً باستخدام media upload endpoint
            // ثم إضافة media_ids إلى التغريدة
            const mediaIds = await uploadTwitterMedia(accessToken, post.media);
            if (mediaIds.length > 0) {
                tweetData.media = { media_ids: mediaIds };
            }
        }

        // إرسال الطلب
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tweetData)
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: result.detail || result.title || 'Failed to publish tweet'
            };
        }

        return {
            success: true,
            tweetId: result.data.id
        };
    } catch (error: any) {
        console.error('Twitter publish error:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }
}

/**
 * رفع ميديا إلى Twitter
 */
async function uploadTwitterMedia(
    accessToken: string,
    media: any[]
): Promise<string[]> {
    const mediaIds: string[] = [];

    for (const item of media) {
        try {
            // تحويل URL إلى blob
            const response = await fetch(item.url);
            const blob = await response.blob();

            // رفع الميديا
            const formData = new FormData();
            formData.append('media', blob);

            const uploadResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                body: formData
            });

            const uploadResult = await uploadResponse.json();

            if (uploadResult.media_id_string) {
                mediaIds.push(uploadResult.media_id_string);
            }
        } catch (error) {
            console.error('Error uploading media to Twitter:', error);
        }
    }

    return mediaIds;
}

/**
 * النشر على LinkedIn
 */
export async function publishToLinkedIn(
    accessToken: string,
    personUrn: string,
    post: ScheduledPost
): Promise<{ success: boolean; postId?: string; error?: string }> {
    try {
        const apiUrl = 'https://api.linkedin.com/v2/ugcPosts';

        // إعداد البيانات
        const postData: any = {
            author: personUrn,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: {
                        text: post.content
                    },
                    shareMediaCategory: post.media && post.media.length > 0 ? 'IMAGE' : 'NONE'
                }
            },
            visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
            }
        };

        // إضافة الميديا إذا كانت موجودة
        if (post.media && post.media.length > 0) {
            const mediaAssets = await uploadLinkedInMedia(accessToken, personUrn, post.media);
            if (mediaAssets.length > 0) {
                postData.specificContent['com.linkedin.ugc.ShareContent'].media = mediaAssets;
            }
        }

        // إرسال الطلب
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
            },
            body: JSON.stringify(postData)
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: result.message || 'Failed to publish on LinkedIn'
            };
        }

        return {
            success: true,
            postId: result.id
        };
    } catch (error: any) {
        console.error('LinkedIn publish error:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }
}

/**
 * رفع ميديا إلى LinkedIn
 */
async function uploadLinkedInMedia(
    accessToken: string,
    personUrn: string,
    media: any[]
): Promise<any[]> {
    const mediaAssets: any[] = [];

    for (const item of media) {
        try {
            // Step 1: Register upload
            const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    registerUploadRequest: {
                        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                        owner: personUrn,
                        serviceRelationships: [{
                            relationshipType: 'OWNER',
                            identifier: 'urn:li:userGeneratedContent'
                        }]
                    }
                })
            });

            const registerResult = await registerResponse.json();
            const uploadUrl = registerResult.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
            const asset = registerResult.value.asset;

            // Step 2: Upload the image
            const imageResponse = await fetch(item.url);
            const imageBlob = await imageResponse.blob();

            await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                body: imageBlob
            });

            mediaAssets.push({
                status: 'READY',
                description: {
                    text: ''
                },
                media: asset,
                title: {
                    text: ''
                }
            });
        } catch (error) {
            console.error('Error uploading media to LinkedIn:', error);
        }
    }

    return mediaAssets;
}

/**
 * النشر على TikTok
 */
export async function publishToTikTok(
    accessToken: string,
    post: ScheduledPost
): Promise<{ success: boolean; postId?: string; error?: string }> {
    try {
        // TikTok API requires video content
        if (!post.media || post.media.length === 0 || post.media[0].type !== 'video') {
            return {
                success: false,
                error: 'TikTok requires video content'
            };
        }

        const apiUrl = 'https://open-api.tiktok.com/share/video/upload/';

        // إعداد البيانات
        const formData = new FormData();

        // تحويل URL إلى blob
        const videoResponse = await fetch(post.media[0].url);
        const videoBlob = await videoResponse.blob();

        formData.append('video', videoBlob);
        formData.append('description', post.content);

        // إرسال الطلب
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            body: formData
        });

        const result = await response.json();

        if (!response.ok || result.data.error_code !== 0) {
            return {
                success: false,
                error: result.data.description || 'Failed to publish on TikTok'
            };
        }

        return {
            success: true,
            postId: result.data.share_id
        };
    } catch (error: any) {
        console.error('TikTok publish error:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }
}
