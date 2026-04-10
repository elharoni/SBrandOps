/**
 * Smart Notifications Service
 * خدمة التنبيهات الذكية والإشعارات
 */

import { supabase } from './supabaseClient';
import { NotificationType } from '../types';

export interface SmartNotification {
    id: string;
    brandId: string;
    userId?: string;
    type: NotificationType;
    title: string;
    message: string;
    icon?: string;
    link?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: string;
    isRead: boolean;
    isArchived: boolean;
    metadata: Record<string, any>;
    createdAt: Date;
    readAt: Date | null;
}

export interface NotificationRule {
    id: string;
    brandId: string;
    name: string;
    description: string;
    trigger: NotificationTrigger;
    conditions: NotificationCondition[];
    actions: NotificationAction[];
    isActive: boolean;
    createdAt: Date;
}

export type NotificationTrigger =
    | 'post_published'
    | 'post_failed'
    | 'engagement_milestone'
    | 'negative_comment'
    | 'mention'
    | 'follower_milestone'
    | 'scheduled_post_due'
    | 'analytics_threshold';

export interface NotificationCondition {
    field: string;
    operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
    value: any;
}

export interface NotificationAction {
    type: 'in_app' | 'email' | 'push' | 'webhook';
    config: Record<string, any>;
}

/**
 * إنشاء إشعار جديد
 */
