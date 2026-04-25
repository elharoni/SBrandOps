// services/campaignBrainAgents.ts
// Campaign Brain — AI Agent functions
// 10 specialized agents that orchestrate the full campaign lifecycle

import { supabase } from './supabaseClient';
import { buildBrandSystemPrompt } from './brandBrainService';
import type {
    BrandBrainContext, CBStrategyDocument, CBCreativeBrief,
    CBQualityScore, CBRecommendation, CBCalendarSlot,
    CBContentType, CBContentFormat, CBKPIPerformance,
    CBPerformanceLearning, CBPerformanceAnalysis,
} from '../types';

const Type = {
    OBJECT: 'OBJECT', STRING: 'STRING',
    NUMBER: 'NUMBER', ARRAY: 'ARRAY', BOOLEAN: 'BOOLEAN',
} as const;

async function callAI(params: {
    model: string;
    prompt: string;
    schema?: unknown;
    feature?: string;
    brandId?: string;
}): Promise<string> {
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: {
            model:    params.model,
            prompt:   params.prompt,
            schema:   params.schema,
            feature:  params.feature,
            brand_id: params.brandId ?? null,
        },
    });
    if (error) throw new Error(error.message ?? 'AI proxy error');
    return (data as { text: string }).text;
}

// ── Agent 1: Strategy Generator ───────────────────────────────────────────────
// Converts brand context + goal into a full campaign strategy document

export async function generateCampaignStrategy(params: {
    brandBrain: BrandBrainContext;
    goalType: string;
    goalTitle: string;
    durationDays: number;
    platforms: string[];
    budget?: number;
    postsPerWeek?: number;
}): Promise<CBStrategyDocument> {
    const systemPrompt = buildBrandSystemPrompt(params.brandBrain, 'full');
    const budgetLine = params.budget ? `الميزانية: ${params.budget} ريال` : '';

    const prompt = `
${systemPrompt}

══ المهمة: استراتيجية حملة Campaign Brain ══
نوع الهدف: ${params.goalType}
الهدف: ${params.goalTitle}
المدة: ${params.durationDays} يوم
المنصات: ${params.platforms.join(', ')}
${budgetLine}
إيقاع النشر: ${params.postsPerWeek ?? 5} منشورات/أسبوع

أنتج استراتيجية محتوى متكاملة تشمل:
1. coreMessage: رسالة محورية واحدة قوية تعبر عن الحملة (جملة واحدة)
2. contentMix: توزيع أنواع المحتوى بالنسب المئوية (educational, promotional, testimonial, behind-scenes, occasion, entertainment)
3. keyMessages: 3-5 رسائل تسويقية رئيسية مرتبة حسب الأولوية
4. platformDistribution: توزيع الوزن النسبي على كل منصة
5. toneGuidance: توجيه النبرة لهذه الحملة تحديداً
6. avoidTopics: 3 موضوعات يجب تجنبها
7. confidenceScore: ثقتك بهذه الاستراتيجية (0-100)
8. reasoning: سبب اختياراتك الرئيسية (جملتان)
`.trim();

    const raw = await callAI({
        model:    'gemini-2.5-pro',
        prompt,
        feature:  'campaign_strategy',
        brandId:  params.brandBrain.brandId,
        schema: {
            type: Type.OBJECT,
            properties: {
                coreMessage: { type: Type.STRING },
                contentMix: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type:       { type: Type.STRING },
                            percentage: { type: Type.NUMBER },
                        },
                        required: ['type', 'percentage'],
                    },
                },
                keyMessages: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            text:     { type: Type.STRING },
                            priority: { type: Type.NUMBER },
                        },
                        required: ['text', 'priority'],
                    },
                },
                platformDistribution: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            platform: { type: Type.STRING },
                            weight:   { type: Type.NUMBER },
                        },
                        required: ['platform', 'weight'],
                    },
                },
                toneGuidance:    { type: Type.STRING },
                avoidTopics:     { type: Type.ARRAY, items: { type: Type.STRING } },
                confidenceScore: { type: Type.NUMBER },
                reasoning:       { type: Type.STRING },
            },
            required: ['coreMessage', 'contentMix', 'keyMessages', 'platformDistribution', 'toneGuidance', 'avoidTopics', 'confidenceScore', 'reasoning'],
        },
    });

    return JSON.parse(raw) as CBStrategyDocument;
}

// ── Agent 2: Content Calendar Planner ─────────────────────────────────────────
// Converts strategy into a day-by-day content calendar

