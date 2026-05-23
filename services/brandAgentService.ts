// services/brandAgentService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Brand Agent — النواة الذكية للرد على الرسائل بنبرة البراند
// Hybrid mode: auto for comments, suggested for DMs
// Shift mode: human takes over → bot becomes "assistant only"
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabaseClient';
import {
    BrandHubProfile, InboxConversation, InboxItemType,
} from '../types';
import type { CrmConversationContext } from './crmInboxService';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BrandAgentDialect =
    | 'gulf'
    | 'egyptian'
    | 'levantine'
    | 'modern_standard'
    | 'english'
    | 'bilingual';

export type BrandAgentShiftMode = 'bot' | 'human';

export type AgentReplyDecision =
    | 'auto_send'     // يرسل تلقائياً
    | 'suggest_only'  // يقترح فقط — المستخدم يراجع
    | 'escalate';     // يصعّد للإنسان فوراً

export interface BrandAgentConfig {
    id?: string;
    brandId: string;
    // Reply mode per item type
    autoReplyComments: boolean;    // تلقائي للتعليقات (facebook/instagram/ad)
    autoReplyDMs: boolean;         // تلقائي للرسائل الخاصة
    autoReplySuggested: boolean;   // اقتراح فقط بدون إرسال
    // Shift control
    shiftMode: BrandAgentShiftMode; // 'bot' = تلقائي، 'human' = مساعد فقط
    shiftStartedAt?: string | null;
    shiftModeratorName?: string | null;
    // Voice & dialect
    dialect: BrandAgentDialect;
    customDialectNote?: string;    // ملاحظة مخصصة عن اللهجة
    activePersonaId?: string | null; // الشخصية النشطة من SmartBot
    // Escalation
    escalationKeywords: string[];  // كلمات تستدعي التصعيد فوراً
    // Working hours (auto-reply only works within hours)
    workingHoursEnabled: boolean;
    workingHoursStart: number;     // 0–23
    workingHoursEnd: number;       // 0–23
    workingHoursTimezone: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface BrandAgentReply {
    text: string;
    style: 'warm' | 'direct' | 'sales';
    confidence: number;   // 0–100
}

export interface BrandAgentSuggestions {
    replies: BrandAgentReply[];
    summary: string;      // ملخص المحادثة بجملة واحدة
    suggestedAction: string; // الإجراء المقترح (رد / متابعة / تصعيد)
    detectedIntent: string;
    crmAction?: string;   // هل يجب إنشاء lead / order / ticket؟
}

export interface AgentActionLog {
    id?: string;
    brandId: string;
    conversationId: string;
    action: 'auto_replied' | 'suggested' | 'escalated' | 'skipped';
    replyText?: string;
    decision: AgentReplyDecision;
    metadata?: Record<string, unknown>;
    createdAt?: string;
}

// ── Default Config ─────────────────────────────────────────────────────────────

export const DEFAULT_BRAND_AGENT_CONFIG: Omit<BrandAgentConfig, 'brandId'> = {
    autoReplyComments: true,
    autoReplyDMs: false,
    autoReplySuggested: true,
    shiftMode: 'bot',
    shiftStartedAt: null,
    shiftModeratorName: null,
    dialect: 'modern_standard',
    customDialectNote: '',
    activePersonaId: null,
    escalationKeywords: ['مشرف', 'مدير', 'شكوى', 'مشكلة', 'supervisor', 'manager', 'complaint', 'refund', 'استرداد'],
    workingHoursEnabled: false,
    workingHoursStart: 9,
    workingHoursEnd: 23,
    workingHoursTimezone: 'Asia/Riyadh',
};

// ── Dialect Prompts ────────────────────────────────────────────────────────────

const DIALECT_INSTRUCTIONS: Record<BrandAgentDialect, string> = {
    gulf:            'اكتب بلهجة خليجية طبيعية ودافئة — استخدم: أبي، وايد، زين، بس، ليش، إن شاء الله، مشكور',
    egyptian:        'اكتب بلهجة مصرية طبيعية — استخدم: عايز، كده، بالظبط، يسطا، طب، هقولك، معلش',
    levantine:       'اكتب بلهجة شامية — استخدم: شو، كيفك، هيك، يعني، رح، والله، منيح',
    modern_standard: 'اكتب بعربية فصحى مبسطة — واضحة ومهنية دون لهجة إقليمية',
    english:         'Write in clear, friendly English that matches the brand tone',
    bilingual:       'اكتب بالعربية أساساً، وإذا كتب العميل بالإنجليزية رد بالإنجليزية بنفس الأسلوب',
};

// ── Config CRUD ────────────────────────────────────────────────────────────────

export async function getBrandAgentConfig(brandId: string): Promise<BrandAgentConfig> {
    const { data, error } = await supabase
        .from('brand_agent_configs')
        .select('*')
        .eq('brand_id', brandId)
        .single();

    if (error || !data) {
        // Return default config if none exists
        return { ...DEFAULT_BRAND_AGENT_CONFIG, brandId };
    }

    return mapRowToConfig(data);
}

export async function saveBrandAgentConfig(
    brandId: string,
    config: Partial<Omit<BrandAgentConfig, 'brandId'>>,
): Promise<BrandAgentConfig> {
    const row: Record<string, unknown> = {
        brand_id:               brandId,
        updated_at:             new Date().toISOString(),
    };

    if (config.autoReplyComments   !== undefined) row.auto_reply_comments    = config.autoReplyComments;
    if (config.autoReplyDMs        !== undefined) row.auto_reply_dms         = config.autoReplyDMs;
    if (config.autoReplySuggested  !== undefined) row.auto_reply_suggested   = config.autoReplySuggested;
    if (config.shiftMode           !== undefined) row.shift_mode             = config.shiftMode;
    if (config.shiftStartedAt      !== undefined) row.shift_started_at       = config.shiftStartedAt;
    if (config.shiftModeratorName  !== undefined) row.shift_moderator_name   = config.shiftModeratorName;
    if (config.dialect             !== undefined) row.dialect                = config.dialect;
    if (config.customDialectNote   !== undefined) row.custom_dialect_note    = config.customDialectNote;
    if (config.activePersonaId     !== undefined) row.active_persona_id      = config.activePersonaId;
    if (config.escalationKeywords  !== undefined) row.escalation_keywords    = config.escalationKeywords;
    if (config.workingHoursEnabled !== undefined) row.working_hours_enabled  = config.workingHoursEnabled;
    if (config.workingHoursStart   !== undefined) row.working_hours_start    = config.workingHoursStart;
    if (config.workingHoursEnd     !== undefined) row.working_hours_end      = config.workingHoursEnd;
    if (config.workingHoursTimezone!== undefined) row.working_hours_timezone = config.workingHoursTimezone;

    const { data, error } = await supabase
        .from('brand_agent_configs')
        .upsert([row], { onConflict: 'brand_id' })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return mapRowToConfig(data);
}

function mapRowToConfig(row: Record<string, unknown>): BrandAgentConfig {
    return {
        id:                    row.id as string,
        brandId:               row.brand_id as string,
        autoReplyComments:     Boolean(row.auto_reply_comments ?? true),
        autoReplyDMs:          Boolean(row.auto_reply_dms ?? false),
        autoReplySuggested:    Boolean(row.auto_reply_suggested ?? true),
        shiftMode:             (row.shift_mode as BrandAgentShiftMode) || 'bot',
        shiftStartedAt:        (row.shift_started_at as string) || null,
        shiftModeratorName:    (row.shift_moderator_name as string) || null,
        dialect:               (row.dialect as BrandAgentDialect) || 'modern_standard',
        customDialectNote:     (row.custom_dialect_note as string) || '',
        activePersonaId:       (row.active_persona_id as string) || null,
        escalationKeywords:    Array.isArray(row.escalation_keywords)
            ? (row.escalation_keywords as string[])
            : DEFAULT_BRAND_AGENT_CONFIG.escalationKeywords,
        workingHoursEnabled:   Boolean(row.working_hours_enabled ?? false),
        workingHoursStart:     Number(row.working_hours_start ?? 9),
        workingHoursEnd:       Number(row.working_hours_end ?? 23),
        workingHoursTimezone:  (row.working_hours_timezone as string) || 'Asia/Riyadh',
        createdAt:             row.created_at as string,
        updatedAt:             row.updated_at as string,
    };
}

// ── Shift Mode Management ─────────────────────────────────────────────────────

export async function startShift(
    brandId: string,
    moderatorName: string,
): Promise<BrandAgentConfig> {
    return saveBrandAgentConfig(brandId, {
        shiftMode: 'human',
        shiftStartedAt: new Date().toISOString(),
        shiftModeratorName: moderatorName,
    });
}

export async function endShift(brandId: string): Promise<BrandAgentConfig> {
    return saveBrandAgentConfig(brandId, {
        shiftMode: 'bot',
        shiftStartedAt: null,
        shiftModeratorName: null,
    });
}

// ── Auto-Reply Decision Engine ────────────────────────────────────────────────

export function shouldAutoReply(
    conversation: InboxConversation,
    config: BrandAgentConfig,
): AgentReplyDecision {
    // 1. Shift mode — human took over → suggest only
    if (config.shiftMode === 'human') return 'suggest_only';

    // 2. Check escalation keywords in last message
    const lastMsg = conversation.messages.at(-1);
    if (lastMsg) {
        const lowerText = lastMsg.text.toLowerCase();
        const needsEscalation = config.escalationKeywords.some(kw =>
            lowerText.includes(kw.toLowerCase()),
        );
        if (needsEscalation) return 'escalate';
    }

    // 3. Working hours check
    if (config.workingHoursEnabled) {
        const now = new Date();
        const hour = parseInt(
            now.toLocaleString('en-US', {
                timeZone: config.workingHoursTimezone,
                hour: 'numeric',
                hour12: false,
            }),
            10,
        );
        if (hour < config.workingHoursStart || hour >= config.workingHoursEnd) {
            return 'suggest_only';
        }
    }

    // 4. Determine by item type
    const itemType: InboxItemType = conversation.itemType ?? 'dm';
    const isComment = ['facebook_comment', 'instagram_comment', 'ad_comment', 'mention', 'story_reply'].includes(itemType);
    const isDM = itemType === 'dm';

    if (isComment && config.autoReplyComments) return 'auto_send';
    if (isDM && config.autoReplyDMs) return 'auto_send';

    return 'suggest_only';
}

// ── Prompt Builder ────────────────────────────────────────────────────────────

export function buildBrandAgentPrompt(
    brandProfile: BrandHubProfile,
    config: BrandAgentConfig,
    crmContext?: CrmConversationContext | null,
    knowledgeSnippets?: string,
): string {
    const brandName       = brandProfile.brandName;
    const industry        = brandProfile.industry || '';
    const tone            = brandProfile.brandVoice?.toneDescription?.join('، ') || 'ودود ومحترف';
    const keywords        = brandProfile.brandVoice?.keywords?.join('، ') || '';
    const negativeWords   = brandProfile.brandVoice?.negativeKeywords?.join('، ') || '';
    const dos             = brandProfile.brandVoice?.voiceGuidelines?.dos?.join(' | ') || '';
    const donts           = brandProfile.brandVoice?.voiceGuidelines?.donts?.join(' | ') || '';
    const sellingPoints   = brandProfile.keySellingPoints?.join(' • ') || '';
    const dialectInstruction = DIALECT_INSTRUCTIONS[config.dialect] || DIALECT_INSTRUCTIONS.modern_standard;
    const customNote      = config.customDialectNote ? `\nملاحظة إضافية عن الأسلوب: ${config.customDialectNote}` : '';

    // CRM context section
    let crmSection = '';
    if (crmContext) {
        const { customer, isVip, isAtRisk, bulletPoints } = crmContext;
        const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ');
        crmSection = `
## سياق العميل (من CRM):
- الاسم: ${fullName}
- الحالة: ${isVip ? '⭐ VIP' : isAtRisk ? '⚠️ في خطر' : 'عادي'}
${bulletPoints.length > 0 ? '- ' + bulletPoints.join('\n- ') : ''}
→ تعامل معه بناءً على هذا السياق (VIP يستحق اهتماماً أكبر)`;
    }

    // Knowledge section
    const knowledgeSection = knowledgeSnippets
        ? `\n## معلومات المنتجات والأسعار:\n${knowledgeSnippets}`
        : '';

    return `أنت مساعد ${brandName} الرسمي على وسائل التواصل الاجتماعي.

## هويتك:
- تمثّل براند: ${brandName}${industry ? ` (${industry})` : ''}
- نبرتك: ${tone}
- ${dialectInstruction}${customNote}

## قواعد الصوت:
- استخدم هذه الكلمات: ${keywords || 'لغة البراند الطبيعية'}
- تجنّب: ${negativeWords || 'لا شيء محدد'}
${dos ? `- افعل: ${dos}` : ''}
${donts ? `- لا تفعل: ${donts}` : ''}

## نقاط البيع الرئيسية:
${sellingPoints || 'قدّم قيمة حقيقية في كل رد'}
${crmSection}${knowledgeSection}

## قواعد الرد الذهبية:
1. ردودك قصيرة ومباشرة — 2-3 جمل كحد أقصى
2. لا تعيد نفسك ولا تكرر كلام العميل
3. دائماً انهِ بسؤال أو CTA خفيف
4. لا تذكر منافسين أبداً
5. إذا طُلب التحدث مع إنسان: "بالتأكيد، سأوصلك بفريقنا فوراً 🙏"
6. إذا سُئلت عن شيء لا تعرفه: "سأتحقق من ذلك وأعود إليك"
7. استخدم الإيموجي باعتدال لإضافة الدفء`;
}

// ── AI Proxy Call ─────────────────────────────────────────────────────────────

async function callAgentProxy(
    systemPrompt: string,
    conversationHistory: { role: 'user' | 'model'; text: string }[],
    feature = 'brand-agent-reply',
): Promise<string> {
    // Prime the context with system prompt as initial exchange
    const primedContents = [
        {
            role: 'user',
            parts: [{ text: `[تعليمات الوكيل]\n${systemPrompt}\n[نهاية التعليمات]\n\nهل استوعبت دورك؟` }],
        },
        {
            role: 'model',
            parts: [{ text: 'نعم، استوعبت تماماً. أنا مستعد للرد بنبرة البراند ووفق التعليمات.' }],
        },
        ...conversationHistory.map(m => ({
            role: m.role,
            parts: [{ text: m.text }],
        })),
    ];

    const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: {
            model:    'gemini-2.5-flash',
            feature,
            contents: primedContents,
        },
    });

    if (error) throw new Error(error.message ?? 'AI proxy error');
    return (data as { text?: string })?.text?.trim() || '';
}