export async function createNotification(data: {
    brandId: string;
    userId?: string;
    type: NotificationType;
    title: string;
    message: string;
    icon?: string;
    link?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    category?: string;
    metadata?: Record<string, any>;
}): Promise<SmartNotification> {
    const { data: notification, error } = await supabase
        .from('notifications')
        .insert({
            brand_id: data.brandId,
            user_id: data.userId,
            type: data.type,
            title: data.title,
            message: data.message,
            icon: data.icon,
            link: data.link,
            priority: data.priority || 'medium',
            category: data.category || 'general',
            is_read: false,
            is_archived: false,
            metadata: data.metadata || {}
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating notification:', error);
        throw new Error('فشل في إنشاء الإشعار');
    }

    return mapDbNotification(notification);
}

/**
 * الحصول على إشعارات البراند
 */
export async function getNotifications(
    brandId: string,
    options: {
        unreadOnly?: boolean;
        limit?: number;
        offset?: number;
    } = {}
): Promise<SmartNotification[]> {
    const { unreadOnly = false, limit = 50, offset = 0 } = options;

    let query = supabase
        .from('notifications')
        .select('*')
        .eq('brand_id', brandId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (unreadOnly) {
        query = query.eq('is_read', false);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }

    return data.map(mapDbNotification);
}

/**
 * تحديد إشعار كمقروء
 */
export async function markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
        .from('notifications')
        .update({
            is_read: true,
            read_at: new Date().toISOString()
        })
        .eq('id', notificationId);

    if (error) {
        console.error('Error marking notification as read:', error);
    }
}

/**
 * تحديد جميع الإشعارات كمقروءة
 */
export async function markAllAsRead(brandId: string): Promise<void> {
    const { error } = await supabase
        .from('notifications')
        .update({
            is_read: true,
            read_at: new Date().toISOString()
        })
        .eq('brand_id', brandId)
        .eq('is_read', false);

    if (error) {
        console.error('Error marking all as read:', error);
    }
}

/**
 * أرشفة إشعار
 */
export async function archiveNotification(notificationId: string): Promise<void> {
    const { error } = await supabase
        .from('notifications')
        .update({ is_archived: true })
        .eq('id', notificationId);

    if (error) {
        console.error('Error archiving notification:', error);
    }
}

/**
 * حذف إشعار
 */
export async function deleteNotification(notificationId: string): Promise<void> {
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

    if (error) {
        console.error('Error deleting notification:', error);
    }
}

/**
 * الحصول على عدد الإشعارات غير المقروءة
 */
export async function getUnreadCount(brandId: string): Promise<number> {
    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .eq('is_read', false)
        .eq('is_archived', false);

    if (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }

    return count || 0;
}

// ==================== Notification Rules ====================

/**
 * إنشاء قاعدة إشعار
 */
export async function createNotificationRule(data: Omit<NotificationRule, 'id' | 'createdAt'>): Promise<NotificationRule> {
    const { data: rule, error } = await supabase
        .from('notification_rules')
        .insert({
            brand_id: data.brandId,
            name: data.name,
            description: data.description,
            trigger: data.trigger,
            conditions: data.conditions,
            actions: data.actions,
            is_active: data.isActive
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating notification rule:', error);
        throw new Error('فشل في إنشاء قاعدة الإشعار');
    }

    return mapDbRule(rule);
}

/**
 * الحصول على قواعد الإشعارات
 */
export async function getNotificationRules(brandId: string): Promise<NotificationRule[]> {
    const { data, error } = await supabase
        .from('notification_rules')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching notification rules:', error);
        return [];
    }

    return data.map(mapDbRule);
}

/**
 * تحديث قاعدة إشعار
 */
export async function updateNotificationRule(
    ruleId: string,
    updates: Partial<Omit<NotificationRule, 'id' | 'createdAt'>>
): Promise<void> {
    const { error } = await supabase
        .from('notification_rules')
        .update(updates)
        .eq('id', ruleId);

    if (error) {
        console.error('Error updating notification rule:', error);
        throw new Error('فشل في تحديث قاعدة الإشعار');
    }
}

/**
 * حذف قاعدة إشعار
 */
export async function deleteNotificationRule(ruleId: string): Promise<void> {
    const { error } = await supabase
        .from('notification_rules')
        .delete()
        .eq('id', ruleId);

    if (error) {
        console.error('Error deleting notification rule:', error);
        throw new Error('فشل في حذف قاعدة الإشعار');
    }
}

// ==================== Smart Notification Triggers ====================

/**
 * إشعار عند نشر منشور
 */
export async function notifyPostPublished(
    brandId: string,
    postId: string,
    platforms: string[]
): Promise<void> {
    await createNotification({
        brandId,
        type: NotificationType.Success,
        title: 'تم نشر المنشور بنجاح',
        message: `تم نشر منشورك على ${platforms.join(', ')}`,
        icon: 'fas fa-check-circle',
        link: `/posts/${postId}`,
        priority: 'medium',
        category: 'publishing',
        metadata: { postId, platforms }
    });
}

/**
 * إشعار عند فشل النشر
 */
export async function notifyPostFailed(
    brandId: string,
    postId: string,
    error: string
): Promise<void> {
    await createNotification({
        brandId,
        type: NotificationType.Error,
        title: 'فشل نشر المنشور',
        message: `حدث خطأ أثناء النشر: ${error}`,
        icon: 'fas fa-exclamation-triangle',
        link: `/posts/${postId}`,
        priority: 'high',
        category: 'publishing',
        metadata: { postId, error }
    });
}

/**
 * إشعار عند وصول لمعدل تفاعل معين
 */
export async function notifyEngagementMilestone(
    brandId: string,
    postId: string,
    milestone: number
): Promise<void> {
    await createNotification({
        brandId,
        type: NotificationType.Success,
        title: 'إنجاز جديد! 🎉',
        message: `منشورك وصل إلى ${milestone} تفاعل!`,
        icon: 'fas fa-trophy',
        link: `/posts/${postId}`,
        priority: 'medium',
        category: 'engagement',
        metadata: { postId, milestone }
    });
}

/**
 * إشعار عند تعليق سلبي
 */
export async function notifyNegativeComment(
    brandId: string,
    commentId: string,
    sentiment: string
): Promise<void> {
    await createNotification({
        brandId,
        type: NotificationType.Warning,
        title: 'تعليق يحتاج انتباهك',
        message: 'تم رصد تعليق سلبي على أحد منشوراتك',
        icon: 'fas fa-comment-slash',
        link: `/inbox/${commentId}`,
        priority: 'high',
        category: 'moderation',
        metadata: { commentId, sentiment }
    });
}

/**
 * إشعار عند ذكر العلامة التجارية
 */
export async function notifyMention(
    brandId: string,
    platform: string,
    author: string
): Promise<void> {
    await createNotification({
        brandId,
        type: NotificationType.Info,
        title: 'تم ذكرك!',
        message: `${author} ذكر علامتك التجارية على ${platform}`,
        icon: 'fas fa-at',
        link: '/inbox',
        priority: 'medium',
        category: 'mentions',
        metadata: { platform, author }
    });
}

/**
 * إشعار عند وصول لعدد متابعين معين
 */
export async function notifyFollowerMilestone(
    brandId: string,
    platform: string,
    followers: number
): Promise<void> {
    await createNotification({
        brandId,
        type: NotificationType.Success,
        title: 'مبروك! 🎊',
        message: `وصلت إلى ${followers.toLocaleString()} متابع على ${platform}!`,
        icon: 'fas fa-users',
        priority: 'medium',
        category: 'growth',
        metadata: { platform, followers }
    });
}

// ==================== Helper Functions ====================

function mapDbNotification(data: any): SmartNotification {
    return {
        id: data.id,
        brandId: data.brand_id,
        userId: data.user_id,
        type: data.type,
        title: data.title,
        message: data.message,
        icon: data.icon,
        link: data.link,
        priority: data.priority,
        category: data.category,
        isRead: data.is_read,
        isArchived: data.is_archived,
        metadata: data.metadata || {},
        createdAt: new Date(data.created_at),
        readAt: data.read_at ? new Date(data.read_at) : null
    };
}

function mapDbRule(data: any): NotificationRule {
    return {
        id: data.id,
        brandId: data.brand_id,
        name: data.name,
        description: data.description,
        trigger: data.trigger,
        conditions: data.conditions || [],
        actions: data.actions || [],
        isActive: data.is_active,
        createdAt: new Date(data.created_at)
    };
}
