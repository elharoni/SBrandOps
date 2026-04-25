/**
 * today-summary Edge Function
 * Aggregates all daily command-center data for the mobile home screen
 * in a single request: inbox alerts, pending approvals, ad alerts, AI brief.
 *
 * POST /functions/v1/today-summary
 * Body: { brand_id: string }
 * Returns: TodaySummary
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyJWT, assertBrandOwnership, buildCorsHeaders } from '../_shared/auth.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ROAS threshold below which a campaign is flagged as an alert
const ROAS_ALERT_THRESHOLD = 1.5;

// ── Gemini helpers ────────────────────────────────────────────────────────────

async function getGeminiApiKey(): Promise<string | null> {
  const { data } = await supabase
    .from('ai_provider_keys')
    .select('key_value')
    .eq('provider', 'gemini')
    .eq('is_active', true)
    .maybeSingle();
  return data?.key_value ?? Deno.env.get('GEMINI_API_KEY') ?? null;
}

async function generateAiBrief(
  apiKey: string,
  brandName: string,
  unreadInbox: number,
  pendingApprovals: number,
  adAlerts: number,
  postsToday: number,
): Promise<{ opportunity: string; risk: string; recommendation: string; action: string }> {
  const prompt = `أنت مساعد تسويق ذكي لبراند اسمه "${brandName}".
بناءً على هذه البيانات الآن:
- رسائل لم يُرد عليها: ${unreadInbox}
- محتوى ينتظر الموافقة: ${pendingApprovals}
- حملات إعلانية تحتاج مراجعة: ${adAlerts}
- منشورات مجدولة اليوم: ${postsToday}

اكتب موجز يومي مختصر جداً (جملة واحدة لكل عنصر):
{
  "opportunity": "أهم فرصة متاحة الآن",
  "risk": "أهم خطر أو تحذير الآن",
  "recommendation": "التوصية الأهم لهذا اليوم",
  "action": "الأكشن الأول المطلوب تنفيذه الآن"
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            opportunity:    { type: 'STRING' },
            risk:           { type: 'STRING' },
            recommendation: { type: 'STRING' },
            action:         { type: 'STRING' },
          },
          required: ['opportunity', 'risk', 'recommendation', 'action'],
        },
      },
    }),
  });

  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  return JSON.parse(raw);
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();

  const user = await verifyJWT(req, correlationId, corsHeaders);
  if (user instanceof Response) return user;

  let brand_id: string;
  try {
    const body = await req.json();
    brand_id = body.brand_id;
    if (!brand_id) throw new Error('missing brand_id');
  } catch {
    return new Response(JSON.stringify({ error: 'brand_id is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ownershipError = await assertBrandOwnership(supabase, user.id, brand_id, correlationId, corsHeaders);
  if (ownershipError) return ownershipError;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(todayStart);
  tomorrowEnd.setUTCDate(tomorrowEnd.getUTCDate() + 2);

  // ── Parallel queries ──────────────────────────────────────────────────────

  const [
    brandResult,
    inboxResult,
    approvalsResult,
    adsResult,
    postsResult,
  ] = await Promise.all([
    // 1. Brand info + connected accounts
    supabase
      .from('brands')
      .select('id, name, logo_url')
      .eq('id', brand_id)
      .single(),

    // 2. Unread inbox conversations
    supabase
      .from('inbox_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand_id)
      .eq('is_read', false),

    // 3. Pending content approvals (Draft posts)
    supabase
      .from('scheduled_posts')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand_id)
      .eq('status', 'Draft'),

    // 4. Active ad campaigns with alerts (low ROAS or near budget)
    supabase
      .from('ad_campaigns')
      .select('id, name, roas, budget, spend, status')
      .eq('brand_id', brand_id)
      .eq('status', 'Active'),

    // 5. Scheduled posts for today and tomorrow
    supabase
      .from('scheduled_posts')
      .select('id, status, scheduled_at')
      .eq('brand_id', brand_id)
      .in('status', ['Scheduled', 'Draft'])
      .gte('scheduled_at', todayStart.toISOString())
      .lt('scheduled_at', tomorrowEnd.toISOString()),
  ]);

  if (brandResult.error || !brandResult.data) {
    return new Response(JSON.stringify({ error: 'Brand not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const brand = brandResult.data;
  const unreadInbox     = inboxResult.count ?? 0;
  const pendingApprovals = approvalsResult.count ?? 0;
  const activeCampaigns = adsResult.data ?? [];
  const postsUpcoming   = postsResult.data ?? [];

  // Identify ad alerts: ROAS below threshold or budget >= 90% spent
  const adAlerts = activeCampaigns.filter((c) => {
    const roasLow    = c.roas != null && c.roas < ROAS_ALERT_THRESHOLD;
    const budgetHigh = c.budget > 0 && c.spend / c.budget >= 0.9;
    return roasLow || budgetHigh;
  });

  // Posts scheduled exactly today
  const postsTodayCount = postsUpcoming.filter((p) => {
    const d = new Date(p.scheduled_at);
    return d >= todayStart && d < new Date(todayStart.getTime() + 86_400_000);
  }).length;

  // ── Build priorities (top 3 most urgent) ──────────────────────────────────

  type Priority = {
    type: string;
    count: number;
    label: string;
    action: string;
    urgent: boolean;
  };

  const priorities: Priority[] = [];

  if (unreadInbox > 0) {
    priorities.push({
      type: 'inbox',
      count: unreadInbox,
      label: unreadInbox === 1 ? 'رسالة تحتاج رد' : `${unreadInbox} رسائل تحتاج رد`,
      action: 'inbox',
      urgent: unreadInbox >= 5,
    });
  }

  if (pendingApprovals > 0) {
    priorities.push({
      type: 'approvals',
      count: pendingApprovals,
      label: pendingApprovals === 1 ? 'محتوى ينتظر الموافقة' : `${pendingApprovals} محتويات تنتظر الموافقة`,
      action: 'content/approvals',
      urgent: false,
    });
  }

  if (adAlerts.length > 0) {
    priorities.push({
      type: 'ad_alert',
      count: adAlerts.length,
      label: adAlerts.length === 1 ? 'حملة إعلانية تحتاج مراجعة' : `${adAlerts.length} حملات تحتاج مراجعة`,
      action: 'ads',
      urgent: true,
    });
  }

  // Sort: urgent first
  priorities.sort((a, b) => Number(b.urgent) - Number(a.urgent));

  // ── AI Brief ──────────────────────────────────────────────────────────────

  let aiBrief: { opportunity: string; risk: string; recommendation: string; action: string } | null = null;

  try {
    const apiKey = await getGeminiApiKey();
    if (apiKey) {
      aiBrief = await generateAiBrief(
        apiKey,
        brand.name,
        unreadInbox,
        pendingApprovals,
        adAlerts.length,
        postsTodayCount,
      );
    }
  } catch {
    // AI brief is optional — don't fail the whole request
  }

  // ── Response ──────────────────────────────────────────────────────────────

  return new Response(
    JSON.stringify({
      brand: {
        id:       brand.id,
        name:     brand.name,
        logo_url: brand.logo_url,
      },
      stats: {
        unread_inbox:      unreadInbox,
        pending_approvals: pendingApprovals,
        ad_alerts:         adAlerts.length,
        posts_today:       postsTodayCount,
      },
      priorities: priorities.slice(0, 3),
      ad_alerts: adAlerts.map((c) => ({
        id:     c.id,
        name:   c.name,
        roas:   c.roas,
        budget: c.budget,
        spend:  c.spend,
      })),
      ai_brief: aiBrief,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
    },
  );
});
