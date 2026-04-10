/**
 * Saved Replies Service
 * خدمة الردود المحفوظة للتعليقات والرسائل
 */

import { supabase } from './supabaseClient';

export interface SavedReply {
    id: string;
    brandId: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    variables: string[]; // متغيرات مثل {name}, {product}, {date}
    usageCount: number;
    lastUsedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateSavedReplyData {
    brandId: string;
    title: string;
    content: string;
    category: string;
    tags?: string[];
}

/**
 * إنشاء رد محفوظ جديد
 */
export async function createSavedReply(data: CreateSavedReplyData): Promise<SavedReply> {
    // استخراج المتغيرات من المحتوى
    const variables = extractVariables(data.content);

    const { data: reply, error } = await supabase
        .from('saved_replies')
        .insert({
            brand_id: data.brandId,
            title: data.title,
            content: data.content,
            category: data.category,
            tags: data.tags || [],
            variables,
            usage_count: 0,
            last_used_at: null
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating saved reply:', error);
        throw new Error('فشل في إنشاء الرد المحفوظ');
    }

    return mapDbReplyToSavedReply(reply);
}

/**
 * الحصول على جميع الردود المحفوظة
 */
export async function getSavedReplies(
    brandId: string,
    category?: string
): Promise<SavedReply[]> {
    let query = supabase
        .from('saved_replies')
        .select('*')
        .eq('brand_id', brandId)
        .order('usage_count', { ascending: false });

    if (category) {
        query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching saved replies:', error);
        return [];
    }

    return data.map(mapDbReplyToSavedReply);
}

/**
 * الحصول على رد محفوظ واحد
 */
export async function getSavedReply(replyId: string): Promise<SavedReply | null> {
    const { data, error } = await supabase
        .from('saved_replies')
        .select('*')
        .eq('id', replyId)
        .single();

    if (error || !data) {
        console.error('Error fetching saved reply:', error);
        return null;
    }

    return mapDbReplyToSavedReply(data);
}

/**
 * تحديث رد محفوظ
 */
export async function updateSavedReply(
    replyId: string,
    updates: Partial<CreateSavedReplyData>
): Promise<SavedReply> {
    const updateData: any = { ...updates };

    // إعادة استخراج المتغيرات إذا تم تحديث المحتوى
    if (updates.content) {
        updateData.variables = extractVariables(updates.content);
    }

    const { data, error } = await supabase
        .from('saved_replies')
        .update(updateData)
        .eq('id', replyId)
        .select()
        .single();

    if (error) {
        console.error('Error updating saved reply:', error);
        throw new Error('فشل في تحديث الرد المحفوظ');
    }

    return mapDbReplyToSavedReply(data);
}

/**
 * حذف رد محفوظ
 */
export async function deleteSavedReply(replyId: string): Promise<void> {
    const { error } = await supabase
        .from('saved_replies')
        .delete()
        .eq('id', replyId);

    if (error) {
        console.error('Error deleting saved reply:', error);
        throw new Error('فشل في حذف الرد المحفوظ');
    }
}

/**
 * البحث في الردود المحفوظة
 */
export async function searchSavedReplies(
    brandId: string,
    searchTerm: string
): Promise<SavedReply[]> {
    const { data, error } = await supabase
        .from('saved_replies')
        .select('*')
        .eq('brand_id', brandId)
        .or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%,tags.cs.{${searchTerm}}`)
        .order('usage_count', { ascending: false });

    if (error) {
        console.error('Error searching saved replies:', error);
        return [];
    }

    return data.map(mapDbReplyToSavedReply);
}

/**
 * استخدام رد محفوظ (مع استبدال المتغيرات)
 */
export async function useSavedReply(
    replyId: string,
    variables?: Record<string, string>
): Promise<string> {
    const reply = await getSavedReply(replyId);

    if (!reply) {
        throw new Error('الرد المحفوظ غير موجود');
    }

    // تحديث عداد الاستخدام
    await supabase
        .from('saved_replies')
        .update({
            usage_count: reply.usageCount + 1,
            last_used_at: new Date().toISOString()
        })
        .eq('id', replyId);

    // استبدال المتغيرات
    return replaceVariables(reply.content, variables || {});
}

/**
 * الحصول على الفئات المتاحة
 */
export async function getReplyCategories(brandId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('saved_replies')
        .select('category')
        .eq('brand_id', brandId);

    if (error) {
        console.error('Error fetching categories:', error);
        return [];
    }

    // استخراج الفئات الفريدة
    const categories = [...new Set(data.map(r => r.category))];
    return categories.filter(Boolean);
}

/**
 * الحصول على الردود الأكثر استخداماً
 */
export async function getMostUsedReplies(
    brandId: string,
    limit: number = 10
): Promise<SavedReply[]> {
    const { data, error } = await supabase
        .from('saved_replies')
        .select('*')
        .eq('brand_id', brandId)
        .order('usage_count', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching most used replies:', error);
        return [];
    }

    return data.map(mapDbReplyToSavedReply);
}

/**
 * نسخ رد محفوظ
 */
export async function duplicateSavedReply(replyId: string): Promise<SavedReply> {
    const original = await getSavedReply(replyId);

    if (!original) {
        throw new Error('الرد المحفوظ غير موجود');
    }

    return createSavedReply({
        brandId: original.brandId,
        title: `${original.title} (نسخة)`,
        content: original.content,
        category: original.category,
        tags: original.tags
    });
}

// ==================== Helper Functions ====================

/**
 * استخراج المتغيرات من المحتوى
 */
function extractVariables(content: string): string[] {
    const regex = /\{([^}]+)\}/g;
    const matches = content.match(regex);

    if (!matches) return [];

    return [...new Set(matches.map(m => m.slice(1, -1)))];
}

/**
 * استبدال المتغيرات في المحتوى
 */
function replaceVariables(
    content: string,
    variables: Record<string, string>
): string {
    let result = content;

    Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        result = result.replace(regex, value);
    });

    return result;
}

/**
 * تحويل بيانات قاعدة البيانات إلى SavedReply
 */
function mapDbReplyToSavedReply(data: any): SavedReply {
    return {
        id: data.id,
        brandId: data.brand_id,
        title: data.title,
        content: data.content,
        category: data.category,
        tags: data.tags || [],
        variables: data.variables || [],
        usageCount: data.usage_count || 0,
        lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : null,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
    };
}

// ==================== Predefined Templates ====================

/**
 * قوالب جاهزة للردود الشائعة
 */
export const REPLY_TEMPLATES = {
    thankYou: {
        title: 'شكراً على التعليق',
        content: 'شكراً لك {name} على تعليقك الرائع! نحن سعداء بتواصلك معنا 🙏',
        category: 'شكر'
    },
    inquiry: {
        title: 'الرد على استفسار',
        content: 'مرحباً {name}! شكراً على استفسارك. يمكنك التواصل معنا مباشرة على {contact} وسنكون سعداء بمساعدتك.',
        category: 'استفسارات'
    },
    complaint: {
        title: 'الاعتذار عن مشكلة',
        content: 'نعتذر بشدة {name} عن هذه المشكلة. نحن نأخذ ملاحظاتك على محمل الجد وسنعمل على حلها في أقرب وقت.',
        category: 'شكاوى'
    },
    promotion: {
        title: 'عرض خاص',
        content: 'عرض خاص لك {name}! استخدم كود {code} للحصول على خصم {discount}% على طلبك القادم 🎉',
        category: 'عروض'
    },
    support: {
        title: 'دعم فني',
        content: 'مرحباً {name}! يمكنك التواصل مع فريق الدعم الفني على {support_email} أو الاتصال بنا على {support_phone}',
        category: 'دعم'
    }
};

/**
 * إنشاء قوالب افتراضية للبراند
 */
export async function createDefaultTemplates(brandId: string): Promise<void> {
    const templates = Object.values(REPLY_TEMPLATES).map(template => ({
        brand_id: brandId,
        ...template,
        tags: [],
        variables: extractVariables(template.content),
        usage_count: 0,
        last_used_at: null
    }));

    const { error } = await supabase
        .from('saved_replies')
        .insert(templates);

    if (error) {
        console.error('Error creating default templates:', error);
    }
}
