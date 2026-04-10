// services/marketingPlansService.ts
import { MarketingPlan, MarketingPlanStatus, SocialPlatform, AiContentPlan, AiPriorityRecommendation, AiMonthlyPlan } from '../types';
import { supabase } from './supabaseClient';

// ── Row mapper ────────────────────────────────────────────────────────────────

function rowToPlan(plan: Record<string, unknown>): MarketingPlan {
    return {
        id:             plan.id as string,
        name:           plan.name as string,
        objective:      plan.objective as string,
        startDate:      new Date(plan.start_date as string),
        endDate:        new Date(plan.end_date as string),
        budget:         Number(plan.budget ?? 0),
        targetAudience: (plan.target_audience as string) ?? '',
        kpis:           (plan.kpis as string[])           ?? [],
        status:         (plan.status as MarketingPlanStatus) ?? MarketingPlanStatus.Draft,
        channels:       (plan.channels as SocialPlatform[]) ?? [],
        aiPlan:         (plan.ai_plan as AiContentPlan)    ?? undefined,
        aiPriorities:   (plan.ai_priorities as AiPriorityRecommendation[]) ?? undefined,
        monthlyPlan:    (plan.monthly_plan as AiMonthlyPlan) ?? undefined,
    };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getMarketingPlans(brandId: string): Promise<MarketingPlan[]> {
    try {
        const { data, error } = await supabase
            .from('marketing_plans')
            .select('*')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false });

        if (error || !data) return [];
        return data.map(p => rowToPlan(p as Record<string, unknown>));
    } catch {
        return [];
    }
}

export async function addMarketingPlan(
    brandId: string,
    planData: Omit<MarketingPlan, 'id' | 'status'>
): Promise<MarketingPlan> {
    const { data, error } = await supabase
        .from('marketing_plans')
        .insert([{
            brand_id:        brandId,
            name:            planData.name,
            objective:       planData.objective,
            start_date:      planData.startDate,
            end_date:        planData.endDate,
            budget:          planData.budget,
            target_audience: planData.targetAudience,
            kpis:            planData.kpis,
            channels:        planData.channels,
            status:          MarketingPlanStatus.Draft,
            ai_plan:         planData.aiPlan     ?? null,
            ai_priorities:   planData.aiPriorities ?? null,
            monthly_plan:    planData.monthlyPlan ?? null,
        }])
        .select()
        .single();

    if (error) throw error;
    return rowToPlan(data as Record<string, unknown>);
}

export async function updateMarketingPlan(
    planId: string,
    updates: Partial<Pick<MarketingPlan, 'name' | 'objective' | 'status' | 'budget' | 'targetAudience' | 'kpis' | 'channels' | 'aiPlan' | 'aiPriorities' | 'monthlyPlan'>>
): Promise<boolean> {
    try {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.name             !== undefined) dbUpdates.name             = updates.name;
        if (updates.objective        !== undefined) dbUpdates.objective        = updates.objective;
        if (updates.status           !== undefined) dbUpdates.status           = updates.status;
        if (updates.budget           !== undefined) dbUpdates.budget           = updates.budget;
        if (updates.targetAudience   !== undefined) dbUpdates.target_audience  = updates.targetAudience;
        if (updates.kpis             !== undefined) dbUpdates.kpis             = updates.kpis;
        if (updates.channels         !== undefined) dbUpdates.channels         = updates.channels;
        if (updates.aiPlan           !== undefined) dbUpdates.ai_plan          = updates.aiPlan;
        if (updates.aiPriorities     !== undefined) dbUpdates.ai_priorities    = updates.aiPriorities;
        if (updates.monthlyPlan      !== undefined) dbUpdates.monthly_plan     = updates.monthlyPlan;

        const { error } = await supabase
            .from('marketing_plans')
            .update(dbUpdates)
            .eq('id', planId);

        return !error;
    } catch {
        return false;
    }
}

export async function deleteMarketingPlan(planId: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('marketing_plans')
            .delete()
            .eq('id', planId);
        return !error;
    } catch {
        return false;
    }
}

export async function saveAiPlanToDb(planId: string, aiPlan: AiContentPlan): Promise<boolean> {
    return updateMarketingPlan(planId, { aiPlan, status: MarketingPlanStatus.Active });
}

export async function saveMonthlyPlanToDb(planId: string, monthlyPlan: AiMonthlyPlan): Promise<boolean> {
    return updateMarketingPlan(planId, { monthlyPlan });
}