// ── Generate Single Reply ─────────────────────────────────────────────────────

export async function generateBrandReply(
    conversation: InboxConversation,
    brandProfile: BrandHubProfile,
    config: BrandAgentConfig,
    crmContext?: CrmConversationContext | null,
    knowledgeSnippets?: string,
): Promise<string> {
    const systemPrompt = buildBrandAgentPrompt(brandProfile, config, crmContext, knowledgeSnippets);

    const history = conversation.messages.slice(-10).map(m => ({
        role: m.sender === 'user' ? 'user' as const : 'model' as const,
        text: m.text,
    }));

    return callAgentProxy(systemPrompt, history, 'brand-agent-single');
}

// ── Generate 3 Suggestions (Warm / Direct / Sales) ────────────────────────────

export async function generateBrandReplySuggestions(
    conversation: InboxConversation,
    brandProfile: BrandHubProfile,
    config: BrandAgentConfig,
    crmContext?: CrmConversationContext | null,
    knowledgeSnippets?: string,
): Promise<BrandAgentSuggestions> {
    const systemPrompt = buildBrandAgentPrompt(brandProfile, config, crmContext, knowledgeSnippets);

    const history = conversation.messages.slice(-10).map(m => ({
        role: m.sender === 'user' ? 'user' as const : 'model' as const,
        text: m.text,
    }));

    const lastUserMsg = conversation.messages.filter(m => m.sender === 'user').at(-1)?.text || '';

    const multiSuggestionPrompt = `
${systemPrompt}

---
الآن أنشئ 3 ردود مختلفة على هذه الرسالة الأخيرة من العميل:
"${lastUserMsg}"

الردود يجب أن تكون:
1. دافئ/عاطفي (warm) — يركز على الاهتمام الشخصي والتعاطف
2. مباشر/احترافي (direct) — واضح وموجز ومحترم  
3. مبيعات/إقناعي (sales) — يوجّه نحو القرار أو الخطوة التالية

أعد JSON بهذا الشكل بالضبط:
{
  "summary": "ملخص المحادثة في جملة",
  "suggestedAction": "الإجراء المقترح التالي",
  "detectedIntent": "نية العميل",
  "crmAction": "lead | order | ticket | none",
  "replies": [
    { "text": "...", "style": "warm", "confidence": 85 },
    { "text": "...", "style": "direct", "confidence": 90 },
    { "text": "...", "style": "sales", "confidence": 75 }
  ]
}`;

    const primedContents = [
        {
            role: 'user',
            parts: [{ text: `[تعليمات]\n${multiSuggestionPrompt}\n[نهاية]\n\nهل مستعد؟` }],
        },
        {
            role: 'model',
            parts: [{ text: 'نعم، سأنشئ الردود الثلاثة بصيغة JSON.' }],
        },
        ...history,
        {
            role: 'user',
            parts: [{ text: `أنشئ الردود الثلاثة الآن على رسالة العميل: "${lastUserMsg}"` }],
        },
    ];

    const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: {
            model:    'gemini-2.5-flash',
            feature:  'brand-agent-suggestions',
            contents: primedContents,
            schema: {
                type: 'OBJECT',
                properties: {
                    summary:         { type: 'STRING' },
                    suggestedAction: { type: 'STRING' },
                    detectedIntent:  { type: 'STRING' },
                    crmAction:       { type: 'STRING' },
                    replies: {
                        type: 'ARRAY',
                        items: {
                            type: 'OBJECT',
                            properties: {
                                text:       { type: 'STRING' },
                                style:      { type: 'STRING' },
                                confidence: { type: 'NUMBER' },
                            },
                            required: ['text', 'style', 'confidence'],
                        },
                    },
                },
                required: ['summary', 'replies', 'suggestedAction', 'detectedIntent'],
            },
        },
    });

    if (error) throw new Error(error.message ?? 'AI proxy error');

    try {
        const parsed = typeof data?.text === 'string'
            ? JSON.parse(data.text)
            : data;
        return {
            replies:         parsed.replies || [],
            summary:         parsed.summary || '',
            suggestedAction: parsed.suggestedAction || '',
            detectedIntent:  parsed.detectedIntent || '',
            crmAction:       parsed.crmAction || 'none',
        };
    } catch {
        // Fallback single reply
        const fallback = (data as { text?: string })?.text?.trim() || '';
        return {
            replies: [
                { text: fallback, style: 'direct', confidence: 70 },
            ],
            summary: '',
            suggestedAction: 'الرد على العميل',
            detectedIntent: 'غير محدد',
        };
    }
}

