import { supabase } from './supabaseClient';

export enum ActivityAction {
    // Posts
    POST_CREATED = 'post_created',
    POST_UPDATED = 'post_updated',
    POST_DELETED = 'post_deleted',
    POST_SCHEDULED = 'post_scheduled',
    POST_PUBLISHED = 'post_published',
    POST_FAILED = 'post_failed',

    // Accounts
    ACCOUNT_CONNECTED = 'account_connected',
    ACCOUNT_DISCONNECTED = 'account_disconnected',
    ACCOUNT_REAUTH_NEEDED = 'account_reauth_needed',

    // Brand
    BRAND_CREATED = 'brand_created',
    BRAND_UPDATED = 'brand_updated',
    BRAND_DELETED = 'brand_deleted',

    // Content
    CONTENT_CREATED = 'content_created',
    CONTENT_UPDATED = 'content_updated',
    CONTENT_DELETED = 'content_deleted',
    CONTENT_APPROVED = 'content_approved',

    // Campaigns
    CAMPAIGN_CREATED = 'campaign_created',
    CAMPAIGN_UPDATED = 'campaign_updated',
    CAMPAIGN_STARTED = 'campaign_started',
    CAMPAIGN_PAUSED = 'campaign_paused',
    CAMPAIGN_COMPLETED = 'campaign_completed',

    // Marketing Plans
    PLAN_CREATED = 'plan_created',
    PLAN_UPDATED = 'plan_updated',
    PLAN_ACTIVATED = 'plan_activated',

    // System
    USER_LOGIN = 'user_login',
    USER_LOGOUT = 'user_logout',
    SETTINGS_UPDATED = 'settings_updated'
}

export enum EntityType {
    POST = 'post',
    ACCOUNT = 'account',
    BRAND = 'brand',
    CONTENT = 'content',
    CAMPAIGN = 'campaign',
    PLAN = 'plan',
    USER = 'user',
    SETTINGS = 'settings'
}

export interface ActivityLog {
    id: string;
    brandId: string;
    userId?: string;
    action: ActivityAction;
    entityType?: EntityType;
    entityId?: string;
    metadata?: any;
    createdAt: Date;
}

export interface CreateActivityLogData {
    brandId: string;
    userId?: string;
    action: ActivityAction;
    entityType?: EntityType;
    entityId?: string;
    metadata?: any;
}

/**
 * إنشاء سجل نشاط جديد
 */
export async function createActivityLog(data: CreateActivityLogData): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('activity_logs')
            .insert([{
                brand_id: data.brandId,
                user_id: data.userId,
                action: data.action,
                entity_type: data.entityType,
                entity_id: data.entityId,
                metadata: data.metadata
            }]);

        if (error) {
            console.error('Error creating activity log:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Create log error:', error);
        return false;
    }
}

/**
 * الحصول على سجلات الأنشطة لبراند معين
 */
export async function getActivityLogs(
    brandId: string,
    limit: number = 50,
    offset: number = 0
): Promise<ActivityLog[]> {
    try {
        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('Error fetching activity logs:', error);
            return [];
        }

        return data.map(mapDbLogToActivityLog);
    } catch (error) {
        console.error('Fetch logs error:', error);
        return [];
    }
}

/**
 * الحصول على سجلات الأنشطة لكيان معين
 */
export async function getEntityActivityLogs(
    entityType: EntityType,
    entityId: string,
    limit: number = 20
): Promise<ActivityLog[]> {
    try {
        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('entity_type', entityType)
            .eq('entity_id', entityId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching entity logs:', error);
            return [];
        }

        return data.map(mapDbLogToActivityLog);
    } catch (error) {
        console.error('Fetch entity logs error:', error);
        return [];
    }
}

/**
 * الحصول على سجلات الأنشطة لمستخدم معين
 */
export async function getUserActivityLogs(
    userId: string,
    limit: number = 50
): Promise<ActivityLog[]> {
    try {
        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching user logs:', error);
            return [];
        }

        return data.map(mapDbLogToActivityLog);
    } catch (error) {
        console.error('Fetch user logs error:', error);
        return [];
    }
}

/**
 * الحصول على سجلات الأنشطة حسب نوع النشاط
 */
export async function getActivityLogsByAction(
    brandId: string,
    action: ActivityAction,
    limit: number = 50
): Promise<ActivityLog[]> {
    try {
        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('brand_id', brandId)
            .eq('action', action)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching logs by action:', error);
            return [];
        }

        return data.map(mapDbLogToActivityLog);
    } catch (error) {
        console.error('Fetch logs by action error:', error);
        return [];
    }
}

/**
 * حذف سجلات الأنشطة القديمة
 */
export async function deleteOldActivityLogs(daysOld: number = 90): Promise<boolean> {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const { error } = await supabase
            .from('activity_logs')
            .delete()
            .lt('created_at', cutoffDate.toISOString());

        if (error) {
            console.error('Error deleting old logs:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Delete old logs error:', error);
        return false;
    }
}

/**
 * الحصول على إحصائيات الأنشطة
 */
export async function getActivityStats(
    brandId: string,
    startDate?: Date,
    endDate?: Date
): Promise<{ action: string; count: number }[]> {
    try {
        let query = supabase
            .from('activity_logs')
            .select('action')
            .eq('brand_id', brandId);

        if (startDate) {
            query = query.gte('created_at', startDate.toISOString());
        }

        if (endDate) {
            query = query.lte('created_at', endDate.toISOString());
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching activity stats:', error);
            return [];
        }

        // تجميع الأنشطة حسب النوع
        const stats: { [key: string]: number } = {};
        data.forEach((log: any) => {
            stats[log.action] = (stats[log.action] || 0) + 1;
        });

        return Object.entries(stats).map(([action, count]) => ({
            action,
            count
        }));
    } catch (error) {
        console.error('Fetch stats error:', error);
        return [];
    }
}

/**
 * Helper function لتحويل بيانات قاعدة البيانات إلى ActivityLog
 */
function mapDbLogToActivityLog(dbLog: any): ActivityLog {
    return {
        id: dbLog.id,
        brandId: dbLog.brand_id,
        userId: dbLog.user_id,
        action: dbLog.action,
        entityType: dbLog.entity_type,
        entityId: dbLog.entity_id,
        metadata: dbLog.metadata,
        createdAt: new Date(dbLog.created_at)
    };
}

/**
 * Helper function لتسجيل نشاط منشور
 */
export async function logPostActivity(
    brandId: string,
    postId: string,
    action: ActivityAction,
    userId?: string,
    metadata?: any
): Promise<boolean> {
    return createActivityLog({
        brandId,
        userId,
        action,
        entityType: EntityType.POST,
        entityId: postId,
        metadata
    });
}

/**
 * Helper function لتسجيل نشاط حساب
 */
export async function logAccountActivity(
    brandId: string,
    accountId: string,
    action: ActivityAction,
    userId?: string,
    metadata?: any
): Promise<boolean> {
    return createActivityLog({
        brandId,
        userId,
        action,
        entityType: EntityType.ACCOUNT,
        entityId: accountId,
        metadata
    });
}
