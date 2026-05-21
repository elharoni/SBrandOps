/**
 * cockpitService — data layer for the Ads Media Buyer Cockpit.
 *
 * Reads from:
 *   ad_campaigns      (with funnel_layer, internal_status)
 *   ad_insights       (7-day sparkline + MTD aggregations)
 *   ad_accounts       (connection health, name)
 *   automation_policies
 *   cpa_targets
 */

import { supabase } from './supabaseClient';

// ── Public types ──────────────────────────────────────────────────────────────

export interface CockpitCampaign {
    id:             string;
    name:           string;
    provider:       string;
    status:         string;         // Meta-reported: 'active' | 'paused' | ...
    internalStatus: string;         // Our status: 'live' | 'paused' | 'draft' | 'killed' | 'error'
    funnelLayer:    'tofu' | 'mofu' | 'bofu';
    budgetDaily:    number | null;
    spend7d:        number;         // sum of last-7-day spend
    cpa7d:          number | null;  // 7-day CPA (spend / conversions)
    roas7d:         number | null;
    sparkline:      { date: string; cpa: number | null; spend: number }[];
    // 7 points ordered oldest → newest
}

export interface CockpitKPIs {
    mtdSpend:     number;
    mtdBudget:    number | null;    // from automation_policies.monthly_budget
    cpaTofu:      number | null;
    cpaMofu:      number | null;
    cpaBofu:      number | null;
    currency:     string;
    // MER = total revenue / total spend (not available without CAPI — omit if 0)
}

export interface CockpitAdAccount {
    id:               string;
    name:             string;
    externalId:       string;
    connectionHealth: 'healthy' | 'degraded' | 'disconnected';
    metaConnected:    boolean;
    currency:         string;
}