// ── Action Logger ─────────────────────────────────────────────────────────────

export async function logAgentAction(
    brandId: string,
    conversationId: string,
    action: AgentActionLog['action'],
    replyText?: string,
    decision: AgentReplyDecision = 'suggest_only',
    metadata?: Record<string, unknown>,
): Promise<void> {
    try {
        await supabase
            .from('brand_agent_logs')
            .insert([{
                brand_id:        brandId,
                conversation_id: conversationId,
                action,
                reply_text:      replyText || null,
                decision,
                metadata:        metadata || {},
                created_at:      new Date().toISOString(),
            }]);
    } catch {
        // Non-critical — don't throw
    }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface BrandAgentStats {
    totalReplies: number;
    autoReplies: number;
    suggestedReplies: number;
    escalations: number;
    todayReplies: number;
    avgResponseMinutes: number | null;
}

export async function getBrandAgentStats(brandId: string): Promise<BrandAgentStats> {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data } = await supabase
        .from('brand_agent_logs')
        .select('action, decision, created_at')
        .eq('brand_id', brandId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false });

    const logs = data || [];
    const today = new Date().toDateString();

    return {
        totalReplies:      logs.filter(l => l.action === 'auto_replied' || l.action === 'suggested').length,
        autoReplies:       logs.filter(l => l.action === 'auto_replied').length,
        suggestedReplies:  logs.filter(l => l.action === 'suggested').length,
        escalations:       logs.filter(l => l.action === 'escalated').length,
        todayReplies:      logs.filter(l => new Date(l.created_at).toDateString() === today).length,
        avgResponseMinutes: null,
    };
}

