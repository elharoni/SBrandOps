import { beforeEach, describe, expect, it, vi } from 'vitest';
const { invokeMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
}));

vi.mock('../services/supabaseClient', () => ({
    supabase: {
        functions: {
            invoke: invokeMock,
        },
    },
}));

import { analyzeBrandFiles } from '../services/brandFileAnalysisService';
import type { OpenAIBrandFileAnalysis } from '../services/brandFileAnalysisShared';

function buildProxyAnalysis(): OpenAIBrandFileAnalysis {
    return {
        brand_summary: {
            brand_name: 'Atlas Advisory',
            business_type: 'B2B consulting',
            industry: 'Consulting',
            market: 'UAE',
            target_audience: ['Founders', 'Operations leaders'],
            positioning: 'Fractional strategy support for scaling service businesses.',
            core_offer: 'Strategy workshops and advisory retainers.',
            main_value_proposition: 'Senior guidance without a full-time headcount.',
        },
        brand_identity: {
            mission: 'Help operators scale with clarity.',
            vision: 'Become the default strategy partner for ambitious SMEs.',
            values: ['Clarity', 'Speed'],
            personality: ['Sharp', 'Reliable'],
            tone_of_voice: 'Direct and practical.',
            visual_direction: 'Minimalist executive style.',
            colors: ['Navy', 'White'],
            typography: ['Inter'],
            logo_notes: 'Simple mark with strong spacing.',
        },
        marketing_intelligence: {
            main_products_or_services: ['Retainer advisory'],
            customer_pain_points: ['Slow execution'],
            customer_desires: ['Predictable growth'],
            competitive_advantages: ['Hands-on implementation'],
            proof_points: ['12 active retainers'],
            objections: ['Do we need this full time?'],
            content_angles: ['Execution bottlenecks'],
            ad_angles: ['Senior support without full-time cost'],
        },
        content_system: {
            recommended_content_pillars: ['Operational clarity'],
            suggested_hooks: ['Why strategy decks fail without execution'],
            caption_style: 'Tight B2B captions with one insight and one action.',
            cta_suggestions: ['Book a strategy call'],
            do: ['Use plain language'],
            dont: ['Use generic motivational fluff'],
        },
        business_notes: {
            missing_information: ['Pricing ranges'],
            risks_or_inconsistencies: [],
            recommended_next_questions: ['What is the average project duration?'],
            confidence_score: 82,
        },
        source_file: {
            file_name: 'brief.pdf',
            file_type: 'application/pdf',
            detected_language: 'en',
            analysis_provider: 'openai',
            model: 'gpt-5.5',
        },
    };
}

describe('analyzeBrandFiles', () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it('calls ai-proxy with the OpenAI brand file analysis mode and maps the response', async () => {
        invokeMock.mockResolvedValueOnce({
            data: {
                analysis: buildProxyAnalysis(),
                model: 'gpt-5.5',
                provider: 'openai',
                fallbackUsed: false,
            },
            error: null,
        });

        const documents = [{
            file_name: 'brief.pdf',
            file_type: 'application/pdf',
            mime_type: 'application/pdf',
            size_bytes: 2048,
            base64_data: 'JVBERi0xLjQKJfake==',
        }];

        const result = await analyzeBrandFiles(documents, 'brand_123');

        expect(invokeMock).toHaveBeenCalledWith('ai-proxy', {
            body: {
                mode: 'brand-file-analysis',
                provider: 'openai',
                task: 'brand_file_analysis',
                documents,
                brand_id: 'brand_123',
            },
        });
        expect(result.provider).toBe('openai');
        expect(result.model).toBe('gpt-5.5');
        expect(result.data.name).toBe('Atlas Advisory');
        expect(result.data.analysisProvider).toBe('openai');
        expect(result.data.analysisModel).toBe('gpt-5.5');
        expect(result.score).toBeGreaterThan(0);
    });

    it('surfaces proxy failures with a user-facing error message', async () => {
        invokeMock.mockResolvedValueOnce({
            data: null,
            error: { message: 'OPENAI_API_KEY is missing for Brand Hub file analysis.' },
        });

        await expect(analyzeBrandFiles([{
            file_name: 'brief.pdf',
            file_type: 'application/pdf',
            mime_type: 'application/pdf',
            size_bytes: 2048,
            base64_data: 'JVBERi0xLjQKJfake==',
        }])).rejects.toThrow('OPENAI_API_KEY is missing for Brand Hub file analysis.');
    });
});
