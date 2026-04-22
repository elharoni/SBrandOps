// services/brandBrainService.ts
// نواة عقل البراند — نظام التشغيل التسويقي
//
// 3 مستويات للسياق لتوفير التوكينز:
//   minimal  ~80 tok  : الاسم + النبرة + الكلمات المحظورة فقط
//   standard ~300 tok : + الجمهور + نقاط التميز
//   full     ~1200 tok: + المنتجات + FAQs + السياسات + الذاكرة
//
// كل مهارة تحدد المستوى الذي تحتاجه — لا نُرسل أكثر مما يلزم.

import { BrandHubProfile, BrandBrainContext, SkillContextLevel } from '../types';
import { getBrandMemoryContext, formatMemoryForPrompt } from './brandMemoryService';
import { getBrandKnowledge, formatKnowledgeForPrompt } from './brandKnowledgeService';

// ── Context builder with level-aware DB fetching ──────────────────────────────

export async function buildBrandBrainContext(
    brandId: string,
    brandProfile: BrandHubProfile,
    level: SkillContextLevel = 'full',
): Promise<BrandBrainContext> {
    // Only fetch from DB what the level actually needs
    const [memories, knowledge] = await Promise.all([
        level === 'minimal'
            ? Promise.resolve([])                    // no DB call
            : getBrandMemoryContext(brandId, 10),

        level === 'full'
            ? getBrandKnowledge(brandId)             // DB call only for full
            : Promise.resolve([]),
    ]);

    return {
        brandId,
        identity: {
            name:    brandProfile.brandName,
            industry: brandProfile.industry,
            country: brandProfile.country ?? 'غير محدد',
            website: brandProfile.website,
        },
        voice: {
            tone:            brandProfile.brandVoice.toneDescription,
            keywords:        brandProfile.brandVoice.keywords,
            negativeKeywords: brandProfile.brandVoice.negativeKeywords,
            dos:             brandProfile.brandVoice.voiceGuidelines?.dos ?? [],
            donts:           brandProfile.brandVoice.voiceGuidelines?.donts ?? [],
        },
        audiences: brandProfile.brandAudiences.map(a => ({
            name:        a.personaName,
            description: a.description,
            painPoints:  a.painPoints,
            emotions:    a.keyEmotions,
        })),
        knowledge: {
            products:    formatKnowledgeForPrompt(knowledge, 'product'),
            faqs:        formatKnowledgeForPrompt(knowledge, 'faq'),
            policies:    formatKnowledgeForPrompt(knowledge, 'policy'),
            competitors: formatKnowledgeForPrompt(knowledge, 'competitor'),
        },
        memory:        formatMemoryForPrompt(memories),
        sellingPoints: brandProfile.keySellingPoints,
        values:        brandProfile.values,
    };
}

// ── System prompt builder — 3 levels ─────────────────────────────────────────

export function buildBrandSystemPrompt(
    ctx: BrandBrainContext,
    level: SkillContextLevel = 'full',
): string {
    switch (level) {
        case 'minimal': return buildMinimalPrompt(ctx);
        case 'standard': return buildStandardPrompt(ctx);
        case 'full': return buildFullPrompt(ctx);
    }
}

// ── minimal (~80 tokens) ──────────────────────────────────────────────────────

function buildMinimalPrompt(ctx: BrandBrainContext): string {
    const forbidden = ctx.voice.negativeKeywords.join(', ') || 'لا يوجد';
    return [
        `براند: "${ctx.identity.name}" | مجال: ${ctx.identity.industry} | دولة: ${ctx.identity.country}`,
        `نبرة: ${ctx.voice.tone.join(', ') || 'محايدة'}`,
        `كلمات محظورة: ${forbidden}`,
        `قاعدة: لا تستخدم الكلمات المحظورة. اعكس هوية هذا البراند تحديداً.`,
    ].join('\n');
}

// ── standard (~300 tokens) ────────────────────────────────────────────────────