// ── Daily Reply Stats (7 days) ────────────────────────────────────────────────

export interface DailyReplyStat {
    date: string;        // e.g. "الخميس"
    dateShort: string;   // e.g. "22/5"
    auto: number;
    suggested: number;
    escalated: number;
    total: number;
}

export async function getDailyReplyStats(brandId: string): Promise<DailyReplyStat[]> {
    const since = new Date();
    since.setDate(since.getDate() - 6); // آخر 7 أيام
    since.setHours(0, 0, 0, 0);

    const { data } = await supabase
        .from('brand_agent_logs')
        .select('action, created_at')
        .eq('brand_id', brandId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });

    const logs = data || [];

    const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const result: DailyReplyStat[] = [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toDateString();
        const dayLogs = logs.filter(l => new Date(l.created_at).toDateString() === dateStr);
        result.push({
            date:      DAYS_AR[d.getDay()],
            dateShort: `${d.getDate()}/${d.getMonth() + 1}`,
            auto:      dayLogs.filter(l => l.action === 'auto_replied').length,
            suggested: dayLogs.filter(l => l.action === 'suggested').length,
            escalated: dayLogs.filter(l => l.action === 'escalated').length,
            total:     dayLogs.length,
        });
    }

    return result;
}

// ── Recent Agent Logs ─────────────────────────────────────────────────────────

export interface RecentAgentLog {
    id: string;
    action: AgentActionLog['action'];
    replyText: string | null;
    createdAt: string;
}

export async function getRecentAgentLogs(brandId: string, limit = 15): Promise<RecentAgentLog[]> {
    const { data } = await supabase
        .from('brand_agent_logs')
        .select('id, action, reply_text, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(limit);

    return (data || []).map(r => ({
        id:        r.id,
        action:    r.action as AgentActionLog['action'],
        replyText: r.reply_text as string | null,
        createdAt: r.created_at as string,
    }));
}
