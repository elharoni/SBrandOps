// services/skillEngine.ts
// محرك المهارات — سجل المهارات التسويقية وأداة تصنيف الطلبات
//
// كل Skill وحدة مستقلة لها: اسم، مدخلات، مخرجات، شروط التشغيل، KPIs
// النظام يختار المهارة المناسبة تلقائياً من الطلب النصي

import { supabase } from './supabaseClient';
import { SkillType, SkillDefinition, TaskClassification, SkillExecution, SkillContextLevel, SkillPreferredModel } from '../types';

// ── Skill Registry ────────────────────────────────────────────────────────────

export const SKILL_REGISTRY: Record<SkillType, SkillDefinition> = {

    // flash + standard = توفير التوكينز على المهام البسيطة
    // pro   + full     = جودة عالية على المهام الحساسة (ردود العملاء، الحملات، التخطيط)

    [SkillType.ContentGeneration]: {
        type: SkillType.ContentGeneration,
        nameAr: 'توليد محتوى',
        nameEn: 'Content Generation',
        description: 'توليد منشورات، ريلز، ستوريز أو إعلانات بصوت البراند',
        triggerKeywords: ['اكتب', 'ولّد', 'محتوى', 'بوست', 'منشور', 'ريل', 'كابشن', 'write', 'generate', 'post', 'caption', 'content'],
        inputSchema: ['topic', 'platform', 'format'],
        outputKeys: ['captions', 'bestPick', 'reasoning'],
        kpis: ['brand_voice_score', 'engagement_rate', 'was_used'],
        confidenceThreshold: 0.5,
        requiresHumanApproval: false,
        contextLevel: 'standard',
        preferredModel: 'gemini-2.5-flash',
    },

    [SkillType.OccasionOpportunity]: {
        type: SkillType.OccasionOpportunity,
        nameAr: 'تحويل مناسبة لفرصة تسويقية',
        nameEn: 'Occasion → Marketing Opportunity',
        description: 'يحوّل المناسبة من تاريخ في تقويم إلى فرصة تسويقية: زوايا محتوى + ريل + عرض + نبرة',
        triggerKeywords: ['مناسبة', 'عيد', 'يوم', 'موسم', 'occasion', 'holiday', 'event', 'celebration'],
        inputSchema: ['occasion', 'daysUntil'],
        outputKeys: ['contentAngles', 'reelIdea', 'offerIdea', 'messageTone', 'sampleCaption', 'hashtags'],
        kpis: ['content_published', 'engagement_rate'],
        confidenceThreshold: 0.6,
        requiresHumanApproval: false,
        contextLevel: 'standard',
        preferredModel: 'gemini-2.5-flash',
    },

    [SkillType.ConversationReply]: {
        type: SkillType.ConversationReply,
        nameAr: 'محرك محادثات البراند',
        nameEn: 'Brand Conversation Engine',
        description: 'يرد على رسائل العملاء بصوت البراند — يكتشف السيناريو ويتعامل معه',
        triggerKeywords: ['رد', 'اقترح رد', 'عميل قال', 'رسالة', 'محادثة', 'reply', 'respond', 'message', 'chat', 'inbox'],
        inputSchema: ['messages'],
        outputKeys: ['reply', 'scenario', 'escalate', 'followUpSuggestion'],
        kpis: ['conversion_rate', 'escalation_rate', 'response_satisfaction'],
        confidenceThreshold: 0.6,
        requiresHumanApproval: false,
        contextLevel: 'full',        // يحتاج المنتجات والسياسات للرد الصحيح
        preferredModel: 'gemini-2.5-pro', // جودة عالية للتعامل مع العملاء
    },

    [SkillType.CampaignBrief]: {
        type: SkillType.CampaignBrief,
        nameAr: 'بريف حملة تسويقية',
        nameEn: 'Campaign Brief',
        description: 'يولّد بريف حملة تسويقية كاملة بأهداف ورسائل وجمهور وقنوات',
        triggerKeywords: ['حملة', 'campaign', 'بريف', 'brief', 'خطة إعلانية', 'launch'],
        inputSchema: ['goal', 'budget', 'duration'],
        outputKeys: ['objective', 'targetAudience', 'keyMessages', 'channels', 'kpis'],
        kpis: ['plan_followed', 'roas'],
        confidenceThreshold: 0.65,
        requiresHumanApproval: true,
        contextLevel: 'full',
        preferredModel: 'gemini-2.5-pro',
    },

    [SkillType.MarketingPlanSuggestion]: {
        type: SkillType.MarketingPlanSuggestion,
        nameAr: 'اقتراح خطة تسويق',
        nameEn: 'Marketing Plan Suggestion',
        description: 'يقترح خطة تسويق شهرية أو ربع سنوية بناءً على البراند والموسم والأهداف',
        triggerKeywords: ['خطة', 'plan', 'استراتيجية', 'strategy', 'quarter', 'ربع سنة', 'شهر', 'تخطيط'],
        inputSchema: ['period', 'budget', 'goals'],
        outputKeys: ['plan', 'priorities', 'timeline', 'kpis'],
        kpis: ['plan_adherence', 'goal_achievement'],
        confidenceThreshold: 0.65,
        requiresHumanApproval: true,
        contextLevel: 'full',
        preferredModel: 'gemini-2.5-pro',
    },

    [SkillType.HashtagResearch]: {
        type: SkillType.HashtagResearch,
        nameAr: 'بحث هاشتاقات',
        nameEn: 'Hashtag Research',
        description: 'يقترح هاشتاقات مناسبة مصنفة: عامة، متخصصة، محلية',
        triggerKeywords: ['هاشتاق', 'hashtag', 'وسوم', 'tags', '#'],
        inputSchema: ['topic', 'platform'],
        outputKeys: ['hashtagGroups'],
        kpis: ['reach_increase'],
        confidenceThreshold: 0.7,
        requiresHumanApproval: false,
        contextLevel: 'minimal',      // اسم البراند + مجاله كافيان
        preferredModel: 'gemini-2.5-flash',
    },

    [SkillType.CompetitorAnalysis]: {
        type: SkillType.CompetitorAnalysis,
        nameAr: 'تحليل منافس',
        nameEn: 'Competitor Analysis',
        description: 'يحلل نقاط قوة وضعف المنافسين ويقترح زوايا تميز للبراند',
        triggerKeywords: ['منافس', 'competitor', 'مقارنة', 'سوق', 'market', 'competition'],
        inputSchema: ['competitorName', 'competitorData'],
        outputKeys: ['strengths', 'weaknesses', 'opportunities', 'differentiators'],
        kpis: ['competitive_positioning'],
        confidenceThreshold: 0.65,
        requiresHumanApproval: false,
        contextLevel: 'standard',
        preferredModel: 'gemini-2.5-flash',
    },

    [SkillType.ContentCalendar]: {
        type: SkillType.ContentCalendar,
        nameAr: 'تقويم المحتوى',
        nameEn: 'Content Calendar',
        description: 'يبني تقويم محتوى شهري بناءً على مناسبات وأهداف البراند وإيقاع النشر',
        triggerKeywords: ['تقويم', 'calendar', 'خطة محتوى', 'content plan', 'جدول نشر', 'شهرية'],
        inputSchema: ['month', 'year', 'postsPerWeek'],
        outputKeys: ['calendarItems'],
        kpis: ['posts_published', 'consistency_score'],
        confidenceThreshold: 0.7,
        requiresHumanApproval: true,
        contextLevel: 'standard',
        preferredModel: 'gemini-2.5-flash',
    },

    [SkillType.AdCopywriting]: {
        type: SkillType.AdCopywriting,
        nameAr: 'كتابة نص إعلاني',
        nameEn: 'Ad Copywriting',
        description: 'يكتب نصوص إعلانات احترافية لـ Meta وGoogle بهدف تحسين CTR',
        triggerKeywords: ['إعلان', 'ad', 'ads', 'sponsored', 'نص إعلاني', 'copywriting', 'اعلان'],
        inputSchema: ['goal', 'platform', 'product'],
        outputKeys: ['headline', 'primaryText', 'cta', 'variations'],
        kpis: ['ctr', 'conversion_rate', 'roas'],
        confidenceThreshold: 0.65,
        requiresHumanApproval: false,
        contextLevel: 'standard',
        preferredModel: 'gemini-2.5-flash',
    },

    [SkillType.SEOContentBrief]: {
        type: SkillType.SEOContentBrief,
        nameAr: 'بريف محتوى SEO',
        nameEn: 'SEO Content Brief',
        description: 'يولّد بريف مقال SEO كامل: عناوين + كلمات مفتاحية + هيكل + meta',
        triggerKeywords: ['seo', 'مقال', 'article', 'بريف seo', 'كتابة محتوى', 'blog', 'مدونة'],
        inputSchema: ['keyword', 'intent'],
        outputKeys: ['h1', 'h2s', 'keywords', 'outline', 'metaDescription'],
        kpis: ['organic_traffic', 'ranking_position'],
        confidenceThreshold: 0.65,
        requiresHumanApproval: false,
        contextLevel: 'minimal',      // SEO يحتاج المجال والدولة فقط
        preferredModel: 'gemini-2.5-flash',
    },

    [SkillType.AudienceInsight]: {
        type: SkillType.AudienceInsight,
        nameAr: 'تحليل الجمهور',
        nameEn: 'Audience Insight',
        description: 'يحلل بيانات الجمهور ويقترح شخصيات مستهدفة ورسائل مخصصة لكل شريحة',
        triggerKeywords: ['جمهور', 'audience', 'عملاء', 'personas', 'شريحة', 'segment'],
        inputSchema: ['analyticsData'],
        outputKeys: ['personas', 'insights', 'recommendations'],
        kpis: ['targeting_accuracy'],
        confidenceThreshold: 0.65,
        requiresHumanApproval: false,
        contextLevel: 'standard',
        preferredModel: 'gemini-2.5-pro',
    },

    [SkillType.BrandVoiceCheck]: {
        type: SkillType.BrandVoiceCheck,
        nameAr: 'فحص صوت البراند',
        nameEn: 'Brand Voice Check',
        description: 'يقيّم أي نص على مدى توافقه مع صوت البراند ويقترح تحسينات محددة',
        triggerKeywords: ['راجع', 'check', 'قيّم', 'هل يناسب', 'brand voice', 'هوية', 'تقييم'],
        inputSchema: ['text'],
        outputKeys: ['score', 'feedback', 'suggestions'],
        kpis: ['voice_consistency_score'],
        confidenceThreshold: 0.75,
        requiresHumanApproval: false,
        contextLevel: 'minimal',      // فقط النبرة والكلمات المحظورة
        preferredModel: 'gemini-2.5-flash',
    },

    [SkillType.LeadQualification]: {
        type: SkillType.LeadQualification,
        nameAr: 'تأهيل عميل محتمل',
        nameEn: 'Lead Qualification',
        description: 'يصنف العميل ويحدد مرحلته في رحلة الشراء ويقترح الخطوة التالية',
        triggerKeywords: ['lead', 'عميل محتمل', 'تأهيل', 'funnel', 'pipeline', 'مبيعات'],
        inputSchema: ['conversationHistory', 'customerProfile'],
        outputKeys: ['stage', 'score', 'nextAction', 'personalizedMessage'],
        kpis: ['conversion_rate', 'deal_close_rate'],
        confidenceThreshold: 0.65,
        requiresHumanApproval: false,
        contextLevel: 'full',         // يحتاج المنتجات والعروض والأسعار
        preferredModel: 'gemini-2.5-pro',
    },

    [SkillType.FollowUpSequence]: {
        type: SkillType.FollowUpSequence,
        nameAr: 'سلسلة رسائل متابعة',
        nameEn: 'Follow-up Sequence',
        description: 'يبني سلسلة رسائل متابعة تلقائية بأسلوب البراند لتحريك العميل نحو البيع',
        triggerKeywords: ['follow up', 'متابعة', 'تسلسل رسائل', 'sequence', 'auto message', 'سلسلة'],
        inputSchema: ['trigger', 'numberOfMessages', 'interval'],
        outputKeys: ['messages'],
        kpis: ['open_rate', 'response_rate', 'conversion_rate'],
        confidenceThreshold: 0.65,
        requiresHumanApproval: true,
        contextLevel: 'full',         // يحتاج أسلوب البراند الكامل في البيع
        preferredModel: 'gemini-2.5-flash',
    },
};