export interface AutomationPolicy {
    mode:                       'manual' | 'auto' | 'tiered';
    maxAutoLaunchAdsetBudget:   number;
    maxAutoScalePercent:        number;
    killCpaMultiplier:          number;
    killWindowHours:            number;
    maxDailySpendPerCampaign:   number;
    tieredAutoLaunchLayers:     string[];
    monthlyBudget:              number | null;
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

export async function getCockpitCampaigns(brandId: string): Promise<CockpitCampaign[]> {
    const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

    // Load campaigns
    const { data: campaigns, error } = await supabase
        .from('ad_campaigns')
        .select('id, name, provider, status, internal_status, funnel_layer, budget_daily, budget_currency')
        .eq('brand_id', brandId)
        .neq('internal_status', 'killed')
        .order('created_at', { ascending: false });

    if (error || !campaigns?.length) return [];

    const campaignIds = campaigns.map(c => c.id as string);

    // Load last-7-day insights for all campaigns in one query
    const { data: insights } = await supabase
        .from('ad_insights')
        .select('external_object_id, date, spend, conversions, conversion_value')
        .eq('brand_id', brandId)
        .eq('object_type', 'campaign')
        .gte('date', since7d)
        .order('date', { ascending: true });

    // Build per-campaign insight map
    const insightMap: Record<string, { date: string; spend: number; conversions: number }[]> = {};

    for (const row of insights ?? []) {
        // Match by external_object_id → campaign.external_campaign_id
        // We need to join via external_campaign_id
    }

    // Load external_campaign_ids to correlate
    const { data: extIds } = await supabase
        .from('ad_campaigns')
        .select('id, external_campaign_id')
        .in('id', campaignIds);

    const uuidToExternal: Record<string, string> = {};
    for (const r of extIds ?? []) {
        uuidToExternal[r.id] = r.external_campaign_id;
    }

    const externalToUuid: Record<string, string> = {};
    for (const [uuid, ext] of Object.entries(uuidToExternal)) {
        if (ext) externalToUuid[ext] = uuid;
    }

    for (const row of insights ?? []) {
        const uuid = externalToUuid[row.external_object_id];
        if (!uuid) continue;
        if (!insightMap[uuid]) insightMap[uuid] = [];
        insightMap[uuid].push({
            date:        row.date,
            spend:       Number(row.spend ?? 0),
            conversions: Number(row.conversions ?? 0),
        });
    }

    return campaigns.map(c => {
        const rows = insightMap[c.id] ?? [];
        const spend7d = rows.reduce((s, r) => s + r.spend, 0);
        const conv7d  = rows.reduce((s, r) => s + r.conversions, 0);
        const cpa7d   = spend7d > 0 && conv7d > 0 ? spend7d / conv7d : null;

        // Build 7-day sparkline
        const sparkline = rows.map(r => ({
            date:  r.date,
            spend: r.spend,
            cpa:   r.spend > 0 && r.conversions > 0 ? r.spend / r.conversions : null,
        }));

        return {
            id:             c.id,
            name:           c.name,
            provider:       c.provider ?? 'meta',
            status:         c.status ?? 'unknown',
            internalStatus: c.internal_status ?? 'live',
            funnelLayer:    (c.funnel_layer ?? 'tofu') as 'tofu' | 'mofu' | 'bofu',
            budgetDaily:    c.budget_daily ? Number(c.budget_daily) : null,
            spend7d,
            cpa7d,
            roas7d:         null, // requires conversion_value — add if available
            sparkline,
        };
    });
}

// ── MTD KPIs ──────────────────────────────────────────────────────────────────

export async function getCockpitKPIs(brandId: string): Promise<CockpitKPIs> {
    const now   = new Date();
    const mtdStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // MTD spend
    const { data: spendRows } = await supabase
        .from('ad_insights')
        .select('spend')
        .eq('brand_id', brandId)
        .gte('date', mtdStart);

    const mtdSpend = (spendRows ?? []).reduce((s, r) => s + Number(r.spend ?? 0), 0);

    // CPA targets
    const { data: targets } = await supabase
        .from('cpa_targets')
        .select('funnel_layer, target_cpa, currency')
        .eq('brand_id', brandId);

    const targetMap: Record<string, number> = {};
    let currency = 'EGP';
    for (const t of targets ?? []) {
        targetMap[t.funnel_layer] = Number(t.target_cpa);
        currency = t.currency ?? 'EGP';
    }

    // Automation policy (monthly budget cap)
    const { data: policy } = await supabase
        .from('automation_policies')
        .select('monthly_budget')
        .eq('brand_id', brandId)
        .maybeSingle();

    return {
        mtdSpend,
        mtdBudget:  policy?.monthly_budget ? Number(policy.monthly_budget) : null,
        cpaTofu:    targetMap['tofu']  ?? null,
        cpaMofu:    targetMap['mofu']  ?? null,
        cpaBofu:    targetMap['bofu']  ?? null,
        currency,
    };
}

// ── Ad Account ────────────────────────────────────────────────────────────────

export async function getCockpitAdAccount(brandId: string): Promise<CockpitAdAccount | null> {
    const { data } = await supabase
        .from('ad_accounts')
        .select('id, name, external_id, connection_health, meta_connected, currency')
        .eq('brand_id', brandId)
        .eq('provider', 'meta')
        .maybeSingle();

    if (!data) return null;
    return {
        id:               data.id,
        name:             data.name,
        externalId:       data.external_id,
        connectionHealth: data.connection_health as 'healthy' | 'degraded' | 'disconnected',
        metaConnected:    data.meta_connected,
        currency:         data.currency ?? 'EGP',
    };
}

// ── Automation policy ─────────────────────────────────────────────────────────

export async function getAutomationPolicy(brandId: string): Promise<AutomationPolicy | null> {
    const { data } = await supabase
        .from('automation_policies')
        .select('mode, max_auto_launch_adset_budget, max_auto_scale_percent, kill_cpa_multiplier, kill_window_hours, max_daily_spend_per_campaign, tiered_auto_launch_layers, monthly_budget')
        .eq('brand_id', brandId)
        .maybeSingle();

    if (!data) return null;
    return {
        mode:                       data.mode ?? 'manual',
        maxAutoLaunchAdsetBudget:   Number(data.max_auto_launch_adset_budget ?? 500),
        maxAutoScalePercent:        Number(data.max_auto_scale_percent ?? 20),
        killCpaMultiplier:          Number(data.kill_cpa_multiplier ?? 2.0),
        killWindowHours:            Number(data.kill_window_hours ?? 48),
        maxDailySpendPerCampaign:   Number(data.max_daily_spend_per_campaign ?? 2000),
        tieredAutoLaunchLayers:     (data.tiered_auto_launch_layers as string[]) ?? ['tofu'],
        monthlyBudget:              data.monthly_budget ? Number(data.monthly_budget) : null,
    };
}

export async function saveAutomationPolicy(
    brandId: string,
    policy: {
        mode:                     'manual' | 'auto' | 'tiered';
        killCpaMultiplier:        number;
        killWindowHours:          number;
        maxAutoScalePercent:      number;
        maxDailySpendPerCampaign: number;
        monthlyBudget:            number | null;
    },
): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase
        .from('automation_policies')
        .upsert(
            {
                brand_id:                     brandId,
                mode:                         policy.mode,
                kill_cpa_multiplier:          policy.killCpaMultiplier,
                kill_window_hours:            policy.killWindowHours,
                max_auto_scale_percent:       policy.maxAutoScalePercent,
                max_daily_spend_per_campaign: policy.maxDailySpendPerCampaign,
                monthly_budget:               policy.monthlyBudget,
                updated_at:                   new Date().toISOString(),
            },
            { onConflict: 'brand_id' },
        );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}

