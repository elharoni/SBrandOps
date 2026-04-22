// services/evaluationService.ts
// طبقة التقييم والتغذية الراجعة — محرك التطور الحقيقي للنظام
//
// كل مخرج يُتابع: هل استُخدم؟ هل عُدِّل؟ هل حقق الهدف؟
// هذه البيانات تُغذّي ذاكرة البراند وتحسّن جودة المخرجات مع الوقت.
//
// دورة التعلم:
//   مخرج AI → تفاعل مستخدم → إشارة تقييم → ذاكرة البراند → مخرج أفضل في المرة القادمة

import { supabase } from './supabaseClient';
import { EvaluationSignal, EvaluationSignalType, SkillStats, SkillType } from '../types';
import { logUserFeedback } from './brandMemoryService';

// ── Record Evaluation Signal ──────────────────────────────────────────────────
// يُسجّل إشارة تقييم ويحوّلها إلى ذاكرة في نظام Brand Memory

export async function recordEvaluationSignal(signal: EvaluationSignal): Promise<void> {
    // Save raw signal to DB for analytics
    const { error } = await supabase.from('skill_evaluations').insert({
        execution_id:    signal.executionId,
        brand_id:        signal.brandId,
        skill_type:      signal.skillType,
        signal:          signal.signal,
        original_output: signal.originalOutput,
        edited_output:   signal.editedOutput ?? null,
        rating:          signal.rating ?? null,
        note:            signal.note ?? null,
    });

    if (error) {
        console.warn('[Evaluation] recordEvaluationSignal error:', error.message);
    }

    // Feed content-related signals back into Brand Memory
    // (الخطوة 11 من خوارزمية عقل التطبيق: تحديث الذاكرة)
    const contentSkills: SkillType[] = [
        SkillType.ContentGeneration,
        SkillType.AdCopywriting,
        SkillType.OccasionOpportunity,
    ];

    if (contentSkills.includes(signal.skillType)) {
        await feedBackToMemory(signal);
    }
}

// ── Memory feedback bridge ────────────────────────────────────────────────────

async function feedBackToMemory(signal: EvaluationSignal): Promise<void> {
    switch (signal.signal) {
        case 'used':
            // استخدام مباشر = محتوى مقبول
            await logUserFeedback(signal.brandId, {
                type: 'APPROVAL',
                originalText: signal.originalOutput,
            });
            break;

        case 'edited':
            // تعديل = تصحيح النبرة أو الأسلوب
            if (signal.editedOutput) {
                await logUserFeedback(signal.brandId, {
                    type: 'EDIT',
                    originalText: signal.originalOutput,
                    editedText: signal.editedOutput,
                });
            }
            break;

        case 'rejected':
            // رفض = تجنب هذا الأسلوب
            await logUserFeedback(signal.brandId, {
                type: 'REJECTION',
                originalText: signal.originalOutput,
            });
            break;

        case 'converted':
            // تحويل لبيع = محتوى عالي الأداء
            await logUserFeedback(signal.brandId, {
                type: 'APPROVAL',
                originalText: signal.originalOutput,
                engagement: 10, // high engagement marker
            });
            break;
    }
}

// ── Skill Stats ───────────────────────────────────────────────────────────────
// يحسب مقاييس أداء المهارة لبراند معين خلال فترة محددة

export async function getSkillStats(
    brandId: string,
    skillType?: SkillType,
    days = 30,
): Promise<SkillStats> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    let query = supabase
        .from('skill_evaluations')
        .select('signal, rating')
        .eq('brand_id', brandId)
        .gte('created_at', since.toISOString());

    if (skillType) query = query.eq('skill_type', skillType);

    const { data, error } = await query;
    if (error || !data?.length) {
        return { totalExecutions: 0, usedRate: 0, editedRate: 0, rejectedRate: 0, averageRating: 0 };
    }

    const total = data.length;
    const count = (sig: EvaluationSignalType) => data.filter(d => d.signal === sig).length;
    const ratings = data.filter(d => d.rating != null).map(d => d.rating as number);

    return {
        totalExecutions: total,
        usedRate:        count('used') / total,
        editedRate:      count('edited') / total,
        rejectedRate:    count('rejected') / total,
        averageRating:   ratings.length
            ? ratings.reduce((a, b) => a + b, 0) / ratings.length
            : 0,
    };
}

// ── All skills stats summary ──────────────────────────────────────────────────

export async function getBrandSkillsReport(
    brandId: string,
    days = 30,
): Promise<Record<string, SkillStats>> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
        .from('skill_evaluations')
        .select('skill_type, signal, rating')
        .eq('brand_id', brandId)
        .gte('created_at', since.toISOString());

    if (error || !data?.length) return {};

    // Group by skill_type
    const grouped: Record<string, typeof data> = {};
    for (const row of data) {
        const key = row.skill_type as string;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(row);
    }

    const report: Record<string, SkillStats> = {};
    for (const [skillType, rows] of Object.entries(grouped)) {
        const total = rows.length;
        const count = (sig: EvaluationSignalType) => rows.filter(r => r.signal === sig).length;
        const ratings = rows.filter(r => r.rating != null).map(r => r.rating as number);

        report[skillType] = {
            totalExecutions: total,
            usedRate:        count('used') / total,
            editedRate:      count('edited') / total,
            rejectedRate:    count('rejected') / total,
            averageRating:   ratings.length
                ? ratings.reduce((a, b) => a + b, 0) / ratings.length
                : 0,
        };
    }

    return report;
}