// ── Task Classifier ───────────────────────────────────────────────────────────
// يصنّف الطلب النصي ويختار المهارة المناسبة بناءً على الكلمات المفتاحية

export function classifyTask(requestText: string): TaskClassification {
    const text = requestText.toLowerCase();
    const scores: Partial<Record<SkillType, number>> = {};

    for (const [skillType, skill] of Object.entries(SKILL_REGISTRY)) {
        let score = 0;
        for (const keyword of skill.triggerKeywords) {
            if (text.includes(keyword.toLowerCase())) {
                score++;
            }
        }
        if (score > 0) scores[skillType as SkillType] = score;
    }

    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);

    if (!sorted.length) {
        return {
            detectedSkill: SkillType.ContentGeneration,
            confidence: 0.3,
            extractedEntities: {},
            ambiguous: true,
            alternativeSkills: [],
        };
    }

    const [topSkill, topScore] = sorted[0];
    const maxKeywords = SKILL_REGISTRY[topSkill as SkillType].triggerKeywords.length;
    const confidence = Math.min(topScore / Math.max(maxKeywords * 0.5, 1), 1);
    const alternatives = sorted.slice(1, 3).map(([s]) => s as SkillType);

    return {
        detectedSkill: topSkill as SkillType,
        confidence,
        extractedEntities: {},
        ambiguous: confidence < 0.5,
        alternativeSkills: alternatives,
    };
}

