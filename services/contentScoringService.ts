// services/contentScoringService.ts
// AI Content Scoring — محرك الجودة
// يُقيّم كل محتوى قبل النشر بـ score من 1-100 بناءً على 3 أبعاد:
//   DNA Match (40%) + Historical Performance (35%) + Cross-Brand Benchmark (25%)

import { supabase } from './supabaseClient';
import { callAIProxy, Type } from './aiProxy';
import { getBrandMemoryContext, formatMemoryForPrompt } from './brandMemoryService';
import type { BrandHubProfile } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ContentScoreBreakdown {
  dnaMatch: { score: number; feedback: string };
  historicalPerformance: { score: number; feedback: string };
  crossBrandBenchmark: { score: number; feedback: string };
}

export interface ContentScoreResult {
  totalScore: number;
  breakdown: ContentScoreBreakdown;
  topImprovement: string;
  predictedCtr: 'low' | 'medium' | 'high';
  contentId?: string;
}

export interface StoredContentScore {
  id: string;
  contentId: string;
  brandId: string;
  totalScore: number;
  breakdown: ContentScoreBreakdown;
  topImprovement: string;
  predictedCtr: 'low' | 'medium' | 'high';
  createdAt: string;
}

// ── Core Scoring Function ─────────────────────────────────────────────────

export async function scoreContent(
  content: string,
  brandProfile: BrandHubProfile,
  brandId: string,
  contentId?: string,
): Promise<ContentScoreResult> {
  if (!content.trim()) {
    return {
      totalScore: 0,
      breakdown: {
        dnaMatch: { score: 0, feedback: 'لا يوجد محتوى للتقييم' },
        historicalPerformance: { score: 0, feedback: 'لا يوجد محتوى للتقييم' },
        crossBrandBenchmark: { score: 0, feedback: 'لا يوجد محتوى للتقييم' },
      },
      topImprovement: 'أضف محتوى أولاً',
      predictedCtr: 'low',
      contentId,
    };
  }

  const memoryEntries = await getBrandMemoryContext(brandId, 8);
  const memoryContext = formatMemoryForPrompt(memoryEntries);

  const prompt = `
أنت خبير تسويق رقمي متخصص. مهمتك تقييم المحتوى التالي على 3 أبعاد وإعطاء score دقيق.

═══════════════════════════════════════
المحتوى المراد تقييمه:
"${content}"
═══════════════════════════════════════

معلومات البراند:
- اسم البراند: ${brandProfile.brandName}
- المجال: ${brandProfile.industry}
- نبرة الصوت: ${brandProfile.brandVoice.toneDescription.join(', ')}
- كلمات مفتاحية: ${brandProfile.brandVoice.keywords.join(', ')}
- يجب: ${brandProfile.brandVoice.voiceGuidelines?.dos?.join(' | ') || 'غير محدد'}
- يُمنع: ${brandProfile.brandVoice.voiceGuidelines?.donts?.join(' | ') || 'غير محدد'}
- القيم: ${brandProfile.values.join(', ')}
═══════════════════════════════════════

${memoryContext ? `سجل أداء البراند التاريخي:\n${memoryContext}\n═══════════════════════════════════════` : ''}

قيّم المحتوى على 3 أبعاد:

1. **dnaMatch** (يمثل 40% من الـ score النهائي):
   هل المحتوى يتطابق مع هوية البراند؟ تحقق من: النبرة، الكلمات المستخدمة، القيم، ما يُمنع استخدامه.

2. **historicalPerformance** (يمثل 35% من الـ score النهائي):
   ${memoryContext
      ? 'بناءً على سجل الأداء التاريخي المرفق، هل هذا المحتوى يشبه المحتوى الفائز السابق؟ هل يتجنب الأساليب الفاشلة؟'
      : 'لا يوجد سجل تاريخي بعد. قيّم المحتوى بناءً على مبادئ الكتابة التسويقية الفعّالة للبراند.'}

3. **crossBrandBenchmark** (يمثل 25% من الـ score النهائي):
   قارن هذا المحتوى مع أفضل الممارسات في مجال "${brandProfile.industry}". هل الـ hook قوي؟ هل هناك CTA واضح؟ هل التنسيق مناسب للمنصة؟

أعطِ score لكل بُعد من 0 إلى 100، و feedback مختصر بالعربية (جملة واحدة تشرح السبب).
ثم حدد:
- **topImprovement**: أهم تحسين واحد يمكن تطبيقه على المحتوى (بالعربية، جملة واحدة عملية)
- **predictedCtr**: توقع الـ CTR — فقط: "low" أو "medium" أو "high"

الـ score النهائي = (dnaMatch × 0.40) + (historicalPerformance × 0.35) + (crossBrandBenchmark × 0.25)
`;

  const response = await callAIProxy({
    model: 'gemini-2.5-flash',
    prompt,
    schema: {
      type: Type.OBJECT,
      properties: {
        dnaMatch: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
          },
          required: ['score', 'feedback'],
        },
        historicalPerformance: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
          },
          required: ['score', 'feedback'],
        },
        crossBrandBenchmark: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
          },
          required: ['score', 'feedback'],
        },
        topImprovement: { type: Type.STRING },
        predictedCtr: { type: Type.STRING },
      },
      required: ['dnaMatch', 'historicalPerformance', 'crossBrandBenchmark', 'topImprovement', 'predictedCtr'],
    },
    feature: 'content_scoring',
    brand_id: brandId,
  });

  const raw = JSON.parse(response.text);

  const breakdown: ContentScoreBreakdown = {
    dnaMatch: { score: Math.round(raw.dnaMatch.score), feedback: raw.dnaMatch.feedback },
    historicalPerformance: { score: Math.round(raw.historicalPerformance.score), feedback: raw.historicalPerformance.feedback },
    crossBrandBenchmark: { score: Math.round(raw.crossBrandBenchmark.score), feedback: raw.crossBrandBenchmark.feedback },
  };

  const totalScore = Math.round(
    breakdown.dnaMatch.score * 0.40 +
    breakdown.historicalPerformance.score * 0.35 +
    breakdown.crossBrandBenchmark.score * 0.25,
  );

  const predictedCtr = ['low', 'medium', 'high'].includes(raw.predictedCtr)
    ? (raw.predictedCtr as 'low' | 'medium' | 'high')
    : totalScore >= 70 ? 'high' : totalScore >= 45 ? 'medium' : 'low';

  return { totalScore, breakdown, topImprovement: raw.topImprovement, predictedCtr, contentId };
}