// ── Conversion tracking ───────────────────────────────────────────────────────

export async function markConversion(executionId: string, brandId: string): Promise<void> {
    await supabase.from('skill_evaluations').insert({
        execution_id:    executionId,
        brand_id:        brandId,
        skill_type:      SkillType.ConversationReply,
        signal:          'converted',
        original_output: null,
    });
}

// ── Brain Execution record ────────────────────────────────────────────────────

export interface BrainExecution {
    id: string;
    brandId?: string;
    skillType: string;
    confidence: number;
    brandPolicyPassed: boolean;
    executionTimeMs: number;
    rawOutput: string;
    createdAt: string;
}

// ── Recent executions for brand ───────────────────────────────────────────────

export async function getBrandRecentExecutions(brandId: string, limit = 20): Promise<BrainExecution[]> {
    const { data, error } = await supabase
        .from('skill_executions')
        .select('id, skill_type, confidence, brand_policy_passed, execution_time_ms, raw_output, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error || !data) return [];
    return data.map(r => ({
        id:                r.id,
        skillType:         r.skill_type,
        confidence:        r.confidence ?? 0,
        brandPolicyPassed: r.brand_policy_passed ?? true,
        executionTimeMs:   r.execution_time_ms ?? 0,
        rawOutput:         r.raw_output ?? '',
        createdAt:         r.created_at,
    }));
}

// ── Global brain stats (super admin) ─────────────────────────────────────────

export interface GlobalBrainStats {
    totalExecutions: number;
    uniqueBrands:    number;
    globalUsedRate:  number;
    globalEditedRate: number;
    globalRejectedRate: number;
    avgRating: number;
    bySkill: Record<string, { total: number; usedRate: number; rejectedRate: number; avgRating: number }>;
    byBrand: Array<{ brandId: string; total: number; usedRate: number; avgRating: number }>;
    recentExecutions: (BrainExecution & { brandId: string })[];
}

export async function getGlobalBrainStats(days = 30): Promise<GlobalBrainStats> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();

    const [execRes, evalRes] = await Promise.all([
        supabase
            .from('skill_executions')
            .select('id, brand_id, skill_type, confidence, raw_output, created_at')
            .gte('created_at', sinceISO)
            .order('created_at', { ascending: false })
            .limit(500),
        supabase
            .from('skill_evaluations')
            .select('brand_id, skill_type, signal, rating')
            .gte('created_at', sinceISO),
    ]);

    const execs = execRes.data ?? [];
    const evals = evalRes.data ?? [];

    const uniqueBrands = new Set(execs.map(e => e.brand_id)).size;
    const totalEvals   = evals.length;
    const count = (sig: string) => evals.filter(e => e.signal === sig).length;
    const ratings = evals.filter(e => e.rating != null).map(e => e.rating as number);

    // Per-skill breakdown
    const bySkill: GlobalBrainStats['bySkill'] = {};
    for (const row of evals) {
        const k = row.skill_type as string;
        if (!bySkill[k]) bySkill[k] = { total: 0, usedRate: 0, rejectedRate: 0, avgRating: 0 };
        bySkill[k].total++;
    }
    for (const k of Object.keys(bySkill)) {
        const rows = evals.filter(e => e.skill_type === k);
        const used = rows.filter(r => r.signal === 'used').length;
        const rej  = rows.filter(r => r.signal === 'rejected').length;
        const sr   = rows.filter(r => r.rating != null).map(r => r.rating as number);
        bySkill[k].usedRate     = rows.length ? used / rows.length : 0;
        bySkill[k].rejectedRate = rows.length ? rej  / rows.length : 0;
        bySkill[k].avgRating    = sr.length   ? sr.reduce((a, b) => a + b, 0) / sr.length : 0;
    }

    // Per-brand breakdown
    const brandMap: Record<string, { execTotal: number; evRows: typeof evals }> = {};
    for (const ex of execs) {
        if (!brandMap[ex.brand_id]) brandMap[ex.brand_id] = { execTotal: 0, evRows: [] };
        brandMap[ex.brand_id].execTotal++;
    }
    for (const ev of evals) {
        if (!brandMap[ev.brand_id]) brandMap[ev.brand_id] = { execTotal: 0, evRows: [] };
        brandMap[ev.brand_id].evRows.push(ev);
    }
    const byBrand = Object.entries(brandMap)
        .map(([brandId, d]) => {
            const used = d.evRows.filter(e => e.signal === 'used').length;
            const br   = d.evRows.filter(e => e.rating != null).map(e => e.rating as number);
            return {
                brandId,
                total:     d.execTotal,
                usedRate:  d.evRows.length ? used / d.evRows.length : 0,
                avgRating: br.length ? br.reduce((a, b) => a + b, 0) / br.length : 0,
            };
        })
        .sort((a, b) => b.total - a.total);

    return {
        totalExecutions:    execs.length,
        uniqueBrands,
        globalUsedRate:     totalEvals ? count('used')     / totalEvals : 0,
        globalEditedRate:   totalEvals ? count('edited')   / totalEvals : 0,
        globalRejectedRate: totalEvals ? count('rejected') / totalEvals : 0,
        avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
        bySkill,
        byBrand,
        recentExecutions: execs.slice(0, 30).map(e => ({
            id:                e.id,
            brandId:           e.brand_id,
            skillType:         e.skill_type,
            confidence:        e.confidence ?? 0,
            brandPolicyPassed: true,
            executionTimeMs:   0,
            rawOutput:         e.raw_output ?? '',
            createdAt:         e.created_at,
        })),
    };
}
