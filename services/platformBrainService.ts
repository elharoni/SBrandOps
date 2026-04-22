// services/platformBrainService.ts
// عقل التطبيق المركزي — نظام التشغيل التسويقي
//
// الخوارزمية (11 خطوة):
// 1.  استقبال الطلب
// 2.  تصنيفه (keyword classifier)
// 3.  تحديد مستوى السياق (minimal / standard / full)
// 4.  بناء سياق البراند بالمستوى المطلوب فقط — توفير التوكينز
// 5.  اختيار الموديل (Flash / Pro) حسب المهارة
// 6.  تنفيذ المهارة
// 7.  فلتر سياسة البراند
// 8.  تقييم الثقة والموافقة
// 9.  حفظ النتيجة
// 10. إرجاع النتيجة للـ UI
// 11. التغذية الراجعة تحدث لاحقاً عبر evaluationService

import {
    MarketingRequest,
    PlatformBrainResponse,
    TaskClassification,
    SkillType,
    BrandBrainContext,
    BrandHubProfile,
    SocialPlatform,
} from '../types';
import { buildBrandBrainContext, buildBrandSystemPrompt } from './brandBrainService';
import { classifyTask, SKILL_REGISTRY, saveSkillExecution, suggestSkillsForContext } from './skillEngine';
import {
    generateOccasionOpportunity,
    generateConversationReply,
    generateBrandContent,
    generateCampaignBrief,
    generateContentCalendar,
    qualifyLead,
    generateFollowUpSequence,
    analyzeCaptionForBrandVoice,
    suggestHashtags,
} from './geminiService';

// ── Brand Policy Filter ───────────────────────────────────────────────────────

function applyBrandPolicyFilter(
    output: string,
    brandBrain: BrandBrainContext,
): { passed: boolean; violations: string[] } {
    if (!output) return { passed: true, violations: [] };

    const violations: string[] = [];
    const lowerOutput = output.toLowerCase();

    for (const forbidden of brandBrain.voice.negativeKeywords) {
        if (forbidden.trim() && lowerOutput.includes(forbidden.toLowerCase())) {
            violations.push(`كلمة محظورة: "${forbidden}"`);
        }
    }

    return { passed: violations.length === 0, violations };
}

// ── Skill Executor — all 14 skills ───────────────────────────────────────────

