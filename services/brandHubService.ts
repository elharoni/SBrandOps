import { BrandHubProfile, BrandVoice, BrandAudience, BusinessModel, BrandGoal, BrandLanguage } from '../types';
import { supabase } from './supabaseClient';

// --- Helper: Build empty profile ---
const getEmptyBrandProfile = (brandName: string): BrandHubProfile => ({
    brandName,
    industry: '',
    values: [],
    keySellingPoints: [],
    styleGuidelines: [],
    brandVoice: {
        toneDescription: [],
        keywords: [],
        negativeKeywords: [],
        toneStrength: 0.5,
        toneSentiment: 0.5,
        voiceGuidelines: { dos: [], donts: [] },
    },
    brandAudiences: [],
    consistencyScore: 0,
    lastMemoryUpdate: new Date().toISOString(),
});

// --- Helper: Map DB row → BrandHubProfile ---
function mapToProfile(data: any, brandName: string): BrandHubProfile {
    const ext = (data.extended_profile as Record<string, any>) ?? {};
    return {
        brandName: data.brand_name || brandName,
        industry: data.industry || '',
        values: data.values || [],
        keySellingPoints: data.key_selling_points || [],
        styleGuidelines: data.style_guidelines || [],
        brandVoice: {
            toneDescription: data.tone_description || [],
            keywords: data.voice_keywords || [],
            negativeKeywords: data.negative_keywords || [],
            toneStrength: data.tone_strength ?? 0.5,
            toneSentiment: data.tone_sentiment ?? 0.5,
            voiceGuidelines: data.voice_guidelines || { dos: [], donts: [] },
        },
        brandAudiences: data.brand_audiences || [],
        consistencyScore: data.consistency_score || 0,
        lastMemoryUpdate: data.updated_at || new Date().toISOString(),
        // Extended wizard fields from extended_profile JSONB
        description: ext.description as string | undefined,
        businessModel: ext.businessModel as BusinessModel | undefined,
        goals: (ext.goals as BrandGoal[]) ?? [],
        language: ext.language as BrandLanguage | undefined,
        ageRange: ext.ageRange as string | undefined,
        targetAudienceSummary: ext.targetAudienceSummary as string | undefined,
        contactInfo: ext.contactInfo as { phone?: string; email?: string } | undefined,
    };
}

// --- Main Service Functions ---

export async function getBrandHubProfile(brandId: string, brandName: string): Promise<BrandHubProfile> {
    try {
        // Fetch brand profile and brand metadata (country, website) in parallel
        const [profileResult, brandResult] = await Promise.all([
            supabase.from('brand_profiles').select('*').eq('brand_id', brandId).maybeSingle(),
            supabase.from('brands').select('country, website_url').eq('id', brandId).maybeSingle(),
        ]);

        const profile = profileResult.data
            ? mapToProfile(profileResult.data, brandName)
            : getEmptyBrandProfile(brandName);

        // Enrich profile with country/website from the brands table
        if (brandResult.data) {
            profile.country = brandResult.data.country ?? undefined;
            profile.website = brandResult.data.website_url ?? undefined;
        }

        return profile;
    } catch (error) {
        console.warn('⚠️ Brand hub profile fetch failed:', error);
        return getEmptyBrandProfile(brandName);
    }
}

export async function updateBrandProfile(brandId: string, profile: Partial<BrandHubProfile>): Promise<BrandHubProfile> {
    const upsertData: any = {
        brand_id: brandId,
        updated_at: new Date().toISOString(),
    };

    if (profile.brandName !== undefined) upsertData.brand_name = profile.brandName;
    if (profile.industry !== undefined) upsertData.industry = profile.industry;
    if (profile.values !== undefined) upsertData.values = profile.values;
    if (profile.keySellingPoints !== undefined) upsertData.key_selling_points = profile.keySellingPoints;
    if (profile.styleGuidelines !== undefined) upsertData.style_guidelines = profile.styleGuidelines;
    if (profile.brandAudiences !== undefined) upsertData.brand_audiences = profile.brandAudiences;
    if (profile.consistencyScore !== undefined) upsertData.consistency_score = profile.consistencyScore;

    if (profile.brandVoice) {
        const bv = profile.brandVoice;
        if (bv.toneDescription !== undefined) upsertData.tone_description = bv.toneDescription;
        if (bv.keywords !== undefined) upsertData.voice_keywords = bv.keywords;
        if (bv.negativeKeywords !== undefined) upsertData.negative_keywords = bv.negativeKeywords;
        if (bv.toneStrength !== undefined) upsertData.tone_strength = bv.toneStrength;
        if (bv.toneSentiment !== undefined) upsertData.tone_sentiment = bv.toneSentiment;
        if (bv.voiceGuidelines !== undefined) upsertData.voice_guidelines = bv.voiceGuidelines;
    }

    // Extended wizard fields — merge into extended_profile JSONB
    const hasExtended = (
        profile.description !== undefined ||
        profile.businessModel !== undefined ||
        profile.goals !== undefined ||
        profile.language !== undefined ||
        profile.ageRange !== undefined ||
        profile.targetAudienceSummary !== undefined ||
        profile.contactInfo !== undefined
    );
    if (hasExtended) {
        // Fetch existing extended_profile to merge (avoid overwriting unrelated keys)
        const { data: existing } = await supabase
            .from('brand_profiles')
            .select('extended_profile')
            .eq('brand_id', upsertData.brand_id)
            .maybeSingle();
        const existingExt = (existing?.extended_profile as Record<string, any>) ?? {};
        upsertData.extended_profile = {
            ...existingExt,
            ...(profile.description !== undefined         && { description: profile.description }),
            ...(profile.businessModel !== undefined       && { businessModel: profile.businessModel }),
            ...(profile.goals !== undefined               && { goals: profile.goals }),
            ...(profile.language !== undefined            && { language: profile.language }),
            ...(profile.ageRange !== undefined            && { ageRange: profile.ageRange }),
            ...(profile.targetAudienceSummary !== undefined && { targetAudienceSummary: profile.targetAudienceSummary }),
            ...(profile.contactInfo !== undefined         && { contactInfo: profile.contactInfo }),
        };
    }

    const { data, error } = await supabase
        .from('brand_profiles')
        .upsert(upsertData, { onConflict: 'brand_id' })
        .select()
        .single();

    if (error) throw error;
    return mapToProfile(data, profile.brandName || '');
}
