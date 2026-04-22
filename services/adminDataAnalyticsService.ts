import { supabase } from './supabaseClient';

export interface SkillStatRow {
    brand_id: string;
    skill_type: string;
    total_evaluations: number;
    used_pct: number;
    edited_pct: number;
    rejected_pct: number;
    conversion_pct: number;
    avg_rating: number | null;
}

export interface SkillExecutionStat {
    skill_type: string;
    total: number;
    avg_confidence: number | null;
    avg_execution_ms: number | null;
    policy_failed: number;
    requires_approval: number;
}

export interface KnowledgeTypeStat {
    type: string;
    total: number;
    active: number;
    inactive: number;
}

export interface SkillTrendPoint {
    date: string;
    count: number;
}

export interface TopSkillByBrand {
    brand_id: string;
    brand_name: string;
    skill_type: string;
    total_evaluations: number;
    avg_rating: number | null;
}

export interface AdminDataAnalytics {
    skillStats: SkillStatRow[];
    executionStats: SkillExecutionStat[];
    knowledgeStats: KnowledgeTypeStat[];
    trendLast30Days: SkillTrendPoint[];
    topSkillsByBrand: TopSkillByBrand[];
    totals: {
        totalExecutions: number;
        totalEvaluations: number;
        totalKnowledgeItems: number;
        totalBrandsWithSkills: number;
        avgConfidence: number;
        avgRating: number | null;
    };
}

export async function fetchAdminDataAnalytics(): Promise<AdminDataAnalytics> {
    const [
        skillStatsRes,
        executionStatsRes,
        knowledgeStatsRes,
        trendRes,
        topSkillsRes,
    ] = await Promise.all([
        // brand_skill_stats view — aggregated per brand + skill_type
        supabase
            .from('brand_skill_stats')
            .select('*')
            .order('total_evaluations', { ascending: false }),

        // skill_executions — aggregated per skill_type across all brands
        supabase
            .from('skill_executions')
            .select('skill_type, confidence, execution_time_ms, brand_policy_passed, requires_approval'),

        // brand_knowledge — grouped by type
        supabase
            .from('brand_knowledge')
            .select('type, is_active'),

        // skill_executions — last 30 days trend (daily count)
        supabase
            .from('skill_executions')
            .select('created_at')
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: true }),

        // top performing skills across brands (join with brands for name)
        supabase
            .from('brand_skill_stats')
            .select('brand_id, skill_type, total_evaluations, avg_rating')
            .order('total_evaluations', { ascending: false })
            .limit(20),
    ]);

    const skillStats: SkillStatRow[] = (skillStatsRes.data ?? []).map((r: any) => ({
        brand_id: r.brand_id,
        skill_type: r.skill_type,
        total_evaluations: Number(r.total_evaluations ?? 0),
        used_pct: Number(r.used_pct ?? 0),
        edited_pct: Number(r.edited_pct ?? 0),
        rejected_pct: Number(r.rejected_pct ?? 0),
        conversion_pct: Number(r.conversion_pct ?? 0),
        avg_rating: r.avg_rating !== null ? Number(r.avg_rating) : null,
    }));

    // Aggregate execution stats per skill_type
    const execMap = new Map<string, { total: number; conf: number[]; ms: number[]; failed: number; approval: number }>();
    for (const row of (executionStatsRes.data ?? []) as any[]) {
        const key = row.skill_type as string;
        if (!execMap.has(key)) execMap.set(key, { total: 0, conf: [], ms: [], failed: 0, approval: 0 });
        const entry = execMap.get(key)!;
        entry.total++;
        if (row.confidence !== null) entry.conf.push(Number(row.confidence));
        if (row.execution_time_ms !== null) entry.ms.push(Number(row.execution_time_ms));
        if (!row.brand_policy_passed) entry.failed++;
        if (row.requires_approval) entry.approval++;
    }
    const executionStats: SkillExecutionStat[] = Array.from(execMap.entries()).map(([skill_type, v]) => ({
        skill_type,
        total: v.total,
        avg_confidence: v.conf.length ? v.conf.reduce((a, b) => a + b, 0) / v.conf.length : null,
        avg_execution_ms: v.ms.length ? Math.round(v.ms.reduce((a, b) => a + b, 0) / v.ms.length) : null,
        policy_failed: v.failed,
        requires_approval: v.approval,
    })).sort((a, b) => b.total - a.total);

    // Aggregate knowledge stats per type
    const kMap = new Map<string, { total: number; active: number; inactive: number }>();
    for (const row of (knowledgeStatsRes.data ?? []) as any[]) {
        const key = row.type as string;
        if (!kMap.has(key)) kMap.set(key, { total: 0, active: 0, inactive: 0 });
        const entry = kMap.get(key)!;
        entry.total++;
        if (row.is_active) entry.active++; else entry.inactive++;
    }
    const knowledgeStats: KnowledgeTypeStat[] = Array.from(kMap.entries()).map(([type, v]) => ({ type, ...v }));

    // Build 30-day trend from raw created_at timestamps
    const dayMap = new Map<string, number>();
    for (const row of (trendRes.data ?? []) as any[]) {
        const day = (row.created_at as string).slice(0, 10);
        dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
    }
    const trendLast30Days: SkillTrendPoint[] = Array.from(dayMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

    const topSkillsByBrand: TopSkillByBrand[] = (topSkillsRes.data ?? []).map((r: any) => ({
        brand_id: r.brand_id,
        brand_name: r.brand_id.slice(0, 8), // will be enriched in the page if needed
        skill_type: r.skill_type,
        total_evaluations: Number(r.total_evaluations ?? 0),
        avg_rating: r.avg_rating !== null ? Number(r.avg_rating) : null,
    }));

    const allExecData = (executionStatsRes.data ?? []) as any[];
    const totalExecutions = allExecData.length;
    const totalEvaluations = skillStats.reduce((s, r) => s + r.total_evaluations, 0);
    const totalKnowledgeItems = knowledgeStats.reduce((s, r) => s + r.total, 0);
    const brandSet = new Set(skillStats.map(r => r.brand_id));
    const allConf = allExecData.filter(r => r.confidence !== null).map(r => Number(r.confidence));
    const avgConfidence = allConf.length ? allConf.reduce((a, b) => a + b, 0) / allConf.length : 0;
    const allRatings = skillStats.filter(r => r.avg_rating !== null).map(r => r.avg_rating as number);
    const avgRating = allRatings.length ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : null;

    return {
        skillStats,
        executionStats,
        knowledgeStats,
        trendLast30Days,
        topSkillsByBrand,
        totals: {
            totalExecutions,
            totalEvaluations,
            totalKnowledgeItems,
            totalBrandsWithSkills: brandSet.size,
            avgConfidence,
            avgRating,
        },
    };
}