export async function generateCalendarPlan(params: {
    brandBrain: BrandBrainContext;
    strategy: CBStrategyDocument;
    startDate: string;
    endDate: string;
    postsPerWeek: number;
    platforms: string[];
    occasions?: Array<{ name: string; date: string }>;
}): Promise<CBCalendarSlot[]> {
    const systemPrompt = buildBrandSystemPrompt(params.brandBrain, 'standard');

    const start = new Date(params.startDate);
    const end   = new Date(params.endDate);
    const days  = Math.round((end.getTime() - start.getTime()) / 86400000);
    const totalPosts = Math.round((days / 7) * params.postsPerWeek);

    const occasionsText = params.occasions?.length
        ? `\nمناسبات هذه الفترة:\n${params.occasions.map(o => `• ${o.date}: ${o.name}`).join('\n')}`
        : '';

    const mixText = params.strategy.contentMix
        ? params.strategy.contentMix.map(m => `${m.type} ${m.percentage}%`).join(' | ')
        : '';

    const prompt = `
${systemPrompt}

══ المهمة: تقويم محتوى ══
الفترة: ${params.startDate} → ${params.endDate} (${days} يوم)
إجمالي المنشورات: ${totalPosts}
المنصات: ${params.platforms.join(', ')}
مزيج المحتوى: ${mixText}
الرسالة الجوهرية: ${params.strategy.coreMessage ?? ''}
${occasionsText}

لكل منشور: التاريخ + المنصة + الفورمات (post/reel/story/carousel/video/ad) + نوع المحتوى + الموضوع + الزاوية
وزّع الفورمات وتأكد من التنويع اليومي. لا تكرر نفس الفورمات يومين متتاليين على نفس المنصة.
`.trim();

    const raw = await callAI({
        model:   'gemini-2.5-flash',
        prompt,
        feature: 'content_calendar_plan',
        brandId: params.brandBrain.brandId,
        schema: {
            type: Type.OBJECT,
            properties: {
                slots: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            date:          { type: Type.STRING },
                            platform:      { type: Type.STRING },
                            format:        { type: Type.STRING },
                            contentType:   { type: Type.STRING },
                            topic:         { type: Type.STRING },
                            angle:         { type: Type.STRING },
                            occasionLink:  { type: Type.STRING },
                        },
                        required: ['date', 'platform', 'format', 'contentType', 'topic', 'angle'],
                    },
                },
            },
            required: ['slots'],
        },
    });

    return (JSON.parse(raw).slots ?? []) as CBCalendarSlot[];
}

// ── Agent 3: Creative Director ─────────────────────────────────────────────────
// Generates a full creative brief for a content item

export async function generateCreativeBriefAI(params: {
    brandBrain: BrandBrainContext;
    platform: string;
    format: CBContentFormat;
    contentType: CBContentType;
    topic: string;
    angle: string;
    strategyContext?: CBStrategyDocument;
}): Promise<CBCreativeBrief> {
    const systemPrompt = buildBrandSystemPrompt(params.brandBrain, 'standard');
    const coreMsg = params.strategyContext?.coreMessage ?? '';
    const toneGuide = params.strategyContext?.toneGuidance ?? '';

    const slideCount = params.format === 'carousel' ? 5 : 1;

    const prompt = `
${systemPrompt}

══ المهمة: بريف إبداعي ══
المنصة: ${params.platform}
الفورمات: ${params.format}
نوع المحتوى: ${params.contentType}
الموضوع: ${params.topic}
الزاوية: ${params.angle}
${coreMsg ? `الرسالة الجوهرية للحملة: ${coreMsg}` : ''}
${toneGuide ? `توجيه النبرة: ${toneGuide}` : ''}

أنتج بريف إبداعي كامل يشمل:
- objective: هدف هذا المنشور تحديداً (جملة واحدة)
- targetSegment: شريحة الجمهور المستهدفة
- keyMessage: الرسالة الرئيسية للمنشور
- tone: النبرة المطلوبة
- hooks: 3 خطافات جذب مختلفة
- cta: دعوة الإجراء
- visualDirection: التوجيه البصري (أسلوب، ألوان، مشاعر)
- negativeSpace: ما يجب تجنبه بصرياً ونصياً
- slideStructure: ${slideCount} ${params.format === 'carousel' ? 'شرائح' : 'شريحة'} (headline + subtext + visualNote + cta لكل شريحة)
`.trim();

    const raw = await callAI({
        model:   'gemini-2.5-pro',
        prompt,
        feature: 'creative_brief',
        brandId: params.brandBrain.brandId,
        schema: {
            type: Type.OBJECT,
            properties: {
                objective:       { type: Type.STRING },
                targetSegment:   { type: Type.STRING },
                keyMessage:      { type: Type.STRING },
                tone:            { type: Type.STRING },
                hooks:           { type: Type.ARRAY, items: { type: Type.STRING } },
                cta:             { type: Type.STRING },
                visualDirection: { type: Type.STRING },
                negativeSpace:   { type: Type.STRING },
                slideStructure: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            order:       { type: Type.NUMBER },
                            headline:    { type: Type.STRING },
                            subtext:     { type: Type.STRING },
                            visualNote:  { type: Type.STRING },
                            cta:         { type: Type.STRING },
                        },
                        required: ['order', 'headline'],
                    },
                },
            },
            required: ['objective', 'keyMessage', 'tone', 'hooks', 'cta', 'visualDirection', 'slideStructure'],
        },
    });

    const parsed = JSON.parse(raw);
    return {
        id:              '',
        brandId:         params.brandBrain.brandId,
        contentItemId:   '',
        objective:       parsed.objective,
        targetSegment:   parsed.targetSegment,
        keyMessage:      parsed.keyMessage,
        tone:            parsed.tone,
        hooks:           parsed.hooks ?? [],
        cta:             parsed.cta,
        visualDirection: parsed.visualDirection,
        negativeSpace:   parsed.negativeSpace,
        slideStructure:  parsed.slideStructure ?? [],
        version:         1,
        isApproved:      false,
        createdAt:       new Date().toISOString(),
    } as CBCreativeBrief;
}