// ── Skill Execution Logger ────────────────────────────────────────────────────

export async function saveSkillExecution(
    execution: Omit<SkillExecution, 'id' | 'timestamp'>,
): Promise<string> {
    const { data, error } = await supabase
        .from('skill_executions')
        .insert({
            skill_type:          execution.skillType,
            brand_id:            execution.brandId,
            input:               execution.input,
            output:              execution.output,
            raw_output:          execution.rawOutput,
            confidence:          execution.confidence,
            brand_policy_passed: execution.brandPolicyPassed,
            requires_approval:   execution.requiresApproval,
            execution_time_ms:   execution.executionTimeMs,
        })
        .select('id')
        .single();

    if (error) {
        console.warn('[SkillEngine] saveSkillExecution error:', error.message);
        return crypto.randomUUID();
    }
    return data.id;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

export function suggestSkillsForContext(ctx: {
    hasUpcomingOccasion?: boolean;
    hasPendingMessages?: boolean;
    hasLowEngagement?: boolean;
    needsNewContent?: boolean;
}): SkillType[] {
    const suggestions: SkillType[] = [];

    if (ctx.hasUpcomingOccasion)  suggestions.push(SkillType.OccasionOpportunity, SkillType.ContentCalendar);
    if (ctx.hasPendingMessages)   suggestions.push(SkillType.ConversationReply, SkillType.LeadQualification);
    if (ctx.hasLowEngagement)     suggestions.push(SkillType.AudienceInsight, SkillType.ContentGeneration);
    if (ctx.needsNewContent)      suggestions.push(SkillType.ContentGeneration, SkillType.OccasionOpportunity);

    return [...new Set(suggestions)];
}
