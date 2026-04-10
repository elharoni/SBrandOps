/**
 * Link Shortener Service
 * خدمة اختصار وتتبع الروابط
 */

import { supabase } from './supabaseClient';

export interface ShortLink {
    id: string;
    brandId: string;
    originalUrl: string;
    shortCode: string;
    shortUrl: string;
    title?: string;
    description?: string;
    clicks: number;
    uniqueClicks: number;
    lastClickedAt: Date | null;
    expiresAt: Date | null;
    isActive: boolean;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface LinkClick {
    id: string;
    linkId: string;
    ipAddress: string;
    userAgent: string;
    referer: string;
    country?: string;
    city?: string;
    device?: string;
    browser?: string;
    os?: string;
    clickedAt: Date;
}

export interface CreateShortLinkData {
    brandId: string;
    originalUrl: string;
    customCode?: string;
    title?: string;
    description?: string;
    expiresAt?: Date;
    metadata?: Record<string, any>;
}

const BASE_URL = import.meta.env.VITE_APP_URL || 'http://localhost:3000';

/**
 * إنشاء رابط مختصر
 */
export async function createShortLink(data: CreateShortLinkData): Promise<ShortLink> {
    // التحقق من صحة الرابط
    if (!isValidUrl(data.originalUrl)) {
        throw new Error('الرابط غير صحيح');
    }

    // توليد كود قصير
    const shortCode = data.customCode || generateShortCode();

    // التحقق من عدم وجود الكود مسبقاً
    const exists = await checkShortCodeExists(shortCode);
    if (exists) {
        throw new Error('هذا الكود مستخدم بالفعل');
    }

    const { data: link, error } = await supabase
        .from('short_links')
        .insert({
            brand_id: data.brandId,
            original_url: data.originalUrl,
            short_code: shortCode,
            title: data.title,
            description: data.description,
            expires_at: data.expiresAt?.toISOString(),
            metadata: data.metadata || {},
            clicks: 0,
            unique_clicks: 0,
            is_active: true
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating short link:', error);
        throw new Error('فشل في إنشاء الرابط المختصر');
    }

    return mapDbLinkToShortLink(link);
}

/**
 * الحصول على رابط مختصر بالكود
 */
export async function getShortLink(shortCode: string): Promise<ShortLink | null> {
    const { data, error } = await supabase
        .from('short_links')
        .select('*')
        .eq('short_code', shortCode)
        .eq('is_active', true)
        .single();

    if (error || !data) {
        return null;
    }

    // التحقق من انتهاء الصلاحية
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return null;
    }

    return mapDbLinkToShortLink(data);
}

/**
 * الحصول على جميع الروابط المختصرة للبراند
 */
export async function getBrandShortLinks(brandId: string): Promise<ShortLink[]> {
    const { data, error } = await supabase
        .from('short_links')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching short links:', error);
        return [];
    }

    return data.map(mapDbLinkToShortLink);
}

/**
 * تتبع نقرة على رابط
 */
export async function trackLinkClick(
    shortCode: string,
    clickData: {
        ipAddress: string;
        userAgent: string;
        referer: string;
    }
): Promise<void> {
    const link = await getShortLink(shortCode);

    if (!link) {
        throw new Error('الرابط غير موجود');
    }

    // تحليل بيانات المستخدم
    const deviceInfo = parseUserAgent(clickData.userAgent);
    const isUnique = await isUniqueClick(link.id, clickData.ipAddress);

    // حفظ النقرة
    await supabase.from('link_clicks').insert({
        link_id: link.id,
        ip_address: clickData.ipAddress,
        user_agent: clickData.userAgent,
        referer: clickData.referer,
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os
    });

    // تحديث عداد النقرات
    await supabase
        .from('short_links')
        .update({
            clicks: link.clicks + 1,
            unique_clicks: isUnique ? link.uniqueClicks + 1 : link.uniqueClicks,
            last_clicked_at: new Date().toISOString()
        })
        .eq('id', link.id);
}

/**
 * الحصول على إحصائيات رابط
 */
export async function getLinkAnalytics(linkId: string): Promise<{
    totalClicks: number;
    uniqueClicks: number;
    clicksByDate: Array<{ date: string; clicks: number }>;
    clicksByCountry: Array<{ country: string; clicks: number }>;
    clicksByDevice: Array<{ device: string; clicks: number }>;
    clicksByBrowser: Array<{ browser: string; clicks: number }>;
    topReferers: Array<{ referer: string; clicks: number }>;
}> {
    const { data: link } = await supabase
        .from('short_links')
        .select('clicks, unique_clicks')
        .eq('id', linkId)
        .single();

    const { data: clicks } = await supabase
        .from('link_clicks')
        .select('*')
        .eq('link_id', linkId)
        .order('clicked_at', { ascending: false });

    if (!clicks || !link) {
        return {
            totalClicks: 0,
            uniqueClicks: 0,
            clicksByDate: [],
            clicksByCountry: [],
            clicksByDevice: [],
            clicksByBrowser: [],
            topReferers: []
        };
    }

    // تجميع البيانات
    const clicksByDate = groupClicksByDate(clicks);
    const clicksByCountry = groupBy(clicks, 'country') as { country: string; clicks: number }[];
    const clicksByDevice = groupBy(clicks, 'device') as { device: string; clicks: number }[];
    const clicksByBrowser = groupBy(clicks, 'browser') as { browser: string; clicks: number }[];
    const topReferers = (groupBy(clicks, 'referer') as { referer: string; clicks: number }[]).slice(0, 10);

    return {
        totalClicks: link.clicks,
        uniqueClicks: link.unique_clicks,
        clicksByDate,
        clicksByCountry,
        clicksByDevice,
        clicksByBrowser,
        topReferers
    };
}