// ── CPA targets CRUD ──────────────────────────────────────────────────────────

export interface CpaTarget {
    funnel_layer: 'tofu' | 'mofu' | 'bofu';
    target_cpa:   number;
    currency:     string;
}

export async function saveCpaTargets(
    brandId: string,
    targets: CpaTarget[],
): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase
        .from('cpa_targets')
        .upsert(
            targets.map(t => ({
                brand_id:     brandId,
                funnel_layer: t.funnel_layer,
                target_cpa:   t.target_cpa,
                currency:     t.currency,
                updated_at:   new Date().toISOString(),
            })),
            { onConflict: 'brand_id,funnel_layer' },
        );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}

// ── BMB agent chat ────────────────────────────────────────────────────────────

export interface BmbMessage {
    role:  'user' | 'model';
    parts: { text: string }[];
}

export async function callBmbAgent(
    brandId: string,
    message: string,
    history: BmbMessage[],
): Promise<{ reply: string; runId: string | null }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Session expired');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

    const resp = await fetch(`${supabaseUrl}/functions/v1/bmb-agent`, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ brand_id: brandId, message, history }),
    });

    if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error((err as { error?: string }).error ?? `HTTP ${resp.status}`);
    }

    const data = await resp.json() as { reply?: string; run_id?: string | null };
    return { reply: data.reply ?? '', runId: data.run_id ?? null };
}

// ── Ad Decisions ──────────────────────────────────────────────────────────────

export interface AdDecision {
    id:                string;
    targetType:        'campaign' | 'adset' | 'ad';
    targetId:          string;
    targetName:        string;
    decisionType:      'scale' | 'kill' | 'duplicate' | 'refresh' | 'review' | 'hold';
    status:            'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
    reasoning:         string;
    supportingMetrics: {
        cpa?:            number | null;
        target_cpa?:     number | null;
        cpa_multiplier?: number | null;
        frequency?:      number | null;
        ctr_drop_pct?:   number | null;
        spend?:          number | null;
        conversions?:    number | null;
    };
    scalePercent: number | null;
    sourceId:     string | null;
    createdAt:    string;
}

export async function getPendingDecisions(brandId: string): Promise<AdDecision[]> {
    const { data, error } = await supabase
        .from('ad_decisions')
        .select('*')
        .eq('brand_id', brandId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error || !data?.length) return [];

    // Resolve campaign names
    const campaignIds = data
        .filter((d: { target_type: string }) => d.target_type === 'campaign')
        .map((d: { target_id: string }) => d.target_id);

    const nameMap: Record<string, string> = {};
    if (campaignIds.length > 0) {
        const { data: camps } = await supabase
            .from('ad_campaigns')
            .select('id, name')
            .in('id', campaignIds);
        for (const c of camps ?? []) nameMap[c.id] = c.name;
    }

    return data.map((d: Record<string, unknown>) => ({
        id:                d.id as string,
        targetType:        d.target_type as 'campaign' | 'adset' | 'ad',
        targetId:          d.target_id as string,
        targetName:        nameMap[d.target_id as string] ?? String(d.target_id).slice(0, 8) + '…',
        decisionType:      d.decision_type as AdDecision['decisionType'],
        status:            d.status as AdDecision['status'],
        reasoning:         (d.reasoning as string) ?? '',
        supportingMetrics: (d.supporting_metrics as AdDecision['supportingMetrics']) ?? {},
        scalePercent:      d.scale_percent as number | null ?? null,
        sourceId:          d.source_id as string | null ?? null,
        createdAt:         d.created_at as string,
    }));
}