async function executeSkill(
    skillType: SkillType,
    request: MarketingRequest,
    brandBrain: BrandBrainContext,
    model: string,
): Promise<{ output: Record<string, unknown>; rawOutput: string }> {
    const ctx = request.context ?? {};

    switch (skillType) {

        // ── Conversation Engine (full context + Pro) ──────────────────────────
        case SkillType.ConversationReply: {
            const messages = (ctx.messages as Array<{ sender: 'customer' | 'agent'; text: string }>) ?? [];
            const result = await generateConversationReply(messages, brandBrain);
            return { output: { ...result }, rawOutput: result.reply };
        }

        // ── Occasion → Opportunity (standard + Flash) ─────────────────────────
        case SkillType.OccasionOpportunity: {
            const occasion = ctx.occasion as any;
            const daysUntil = (ctx.daysUntil as number) ?? 7;
            if (!occasion) return { output: { error: 'occasion is required' }, rawOutput: '' };
            const result = await generateOccasionOpportunity(occasion, brandBrain, daysUntil);
            return { output: { ...result }, rawOutput: result.sampleCaption };
        }

        // ── Campaign Brief (full + Pro) ───────────────────────────────────────
        case SkillType.CampaignBrief: {
            const result = await generateCampaignBrief(
                (ctx.goal as string) ?? request.requestText,
                (ctx.budget as string) ?? 'غير محدد',
                (ctx.duration as string) ?? 'شهر',
                brandBrain,
                model,
            );
            return { output: { ...result }, rawOutput: result.objective };
        }

        // ── Content Calendar (standard + Flash) ───────────────────────────────
        case SkillType.ContentCalendar: {
            const now = new Date();
            const items = await generateContentCalendar(
                (ctx.month as number) ?? now.getMonth() + 1,
                (ctx.year as number) ?? now.getFullYear(),
                (ctx.postsPerWeek as number) ?? 4,
                brandBrain,
                (ctx.occasions as any[]) ?? [],
                model,
            );
            return { output: { calendarItems: items }, rawOutput: `${items.length} منشور في التقويم` };
        }

        // ── Lead Qualification (full + Pro) ───────────────────────────────────
        case SkillType.LeadQualification: {
            const history = (ctx.conversationHistory as string) ?? request.requestText;
            const result = await qualifyLead(history, brandBrain, model);
            return { output: { ...result }, rawOutput: result.personalizedMessage };
        }

        // ── Follow-up Sequence (full + Flash) ─────────────────────────────────
        case SkillType.FollowUpSequence: {
            const messages = await generateFollowUpSequence(
                (ctx.trigger as string) ?? request.requestText,
                (ctx.numberOfMessages as number) ?? 4,
                brandBrain,
                model,
            );
            return {
                output: { messages },
                rawOutput: messages.map(m => `[${m.order}] ${m.text}`).join('\n\n'),
            };
        }

        // ── Brand Voice Check (minimal + Flash) ───────────────────────────────
        case SkillType.BrandVoiceCheck: {
            const text = (ctx.text as string) ?? request.requestText;
            // Use existing brand profile for voice check (no full BrandHubProfile available here)
            // Build a minimal wrapper compatible with analyzeCaptionForBrandVoice
            const miniBrandProfile = {
                brandName: brandBrain.identity.name,
                industry: brandBrain.identity.industry,
                values: brandBrain.values,
                keySellingPoints: brandBrain.sellingPoints,
                styleGuidelines: [],
                brandVoice: {
                    toneDescription: brandBrain.voice.tone,
                    keywords: brandBrain.voice.keywords,
                    negativeKeywords: brandBrain.voice.negativeKeywords,
                    toneStrength: 0.5,
                    toneSentiment: 0.5,
                    voiceGuidelines: {
                        dos: brandBrain.voice.dos,
                        donts: brandBrain.voice.donts,
                    },
                },
                brandAudiences: brandBrain.audiences.map(a => ({
                    personaName: a.name,
                    description: a.description,
                    keyEmotions: a.emotions,
                    painPoints: a.painPoints,
                })),
                consistencyScore: 0,
                lastMemoryUpdate: '',
            } as any;
            const result = await analyzeCaptionForBrandVoice(text, miniBrandProfile);
            return {
                output: { ...result },
                rawOutput: result.feedback ?? '',
            };
        }

        // ── Hashtag Research (minimal + Flash) ────────────────────────────────
        case SkillType.HashtagResearch: {
            const topic = (ctx.topic as string) ?? request.requestText;
            const platform = request.platform ?? SocialPlatform.Instagram;
            const groups = await suggestHashtags(topic, [platform]);
            return {
                output: { hashtagGroups: groups },
                rawOutput: groups.flatMap(g => g.hashtags).join(' '),
            };
        }

        // ── Ad Copywriting (standard + Flash) ─────────────────────────────────
        case SkillType.AdCopywriting: {
            const result = await generateBrandContent(
                request.requestText,
                request.platform ?? SocialPlatform.Facebook,
                brandBrain,
                'ad',
            );
            return { output: { ...result }, rawOutput: result.bestPick };
        }

        // ── Marketing Plan Suggestion (full + Pro) ────────────────────────────
        case SkillType.MarketingPlanSuggestion: {
            // Reuse CampaignBrief with plan framing
            const result = await generateCampaignBrief(
                (ctx.goals as string) ?? request.requestText,
                (ctx.budget as string) ?? 'غير محدد',
                (ctx.period as string) ?? 'شهر',
                brandBrain,
                model,
            );
            return { output: { ...result }, rawOutput: result.objective };
        }

        // ── Competitor Analysis (standard + Flash) ────────────────────────────
        case SkillType.CompetitorAnalysis: {
            const systemPrompt = buildBrandSystemPrompt(brandBrain, 'standard');
            // Generic competitive analysis via brand-aware prompt
            return await genericSkillExecution(
                `${systemPrompt}\n\nحلّل المنافس التالي وقدم: نقاط القوة، نقاط الضعف، الفرص لبراند "${brandBrain.identity.name}".\n\nالمنافس: ${request.requestText}`,
                { strengths: [], weaknesses: [], opportunities: [], differentiators: [] },
                'competitor_analysis',
                brandBrain.brandId,
                model,
            );
        }

        // ── SEO Content Brief (minimal + Flash) ───────────────────────────────
        case SkillType.SEOContentBrief: {
            const systemPrompt = buildBrandSystemPrompt(brandBrain, 'minimal');
            return await genericSkillExecution(
                `${systemPrompt}\n\nاكتب بريف مقال SEO للكلمة المفتاحية: "${request.requestText}"\nيشمل: H1، H2s (4-6)، outline، meta description، كلمات مفتاحية ثانوية.`,
                { h1: '', h2s: [], keywords: [], outline: '', metaDescription: '' },
                'seo_content_brief',
                brandBrain.brandId,
                model,
            );
        }

        // ── Audience Insight (standard + Pro) ─────────────────────────────────
        case SkillType.AudienceInsight: {
            const systemPrompt = buildBrandSystemPrompt(brandBrain, 'standard');
            return await genericSkillExecution(
                `${systemPrompt}\n\nبناءً على البيانات التالية، حدد 2-3 شخصيات جمهور ورسائل مخصصة لكل منها:\n${request.requestText}`,
                { personas: [], insights: [], recommendations: [] },
                'audience_insight',
                brandBrain.brandId,
                model,
            );
        }

        // ── Content Generation (default, standard + Flash) ────────────────────
        case SkillType.ContentGeneration:
        default: {
            const format = (ctx.format as 'post' | 'reel_script' | 'story' | 'ad') ?? 'post';
            const result = await generateBrandContent(
                request.requestText,
                request.platform ?? SocialPlatform.Instagram,
                brandBrain,
                format,
            );
            return { output: { ...result }, rawOutput: result.bestPick };
        }
    }
}

