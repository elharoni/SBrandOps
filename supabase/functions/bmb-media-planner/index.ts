/**
 * bmb-media-planner Edge Function — M5 Media Plan Generator
 *
 * Generates a 3-layer (TOFU/MOFU/BOFU) media plan from an operator brief,
 * inserts it into media_plans with status='pending_approval', logs the run.
 *
 * Body:    { brand_id, brief, total_budget, currency?, start_date?, end_date? }
 * Response: { plan_id, plan }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyJWT, assertBrandOwnership, buildCorsHeaders } from '../_shared/auth.ts';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const BMB_MODEL   = 'gemini-2.5-pro';
const BMB_TIMEOUT = 120_000;

const VALID_OBJECTIVES = new Set([
    'OUTCOME_AWARENESS', 'OUTCOME_TRAFFIC', 'OUTCOME_LEADS',
    'OUTCOME_SALES', 'OUTCOME_ENGAGEMENT',
]);

function jsonError(msg: string, status: number, correlationId: string, corsHeaders: Record<string, string>): Response {
    return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
    });
}

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

interface LayerKPIs {
    cpa_target:         number | null;
    roas_target:        number | null;
    impressions_target: number | null;
    ctr_target:         number | null;
}

interface FunnelLayer {
    budget_amount:  number;
    budget_pct:     number;
    objective:      string;
    kpis:           LayerKPIs;
    audience_notes: string;
    ad_formats:     string[];
}

interface CreativeBrief {
    layer:    string;
    format:   string;
    headline: string;
    body:     string;
    cta:      string;
    notes:    string;
}

interface AudienceSpec {
    layer:          string;
    type:           string;
    description:    string;
    estimated_size: string;
}

interface GeminiPlanOutput {
    name:             string;
    objective:        string;
    strategy_summary: string;
    funnel_layers: {
        tofu: FunnelLayer;
        mofu: FunnelLayer;
        bofu: FunnelLayer;
    };
    kpis: {
        overall_cpa_target: number | null;
        roas_target:        number | null;
        reach_target:       number | null;
    };
    creative_briefs: CreativeBrief[];
    audience_plan:   AudienceSpec[];
}

// ── Context loader ────────────────────────────────────────────────────────────

async function loadPlannerContext(brandId: string) {
    const [brandRes, targetsRes, policyRes, campaignsRes] = await Promise.all([
        supabase.from('brands')
            .select('name, industry, country, description')
            .eq('id', brandId)
            .maybeSingle(),

        supabase.from('cpa_targets')
            .select('funnel_layer, target_cpa, currency')
            .eq('brand_id', brandId),

        supabase.from('automation_policies')
            .select('monthly_budget')
            .eq('brand_id', brandId)
            .maybeSingle(),

        supabase.from('ad_campaigns')
            .select('name, funnel_layer, internal_status, budget_daily')
            .eq('brand_id', brandId)
            .in('internal_status', ['live', 'paused'])
            .order('created_at', { ascending: false })
            .limit(10),
    ]);

    const cpaMap: Record<string, number> = {};
    let currency = 'EGP';
    for (const t of targetsRes.data ?? []) {
        cpaMap[t.funnel_layer] = Number(t.target_cpa);
        currency = t.currency ?? currency;
    }

    return {
        brand: {
            name:        (brandRes.data?.name as string)        ?? 'البراند',
            industry:    (brandRes.data?.industry as string)    ?? null,
            country:     (brandRes.data?.country as string)     ?? null,
            description: (brandRes.data?.description as string) ?? null,
        },
        cpaTargets:    cpaMap,
        currency,
        monthlyBudget: policyRes.data?.monthly_budget ? Number(policyRes.data.monthly_budget) : null,
        activeCampaigns: (campaignsRes.data ?? []).map(c => ({
            name:        c.name as string,
            layer:       (c.funnel_layer ?? 'tofu') as string,
            status:      (c.internal_status ?? 'live') as string,
            budgetDaily: c.budget_daily ? Number(c.budget_daily) : null,
        })),
    };
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPlannerPrompt(
    ctx:         Awaited<ReturnType<typeof loadPlannerContext>>,
    brief:       string,
    totalBudget: number,
    currency:    string,
    startDate:   string | null,
    endDate:     string | null,
): string {
    const lines: string[] = [
        `أنت البيير — خبير ميديا بايينج محترف لبراند ${ctx.brand.name}${ctx.brand.country ? ` في ${ctx.brand.country}` : ''}.`,
        ctx.brand.industry    ? `المجال: ${ctx.brand.industry}` : '',
        ctx.brand.description ? `وصف البراند: ${ctx.brand.description}` : '',
        '',
        '## المهمة',
        'بناءً على الـ brief التالي، أنشئ خطة إعلانية متكاملة 3 طبقات (TOFU/MOFU/BOFU) احترافية.',
        '',
        '## الـ Brief',
        brief,
        '',
        '## معلومات الحملة',
        `الميزانية الإجمالية: ${totalBudget.toLocaleString()} ${currency}`,
        startDate ? `تاريخ البداية: ${startDate}` : '',
        endDate   ? `تاريخ النهاية: ${endDate}` : '',
        (endDate && startDate)
            ? `مدة الحملة التقريبية: ${Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000))} يوم`
            : '',
    ].filter(l => l !== '');

    if (Object.keys(ctx.cpaTargets).length > 0) {
        lines.push('', '## أهداف CPA الحالية:');
        if (ctx.cpaTargets['tofu']) lines.push(`- TOFU: ${ctx.cpaTargets['tofu']} ${ctx.currency}`);
        if (ctx.cpaTargets['mofu']) lines.push(`- MOFU: ${ctx.cpaTargets['mofu']} ${ctx.currency}`);
        if (ctx.cpaTargets['bofu']) lines.push(`- BOFU: ${ctx.cpaTargets['bofu']} ${ctx.currency}`);
    }

    if (ctx.activeCampaigns.length > 0) {
        lines.push('', '## الحملات الحالية النشطة (للسياق — لا تُعيدها، فقط استلهم منها):');
        for (const c of ctx.activeCampaigns.slice(0, 5)) {
            lines.push(`- ${c.name} (${c.layer.toUpperCase()}, ${c.status}${c.budgetDaily ? `, ${c.budgetDaily} ${ctx.currency}/يوم` : ''})`);
        }
    }

    lines.push(
        '',
        '## إرشادات توزيع الميزانية:',
        '- TOFU (الوعي والانتشار): 40-50% من الميزانية',
        '- MOFU (الاهتمام والتفاعل): 25-35%',
        '- BOFU (التحويل والشراء): 20-30%',
        '- يجب أن يكون مجموع budget_amount للطبقات الثلاث مساوياً تماماً لـ total_budget',
        '',
        '## تعليمات الإخراج:',
        '- اكتب بالعربية في جميع الحقول النصية (name, strategy_summary, objective text, audience_notes, كل نصوص creative_briefs)',
        '- حقل objective يجب أن يكون أحد: OUTCOME_AWARENESS | OUTCOME_TRAFFIC | OUTCOME_LEADS | OUTCOME_SALES | OUTCOME_ENGAGEMENT',
        '- creative_briefs: 1-2 brief لكل طبقة (tofu/mofu/bofu)',
        '- audience_plan: 1-2 جمهور لكل طبقة',
        '- أرقام واقعية مناسبة للسوق والمجال والميزانية',
        '- لا تُضف أي نص خارج JSON',
        '',
        '## صيغة الإخراج — JSON object واحد فقط:',
        JSON.stringify({
            name:             'اسم الخطة (مثال: خطة إطلاق مارس 2025)',
            objective:        'OUTCOME_LEADS',
            strategy_summary: 'ملخص الاستراتيجية الإعلانية بالعربية — 3 إلى 5 جمل',
            funnel_layers: {
                tofu: {
                    budget_amount:  25000,
                    budget_pct:     50,
                    objective:      'الوعي والوصول لجمهور جديد',
                    kpis: { cpa_target: null, roas_target: null, impressions_target: 500000, ctr_target: 1.5 },
                    audience_notes: 'جمهور بارد، اهتمامات متعلقة بالمجال، عمر 25-40',
                    ad_formats:     ['فيديو قصير 15 ثانية', 'صورة واحدة'],
                },
                mofu: {
                    budget_amount:  15000,
                    budget_pct:     30,
                    objective:      'زيادة التفاعل وبناء اهتمام',
                    kpis: { cpa_target: null, roas_target: null, impressions_target: null, ctr_target: 2.0 },
                    audience_notes: 'جمهور دافئ، شاهد محتوانا أو تفاعل معه',
                    ad_formats:     ['كاروسيل', 'فيديو 30 ثانية'],
                },
                bofu: {
                    budget_amount:  10000,
                    budget_pct:     20,
                    objective:      'تحفيز التحويل والشراء',
                    kpis: { cpa_target: 150, roas_target: null, impressions_target: null, ctr_target: null },
                    audience_notes: 'ريتارجتينج — زاروا الموقع أو تفاعلوا بعمق',
                    ad_formats:     ['صورة + CTA واضح', 'كاروسيل منتجات'],
                },
            },
            kpis: { overall_cpa_target: 150, roas_target: null, reach_target: 800000 },
            creative_briefs: [
                { layer: 'tofu', format: 'فيديو 15 ثانية', headline: 'اكتشف الحل الأمثل لـ...', body: 'نص الإعلان هنا', cta: 'اعرف أكثر', notes: 'أبرز المشكلة والحل بوضوح' },
                { layer: 'mofu', format: 'كاروسيل',         headline: 'لماذا يختارنا الآلاف؟',  body: 'نص الإعلان هنا', cta: 'اكتشف الآن', notes: 'اعرض المزايا بشكل مرئي' },
                { layer: 'bofu', format: 'صورة واحدة',      headline: 'عرض محدود — احجز الآن',   body: 'نص الإعلان هنا', cta: 'اطلب الآن', notes: 'urgency + social proof' },
            ],
            audience_plan: [
                { layer: 'tofu', type: 'اهتمامات',        description: 'مهتمون بـ...', estimated_size: '2-5 مليون' },
                { layer: 'mofu', type: 'ريتارجتينج موقع', description: 'زاروا الصفحة الرئيسية', estimated_size: '50,000-200,000' },
                { layer: 'bofu', type: 'ريتارجتينج متقدم', description: 'زاروا صفحة التسعير أو أضافوا للسلة', estimated_size: '10,000-50,000' },
            ],
        }, null, 2),
    );

    return lines.join('\n');
}

// ── Validator ─────────────────────────────────────────────────────────────────

function coerceLayer(raw: unknown): FunnelLayer {
    const l = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const kpis = (l.kpis && typeof l.kpis === 'object' ? l.kpis : {}) as Record<string, unknown>;
    return {
        budget_amount:  typeof l.budget_amount === 'number'  ? l.budget_amount  : 0,
        budget_pct:     typeof l.budget_pct    === 'number'  ? l.budget_pct     : 0,
        objective:      typeof l.objective     === 'string'  ? l.objective      : '',
        kpis: {
            cpa_target:         typeof kpis.cpa_target         === 'number' ? kpis.cpa_target         : null,
            roas_target:        typeof kpis.roas_target        === 'number' ? kpis.roas_target        : null,
            impressions_target: typeof kpis.impressions_target === 'number' ? kpis.impressions_target : null,
            ctr_target:         typeof kpis.ctr_target         === 'number' ? kpis.ctr_target         : null,
        },
        audience_notes: typeof l.audience_notes === 'string' ? l.audience_notes : '',
        ad_formats:     Array.isArray(l.ad_formats) ? (l.ad_formats as string[]).filter(f => typeof f === 'string') : [],
    };
}

function validatePlan(raw: unknown, totalBudget: number): GeminiPlanOutput {
    if (!raw || typeof raw !== 'object') throw new Error('الإخراج ليس object صالح');
    const p = raw as Record<string, unknown>;

    const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : 'خطة إعلانية';
    const objective = (typeof p.objective === 'string' && VALID_OBJECTIVES.has(p.objective))
        ? p.objective
        : 'OUTCOME_LEADS';
    const strategy_summary = typeof p.strategy_summary === 'string' ? p.strategy_summary : '';

    const rawFL = (p.funnel_layers && typeof p.funnel_layers === 'object')
        ? p.funnel_layers as Record<string, unknown>
        : {};

    const tofu = coerceLayer(rawFL['tofu']);
    const mofu = coerceLayer(rawFL['mofu']);
    const bofu = coerceLayer(rawFL['bofu']);

    // Re-scale budgets if sum doesn't match totalBudget
    const sum = tofu.budget_amount + mofu.budget_amount + bofu.budget_amount;
    if (sum > 0 && Math.abs(sum - totalBudget) > 1) {
        const ratio = totalBudget / sum;
        tofu.budget_amount = Math.round(tofu.budget_amount * ratio);
        mofu.budget_amount = Math.round(mofu.budget_amount * ratio);
        bofu.budget_amount = totalBudget - tofu.budget_amount - mofu.budget_amount;
    } else if (sum === 0) {
        // fallback 50/30/20
        tofu.budget_amount = Math.round(totalBudget * 0.5);
        mofu.budget_amount = Math.round(totalBudget * 0.3);
        bofu.budget_amount = totalBudget - tofu.budget_amount - mofu.budget_amount;
    }

    // Recalculate pct
    tofu.budget_pct = Math.round((tofu.budget_amount / totalBudget) * 100);
    mofu.budget_pct = Math.round((mofu.budget_amount / totalBudget) * 100);
    bofu.budget_pct = 100 - tofu.budget_pct - mofu.budget_pct;

    const rawKpis = (p.kpis && typeof p.kpis === 'object' ? p.kpis : {}) as Record<string, unknown>;
    const kpis = {
        overall_cpa_target: typeof rawKpis.overall_cpa_target === 'number' ? rawKpis.overall_cpa_target : null,
        roas_target:        typeof rawKpis.roas_target        === 'number' ? rawKpis.roas_target        : null,
        reach_target:       typeof rawKpis.reach_target       === 'number' ? rawKpis.reach_target       : null,
    };

    const creative_briefs: CreativeBrief[] = Array.isArray(p.creative_briefs)
        ? (p.creative_briefs as unknown[])
            .filter(b => b && typeof b === 'object')
            .map(b => {
                const br = b as Record<string, unknown>;
                return {
                    layer:    typeof br.layer    === 'string' ? br.layer    : '',
                    format:   typeof br.format   === 'string' ? br.format   : '',
                    headline: typeof br.headline === 'string' ? br.headline : '',
                    body:     typeof br.body     === 'string' ? br.body     : '',
                    cta:      typeof br.cta      === 'string' ? br.cta      : '',
                    notes:    typeof br.notes    === 'string' ? br.notes    : '',
                };
            })
        : [];

    const audience_plan: AudienceSpec[] = Array.isArray(p.audience_plan)
        ? (p.audience_plan as unknown[])
            .filter(a => a && typeof a === 'object')
            .map(a => {
                const ar = a as Record<string, unknown>;
                return {
                    layer:          typeof ar.layer          === 'string' ? ar.layer          : '',
                    type:           typeof ar.type           === 'string' ? ar.type           : '',
                    description:    typeof ar.description    === 'string' ? ar.description    : '',
                    estimated_size: typeof ar.estimated_size === 'string' ? ar.estimated_size : '',
                };
            })
        : [];

    return {
        name,
        objective,
        strategy_summary,
        funnel_layers: { tofu, mofu, bofu },
        kpis,
        creative_briefs,
        audience_plan,
    };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    const correlationId = crypto.randomUUID();
    const corsHeaders   = buildCorsHeaders(req.headers.get('Origin'));

    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const userOrError = await verifyJWT(req, correlationId, corsHeaders);
    if (userOrError instanceof Response) return userOrError;

    if (req.method !== 'POST') return jsonError('Method Not Allowed', 405, correlationId, corsHeaders);

    let brand_id:     string;
    let brief:        string;
    let total_budget: number;
    let currency:     string;
    let start_date:   string | null;
    let end_date:     string | null;

    try {
        const body   = await req.json();
        brand_id     = String(body.brand_id     ?? '').trim();
        brief        = String(body.brief        ?? '').trim();
        total_budget = Number(body.total_budget ?? 0);
        currency     = String(body.currency     ?? 'EGP').trim();
        start_date   = body.start_date ? String(body.start_date) : null;
        end_date     = body.end_date   ? String(body.end_date)   : null;
    } catch {
        return jsonError('Invalid JSON body', 400, correlationId, corsHeaders);
    }

    if (!brand_id)         return jsonError('brand_id is required',          400, correlationId, corsHeaders);
    if (!brief)            return jsonError('brief is required',             400, correlationId, corsHeaders);
    if (total_budget <= 0) return jsonError('total_budget must be positive', 400, correlationId, corsHeaders);

    const ownershipError = await assertBrandOwnership(supabase, userOrError.id, brand_id, correlationId, corsHeaders);
    if (ownershipError) return ownershipError;

    const [apiKey, ctx] = await Promise.all([
        getGeminiApiKey(),
        loadPlannerContext(brand_id),
    ]);

    if (!apiKey) return jsonError('No active Gemini API key', 503, correlationId, corsHeaders);

    const prompt = buildPlannerPrompt(ctx, brief, total_budget, currency, start_date, end_date);

    // Audit record
    let runId: string | null = null;
    try {
        const { data } = await supabase.from('bmb_runs').insert({
            brand_id,
            run_type: 'on_demand',
            trigger:  'operator',
            status:   'running',
            input:    { brief: brief.slice(0, 500), total_budget, currency },
            model:    BMB_MODEL,
        }).select('id').single();
        runId = data?.id ?? null;
    } catch { /* non-fatal */ }

    const startMs = Date.now();

    try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${BMB_MODEL}:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(geminiUrl, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            signal:  AbortSignal.timeout(BMB_TIMEOUT),
            body:    JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature:      0.2,
                    maxOutputTokens:  8192,
                    responseMimeType: 'application/json',
                },
            }),
        });

        if (!geminiRes.ok) {
            const errData = await geminiRes.json().catch(() => ({}));
            throw new Error((errData as { error?: { message?: string } })?.error?.message ?? `Gemini ${geminiRes.status}`);
        }

        const geminiData = await geminiRes.json();
        const rawText    = (geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '') as string;
        const usage      = (geminiData.usageMetadata ?? {}) as Record<string, number>;
        const latency    = Date.now() - startMs;

        let rawParsed: unknown;
        try {
            rawParsed = JSON.parse(rawText);
        } catch {
            throw new Error('فشل تحليل إخراج Gemini — الرجاء المحاولة مرة أخرى');
        }

        const plan = validatePlan(rawParsed, total_budget);

        const { data: insertedPlan, error: insertErr } = await supabase
            .from('media_plans')
            .insert({
                brand_id,
                name:             plan.name,
                objective:        plan.objective,
                status:           'pending_approval',
                total_budget,
                currency,
                start_date:       start_date ?? null,
                end_date:         end_date   ?? null,
                brief,
                strategy_summary: plan.strategy_summary,
                funnel_layers:    plan.funnel_layers,
                kpis:             plan.kpis,
                creative_briefs:  plan.creative_briefs,
                audience_plan:    plan.audience_plan,
                bmb_run_id:       runId ?? null,
            })
            .select('*')
            .single();

        if (insertErr) throw new Error(insertErr.message);

        // Update bmb_run (non-blocking)
        if (runId) {
            supabase.from('bmb_runs').update({
                status:        'completed',
                output:        { plan_id: insertedPlan.id, plan_name: plan.name },
                input_tokens:  usage.promptTokenCount     ?? null,
                output_tokens: usage.candidatesTokenCount ?? null,
                latency_ms:    latency,
                completed_at:  new Date().toISOString(),
            }).eq('id', runId).then(() => {}).catch(() => {});
        }

        console.log(JSON.stringify({
            correlationId,
            event:    'bmb-media-planner-ok',
            brandId:  brand_id,
            planId:   insertedPlan.id,
            latencyMs: latency,
        }));

        return new Response(JSON.stringify({ plan_id: insertedPlan.id, plan: insertedPlan }), {
            status:  200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
        });

    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';

        if (runId) {
            supabase.from('bmb_runs').update({
                status:        'failed',
                error_message: msg,
                completed_at:  new Date().toISOString(),
            }).eq('id', runId).then(() => {}).catch(() => {});
        }

        console.error(JSON.stringify({ correlationId, event: 'bmb-media-planner-error', error: msg }));
        return jsonError(msg, 502, correlationId, corsHeaders);
    }
});