/**
 * تحديث رابط مختصر
 */
export async function updateShortLink(
    linkId: string,
    updates: Partial<CreateShortLinkData>
): Promise<ShortLink> {
    const { data, error } = await supabase
        .from('short_links')
        .update(updates)
        .eq('id', linkId)
        .select()
        .single();

    if (error) {
        console.error('Error updating short link:', error);
        throw new Error('فشل في تحديث الرابط');
    }

    return mapDbLinkToShortLink(data);
}

/**
 * حذف رابط مختصر
 */
export async function deleteShortLink(linkId: string): Promise<void> {
    const { error } = await supabase
        .from('short_links')
        .delete()
        .eq('id', linkId);

    if (error) {
        console.error('Error deleting short link:', error);
        throw new Error('فشل في حذف الرابط');
    }
}

/**
 * تفعيل/تعطيل رابط
 */
export async function toggleLinkStatus(linkId: string): Promise<void> {
    const { data: link } = await supabase
        .from('short_links')
        .select('is_active')
        .eq('id', linkId)
        .single();

    if (!link) {
        throw new Error('الرابط غير موجود');
    }

    await supabase
        .from('short_links')
        .update({ is_active: !link.is_active })
        .eq('id', linkId);
}

// ==================== Helper Functions ====================

/**
 * توليد كود قصير عشوائي
 */
function generateShortCode(length: number = 6): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';

    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
}

/**
 * التحقق من وجود كود مسبقاً
 */
async function checkShortCodeExists(shortCode: string): Promise<boolean> {
    const { data } = await supabase
        .from('short_links')
        .select('id')
        .eq('short_code', shortCode)
        .single();

    return !!data;
}

/**
 * التحقق من صحة الرابط
 */
function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * تحليل User Agent
 */
function parseUserAgent(userAgent: string): {
    device: string;
    browser: string;
    os: string;
} {
    // تحليل بسيط - يمكن استخدام مكتبة مثل ua-parser-js
    const isMobile = /Mobile|Android|iPhone/i.test(userAgent);
    const isTablet = /Tablet|iPad/i.test(userAgent);

    let device = 'Desktop';
    if (isMobile) device = 'Mobile';
    if (isTablet) device = 'Tablet';

    let browser = 'Unknown';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    let os = 'Unknown';
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iOS')) os = 'iOS';

    return { device, browser, os };
}

/**
 * التحقق من نقرة فريدة
 */
async function isUniqueClick(linkId: string, ipAddress: string): Promise<boolean> {
    const { data } = await supabase
        .from('link_clicks')
        .select('id')
        .eq('link_id', linkId)
        .eq('ip_address', ipAddress)
        .limit(1);

    return !data || data.length === 0;
}

/**
 * تجميع النقرات حسب التاريخ
 */
function groupClicksByDate(clicks: any[]): Array<{ date: string; clicks: number }> {
    const grouped: Record<string, number> = {};

    clicks.forEach(click => {
        const date = new Date(click.clicked_at).toISOString().split('T')[0];
        grouped[date] = (grouped[date] || 0) + 1;
    });

    return Object.entries(grouped).map(([date, clicks]) => ({ date, clicks }));
}

/**
 * تجميع حسب حقل معين
 */
function groupBy(clicks: any[], field: string): Array<{ [key: string]: any; clicks: number }> {
    const grouped: Record<string, number> = {};

    clicks.forEach(click => {
        const value = click[field] || 'Unknown';
        grouped[value] = (grouped[value] || 0) + 1;
    });

    return Object.entries(grouped)
        .map(([key, clicks]) => ({ [field]: key, clicks }))
        .sort((a, b) => b.clicks - a.clicks);
}

/**
 * تحويل بيانات قاعدة البيانات
 */
function mapDbLinkToShortLink(data: any): ShortLink {
    return {
        id: data.id,
        brandId: data.brand_id,
        originalUrl: data.original_url,
        shortCode: data.short_code,
        shortUrl: `${BASE_URL}/l/${data.short_code}`,
        title: data.title,
        description: data.description,
        clicks: data.clicks || 0,
        uniqueClicks: data.unique_clicks || 0,
        lastClickedAt: data.last_clicked_at ? new Date(data.last_clicked_at) : null,
        expiresAt: data.expires_at ? new Date(data.expires_at) : null,
        isActive: data.is_active,
        metadata: data.metadata || {},
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
    };
}