function buildStandardPrompt(ctx: BrandBrainContext): string {
    const audiences = ctx.audiences.length
        ? ctx.audiences.map(a => `${a.name}: ${a.description}`).join(' | ')
        : 'لم يتم تحديد جمهور';

    const dos = ctx.voice.dos.length
        ? ctx.voice.dos.slice(0, 3).map(d => `✓ ${d}`).join('  ')
        : '';

    const donts = ctx.voice.donts.length
        ? ctx.voice.donts.slice(0, 3).map(d => `✗ ${d}`).join('  ')
        : '';

    return [
        buildMinimalPrompt(ctx),
        ``,
        `قيم: ${ctx.values.join(' | ') || 'غير محدد'}`,
        `تميز: ${ctx.sellingPoints.join(' | ') || 'غير محدد'}`,
        `جمهور: ${audiences}`,
        dos   ? `${dos}` : '',
        donts ? `${donts}` : '',
        ``,
        `المخرجات يجب أن تكون جاهزة للنشر الفوري وتعكس هذا البراند تحديداً.`,
    ].filter(Boolean).join('\n');
}

// ── full (~1200 tokens) ───────────────────────────────────────────────────────

function buildFullPrompt(ctx: BrandBrainContext): string {
    const audienceSection = ctx.audiences.length
        ? ctx.audiences
            .map(a => `• ${a.name}: ${a.description}${a.painPoints?.length ? ` | ألم: ${a.painPoints.slice(0, 2).join(', ')}` : ''}`)
            .join('\n')
        : 'لم يتم تحديد جمهور';

    const voiceDos   = ctx.voice.dos.map(d => `  ✓ ${d}`).join('\n') || '  ✓ التزم بالنبرة';
    const voiceDonts = ctx.voice.donts.map(d => `  ✗ ${d}`).join('\n') || '  ✗ تجنب الكلمات المحظورة';

    const knowledgeSections: string[] = [];
    if (ctx.knowledge.products !== 'لا توجد بيانات') {
        knowledgeSections.push(`━ المنتجات والخدمات:\n${ctx.knowledge.products}`);
    }
    if (ctx.knowledge.faqs !== 'لا توجد بيانات') {
        knowledgeSections.push(`━ الأسئلة الشائعة:\n${ctx.knowledge.faqs}`);
    }
    if (ctx.knowledge.policies !== 'لا توجد بيانات') {
        knowledgeSections.push(`━ السياسات:\n${ctx.knowledge.policies}`);
    }
    if (ctx.knowledge.competitors !== 'لا توجد بيانات') {
        knowledgeSections.push(`━ المنافسون:\n${ctx.knowledge.competitors}`);
    }

    return `
أنت عقل تسويقي متخصص لبراند "${ctx.identity.name}" — لست مساعداً عاماً.
كل مخرج يجب أن يعكس هذا البراند تحديداً وأن يكون جاهزاً للاستخدام الفوري.

══ الهوية ══
${ctx.identity.name} | ${ctx.identity.industry} | ${ctx.identity.country}
القيم: ${ctx.values.join(' | ') || 'غير محدد'}
التميز: ${ctx.sellingPoints.join(' | ') || 'غير محدد'}

══ الصوت ══
النبرة: ${ctx.voice.tone.join(', ') || 'محايدة'}
الكلمات المفضلة: ${ctx.voice.keywords.join(', ') || '-'}
الكلمات المحظورة: ${ctx.voice.negativeKeywords.join(', ') || '-'}
${voiceDos}
${voiceDonts}

══ الجمهور ══
${audienceSection}

${knowledgeSections.length ? '══ قاعدة المعرفة ══\n' + knowledgeSections.join('\n\n') : ''}
${ctx.memory ? '══ الذاكرة (تعلمت من التفاعلات السابقة) ══\n' + ctx.memory : ''}

══ قواعد ثابتة ══
1. لا تستخدم الكلمات المحظورة أبداً
2. اعكس هوية "${ctx.identity.name}" — ليس أي براند آخر
3. المخرجات جاهزة للاستخدام الفوري بلا تعديل جوهري
`.trim();
}

// ── Lightweight one-liner for filters & checks ───────────────────────────────

export function buildLightBrandContext(ctx: BrandBrainContext): string {
    return buildMinimalPrompt(ctx);
}