// ── Agent 4: Design Prompt Generator ──────────────────────────────────────────
// Converts creative brief into optimized AI image generation prompt

export interface DesignPromptResult {
    englishPrompt: string;
    negativePrompt: string;
    arabicOverlays: string[];
    styleVariants: string[];
    aspectRatio: string;
}

export async function generateDesignPromptAI(params: {
    brandBrain: BrandBrainContext;
    brief: CBCreativeBrief;
    slideIndex?: number;
    platform: string;
    stylePreference?: string;
}): Promise<DesignPromptResult> {
    const slide = params.brief.slideStructure[params.slideIndex ?? 0];
    const slideHint = slide ? `\nالشريحة ${(params.slideIndex ?? 0) + 1}: "${slide.headline}" — ${slide.visualNote ?? ''}` : '';

    const aspectMap: Record<string, string> = {
        instagram: '1:1', facebook: '1:1', tiktok: '9:16',
        story: '9:16', linkedin: '1:1',
    };
    const aspectRatio = aspectMap[params.platform.toLowerCase()] ?? '1:1';

    const brandColors = `${params.brandBrain.identity.name} brand visual identity`;
    const brandIndustry = params.brandBrain.identity.industry;

    const prompt = `
Create a highly detailed English image generation prompt for an AI image model (Imagen/DALL-E).

Brand: ${params.brandBrain.identity.name} | Industry: ${brandIndustry}
Visual Direction: ${params.brief.visualDirection ?? 'modern, clean, professional'}
Key Message: ${params.brief.keyMessage}
Tone: ${params.brief.tone ?? 'professional and warm'}
Platform: ${params.platform} (aspect ratio ${aspectRatio})
${params.stylePreference ? `Style: ${params.stylePreference}` : ''}
${slideHint}

Rules:
- Write in English only — NO Arabic text in the image prompt
- No text overlays in prompt (text is added separately)
- Focus on composition, lighting, colors, mood, style
- Be specific about ${brandIndustry} context
- Add technical photography/design notes (lighting, perspective, etc.)

Also provide:
- negativePrompt: what to exclude
- arabicOverlays: 1-2 short Arabic text strings to overlay on the image (from the slide headline)
- styleVariants: 3 style alternative names (e.g. "Photorealistic", "Flat Design Illustration", "Minimalist")
`.trim();

    const raw = await callAI({
        model:   'gemini-2.5-flash',
        prompt,
        feature: 'design_prompt',
        brandId: params.brandBrain.brandId,
        schema: {
            type: Type.OBJECT,
            properties: {
                englishPrompt:  { type: Type.STRING },
                negativePrompt: { type: Type.STRING },
                arabicOverlays: { type: Type.ARRAY, items: { type: Type.STRING } },
                styleVariants:  { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['englishPrompt', 'negativePrompt', 'arabicOverlays', 'styleVariants'],
        },
    });

    const parsed = JSON.parse(raw);
    return { ...parsed, aspectRatio } as DesignPromptResult;
}

// ── Agent 5: Caption Copywriter ───────────────────────────────────────────────
// Generates platform-optimized captions in 3 versions

export interface CaptionResult {
    versions: Array<{
        caption: string;
        headline: string;
        hashtags: string[];
        cta: string;
        charCount: number;
    }>;
    language: string;
    platform: string;
}

const PLATFORM_LIMITS: Record<string, number> = {
    instagram: 2200, facebook: 63206, x: 280, twitter: 280,
    linkedin: 3000, tiktok: 2200, youtube: 5000,
};

export async function generateCaptions(params: {
    brandBrain: BrandBrainContext;
    brief: CBCreativeBrief;
    platform: string;
    imageDescription?: string;
    language?: 'ar' | 'en';
}): Promise<CaptionResult> {
    const systemPrompt = buildBrandSystemPrompt(params.brandBrain, 'standard');
    const lang = params.language ?? 'ar';
    const charLimit = PLATFORM_LIMITS[params.platform.toLowerCase()] ?? 2200;

    const prompt = `
${systemPrompt}

══ المهمة: كتابة كابشن احترافي ══
المنصة: ${params.platform} (حد الأحرف: ${charLimit})
الهدف: ${params.brief.objective}
الرسالة الرئيسية: ${params.brief.keyMessage}
النبرة: ${params.brief.tone ?? 'مهني ودافئ'}
دعوة الإجراء: ${params.brief.cta ?? 'تواصل معنا'}
${params.imageDescription ? `وصف التصميم: ${params.imageDescription}` : ''}

اكتب 3 نسخ من الكابشن باللغة ${lang === 'ar' ? 'العربية' : 'الإنجليزية'} لكل نسخة:
- caption: النص الكامل (داخل حد ${charLimit} حرف)
- headline: عنوان جذاب مختصر (للإعلانات والسلايدز)
- hashtags: 10-15 هاشتاق مناسب للمنصة والمحتوى
- cta: دعوة الإجراء النهائية

تأكد من:
1. استخدام صوت البراند المحدد
2. تجنب الكلمات المحظورة
3. تناسب كل نسخة مع خوارزمية ${params.platform}
`.trim();

    const raw = await callAI({
        model:   'gemini-2.5-pro',
        prompt,
        feature: 'caption_copy',
        brandId: params.brandBrain.brandId,
        schema: {
            type: Type.OBJECT,
            properties: {
                versions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            caption:   { type: Type.STRING },
                            headline:  { type: Type.STRING },
                            hashtags:  { type: Type.ARRAY, items: { type: Type.STRING } },
                            cta:       { type: Type.STRING },
                        },
                        required: ['caption', 'headline', 'hashtags', 'cta'],
                    },
                },
            },
            required: ['versions'],
        },
    });

    const parsed = JSON.parse(raw);
    const versions = (parsed.versions ?? []).map((v: Record<string, unknown>) => ({
        ...v,
        charCount: String(v.caption ?? '').length,
    }));

    return { versions, language: lang, platform: params.platform };
}

