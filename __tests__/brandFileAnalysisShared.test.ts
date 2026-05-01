import { describe, expect, it } from 'vitest';
import {
    OpenAIBrandFileAnalysis,
    calcBrandImportCompleteness,
    getBrandFileMimeType,
    isSupportedBrandFileExt,
    mapOpenAIAnalysisToBrandImport,
} from '../services/brandFileAnalysisShared';

function buildAnalysis(overrides: Partial<OpenAIBrandFileAnalysis> = {}): OpenAIBrandFileAnalysis {
    return {
        brand_summary: {
            brand_name: 'Nour Skin',
            business_type: 'DTC skincare brand',
            industry: 'Beauty',
            market: 'Saudi Arabia',
            target_audience: ['نساء 25-40', 'مهتمات بالعناية الطبيعية'],
            positioning: 'Premium natural skincare tailored for Gulf climates.',
            core_offer: 'Natural skincare routines and bundles.',
            main_value_proposition: 'Clean formulas with clear routines that fit busy lifestyles.',
        },
        brand_identity: {
            mission: 'Help customers build simple skincare habits they trust.',
            vision: 'Become the most trusted Arabic-first skincare brand in the GCC.',
            values: ['Trust', 'Simplicity', 'Consistency'],
            personality: ['Warm', 'Expert', 'Modern'],
            tone_of_voice: 'Confident, supportive, and educational.',
            visual_direction: 'Soft neutrals with premium editorial styling.',
            colors: ['Sand', 'Olive', 'White'],
            typography: ['Cairo', 'Manrope'],
            logo_notes: 'Logo should feel clean and premium with high readability.',
        },
        marketing_intelligence: {
            main_products_or_services: ['Hydration set', 'Night repair serum'],
            customer_pain_points: ['Confusing routines', 'Sensitivity to harsh products'],
            customer_desires: ['Healthy glow', 'Simple routine'],
            competitive_advantages: ['Arabic-first guidance', 'Climate-aware formulations'],
            proof_points: ['Dermatologist reviewed', '4.8/5 average rating'],
            objections: ['Will it suit sensitive skin?'],
            content_angles: ['Routine education', 'Ingredient explainers'],
            ad_angles: ['Before/after routines', 'Simple routine bundles'],
        },
        content_system: {
            recommended_content_pillars: ['Education', 'Transformation stories'],
            suggested_hooks: ['Why your current skincare routine fails in hot weather'],
            caption_style: 'Short educational captions with practical steps.',
            cta_suggestions: ['Shop the routine', 'Take the skin quiz'],
            do: ['Use simple Arabic', 'Lead with the problem'],
            dont: ['Overpromise results'],
        },
        business_notes: {
            missing_information: ['Refund policy'],
            risks_or_inconsistencies: ['No clear shipping SLA in the source file'],
            recommended_next_questions: ['What are the main shipping regions?'],
            confidence_score: 87,
        },
        source_file: {
            file_name: 'brand-book.pdf',
            file_type: 'application/pdf',
            detected_language: 'ar,en',
            analysis_provider: 'openai',
            model: 'gpt-5.5',
        },
        ...overrides,
    };
}

describe('brandFileAnalysisShared', () => {
    it('maps the OpenAI analysis payload into Brand Hub import data', () => {
        const mapped = mapOpenAIAnalysisToBrandImport(buildAnalysis());

        expect(mapped.name).toBe('Nour Skin');
        expect(mapped.businessType).toBe('DTC skincare brand');
        expect(mapped.industry).toBe('Beauty');
        expect(mapped.country).toBe('SA');
        expect(mapped.targetAudienceSummary).toContain('نساء 25-40');
        expect(mapped.valueProp).toContain('Clean formulas');
        expect(mapped.brandVoice.toneDescription).toContain('Confident, supportive, and educational.');
        expect(mapped.styleGuidelines).toContain('Typography: Cairo');
        expect(mapped.marketingIntelligence.competitive_advantages).toContain('Arabic-first guidance');
        expect(mapped.contentSystem.cta_suggestions).toContain('Take the skin quiz');
        expect(mapped.businessNotes.confidence_score).toBe(87);
        expect(mapped.analysisProvider).toBe('openai');
        expect(mapped.analysisModel).toBe('gpt-5.5');
        expect(mapped.knowledgeEntries.some((entry) => entry.type === 'product')).toBe(true);
    });

    it('calculates completeness using the mapped OpenAI analysis fields', () => {
        const score = calcBrandImportCompleteness(mapOpenAIAnalysisToBrandImport(buildAnalysis()));
        expect(score).toBeGreaterThanOrEqual(90);
    });

    it('recognizes supported file types for Brand Hub analysis', () => {
        expect(isSupportedBrandFileExt('pdf')).toBe(true);
        expect(isSupportedBrandFileExt('csv')).toBe(true);
        expect(isSupportedBrandFileExt('zip')).toBe(false);
        expect(getBrandFileMimeType('strategy.csv')).toBe('text/csv');
    });
});
