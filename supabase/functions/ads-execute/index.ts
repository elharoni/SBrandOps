/**
 * ads-execute Edge Function — M4-A Decision Execution
 *
 * Takes a pending decision and executes it immediately:
 *   kill:      POST to Meta API → status=PAUSED, updates ad_campaigns.internal_status
 *   scale:     POST to Meta API → daily_budget += scale_percent%, updates ad_campaigns.budget_daily
 *   duplicate: inserts a draft copy of the campaign in DB (no Meta API call)
 *   refresh / review / hold: marks executed with no API change
 *
 * Body:    { decision_id: string }
 * Response: { ok: boolean, action: string, message_ar: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptTokenWithLog } from '../_shared/tokens.ts';
import { verifyJWT, assertBrandOwnership, buildCorsHeaders } from '../_shared/auth.ts';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const FB_API_VER = 'v23.0';

function jsonError(msg: string, status: number, correlationId: string, corsHeaders: Record<string, string>): Response {
    return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
    });
}

// ── Token loader (mirrors ads-sync pattern) ───────────────────────────────────

async function getMetaToken(brandId: string): Promise<{ token: string; tokenId: string } | null> {
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

    const token = await decryptTokenWithLog(
        data.access_token_enc,
        data.id,
        brandId,
        'ads_execute',
        'ads-execute',
    );

    return token ? { token, tokenId: data.id } : null;
}

// ── Meta API mutation (campaign update) ───────────────────────────────────────

interface MetaUpdateResult {
    fbtrace_id: string | null;
    error:      string | null;
}

async function updateCampaignOnMeta(
    externalCampaignId: string,
    token: string,
    params: Record<string, string>,
): Promise<MetaUpdateResult> {
    const body = new URLSearchParams({
        access_token: token,
        ...params,
    });

    const resp = await fetch(
        `https://graph.facebook.com/${FB_API_VER}/${externalCampaignId}`,
        {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    body.toString(),
            signal:  AbortSignal.timeout(20_000),
        },
    );

    const fbtrace_id = resp.headers.get('x-fb-trace-id') ?? null;

    if (!resp.ok) {
        const errData = await resp.json().catch(() => ({})) as { error?: { message?: string } };
        return { fbtrace_id, error: errData?.error?.message ?? `Meta API ${resp.status}` };
    }

    return { fbtrace_id, error: null };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    const correlationId = crypto.randomUUID();
    const corsHeaders   = buildCorsHeaders(req.headers.get('Origin'));

    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const userOrError = await verifyJWT(req, correlationId, corsHeaders);
    if (userOrError instanceof Response) return userOrError;

    if (req.method !== 'POST') return jsonError('Method Not Allowed', 405, correlationId, corsHeaders);

    let decision_id: string;
    try {
        const body = await req.json();
        decision_id = String(body.decision_id ?? '').trim();
    } catch {
        return jsonError('Invalid JSON body', 400, correlationId, corsHeaders);
    }

    if (!decision_id) return jsonError('decision_id is required', 400, correlationId, corsHeaders);

    // ── Load decision ─────────────────────────────────────────────────────────

    const { data: decision } = await supabase
        .from('ad_decisions')
        .select('id, brand_id, target_id, target_type, decision_type, scale_percent')
        .eq('id', decision_id)
        .eq('status', 'pending')
        .maybeSingle();

    if (!decision) return jsonError('Decision not found or already processed', 404, correlationId, corsHeaders);

    // ── Assert brand ownership ────────────────────────────────────────────────

    const ownerErr = await assertBrandOwnership(supabase, userOrError.id, decision.brand_id as string, correlationId, corsHeaders);
    if (ownerErr) return ownerErr;

    // ── Load campaign ─────────────────────────────────────────────────────────

    const { data: campaign } = await supabase
        .from('ad_campaigns')
        .select('id, brand_id, name, provider, external_campaign_id, budget_daily, funnel_layer, objective, ad_account_uuid')
        .eq('id', decision.target_id as string)
        .maybeSingle();

    if (!campaign) return jsonError('Campaign not found', 404, correlationId, corsHeaders);

    // ── Execute ───────────────────────────────────────────────────────────────

    const brandId     = decision.brand_id as string;
    const decisionType = decision.decision_type as string;
    const extId        = campaign.external_campaign_id as string | null;

    let action:     string;
    let message_ar: string;
    let fbtrace_id: string | null = null;

    try {
        if (decisionType === 'kill') {
            if (extId) {
                const tokenData = await getMetaToken(brandId);
                if (tokenData) {
                    const result = await updateCampaignOnMeta(extId, tokenData.token, { status: 'PAUSED' });
                    fbtrace_id = result.fbtrace_id;
                    if (result.error) throw new Error(result.error);
                    action     = 'paused_meta';
                    message_ar = `تم إيقاف الحملة "${campaign.name}" على Meta`;
                } else {
                    action     = 'paused_local';
                    message_ar = `تم تحديد الحملة "${campaign.name}" كموقوفة (لا يوجد توكن)`;
                }
            } else {
                action     = 'paused_local';
                message_ar = `تم تحديد الحملة "${campaign.name}" كموقوفة (مسودة)`;
            }
            await supabase.from('ad_campaigns')
                .update({ internal_status: 'paused', updated_at: new Date().toISOString() })
                .eq('id', campaign.id as string);

        } else if (decisionType === 'scale') {
            const currentBudget = Number(campaign.budget_daily ?? 0);
            const pct           = Number(decision.scale_percent ?? 20);
            const newBudget     = currentBudget > 0 ? currentBudget * (1 + pct / 100) : 0;

            if (extId && currentBudget > 0) {
                const tokenData = await getMetaToken(brandId);
                if (tokenData) {
                    const newBudgetCents = String(Math.round(newBudget * 100));
                    const result = await updateCampaignOnMeta(extId, tokenData.token, { daily_budget: newBudgetCents });
                    fbtrace_id = result.fbtrace_id;
                    if (result.error) throw new Error(result.error);
                    action     = 'scaled_meta';
                    message_ar = `تم رفع ميزانية الحملة "${campaign.name}" +${pct}% على Meta`;
                } else {
                    action     = 'scaled_local';
                    message_ar = `تم تعديل ميزانية الحملة "${campaign.name}" +${pct}% (لا يوجد توكن)`;
                }
            } else {
                action     = 'scaled_local';
                message_ar = `تم تعديل ميزانية الحملة "${campaign.name}" +${pct}% (مسودة)`;
            }

            if (newBudget > 0) {
                await supabase.from('ad_campaigns')
                    .update({ budget_daily: newBudget, updated_at: new Date().toISOString() })
                    .eq('id', campaign.id as string);
            }

        } else if (decisionType === 'duplicate') {
            await supabase.from('ad_campaigns').insert({
                brand_id:        brandId,
                provider:        (campaign.provider as string) ?? 'meta',
                name:            (campaign.name as string) + ' — نسخة',
                status:          'paused',
                internal_status: 'draft',
                objective:       campaign.objective ?? null,
                budget_daily:    campaign.budget_daily ?? null,
                funnel_layer:    (campaign.funnel_layer as string) ?? 'tofu',
                ad_account_uuid: campaign.ad_account_uuid ?? null,
            });
            action     = 'duplicated_local';
            message_ar = `تم إنشاء نسخة من الحملة "${campaign.name}" كمسودة`;

        } else {
            // refresh / review / hold — no API change needed
            const labels: Record<string, string> = {
                refresh: `تم تحديد الحملة "${campaign.name}" للتجديد الإبداعي`,
                review:  `تم تحديد الحملة "${campaign.name}" للمراجعة`,
                hold:    `تم الاحتفاظ بالحملة "${campaign.name}" كما هي`,
            };
            action     = decisionType;
            message_ar = labels[decisionType] ?? 'تم تنفيذ القرار';
        }

    } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Execution error';

        await supabase.from('ad_decisions').update({
            status:        'failed',
            error_message: errMsg,
            updated_at:    new Date().toISOString(),
        }).eq('id', decision_id);

        console.error(JSON.stringify({ correlationId, event: 'ads-execute-failed', decisionId: decision_id, error: errMsg }));

        return new Response(JSON.stringify({ ok: false, error: errMsg }), {
            status:  502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
        });
    }

    // ── Mark decision executed ────────────────────────────────────────────────

    await supabase.from('ad_decisions').update({
        status:      'executed',
        approved_by: userOrError.id,
        approved_at: new Date().toISOString(),
        executed_at: new Date().toISOString(),
        fbtrace_id:  fbtrace_id ?? null,
        updated_at:  new Date().toISOString(),
    }).eq('id', decision_id);

    console.log(JSON.stringify({
        correlationId,
        event:      'ads-execute-ok',
        decisionId: decision_id,
        action,
        brandId,
    }));

    return new Response(JSON.stringify({ ok: true, action, message_ar }), {
        status:  200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
    });
});