// ── Agent 6: Brand QA Agent ────────────────────────────────────────────────────
// Comprehensive 10-dimension quality check before approval

export async function runQualityCheck(params: {
    brandBrain: BrandBrainContext;
    caption: string;
    platform: string;
    goalType: string;
    hasImage: boolean;
    brief: CBCreativeBrief;
}): Promise<CBQualityScore> {
    const systemPrompt = buildBrandSystemPrompt(params.brandBrain, 'standard');

    const prompt = `
${systemPrompt}

══ المهمة: فحص جودة شامل ══
المنصة: ${params.platform}
نوع الهدف: ${params.goalType}
هل يوجد تصميم: ${params.hasImage ? 'نعم' : 'لا'}
الكابشن:
---
${params.caption}
---
الرسالة المطلوبة: ${params.brief.keyMessage}
النبرة المطلوبة: ${params.brief.tone ?? 'مهني'}
دعوة الإجراء: ${params.brief.cta ?? 'غير محدد'}

قيّم المحتوى على 10 محاور من 100:
1. brandFit: توافق مع هوية البراند وصوته
2. audienceFit: توافق مع الجمهور المستهدف
3. goalFit: توافق مع هدف الحملة
4. platformFit: توافق مع خوارزمية ومتطلبات المنصة
5. visualClarity: وضوح الرسالة البصرية (إذا كان هناك تصميم)
6. captionPower: قوة النص وجاذبيته
7. ctaStrength: قوة دعوة الإجراء
8. algorithm: توافق مع الخوارزمية (هاشتاق، timing، format)
9. safety: سلامة المحتوى (لا محتوى حساس أو مسيء)
10. conversion: احتمالية التحويل نحو الهدف

أيضاً:
- issues: قائمة المشاكل المحددة مع كل محور
- predictedCtr: توقع معدل النقر (low/medium/high)
`.trim();

    const raw = await callAI({
        model:   'gemini-2.5-flash',
        prompt,
        feature: 'quality_check',
        brandId: params.brandBrain.brandId,
        schema: {
            type: Type.OBJECT,
            properties: {
                brandFit:      { type: Type.NUMBER },
                audienceFit:   { type: Type.NUMBER },
                goalFit:       { type: Type.NUMBER },
                platformFit:   { type: Type.NUMBER },
                visualClarity: { type: Type.NUMBER },
                captionPower:  { type: Type.NUMBER },
                ctaStrength:   { type: Type.NUMBER },
                algorithm:     { type: Type.NUMBER },
                safety:        { type: Type.NUMBER },
                conversion:    { type: Type.NUMBER },
                issues: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            dimension:    { type: Type.STRING },
                            message:      { type: Type.STRING },
                            autoFixable:  { type: Type.BOOLEAN },
                        },
                        required: ['dimension', 'message', 'autoFixable'],
                    },
                },
                predictedCtr: { type: Type.STRING },
            },
            required: ['brandFit', 'audienceFit', 'goalFit', 'platformFit', 'visualClarity', 'captionPower', 'ctaStrength', 'algorithm', 'safety', 'conversion', 'issues', 'predictedCtr'],
        },
    });

    const p = JSON.parse(raw);
    const scores = [p.brandFit, p.audienceFit, p.goalFit, p.platformFit, p.visualClarity, p.captionPower, p.ctaStrength, p.algorithm, p.safety, p.conversion];
    const overall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    return {
        overall,
        brandFit:      p.brandFit,
        audienceFit:   p.audienceFit,
        goalFit:       p.goalFit,
        platformFit:   p.platformFit,
        visualClarity: p.visualClarity,
        captionPower:  p.captionPower,
        ctaStrength:   p.ctaStrength,
        algorithm:     p.algorithm,
        safety:        p.safety,
        conversion:    p.conversion,
        issues:        p.issues ?? [],
        predictedCtr:  p.predictedCtr ?? 'medium',
    } as CBQualityScore;
}