// ── Supabase Storage ──────────────────────────────────────────────────────

export async function saveContentScore(
  brandId: string,
  contentId: string,
  result: ContentScoreResult,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('content_scores')
    .upsert(
      {
        brand_id: brandId,
        content_id: contentId,
        total_score: result.totalScore,
        dna_score: result.breakdown.dnaMatch.score,
        history_score: result.breakdown.historicalPerformance.score,
        cross_brand_score: result.breakdown.crossBrandBenchmark.score,
        breakdown: result.breakdown,
        top_improvement: result.topImprovement,
        predicted_ctr: result.predictedCtr,
        scored_at: new Date().toISOString(),
      },
      { onConflict: 'content_id' },
    )
    .select('id')
    .single();

  if (error) {
    console.warn('[ContentScoring] Failed to save score:', error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function getContentScore(contentId: string): Promise<StoredContentScore | null> {
  const { data, error } = await supabase
    .from('content_scores')
    .select('*')
    .eq('content_id', contentId)
    .order('scored_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    contentId: data.content_id,
    brandId: data.brand_id,
    totalScore: data.total_score,
    breakdown: data.breakdown,
    topImprovement: data.top_improvement,
    predictedCtr: data.predicted_ctr,
    createdAt: data.scored_at,
  };
}

export async function getBrandScoreStats(brandId: string): Promise<{
  avgScore: number;
  totalScored: number;
  highScoreCount: number;
  lowScoreCount: number;
}> {
  const { data, error } = await supabase
    .from('content_scores')
    .select('total_score')
    .eq('brand_id', brandId);

  if (error || !data?.length) {
    return { avgScore: 0, totalScored: 0, highScoreCount: 0, lowScoreCount: 0 };
  }

  const scores = data.map((r: any) => r.total_score as number);
  const avg = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);

  return {
    avgScore: avg,
    totalScored: scores.length,
    highScoreCount: scores.filter((s: number) => s >= 70).length,
    lowScoreCount: scores.filter((s: number) => s < 50).length,
  };
}

export async function scoreAndSave(
  content: string,
  brandProfile: BrandHubProfile,
  brandId: string,
  contentId: string,
): Promise<ContentScoreResult> {
  const result = await scoreContent(content, brandProfile, brandId, contentId);
  await saveContentScore(brandId, contentId, result);
  return result;
}