// ── Generic skill execution for skills without dedicated functions ─────────────

async function genericSkillExecution(
    prompt: string,
    fallback: Record<string, unknown>,
    feature: string,
    brandId: string,
    _model: string,
): Promise<{ output: Record<string, unknown>; rawOutput: string }> {
    try {
        const { supabase } = await import('./supabaseClient');
        const { data, error } = await supabase.functions.invoke('ai-proxy', {
            body: { model: _model, prompt, feature, brand_id: brandId },
        });
        if (error) throw new Error(error.message);
        const text: string = (data as any)?.text ?? '';
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
        return { output: parsed, rawOutput: JSON.stringify(parsed).slice(0, 300) };
    } catch {
        return { output: fallback, rawOutput: '' };
    }
}

// ── Main Orchestrator ─────────────────────────────────────────────────────────

export async function processMarketingRequest(
    request: MarketingRequest,
    brandProfile: BrandHubProfile,
): Promise<PlatformBrainResponse> {
    const start = Date.now();

    // ── Steps 1+2: Classify ───────────────────────────────────────────────────
    const classification: TaskClassification = request.forcedSkill
        ? { detectedSkill: request.forcedSkill, confidence: 1.0, extractedEntities: {}, ambiguous: false, alternativeSkills: [] }
        : classifyTask(request.requestText);

    const selectedSkill = SKILL_REGISTRY[classification.detectedSkill];

    // ── Steps 3+4: Build brand context at the required level only ─────────────
    const brandBrain = await buildBrandBrainContext(
        request.brandId,
        brandProfile,
        selectedSkill.contextLevel,   // only fetch what this skill needs
    );

    // ── Step 5: Model routing ─────────────────────────────────────────────────
    const model = selectedSkill.preferredModel;

    // ── Steps 6: Execute skill ────────────────────────────────────────────────
    let output: Record<string, unknown> = {};
    let rawOutput = '';

    try {
        const result = await executeSkill(classification.detectedSkill, request, brandBrain, model);
        output = result.output;
        rawOutput = result.rawOutput;
    } catch (err) {
        output = { error: err instanceof Error ? err.message : 'Unknown error' };
        rawOutput = '';
        console.error('[PlatformBrain] Skill execution failed:', err);
    }

    // ── Step 7: Brand policy filter ───────────────────────────────────────────
    const { passed: brandPolicyPassed, violations } = applyBrandPolicyFilter(rawOutput, brandBrain);
    if (!brandPolicyPassed) output._policyViolations = violations;

    // ── Step 8: Confidence & approval ────────────────────────────────────────
    const requiresApproval = selectedSkill.requiresHumanApproval || !brandPolicyPassed;
    const finalConfidence = brandPolicyPassed ? classification.confidence : classification.confidence * 0.5;

    // ── Step 9: Save execution ────────────────────────────────────────────────
    const executionTimeMs = Date.now() - start;
    const executionId = await saveSkillExecution({
        skillType:          classification.detectedSkill,
        brandId:            request.brandId,
        input:              { requestText: request.requestText, context: request.context ?? {} },
        output,
        rawOutput,
        confidence:         finalConfidence,
        brandPolicyPassed,
        requiresApproval,
        executionTimeMs,
    });

    return {
        executionId,
        skill:             classification.detectedSkill,
        confidence:        finalConfidence,
        output,
        requiresApproval,
        brandPolicyPassed,
        classification,
        executionTimeMs,
    };
}

export { suggestSkillsForContext };