export async function approveDecision(decisionId: string): Promise<{ ok: boolean; error?: string; message_ar?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { ok: false, error: 'Session expired' };

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

    const resp = await fetch(`${supabaseUrl}/functions/v1/ads-execute`, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ decision_id: decisionId }),
    });

    const data = await resp.json().catch(() => ({})) as { ok?: boolean; error?: string; message_ar?: string };

    if (!resp.ok) return { ok: false, error: data.error ?? `HTTP ${resp.status}` };
    return { ok: data.ok ?? true, message_ar: data.message_ar };
}

export async function rejectDecision(decisionId: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase
        .from('ad_decisions')
        .update({
            status:          'rejected',
            rejected_reason: reason ?? null,
        })
        .eq('id', decisionId)
        .eq('status', 'pending');

    if (error) return { ok: false, error: error.message };
    return { ok: true };
}

export async function generateDecisions(brandId: string): Promise<{ decisions: AdDecision[]; runId: string | null }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Session expired');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

    const resp = await fetch(`${supabaseUrl}/functions/v1/bmb-decisions`, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ brand_id: brandId }),
    });

    if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error((err as { error?: string }).error ?? `HTTP ${resp.status}`);
    }

    const data = await resp.json() as { run_id?: string | null; inserted?: number };
    const freshDecisions = await getPendingDecisions(brandId);
    return { decisions: freshDecisions, runId: data.run_id ?? null };
}

// ── Auto-executed decisions history ──────────────────────────────────────────

export interface AutoExecutedDecision {
    id:              string;
    targetName:      string;
    decisionType:    'scale' | 'kill';
    reasoning:       string;
    autoExecutedAt:  string;
    supportingMetrics: {
        cpa?:            number | null;
        target_cpa?:     number | null;
        cpa_multiplier?: number | null;
        spend?:          number | null;
    };
    scalePercent: number | null;
}

export async function getAutoExecutedDecisions(brandId: string, limit = 20): Promise<AutoExecutedDecision[]> {
    const { data, error } = await supabase
        .from('ad_decisions')
        .select('*')
        .eq('brand_id', brandId)
        .eq('auto_actor', 'automation')
        .eq('status', 'executed')
        .order('auto_executed_at', { ascending: false })
        .limit(limit);

    if (error || !data?.length) return [];

    const campaignIds = data
        .filter((d: { target_type: string }) => d.target_type === 'campaign')
        .map((d: { target_id: string }) => d.target_id);

    const nameMap: Record<string, string> = {};
    if (campaignIds.length > 0) {
        const { data: camps } = await supabase
            .from('ad_campaigns')
            .select('id, name')
            .in('id', campaignIds);
        for (const c of camps ?? []) nameMap[c.id] = c.name;
    }

    return data.map((d: Record<string, unknown>) => ({
        id:               d.id as string,
        targetName:       nameMap[d.target_id as string] ?? String(d.target_id).slice(0, 8) + '…',
        decisionType:     d.decision_type as 'scale' | 'kill',
        reasoning:        (d.reasoning as string) ?? '',
        autoExecutedAt:   (d.auto_executed_at as string) ?? (d.executed_at as string),
        supportingMetrics:(d.supporting_metrics as AutoExecutedDecision['supportingMetrics']) ?? {},
        scalePercent:     d.scale_percent as number | null ?? null,
    }));
}

// ── Manual bmb-scheduler trigger ─────────────────────────────────────────────

