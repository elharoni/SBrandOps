import { BrandHubProfile, BrandVoice, BrandAudience } from '../types';
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

    const { data, error } = await supabase
        .from('brand_profiles')
        .upsert(upsertData, { onConflict: 'brand_id' })
        .select()
        .single();

    if (error) throw error;
    return mapToProfile(data, profile.brandName || '');
}