// ── Agent 7: Smart Scheduler ───────────────────────────────────────────────────
// Suggests 3 optimal publish times based on platform and audience

export interface ScheduleSuggestion {
    datetime: string;    // ISO
    label: string;       // 'Best' | 'Good' | 'Acceptable'
    reason: string;
    predictedReachMin: number;
    predictedReachMax: number;
}

export async function suggestPublishTimes(params: {
    brandBrain: BrandBrainContext;
    platform: string;
    goalType: string;
    preferredDateRange?: { from: string; to: string };
}): Promise<ScheduleSuggestion[]> {
    const prompt = `
براند: ${params.brandBrain.identity.name} | مجال: ${params.brandBrain.identity.industry}
الجمهور: ${params.brandBrain.audiences.map(a => a.name).join(', ') || 'عام'}
المنصة: ${params.platform}
الهدف: ${params.goalType}
التاريخ الحالي: ${new Date().toISOString()}

اقترح 3 أوقات مثالية للنشر خلال الـ 7 أيام القادمة (الأفضل، جيد، مقبول).
لكل وقت:
- datetime: ISO format
- label: أفضل وقت / وقت جيد / وقت مقبول
- reason: سبب الاختيار (جملة واحدة بالعربية)
- predictedReachMin: الحد الأدنى للوصول المتوقع
- predictedReachMax: الحد الأقصى للوصول المتوقع
`.trim();

    const raw = await callAI({
        model:   'gemini-2.5-flash',
        prompt,
        feature: 'smart_scheduler',
        brandId: params.brandBrain.brandId,
        schema: {
            type: Type.OBJECT,
            properties: {
                suggestions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            datetime:          { type: Type.STRING },
                            label:             { type: Type.STRING },
                            reason:            { type: Type.STRING },
                            predictedReachMin: { type: Type.NUMBER },
                            predictedReachMax: { type: Type.NUMBER },
                        },
                        required: ['datetime', 'label', 'reason', 'predictedReachMin', 'predictedReachMax'],
                    },
                },
            },
            required: ['suggestions'],
        },
    });

    return JSON.parse(raw).suggestions ?? [];
}

// ── Agent 8: Goal Reality Check ───────────────────────────────────────────────

export interface GoalRealityCheck {
    isRealistic: boolean;
    confidence: number;
    assessment: string;
    adjustedTarget?: number;
    requiredPosts: number;
    warningLevel: 'none' | 'yellow' | 'red';
}

