// services/brandMemoryService.ts — Real Supabase Implementation
// يحفظ ذاكرة الـ AI لكل براند ويسترجعها لتحسين الاقتراحات

import { supabase } from './supabaseClient';

export type MemoryType =
    | 'approved_caption'
    | 'rejected_caption'
    | 'tone_correction'
    | 'audience_insight'
    | 'high_performing_post'
    | 'avoided_topic';

export interface BrandMemoryEntry {
    id: string;
    brandId: string;
    memoryType: MemoryType;
    content: string;
    context?: Record<string, unknown>;
    importance: number;
    usedCount: number;
    createdAt: string;
}

function mapRow(row: any): BrandMemoryEntry {
    return {
        id: row.id,
        brandId: row.brand_id,
        memoryType: row.memory_type as MemoryType,
        content: row.content,
        context: row.context ?? {},
        importance: row.importance ?? 5,
        usedCount: row.used_count ?? 0,
        createdAt: row.created_at,
    };
}

// ── Log user feedback (approval / edit / rejection) ─────────────────────────

export interface UserFeedback {
    type: 'APPROVAL' | 'EDIT' | 'REJECTION';
    originalText: string;
    editedText?: string;
    platform?: string;
    engagement?: number;
}

/**
 * الدالة الرئيسية — تُسجّل تفاعل المستخدم مع المحتوى في قاعدة البيانات
 * ليستفيد منها الـ AI في المرات القادمة
 */
export async function logUserFeedback(
    brandId: string,
    feedback: UserFeedback,
): Promise<void> {
    if (!brandId) {
        console.warn('[BrandMemory] No brandId provided — skipping memory log');
        return;
    }

    let memoryType: MemoryType;
    let content: string;
    let importance: number;

    switch (feedback.type) {
        case 'APPROVAL':
            memoryType = 'approved_caption';
            content = `✅ Approved: "${feedback.originalText}"`;
            importance = 7;
            break;

        case 'EDIT':
            // إذا عدّل المستخدم النص، نحفظ الإصدار الأصلي والمعدّل معاً
            memoryType = 'tone_correction';
            content = feedback.editedText
                ? `✏️ Corrected from: "${feedback.originalText}" → to: "${feedback.editedText}"`
                : `✏️ Edited: "${feedback.originalText}"`;
            importance = 8; // التصحيحات أهم لأنها تكشف النبرة المفضّلة
            break;

        case 'REJECTION':
            memoryType = 'rejected_caption';
            content = `❌ Rejected: "${feedback.originalText}"`;
            importance = 6;
            break;

        default:
            return;
    }

    const { error } = await supabase.from('brand_memory').insert({
        brand_id: brandId,
        memory_type: memoryType,
        content,
        context: {
            platform: feedback.platform ?? null,
            engagement: feedback.engagement ?? null,
            timestamp: new Date().toISOString(),
        },
        importance,
    });

    if (error) {
        // لا نرمي error — الذاكرة ليست critical path
        console.warn('[BrandMemory] Failed to save memory entry:', error.message);
    }
}

// ── Save high-performing post ────────────────────────────────────────────────

export async function saveHighPerformingPost(
    brandId: string,
    content: string,
    platform: string,
    engagement: number,
): Promise<void> {
    if (!brandId) return;

    const { error } = await supabase.from('brand_memory').insert({
        brand_id: brandId,
        memory_type: 'high_performing_post',
        content: `🔥 High performer on ${platform}: "${content}"`,
        context: { platform, engagement },
        importance: 9,
    });

    if (error) {
        console.warn('[BrandMemory] Failed to save high-performing post:', error.message);
    }
}

// ── Get memory context for AI ────────────────────────────────────────────────

/**
 * تجلب أهم الذكريات لاستخدامها كـ context للـ AI prompt
 */
export async function getBrandMemoryContext(
    brandId: string,
    limit = 10,
): Promise<BrandMemoryEntry[]> {
    if (!brandId) return [];

    const { data, error } = await supabase
        .rpc('get_brand_memory_context', {
            p_brand_id: brandId,
            p_limit: limit,
        });

    if (error) {
        console.warn('[BrandMemory] Failed to fetch memory context:', error.message);
        return [];
    }

    return (data || []).map((row: any) => ({
        id: '',
        brandId,
        memoryType: row.memory_type as MemoryType,
        content: row.content,
        context: row.context ?? {},
        importance: row.importance ?? 5,
        usedCount: 0,
        createdAt: '',
    }));
}

/**
 * تحوّل الذاكرة إلى نص قابل للإضافة في الـ AI prompt
 */
export function formatMemoryForPrompt(memories: BrandMemoryEntry[]): string {
    if (!memories.length) return '';

    const grouped: Partial<Record<MemoryType, string[]>> = {};
    for (const m of memories) {
        if (!grouped[m.memoryType]) grouped[m.memoryType] = [];
        grouped[m.memoryType]!.push(m.content);
    }

    const sections: string[] = [];

    if (grouped.approved_caption?.length) {
        sections.push(`Approved style examples:\n${grouped.approved_caption.slice(0, 3).join('\n')}`);
    }
    if (grouped.tone_correction?.length) {
        sections.push(`Tone corrections to learn from:\n${grouped.tone_correction.slice(0, 3).join('\n')}`);
    }
    if (grouped.rejected_caption?.length) {
        sections.push(`Avoid styles like:\n${grouped.rejected_caption.slice(0, 2).join('\n')}`);
    }
    if (grouped.high_performing_post?.length) {
        sections.push(`High-performing content to emulate:\n${grouped.high_performing_post.slice(0, 2).join('\n')}`);
    }

    return sections.join('\n\n');
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function getMemoryEntries(brandId: string): Promise<BrandMemoryEntry[]> {
    const { data, error } = await supabase
        .from('brand_memory')
        .select('*')
        .eq('brand_id', brandId)
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.warn('[BrandMemory] Failed to fetch entries:', error.message);
        return [];
    }

    return (data || []).map(mapRow);
}

export async function deleteMemoryEntry(brandId: string, memoryId: string): Promise<void> {
    const { error } = await supabase
        .from('brand_memory')
        .delete()
        .eq('id', memoryId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}

export async function clearBrandMemory(brandId: string): Promise<void> {
    const { error } = await supabase
        .from('brand_memory')
        .delete()
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}