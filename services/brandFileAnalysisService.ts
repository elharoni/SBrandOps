import type { BrandHubProfile } from '../types';
import { supabase } from './supabaseClient';
import {
    BrandAnalysisDocumentPayload,
    BrandImportData,
    OpenAIBrandFileAnalysis,
    calcBrandImportCompleteness,
    mapOpenAIAnalysisToBrandImport,
} from './brandFileAnalysisShared';

export type BrandFileAnalysisResult = {
    data: BrandImportData;
    score: number;
    provider: 'openai';
    model: string;
    fallbackUsed: boolean;
};

type BrandFileAnalysisProxyResponse = {
    analysis: OpenAIBrandFileAnalysis;
    model: string;
    provider: 'openai';
    fallbackUsed: boolean;
};

type WizardTone = 'professional' | 'friendly' | 'bold' | 'creative' | 'empathetic' | 'authoritative';

export type WizardPrefill = {
    industry: string;
    description: string;
    targetAudience: string;
    ageRange: string;
    tones: WizardTone[];
    platforms: string[];
};

const TONE_HINTS: Array<{ tone: WizardTone; matches: string[] }> = [
    { tone: 'professional', matches: ['professional', 'formal', 'corporate', 'رسمي', 'مهني'] },
    { tone: 'friendly', matches: ['friendly', 'warm', 'approachable', 'ودود', 'قريب'] },
    { tone: 'bold', matches: ['bold', 'direct', 'confident', 'جريء', 'مباشر'] },
    { tone: 'creative', matches: ['creative', 'playful', 'innovative', 'إبداعي', 'مبتكر'] },
    { tone: 'empathetic', matches: ['empathetic', 'human', 'caring', 'متعاطف', 'عاطفي'] },
    { tone: 'authoritative', matches: ['authoritative', 'expert', 'trusted', 'خبير', 'موثوق'] },
];

const PLATFORM_HINTS = ['Instagram', 'TikTok', 'Facebook', 'X', 'LinkedIn', 'Snapchat'];

function inferWizardTones(data: BrandImportData): WizardTone[] {
    const source = [
        ...data.brandVoice.toneDescription,
        ...data.brandVoice.keywords,
        data.valueProp,
    ].filter(Boolean).join(' ').toLowerCase();

    return TONE_HINTS
        .filter(({ matches }) => matches.some((match) => source.includes(match.toLowerCase())))
        .map(({ tone }) => tone)
        .slice(0, 3);
}

function inferPlatforms(data: BrandImportData): string[] {
    const source = [
        data.postingStrategy,
        ...data.contentSystem.suggested_hooks,
        ...data.marketingIntelligence.content_angles,
        ...data.marketingIntelligence.ad_angles,
    ].filter(Boolean).join(' ').toLowerCase();

    return PLATFORM_HINTS.filter((platform) => source.includes(platform.toLowerCase()));
}

function normalizeDescription(value: string | undefined, fallback = ''): string {
    return value?.trim() || fallback;
}

export function buildWizardPrefillFromAnalysis(data: BrandImportData): WizardPrefill {
    return {
        industry: normalizeDescription(data.industry),
        description: normalizeDescription(data.valueProp, data.documentSummary || data.positioning || ''),
        targetAudience: normalizeDescription(
            data.targetAudienceSummary,
            data.brandAudiences[0]?.description || '',
        ),
        ageRange: '',
        tones: inferWizardTones(data),
        platforms: inferPlatforms(data),
    };
}

export function mergeBrandImportIntoProfile(
    profile: BrandHubProfile,
    data: BrandImportData,
): Partial<BrandHubProfile> {
    return {
        brandName: data.name || profile.brandName,
        industry: data.industry || profile.industry,
        description: data.documentSummary || data.positioning || profile.description,
        targetAudienceSummary: data.targetAudienceSummary || profile.targetAudienceSummary,
        valueProp: data.valueProp || profile.valueProp,
        brandPromise: data.coreOffer || profile.brandPromise,
        messagingPillars: data.contentPillars.length > 0 ? data.contentPillars : profile.messagingPillars,
        values: data.values.length > 0 ? data.values : profile.values,
        keySellingPoints: data.keySellingPoints.length > 0 ? data.keySellingPoints : profile.keySellingPoints,
        styleGuidelines: data.styleGuidelines.length > 0 ? data.styleGuidelines : profile.styleGuidelines,
        brandVoice: {
            ...profile.brandVoice,
            toneDescription: data.brandVoice.toneDescription.length > 0
                ? data.brandVoice.toneDescription
                : profile.brandVoice.toneDescription,
            keywords: data.brandVoice.keywords.length > 0
                ? data.brandVoice.keywords
                : profile.brandVoice.keywords,
            negativeKeywords: data.brandVoice.negativeKeywords.length > 0
                ? data.brandVoice.negativeKeywords
                : profile.brandVoice.negativeKeywords,
            toneStrength: data.brandVoice.toneStrength || profile.brandVoice.toneStrength,
            toneSentiment: data.brandVoice.toneSentiment || profile.brandVoice.toneSentiment,
            voiceGuidelines: {
                dos: data.brandVoice.voiceGuidelines.dos.length > 0
                    ? data.brandVoice.voiceGuidelines.dos
                    : profile.brandVoice.voiceGuidelines.dos,
                donts: data.brandVoice.voiceGuidelines.donts.length > 0
                    ? data.brandVoice.voiceGuidelines.donts
                    : profile.brandVoice.voiceGuidelines.donts,
            },
        },
        brandAudiences: data.brandAudiences.length > 0 ? data.brandAudiences : profile.brandAudiences,
        website: data.website || profile.website,
        country: data.country || profile.country,
    };
}

export async function analyzeBrandFiles(
    documents: BrandAnalysisDocumentPayload[],
    brandId?: string,
): Promise<BrandFileAnalysisResult> {
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: {
            mode: 'brand-file-analysis',
            provider: 'openai',
            task: 'brand_file_analysis',
            documents,
            brand_id: brandId ?? null,
        },
    });

    if (error) {
        const message = (error as { message?: string }).message ?? 'Brand file analysis failed';
        throw new Error(message);
    }
    if (!data) {
        throw new Error('Empty response from Brand Hub file analysis');
    }

    const parsed = data as BrandFileAnalysisProxyResponse;
    const mapped = mapOpenAIAnalysisToBrandImport(parsed.analysis);

    if (parsed.model) {
        mapped.analysisModel = parsed.model;
        mapped.rawAnalysis.source_file.model = parsed.model;
    }

    return {
        data: mapped,
        score: calcBrandImportCompleteness(mapped),
        provider: parsed.provider,
        model: parsed.model,
        fallbackUsed: parsed.fallbackUsed,
    };
}