export async function checkGoalRealism(params: {
    brandBrain: BrandBrainContext;
    goalType: string;
    targetNumber: number;
    targetMetric: string;
    durationDays: number;
    platforms: string[];
    budget?: number;
}): Promise<GoalRealityCheck> {
    const prompt = `
براند: ${params.brandBrain.identity.name} | مجال: ${params.brandBrain.identity.industry}
نوع الهدف: ${params.goalType}
الهدف المستهدف: ${params.targetNumber} ${params.targetMetric}
المدة: ${params.durationDays} يوم
المنصات: ${params.platforms.join(', ')}
${params.budget ? `الميزانية: ${params.budget} ريال` : 'بدون ميزانية إعلانية'}

قيّم واقعية هذا الهدف التسويقي بشكل صريح:
- isRealistic: هل الهدف قابل للتحقيق عضوياً؟
- confidence: نسبة ثقتك (0-100)
- assessment: تقييم مختصر بالعربية (جملتان)
- adjustedTarget: اقتراح هدف بديل أكثر واقعية إن كان الهدف غير واقعي
- requiredPosts: عدد المنشورات المطلوبة تقريباً
- warningLevel: none (واقعي) / yellow (تحذير) / red (غير واقعي)
`.trim();

    const raw = await callAI({
        model:   'gemini-2.5-flash',
        prompt,
        feature: 'goal_reality_check',
        brandId: params.brandBrain.brandId,
        schema: {
            type: Type.OBJECT,
            properties: {
                isRealistic:    { type: Type.BOOLEAN },
                confidence:     { type: Type.NUMBER },
                assessment:     { type: Type.STRING },
                adjustedTarget: { type: Type.NUMBER },
                requiredPosts:  { type: Type.NUMBER },
                warningLevel:   { type: Type.STRING },
            },
            required: ['isRealistic', 'confidence', 'assessment', 'requiredPosts', 'warningLevel'],
        },
    });

    return JSON.parse(raw) as GoalRealityCheck;
}

// ── Agent 9: Analytics Learning ───────────────────────────────────────────────
// Generates recommendations from published content performance

export async function generateLearningRecommendations(params: {
    brandBrain: BrandBrainContext;
    publishedCount: number;
    avgEngagement: number;
    topPerformerType: string;
    weakPerformerType: string;
    goalType: string;
}): Promise<CBRecommendation[]> {
    const prompt = `
براند: ${params.brandBrain.identity.name}
عدد المنشورات المنشورة: ${params.publishedCount}
متوسط التفاعل: ${params.avgEngagement}%
الأنواع الأعلى أداءً: ${params.topPerformerType}
الأنواع الأضعف أداءً: ${params.weakPerformerType}
هدف الحملة: ${params.goalType}

بناءً على هذه البيانات، أنتج 3-5 توصيات مرتبة حسب الأولوية:
- priority: high / medium / low
- title: عنوان التوصية
- reason: سبب التوصية (جملة واحدة تستند إلى البيانات)
- action: الإجراء المحدد الذي يجب اتخاذه
- confidence: نسبة الثقة (0-100)
`.trim();

    const raw = await callAI({
        model:   'gemini-2.5-flash',
        prompt,
        feature: 'learning_recommendations',
        brandId: params.brandBrain.brandId,
        schema: {
            type: Type.OBJECT,
            properties: {
                recommendations: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            priority:   { type: Type.STRING },
                            title:      { type: Type.STRING },
                            reason:     { type: Type.STRING },
                            action:     { type: Type.STRING },
                            confidence: { type: Type.NUMBER },
                        },
                        required: ['priority', 'title', 'reason', 'action', 'confidence'],
                    },
                },
            },
            required: ['recommendations'],
        },
    });

    return JSON.parse(raw).recommendations ?? [];
}

// ── Agent 10: KPI Suggester ────────────────────────────────────────────────────