export async function triggerScheduler(trigger: 'manual' = 'manual'): Promise<{ ok: boolean; processed: number; auto_executed: number; error?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { ok: false, processed: 0, auto_executed: 0, error: 'Session expired' };

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/bmb-scheduler`, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'X-Trigger':     trigger,
            },
            body: JSON.stringify({}),
        });
        const data = await resp.json().catch(() => ({})) as { processed?: number; auto_executed?: number; error?: string };
        if (!resp.ok) return { ok: false, processed: 0, auto_executed: 0, error: data.error ?? `HTTP ${resp.status}` };
        return { ok: true, processed: data.processed ?? 0, auto_executed: data.auto_executed ?? 0 };
    } catch (e) {
        return { ok: false, processed: 0, auto_executed: 0, error: String(e) };
    }
}

// ── Media Plans ───────────────────────────────────────────────────────────────

export interface MediaPlanLayerKPIs {
    cpa_target:         number | null;
    roas_target:        number | null;
    impressions_target: number | null;
    ctr_target:         number | null;
}

export interface MediaPlanLayer {
    budget_amount:  number;
    budget_pct:     number;
    objective:      string;
    kpis:           MediaPlanLayerKPIs;
    audience_notes: string;
    ad_formats:     string[];
}

export interface MediaPlanCreativeBrief {
    layer:    string;
    format:   string;
    headline: string;
    body:     string;
    cta:      string;
    notes:    string;
}

export interface MediaPlanAudienceSpec {
    layer:          string;
    type:           string;
    description:    string;
    estimated_size: string;
}

export interface MediaPlan {
    id:              string;
    name:            string;
    objective:       string;
    status:          'draft' | 'pending_approval' | 'approved' | 'executing' | 'live' | 'completed' | 'rejected';
    totalBudget:     number;
    currency:        string;
    startDate:       string | null;
    endDate:         string | null;
    brief:           string | null;
    strategySummary: string | null;
    funnelLayers: {
        tofu: MediaPlanLayer;
        mofu: MediaPlanLayer;
        bofu: MediaPlanLayer;
    };
    kpis: {
        overall_cpa_target: number | null;
        roas_target:        number | null;
        reach_target:       number | null;
    };
    creativeBriefs:  MediaPlanCreativeBrief[];
    audiencePlan:    MediaPlanAudienceSpec[];
    approvedBy:      string | null;
    approvedAt:      string | null;
    rejectedReason:  string | null;
    createdAt:       string;
}

function defaultLayer(): MediaPlanLayer {
    return {
        budget_amount: 0, budget_pct: 0, objective: '',
        kpis: { cpa_target: null, roas_target: null, impressions_target: null, ctr_target: null },
        audience_notes: '', ad_formats: [],
    };
}

function mapMediaPlan(row: Record<string, unknown>): MediaPlan {
    const fl = (row.funnel_layers ?? {}) as {
        tofu?: Partial<MediaPlanLayer>;
        mofu?: Partial<MediaPlanLayer>;
        bofu?: Partial<MediaPlanLayer>;
    };
    return {
        id:              (row.id              as string) ?? '',
        name:            (row.name            as string) ?? '',
        objective:       (row.objective       as string) ?? '',
        status:          (row.status          as MediaPlan['status']) ?? 'draft',
        totalBudget:     Number(row.total_budget ?? 0),
        currency:        (row.currency        as string) ?? 'EGP',
        startDate:       (row.start_date      as string) ?? null,
        endDate:         (row.end_date        as string) ?? null,
        brief:           (row.brief           as string) ?? null,
        strategySummary: (row.strategy_summary as string) ?? null,
        funnelLayers: {
            tofu: { ...defaultLayer(), ...(fl.tofu ?? {}) } as MediaPlanLayer,
            mofu: { ...defaultLayer(), ...(fl.mofu ?? {}) } as MediaPlanLayer,
            bofu: { ...defaultLayer(), ...(fl.bofu ?? {}) } as MediaPlanLayer,
        },
        kpis:           (row.kpis as MediaPlan['kpis']) ?? { overall_cpa_target: null, roas_target: null, reach_target: null },
        creativeBriefs: (row.creative_briefs as MediaPlanCreativeBrief[]) ?? [],
        audiencePlan:   (row.audience_plan   as MediaPlanAudienceSpec[])  ?? [],
        approvedBy:     (row.approved_by     as string) ?? null,
        approvedAt:     (row.approved_at     as string) ?? null,
        rejectedReason: (row.rejected_reason as string) ?? null,
        createdAt:      (row.created_at      as string) ?? '',
    };
}

export async function createMediaPlan(
    brandId:     string,
    brief:       string,
    totalBudget: number,
    currency:    string,
    startDate:   string | null,
    endDate:     string | null,
): Promise<{ planId: string; plan: MediaPlan }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Session expired');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

    const resp = await fetch(`${supabaseUrl}/functions/v1/bmb-media-planner`, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
            brand_id:     brandId,
            brief,
            total_budget: totalBudget,
            currency,
            start_date:   startDate,
            end_date:     endDate,
        }),
    });

    if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error((err as { error?: string }).error ?? `HTTP ${resp.status}`);
    }

    const data = await resp.json() as { plan_id: string; plan: Record<string, unknown> };
    return { planId: data.plan_id, plan: mapMediaPlan(data.plan) };
}

export async function getMediaPlans(brandId: string): Promise<MediaPlan[]> {
    const { data, error } = await supabase
        .from('media_plans')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(30);

    if (error || !data?.length) return [];
    return (data as Record<string, unknown>[]).map(mapMediaPlan);
}

export async function approveMediaPlan(
    planId: string,
): Promise<{ ok: boolean; error?: string; campaignsCreated?: number }> {
    const { data: planRow, error: loadErr } = await supabase
        .from('media_plans')
        .select('*')
        .eq('id', planId)
        .eq('status', 'pending_approval')
        .maybeSingle();

    if (loadErr || !planRow) return { ok: false, error: 'الخطة غير موجودة أو تمت معالجتها' };

    const plan  = mapMediaPlan(planRow as Record<string, unknown>);
    const layers: Array<'tofu' | 'mofu' | 'bofu'> = ['tofu', 'mofu', 'bofu'];

    const campaigns = layers
        .filter(l => plan.funnelLayers[l].budget_amount > 0)
        .map(l => {
            const layerData = plan.funnelLayers[l];
            let budgetDaily: number | null = null;
            if (plan.startDate && plan.endDate) {
                const days = Math.max(1, Math.round(
                    (new Date(plan.endDate).getTime() - new Date(plan.startDate).getTime()) / 86_400_000,
                ));
                budgetDaily = Math.round(layerData.budget_amount / days);
            }
            return {
                brand_id:        planRow.brand_id,
                provider:        'meta',
                name:            `${plan.name} — ${l.toUpperCase()}`,
                status:          'paused',
                internal_status: 'draft',
                funnel_layer:    l,
                objective:       plan.objective,
                budget_daily:    budgetDaily,
                media_plan_id:   planId,
            };
        });

    if (campaigns.length > 0) {
        const { error: insertErr } = await supabase.from('ad_campaigns').insert(campaigns);
        if (insertErr) return { ok: false, error: insertErr.message };
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { error: updateErr } = await supabase
        .from('media_plans')
        .update({
            status:      'approved',
            approved_by: user?.id ?? null,
            approved_at: new Date().toISOString(),
            updated_at:  new Date().toISOString(),
        })
        .eq('id', planId);

    if (updateErr) return { ok: false, error: updateErr.message };
    return { ok: true, campaignsCreated: campaigns.length };
}

export async function rejectMediaPlan(
    planId: string,
    reason?: string,
): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase
        .from('media_plans')
        .update({
            status:          'rejected',
            rejected_reason: reason ?? null,
            updated_at:      new Date().toISOString(),
        })
        .eq('id', planId)
        .eq('status', 'pending_approval');

    if (error) return { ok: false, error: error.message };
    return { ok: true };
}

// ── Manual sync trigger ───────────────────────────────────────────────────────

export async function triggerAdsSync(brandId: string): Promise<{ ok: boolean; error?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { ok: false, error: 'Session expired' };

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

    try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/ads-sync`, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ brand_id: brandId }),
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
            return { ok: false, error: err.error ?? `HTTP ${resp.status}` };
        }

        return { ok: true };
    } catch (e) {
        return { ok: false, error: String(e) };
    }
}
