/**
 * Notifications Extension — Realtime + Email + CSV Export
 * يُستورد في smartNotificationsService أو مباشرة في المكونات
 */

import { supabase } from './supabaseClient';
import { SmartNotification } from './smartNotificationsService';
import { notifyPostFailed } from './smartNotificationsService';

// ── Realtime Subscription ────────────────────────────────────────────────────

/**
 * الاشتراك في الإشعارات الجديدة لحظياً عبر Supabase Realtime
 * @returns دالة unsubscribe لتنظيف الاشتراك عند إلغاء تحميل المكوّن
 *
 * @example
 * useEffect(() => {
 *   const unsub = subscribeToNotifications(brandId, (n) => addToast(n));
 *   return unsub;
 * }, [brandId]);
 */
export function subscribeToNotifications(
    brandId: string,
    onNew: (notification: SmartNotification) => void,
): () => void {
    const channel = supabase
        .channel(`notifications:brand:${brandId}`)
        .on(
            // @ts-ignore — postgres_changes is valid at runtime
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `brand_id=eq.${brandId}`,
            },
            (payload: { new: Record<string, unknown> }) => {
                const row = payload.new;
                onNew({
                    id: row.id as string,
                    brandId: row.brand_id as string,
                    userId: row.user_id as string | undefined,
                    type: row.type as any,
                    title: row.title as string,
                    message: row.message as string,
                    icon: row.icon as string | undefined,
                    link: row.link as string | undefined,
                    priority: row.priority as any,
                    category: row.category as string,
                    isRead: row.is_read as boolean,
                    isArchived: row.is_archived as boolean,
                    metadata: (row.metadata as Record<string, unknown>) ?? {},
                    createdAt: new Date(row.created_at as string),
                    readAt: row.read_at ? new Date(row.read_at as string) : null,
                });
            },
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

// ── Email Notification on Publish Failure ────────────────────────────────────

/**
 * إرسال إشعار داخلي + email عند فشل النشر
 */
export async function notifyPostFailedWithEmail(
    brandId: string,
    postId: string,
    postTitle: string,
    errorMsg: string,
    userEmail?: string,
): Promise<void> {
    // 1. الإشعار الداخلي
    await notifyPostFailed(brandId, postId, errorMsg);

    // 2. Email عبر Edge Function (اختياري — يعمل فقط إذا كانت send-email function موجودة)
    if (!userEmail) return;

    try {
        await supabase.functions.invoke('send-email', {
            body: {
                to: userEmail,
                subject: `❌ فشل نشر: ${postTitle}`,
                html: buildFailureEmailHtml(postTitle, postId, errorMsg),
            },
        });
    } catch (e) {
        // Email فاشل ليس حرجاً — نسجّل فقط
        console.warn('[Notifications] Email send failed (non-critical):', e);
    }
}

function buildFailureEmailHtml(title: string, postId: string, error: string): string {
    return `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#e53e3e;margin-bottom:8px">❌ فشل نشر المنشور</h2>
            <p style="color:#4a5568">المنشور: <strong>${title}</strong></p>
            <div style="background:#fff5f5;border:1px solid #fed7d7;border-radius:8px;padding:16px;margin:16px 0">
                <p style="color:#c53030;margin:0"><strong>سبب الخطأ:</strong> ${error}</p>
            </div>
            <p style="color:#4a5568">يرجى مراجعة لوحة التحكم وإعادة النشر يدوياً.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
            <p style="font-size:12px;color:#a0aec0">هذا إشعار تلقائي من SBrandOps</p>
        </div>
    `;
}

// ── Content Pipeline CSV Export ──────────────────────────────────────────────

export interface PipelinePostExport {
    title?: string;
    content: string;
    platforms: string[];
    status: string;
    scheduledAt?: string | null;
    publishedAt?: string | null;
    briefTitle?: string | null;
    engagement?: number;
    impressions?: number;
}

/**
 * تصدير Content Pipeline كـ CSV متوافق مع Excel وGoogle Sheets
 */
export function exportContentPipelineCSV(posts: PipelinePostExport[]): void {
    if (posts.length === 0) return;

    const headers: (keyof typeof rows[0])[] = [
        'title', 'content', 'platforms', 'status',
        'scheduled_at', 'published_at', 'brief',
        'engagement', 'impressions',
    ];

    const rows = posts.map((p) => ({
        title: p.title ?? '',
        content: p.content.substring(0, 250).replace(/\n/g, ' '),
        platforms: p.platforms.join(' | '),
        status: p.status,
        scheduled_at: p.scheduledAt ?? '',
        published_at: p.publishedAt ?? '',
        brief: p.briefTitle ?? '',
        engagement: p.engagement?.toString() ?? '0',
        impressions: p.impressions?.toString() ?? '0',
    }));

    const csvLines = [
        headers.join(','),
        ...rows.map((row) =>
            headers.map((h) => `"${String(row[h]).replace(/"/g, '""')}"`).join(','),
        ),
    ];

    const csv = '\uFEFF' + csvLines.join('\n'); // BOM لدعم Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `content-pipeline-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}