export async function suggestKPIs(params: {
    brandBrain: BrandBrainContext;
    goalType: string;
    platforms: string[];
    durationDays: number;
}): Promise<Array<{ metric: string; target: number; unit: string }>> {
    const prompt = `
براند: ${params.brandBrain.identity.name} | مجال: ${params.brandBrain.identity.industry}
نوع الهدف: ${params.goalType}
المنصات: ${params.platforms.join(', ')}
المدة: ${params.durationDays} يوم

اقترح 3-5 مؤشرات أداء رئيسية (KPIs) قابلة للقياس ومناسبة لهذا الهدف.
لكل KPI: metric (اسم المؤشر) + target (الرقم المستهدف) + unit (الوحدة)
`.trim();

    const raw = await callAI({
        model:   'gemini-2.5-flash',
        prompt,
        feature: 'kpi_suggestion',
        brandId: params.brandBrain.brandId,
        schema: {
            type: Type.OBJECT,
            properties: {
                kpis: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            metric: { type: Type.STRING },
                            target: { type: Type.NUMBER },
                            unit:   { type: Type.STRING },
                        },
                        required: ['metric', 'target', 'unit'],
                    },
                },
            },
            required: ['kpis'],
        },
    });

    return JSON.parse(raw).kpis ?? [];
}

// ── Agent 11: Performance Analyzer ────────────────────────────────────────────
// Compares actual platform metrics against predicted KPIs and generates learnings

export async function analyzePerformanceVsPredicted(params: {
    brandBrain: BrandBrainContext;
    campaignId: string;
    goalType: string;
    predictedKpis: Array<{ metric: string; target: number; unit: string }>;
    actualMetrics: {
        reach: number;
        engagementRate: number;
        saves: number;
        clicks: number;
        profileVisits: number;
        publishedCount: number;
    };
}): Promise<CBPerformanceAnalysis> {
    const predictedText = params.predictedKpis.map(k =>
        `${k.metric}: ${k.target} ${k.unit}`
    ).join('\n');

    const actualText = `
وصول: ${params.actualMetrics.reach}
معدل التفاعل: ${(params.actualMetrics.engagementRate * 100).toFixed(2)}%
حفظ: ${params.actualMetrics.saves}
نقرات: ${params.actualMetrics.clicks}
زيارات الصفحة: ${params.actualMetrics.profileVisits}
منشورات نُشرت: ${params.actualMetrics.publishedCount}
`.trim();

    const prompt = `
براند: ${params.brandBrain.identity.name} | هدف: ${params.goalType}

المؤشرات المتوقعة:
${predictedText}

المؤشرات الفعلية:
${actualText}

قارن الأداء الفعلي بالمتوقع وأنتج:
1. kpiPerformance: مقارنة لكل KPI (metric, predicted, actual, unit, status: on_target/exceeded/below)
2. learnings: 3-5 دروس مستفادة (type: success/weakness/trend, text: جملة قصيرة بالعربية)
3. healthScore: درجة صحة الحملة (0-100)
4. topPerformerType: نوع المحتوى الأعلى أداءً
5. weakPerformerType: نوع المحتوى الأضعف أداءً

استند إلى البيانات الفعلية فقط. إذا لم تكن هناك بيانات كافية، استخدم التقديرات المنطقية.
`.trim();

    const raw = await callAI({
        model:   'gemini-2.5-flash',
        prompt,
        feature: 'performance_analysis',
        brandId: params.brandBrain.brandId,
        schema: {
            type: Type.OBJECT,
            properties: {
                kpiPerformance: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            metric:    { type: Type.STRING },
                            predicted: { type: Type.NUMBER },
                            actual:    { type: Type.NUMBER },
                            unit:      { type: Type.STRING },
                            status:    { type: Type.STRING },
                        },
                        required: ['metric', 'predicted', 'actual', 'unit', 'status'],
                    },
                },
                learnings: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING },
                            text: { type: Type.STRING },
                        },
                        required: ['type', 'text'],
                    },
                },
                healthScore:         { type: Type.NUMBER },
                topPerformerType:    { type: Type.STRING },
                weakPerformerType:   { type: Type.STRING },
            },
            required: ['kpiPerformance', 'learnings', 'healthScore', 'topPerformerType', 'weakPerformerType'],
        },
    });

    const p = JSON.parse(raw);
    return {
        campaignId:        params.campaignId,
        kpiPerformance:    p.kpiPerformance ?? [],
        learnings:         p.learnings ?? [],
        healthScore:       p.healthScore ?? 50,
        avgEngagement:     params.actualMetrics.engagementRate,
        topPerformerType:  p.topPerformerType ?? '',
        weakPerformerType: p.weakPerformerType ?? '',
        generatedAt:       new Date().toISOString(),
    } as CBPerformanceAnalysis;
}

// ── Agent 7 (extended): Platform Optimization ─────────────────────────────────
// Generates platform-specific caption variants from a base caption

export interface PlatformOptimizationResult {
    platform: string;
    caption: string;
    headline: string;
    hashtags: string[];
    cta: string;
    charCount: number;
}

