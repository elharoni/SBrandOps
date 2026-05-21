/**
 * bmb-scheduler Edge Function — M4-B Automation Scheduler
 *
 * Called by pg_cron every 15 minutes (via pg_net) or manually.
 * Processes pending 'scheduled_decisions' jobs from bmb_job_queue.
 *
 * For each job:
 *   1. Loads brand's automation_policy
 *   2. Generates KILL/SCALE/DUPLICATE/REFRESH/REVIEW/HOLD decisions via Gemini
 *   3. AUTO mode: auto-executes KILL/SCALE within policy thresholds
 *      TIERED mode: same but restricted to tiered_auto_launch_layers
 *      MANUAL mode: skips auto-execution (jobs shouldn't exist but handled safely)
 *   4. Leaves DUPLICATE/REFRESH/REVIEW/HOLD as pending (require manual approval)
 *   5. Marks job 'completed' and logs to bmb_scheduler_log
 *
 * Auth: accepts service_role key (pg_cron) OR valid user JWT (manual trigger).
 * Body: {} — processes all pending jobs in one invocation.
 * Response: { processed, generated, auto_executed, kept_pending, log_id }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildCorsHeaders } from '../_shared/auth.ts';
import { decryptTokenWithLog } from '../_shared/tokens.ts';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const BMB_MODEL    = 'gemini-2.5-pro';
const BMB_TIMEOUT  = 90_000;
const FB_API_VER   = 'v23.0';

// ── Auth check ────────────────────────────────────────────────────────────────
// Accepts service_role key (pg_cron) OR a valid user JWT (manual trigger)

async function isAuthorized(req: Request): Promise<boolean> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return false;
    const token = authHeader.replace('Bearer ', '').trim();

    // Service role shortcut
    if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return true;

    // Validate user JWT
    const { data: { user } } = await supabase.auth.getUser(token);
    return !!user;
}

// ── Gemini API key ────────────────────────────────────────────────────────────

async function getGeminiApiKey(): Promise<string | null> {
    const { data } = await supabase
        .from('ai_provider_keys')
        .select('key_value')
        .eq('provider', 'gemini')
        .eq('is_active', true)
        .maybeSingle();
    return data?.key_value ?? Deno.env.get('GEMINI_API_KEY') ?? null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type DecisionType = 'scale' | 'kill' | 'duplicate' | 'refresh' | 'review' | 'hold';

interface RawDecision {
    target_type:        'campaign';
    target_id:          string;
    target_name:        string;
    decision_type:      DecisionType;
    reasoning:          string;
    supporting_metrics: {
        cpa?:            number | null;
        target_cpa?:     number | null;
        cpa_multiplier?: number | null;
        frequency?:      number | null;
        ctr_drop_pct?:   number | null;
        spend?:          number | null;
        conversions?:    number | null;
    };
    scale_percent?: number | null;
    source_id?:     string | null;
}

interface AutomationPolicy {
    mode:                        'manual' | 'auto' | 'tiered';
    kill_cpa_multiplier:         number;
    kill_window_hours:           number;
    max_auto_scale_percent:      number;
    max_daily_spend_per_campaign:number;
    tiered_auto_launch_layers:   string[];
    monthly_budget:              number | null;
}

interface BrandContext {
    name:        string;
    industry:    string | null;
    country:     string | null;
    currency:    string;
    killMultiplier: number;
    campaigns:   CampaignCtx[];
    policy:      AutomationPolicy;
}

interface CampaignCtx {
    id:            string;
    name:          string;
    layer:         string;
    status:        string;
    spend7d:       number;
    conversions7d: number;
    cpa7d:         number | null;
    ctr7d:         number | null;
    targetCpa:     number | null;
    cpaMultiplier: number | null;
    killThreshold: number | null;
    budgetDaily:   number;
    externalId:    string | null;
}

// ── Context loader ────────────────────────────────────────────────────────────

async function loadBrandContext(brandId: string, apiKey: string): Promise<BrandContext | null> {
    const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

    const [brandRes, targetsRes, policyRes, campaignsRes, insightsRes] = await Promise.all([
        supabase.from('brands').select('name, industry, country').eq('id', brandId).maybeSingle(),
        supabase.from('cpa_targets').select('funnel_layer, target_cpa, currency').eq('brand_id', brandId),
        supabase.from('automation_policies')
            .select('mode, kill_cpa_multiplier, kill_window_hours, max_auto_scale_percent, max_daily_spend_per_campaign, tiered_auto_launch_layers, monthly_budget')
            .eq('brand_id', brandId)
            .maybeSingle(),
        supabase.from('ad_campaigns')
            .select('id, name, funnel_layer, status, internal_status, external_campaign_id, budget_daily')
            .eq('brand_id', brandId)
            .in('internal_status', ['live', 'paused', 'draft'])
            .order('created_at', { ascending: false })
            .limit(20),
        supabase.from('ad_insights')
            .select('external_object_id, date, spend, conversions, impressions, clicks')
            .eq('brand_id', brandId)
            .eq('object_type', 'campaign')
            .gte('date', since7d),
    ]);

    const policy = policyRes.data as AutomationPolicy | null;
    if (!policy) return null;

    const cpaMap: Record<string, number> = {};
    let currency = 'EGP';
    for (const t of targetsRes.data ?? []) {
        cpaMap[t.funnel_layer] = Number(t.target_cpa);
        currency = t.currency ?? currency;
    }

    const insightAgg: Record<string, { spend: number; conversions: number; impressions: number; clicks: number }> = {};
    for (const r of insightsRes.data ?? []) {
        const k = r.external_object_id;
        if (!insightAgg[k]) insightAgg[k] = { spend: 0, conversions: 0, impressions: 0, clicks: 0 };
        insightAgg[k].spend       += Number(r.spend ?? 0);
        insightAgg[k].conversions += Number(r.conversions ?? 0);
        insightAgg[k].impressions += Number(r.impressions ?? 0);
        insightAgg[k].clicks      += Number(r.clicks ?? 0);
    }

    const killMultiplier = Number(policy.kill_cpa_multiplier ?? 2.0);

    const campaigns: CampaignCtx[] = (campaignsRes.data ?? []).map(c => {
        const agg  = insightAgg[c.external_campaign_id ?? ''] ?? { spend: 0, conversions: 0, impressions: 0, clicks: 0 };
        const cpa7d      = agg.spend > 0 && agg.conversions > 0 ? agg.spend / agg.conversions : null;
        const ctr7d      = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : null;
        const targetCpa  = cpaMap[c.funnel_layer ?? 'tofu'] ?? null;
        const multiplier = cpa7d && targetCpa ? cpa7d / targetCpa : null;

        return {
            id:            c.id as string,
            name:          c.name as string,
            layer:         (c.funnel_layer ?? 'tofu') as string,
            status:        (c.internal_status ?? c.status ?? 'live') as string,
            spend7d:       agg.spend,
            conversions7d: agg.conversions,
            cpa7d,
            ctr7d,
            targetCpa,
            cpaMultiplier: multiplier,
            killThreshold: targetCpa ? targetCpa * killMultiplier : null,
            budgetDaily:   Number(c.budget_daily ?? 0),
            externalId:    c.external_campaign_id as string | null,
        };
    });

    return {
        name:          brandRes.data?.name ?? 'البراند',
        industry:      brandRes.data?.industry ?? null,
        country:       brandRes.data?.country ?? null,
        currency,
        killMultiplier,
        campaigns,
        policy: {
            mode:                         policy.mode ?? 'manual',
            kill_cpa_multiplier:          Number(policy.kill_cpa_multiplier ?? 2.0),
            kill_window_hours:            Number(policy.kill_window_hours ?? 48),
            max_auto_scale_percent:       Number(policy.max_auto_scale_percent ?? 20),
            max_daily_spend_per_campaign: Number(policy.max_daily_spend_per_campaign ?? 2000),
            tiered_auto_launch_layers:    (policy.tiered_auto_launch_layers as string[]) ?? ['tofu'],
            monthly_budget:               policy.monthly_budget ? Number(policy.monthly_budget) : null,
        },
    };
}

// ── Prompt builder (shared with bmb-decisions) ────────────────────────────────

function buildPrompt(ctx: BrandContext): string {
    const cur = ctx.currency;
    const lines: string[] = [
        `أنت البيير — محلل ميديا بايينج متخصص لبراند ${ctx.name}${ctx.country ? ` في ${ctx.country}` : ''}.`,
        'مهمتك: تحليل أداء الحملات وتقديم مقترحات قرارات موضوعية بصيغة JSON array فقط — بدون أي نص خارجه.',
        '',
        `معامل الإيقاف (KILL): CPA أعلى من ${ctx.killMultiplier}x فوق هدف CPA.`,
        '',
        '## الحملات (آخر 7 أيام):',
    ];

    for (const c of ctx.campaigns) {
        lines.push(`### UUID: ${c.id}`);
        lines.push(`الاسم: ${c.name} | الطبقة: ${c.layer.toUpperCase()} | الحالة: ${c.status}`);
        lines.push(`الإنفاق 7 أيام: ${c.spend7d.toFixed(0)} ${cur}`);
        lines.push(`التحويلات: ${c.conversions7d}`);
        lines.push(`CPA الفعلي: ${c.cpa7d != null ? c.cpa7d.toFixed(1) + ' ' + cur : 'لا تحويلات'}`);
        lines.push(`CPA المستهدف: ${c.targetCpa != null ? c.targetCpa.toFixed(0) + ' ' + cur : 'غير محدد'}`);
        lines.push(`مضاعف CPA: ${c.cpaMultiplier != null ? c.cpaMultiplier.toFixed(2) + 'x' : 'N/A'}`);
        lines.push(`CTR: ${c.ctr7d != null ? c.ctr7d.toFixed(2) + '%' : 'N/A'}`);
        lines.push('');
    }

    lines.push(
        '## قواعد القرارات:',
        `- KILL: CPA > ${ctx.killMultiplier}x الهدف مع إنفاق > 200 ${cur}.`,
        '- SCALE: CPA ≤ 0.8x الهدف مع تحويلات ≥ 3. اقترح scale_percent بين 10-50.',
        '- DUPLICATE: حملة ممتازة (CPA ≤ 0.7x) يمكن نسخها لطبقة قمع مختلفة.',
        '- REFRESH: CTR < 1% أو لا تحويلات مع إنفاق > 300 — الإبداع يحتاج تجديد.',
        '- REVIEW: بيانات غير كافية (إنفاق < 100) أو وضع غير واضح.',
        '- HOLD: أداء مقبول (0.8x ≤ CPA ≤ 1.2x الهدف)، لا تغيير مطلوب.',
        '',
        '## تعليمات:',
        '- أصدر قراراً واحداً لكل حملة.',
        '- استخدم UUID الحملة الفعلي في target_id بالضبط.',
        '- اكتب reasoning باللغة العربية، جملة أو جملتين.',
        '- ضع القيم الفعلية في supporting_metrics.',
        '',
        '## صيغة الإخراج — JSON array فقط:',
        JSON.stringify([{
            target_type: 'campaign',
            target_id:   '<campaign UUID>',
            target_name: '<اسم الحملة>',
            decision_type: 'kill|scale|duplicate|refresh|review|hold',
            reasoning:   '<سبب القرار بالعربية>',
            supporting_metrics: { cpa: null, target_cpa: null, cpa_multiplier: null, frequency: null, ctr_drop_pct: null, spend: null, conversions: null },
            scale_percent: null,
            source_id:   null,
        }], null, 2),
    );

    return lines.join('\n');
}

// ── Meta token loader ─────────────────────────────────────────────────────────

async function getMetaToken(brandId: string): Promise<string | null> {
    const { data } = await supabase
        .from('oauth_tokens')
        .select('id, access_token_enc')
        .eq('brand_id', brandId)
        .eq('provider', 'meta_ads')
        .eq('is_valid', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!data?.access_token_enc) return null;
    return decryptTokenWithLog(data.access_token_enc, data.id, brandId, 'scheduler', 'bmb-scheduler');
}

// ── Meta API campaign update ──────────────────────────────────────────────────

async function updateMetaCampaign(extId: string, token: string, params: Record<string, string>): Promise<string | null> {
    const body = new URLSearchParams({ access_token: token, ...params });
    const resp = await fetch(`https://graph.facebook.com/${FB_API_VER}/${extId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
        signal:  AbortSignal.timeout(20_000),
    });
    return resp.ok ? null : `Meta ${resp.status}`;
}

// ── Auto-execute decision ─────────────────────────────────────────────────────

async function autoExecuteDecision(
    decisionId: string,
    decision: RawDecision,
    brandId: string,
    campaign: CampaignCtx,
): Promise<{ ok: boolean; action: string }> {
    try {
        if (decision.decision_type === 'kill') {
            if (campaign.externalId) {
                const token = await getMetaToken(brandId);
                if (token) {
                    const err = await updateMetaCampaign(campaign.externalId, token, { status: 'PAUSED' });
                    if (err) throw new Error(err);
                }
            }
            await supabase.from('ad_campaigns').update({ internal_status: 'paused', updated_at: new Date().toISOString() }).eq('id', campaign.id);

        } else if (decision.decision_type === 'scale') {
            if (campaign.budgetDaily > 0) {
                const pct       = Math.min(Number(decision.scale_percent ?? 20), 50);
                const newBudget = campaign.budgetDaily * (1 + pct / 100);
                if (campaign.externalId) {
                    const token = await getMetaToken(brandId);
                    if (token) {
                        const err = await updateMetaCampaign(campaign.externalId, token, { daily_budget: String(Math.round(newBudget * 100)) });
                        if (err) throw new Error(err);
                    }
                }
                await supabase.from('ad_campaigns').update({ budget_daily: newBudget, updated_at: new Date().toISOString() }).eq('id', campaign.id);
            }
        }

        await supabase.from('ad_decisions').update({
            status:           'executed',
            auto_executed_at: new Date().toISOString(),
            auto_actor:       'automation',
            executed_at:      new Date().toISOString(),
            updated_at:       new Date().toISOString(),
        }).eq('id', decisionId);

        return { ok: true, action: decision.decision_type };
    } catch (err) {
        await supabase.from('ad_decisions').update({
            status:        'failed',
            error_message: err instanceof Error ? err.message : 'Auto-execute error',
            updated_at:    new Date().toISOString(),
        }).eq('id', decisionId);
        return { ok: false, action: decision.decision_type };
    }
}

// ── Threshold checks ──────────────────────────────────────────────────────────

function shouldAutoExecute(decision: RawDecision, campaign: CampaignCtx, policy: AutomationPolicy): boolean {
    if (policy.mode === 'manual') return false;

    // TIERED: only auto-execute for the configured funnel layers
    if (policy.mode === 'tiered' && !policy.tiered_auto_launch_layers.includes(campaign.layer)) return false;

    const { cpa7d, targetCpa, spend7d, conversions7d } = campaign;

    if (decision.decision_type === 'kill') {
        // Only auto-kill if CPA clearly exceeds multiplier and there's enough spend data
        return (
            cpa7d != null &&
            targetCpa != null &&
            spend7d >= 200 &&
            cpa7d > targetCpa * policy.kill_cpa_multiplier
        );
    }

    if (decision.decision_type === 'scale') {
        const pct        = Number(decision.scale_percent ?? 20);
        const newBudget  = campaign.budgetDaily * (1 + pct / 100);
        return (
            cpa7d != null &&
            targetCpa != null &&
            conversions7d >= 3 &&
            cpa7d < targetCpa * 0.8 &&
            pct <= policy.max_auto_scale_percent &&
            newBudget <= policy.max_daily_spend_per_campaign
        );
    }

    // duplicate / refresh / review / hold — always keep for manual approval
    return false;
}

// ── Process one brand job ─────────────────────────────────────────────────────

async function processBrandJob(
    jobId: string,
    brandId: string,
    apiKey: string,
): Promise<{ generated: number; autoExecuted: number; keptPending: number }> {
    // Claim job
    await supabase.from('bmb_job_queue').update({
        status:     'running',
        attempts:   1,
        updated_at: new Date().toISOString(),
    }).eq('id', jobId);

    const ctx = await loadBrandContext(brandId, apiKey);
    if (!ctx || ctx.campaigns.length === 0) {
        await supabase.from('bmb_job_queue').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', jobId);
        return { generated: 0, autoExecuted: 0, keptPending: 0 };
    }

    // Create bmb_run record
    let runId: string | null = null;
    try {
        const { data } = await supabase.from('bmb_runs').insert({
            brand_id: brandId,
            run_type: 'scheduled_decisions',
            trigger:  'pg_cron',
            status:   'running',
            input:    { campaigns_count: ctx.campaigns.length },
            model:    BMB_MODEL,
        }).select('id').single();
        runId = data?.id ?? null;
    } catch { /* non-fatal */ }

    const startMs = Date.now();
    let generated = 0, autoExecuted = 0, keptPending = 0;

    try {
        // Call Gemini
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${BMB_MODEL}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            signal:  AbortSignal.timeout(BMB_TIMEOUT),
            body:    JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: buildPrompt(ctx) }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 4096, responseMimeType: 'application/json' },
            }),
        });

        if (!res.ok) throw new Error(`Gemini ${res.status}`);

        const geminiData = await res.json();
        const rawText    = (geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '') as string;
        const latency    = Date.now() - startMs;
        const usage      = (geminiData.usageMetadata ?? {}) as Record<string, number>;

        let rawDecisions: RawDecision[] = [];
        try { rawDecisions = JSON.parse(rawText) ?? []; } catch { rawDecisions = []; }
        if (!Array.isArray(rawDecisions)) rawDecisions = [];

        const VALID_TYPES   = new Set<string>(['scale', 'kill', 'duplicate', 'refresh', 'review', 'hold']);
        const campaignIdSet = new Set(ctx.campaigns.map(c => c.id));
        const campaignMap   = Object.fromEntries(ctx.campaigns.map(c => [c.id, c]));

        const validDecisions = rawDecisions.filter(d =>
            d && typeof d === 'object' &&
            d.target_type === 'campaign' &&
            VALID_TYPES.has(d.decision_type) &&
            typeof d.target_id === 'string' &&
            campaignIdSet.has(d.target_id) &&
            typeof d.reasoning === 'string' && d.reasoning.length > 0,
        );

        // Deduplicate against existing pending decisions
        const { data: existingPending } = await supabase
            .from('ad_decisions')
            .select('target_id, decision_type')
            .eq('brand_id', brandId)
            .eq('status', 'pending');

        const existingSet = new Set(
            (existingPending ?? []).map((d: { target_id: string; decision_type: string }) => `${d.target_id}:${d.decision_type}`),
        );

        for (const d of validDecisions) {
            const key = `${d.target_id}:${d.decision_type}`;
            if (existingSet.has(key)) continue;

            const { data: inserted, error: insertErr } = await supabase
                .from('ad_decisions')
                .insert({
                    brand_id:           brandId,
                    bmb_run_id:         runId,
                    target_type:        'campaign',
                    target_id:          d.target_id,
                    decision_type:      d.decision_type,
                    status:             'pending',
                    reasoning:          d.reasoning,
                    supporting_metrics: d.supporting_metrics ?? {},
                    scale_percent:      d.scale_percent   ?? null,
                    source_id:          d.source_id       ?? null,
                })
                .select('id')
                .single();

            if (insertErr || !inserted) continue;

            generated++;
            existingSet.add(key);

            const campaign = campaignMap[d.target_id];
            if (campaign && shouldAutoExecute(d, campaign, ctx.policy)) {
                const { ok } = await autoExecuteDecision(inserted.id, d, brandId, campaign);
                if (ok) autoExecuted++;
                else    keptPending++;
            } else {
                keptPending++;
            }
        }

        // Update bmb_run
        if (runId) {
            supabase.from('bmb_runs').update({
                status:        'completed',
                output:        { generated, autoExecuted, keptPending },
                input_tokens:  usage.promptTokenCount     ?? null,
                output_tokens: usage.candidatesTokenCount ?? null,
                latency_ms:    latency,
                completed_at:  new Date().toISOString(),
            }).eq('id', runId).then(() => {}).catch(() => {});
        }

    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (runId) {
            supabase.from('bmb_runs').update({ status: 'failed', error_message: msg, completed_at: new Date().toISOString() })
                .eq('id', runId).then(() => {}).catch(() => {});
        }
        await supabase.from('bmb_job_queue').update({ status: 'retry', last_error: msg, updated_at: new Date().toISOString() }).eq('id', jobId);
        throw err;
    }

    await supabase.from('bmb_job_queue').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', jobId);
    return { generated, autoExecuted, keptPending };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    const correlationId = crypto.randomUUID();
    const corsHeaders   = buildCorsHeaders(req.headers.get('Origin'));

    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    if (!await isAuthorized(req)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const trigger = req.headers.get('X-Trigger') ?? 'manual';
    const startMs = Date.now();

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'No active Gemini API key' }), {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // Claim up to 10 pending jobs in this invocation
    const { data: jobs } = await supabase
        .from('bmb_job_queue')
        .select('id, brand_id')
        .in('status', ['pending', 'retry'])
        .lte('next_attempt_at', new Date().toISOString())
        .lt('attempts', 5)
        .order('next_attempt_at', { ascending: true })
        .limit(10);

    if (!jobs?.length) {
        return new Response(JSON.stringify({ processed: 0, generated: 0, auto_executed: 0, kept_pending: 0, message: 'No pending jobs' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
        });
    }

    let brandsProcessed = 0, totalGenerated = 0, totalAutoExecuted = 0, totalKeptPending = 0;
    const detail: Record<string, unknown> = {};

    for (const job of jobs) {
        try {
            const result = await processBrandJob(job.id, job.brand_id as string, apiKey);
            brandsProcessed++;
            totalGenerated      += result.generated;
            totalAutoExecuted   += result.autoExecuted;
            totalKeptPending    += result.keptPending;
            detail[job.brand_id as string] = result;
        } catch (err) {
            detail[job.brand_id as string] = { error: err instanceof Error ? err.message : 'Unknown' };
        }
    }

    const duration = Date.now() - startMs;

    // Log to bmb_scheduler_log
    const { data: logRow } = await supabase.from('bmb_scheduler_log').insert({
        trigger,
        brands_processed:        brandsProcessed,
        decisions_generated:     totalGenerated,
        decisions_auto_executed: totalAutoExecuted,
        decisions_kept_pending:  totalKeptPending,
        duration_ms:             duration,
        detail,
    }).select('id').single();

    console.log(JSON.stringify({
        correlationId,
        event:        'bmb-scheduler-ok',
        trigger,
        brandsProcessed,
        totalGenerated,
        totalAutoExecuted,
        durationMs: duration,
    }));

    return new Response(JSON.stringify({
        processed:     brandsProcessed,
        generated:     totalGenerated,
        auto_executed: totalAutoExecuted,
        kept_pending:  totalKeptPending,
        duration_ms:   duration,
        log_id:        logRow?.id ?? null,
    }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
    });
});