export async function optimizePerPlatform(params: {
    brandBrain: BrandBrainContext;
    baseCaption: string;
    baseHashtags: string[];
    platforms: string[];
    brief: CBCreativeBrief;
}): Promise<PlatformOptimizationResult[]> {
    const systemPrompt = buildBrandSystemPrompt(params.brandBrain, 'minimal');

    const prompt = `
${systemPrompt}

══ المهمة: تحسين الكابشن لكل منصة ══
الكابشن الأساسي:
---
${params.baseCaption}
---
الهاشتاق الأساسي: ${params.baseHashtags.slice(0, 5).join(', ')}
الرسالة: ${params.brief.keyMessage}
CTA: ${params.brief.cta ?? ''}
المنصات: ${params.platforms.join(', ')}

أنشئ نسخة محسّنة لكل منصة:
- instagram: عاطفي + هاشتاق وفير (10-15) + emoji معتدل
- facebook: أطول + قصة + أقل هاشتاق (3-5)
- tiktok: قصير + ترند + خطاف قوي
- linkedin: مهني + بيانات + لا emoji زائد
- x: مختصر جداً تحت 280 حرف + هاشتاق (2-3)

لكل منصة: platform, caption, headline, hashtags (مصفوفة), cta
`.trim();

    const raw = await callAI({
        model:   'gemini-2.5-flash',
        prompt,
        feature: 'platform_optimization',
        brandId: params.brandBrain.brandId,
        schema: {
            type: Type.OBJECT,
            properties: {
                results: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            platform:  { type: Type.STRING },
                            caption:   { type: Type.STRING },
                            headline:  { type: Type.STRING },
                            hashtags:  { type: Type.ARRAY, items: { type: Type.STRING } },
                            cta:       { type: Type.STRING },
                        },
                        required: ['platform', 'caption', 'headline', 'hashtags', 'cta'],
                    },
                },
            },
            required: ['results'],
        },
    });

    const parsed = JSON.parse(raw);
    return (parsed.results ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        charCount: String(r.caption ?? '').length,
    })) as PlatformOptimizationResult[];
}

// ── Agent 12: Asset Visual Reviewer ───────────────────────────────────────────
// Evaluates a generated image for brand fit, clarity, composition, text contrast

export interface AssetReviewResult {
    brandFit:      number;
    clarity:       number;
    composition:   number;
    textContrast:  number;
    overall:       number;
    suggestions:   string[];
    autoFixPrompt: string;
}

export async function reviewAssetQuality(params: {
    brandBrain: BrandBrainContext;
    imageUrl: string;
    brief: CBCreativeBrief;
    platform: string;
}): Promise<AssetReviewResult> {
    const prompt = `
براند: ${params.brandBrain.identity.name} | مجال: ${params.brandBrain.identity.industry}
المنصة: ${params.platform}
الرسالة المطلوبة: ${params.brief.keyMessage}
التوجيه البصري: ${params.brief.visualDirection ?? 'مهني وجذاب'}

قيّم هذه الصورة على 4 محاور (0-100):
1. brandFit: توافق مع هوية البراند (ألوان، أسلوب، مشاعر)
2. clarity: وضوح الرسالة البصرية وسهولة القراءة
3. composition: جودة التكوين والتوازن البصري
4. textContrast: تباين النص مع الخلفية إن وُجد

أيضاً:
- suggestions: قائمة 2-3 اقتراحات تحسين محددة
- autoFixPrompt: prompt إنجليزي قصير يصف التعديلات المطلوبة لصورة جديدة
`.trim();

    const raw = await callAI({
        model:   'gemini-2.5-flash',
        prompt,
        feature: 'asset_visual_review',
        brandId: params.brandBrain.brandId,
        schema: {
            type: Type.OBJECT,
            properties: {
                brandFit:      { type: Type.NUMBER },
                clarity:       { type: Type.NUMBER },
                composition:   { type: Type.NUMBER },
                textContrast:  { type: Type.NUMBER },
                suggestions:   { type: Type.ARRAY, items: { type: Type.STRING } },
                autoFixPrompt: { type: Type.STRING },
            },
            required: ['brandFit', 'clarity', 'composition', 'textContrast', 'suggestions', 'autoFixPrompt'],
        },
    });

    const p = JSON.parse(raw);
    const scores = [p.brandFit, p.clarity, p.composition, p.textContrast];
    const overall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    return {
        brandFit:      p.brandFit,
        clarity:       p.clarity,
        composition:   p.composition,
        textContrast:  p.textContrast,
        overall,
        suggestions:   p.suggestions ?? [],
        autoFixPrompt: p.autoFixPrompt ?? '',
    };
}
