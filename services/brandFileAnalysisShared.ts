export type BrandAnalysisProvider = 'openai';

export interface OpenAIBrandFileAnalysis {
    brand_summary: {
        brand_name: string;
        business_type: string;
        industry: string;
        market: string;
        target_audience: string[];
        positioning: string;
        core_offer: string;
        main_value_proposition: string;
    };
    brand_identity: {
        mission: string;
        vision: string;
        values: string[];
        personality: string[];
        tone_of_voice: string;
        visual_direction: string;
        colors: string[];
        typography: string[];
        logo_notes: string;
    };
    marketing_intelligence: {
        main_products_or_services: string[];
        customer_pain_points: string[];
        customer_desires: string[];
        competitive_advantages: string[];
        proof_points: string[];
        objections: string[];
        content_angles: string[];
        ad_angles: string[];
    };
    content_system: {
        recommended_content_pillars: string[];
        suggested_hooks: string[];
        caption_style: string;
        cta_suggestions: string[];
        do: string[];
        dont: string[];
    };
    business_notes: {
        missing_information: string[];
        risks_or_inconsistencies: string[];
        recommended_next_questions: string[];
        confidence_score: number;
    };
    source_file: {
        file_name: string;
        file_type: string;
        detected_language: string;
        analysis_provider: BrandAnalysisProvider;
        model: string;
    };
}

export interface BrandImportData {
    name: string;
    businessType?: string;
    industry: string;
    market?: string;
    country?: string;
    website?: string;
    targetAudienceSummary?: string;
    missionStatement?: string;
    visionStatement?: string;
    brandStory?: string;
    brandArchetype?: string;
    valueProp?: string;
    coreOffer?: string;
    positioning?: string;
    brandColors: string[];
    brandHashtags: string[];
    values: string[];
    keySellingPoints: string[];
    styleGuidelines: string[];
    contentPillars: string[];
    postingStrategy?: string;
    brandVoice: {
        toneDescription: string[];
        keywords: string[];
        negativeKeywords: string[];
        toneStrength: number;
        toneSentiment: number;
        voiceGuidelines: { dos: string[]; donts: string[] };
    };
    brandAudiences: {
        personaName: string;
        description: string;
        keyEmotions: string[];
        painPoints: string[];
    }[];
    knowledgeEntries: {
        type: 'product' | 'faq' | 'policy' | 'competitor' | 'scenario_script';
        title: string;
        content: string;
    }[];
    sampleContent: {
        text: string;
        platform?: string;
        contentType: 'post' | 'caption' | 'slogan' | 'tagline' | 'ad_copy' | 'bio' | 'story';
    }[];
    documentTitle?: string;
    documentSummary?: string;
    marketingIntelligence: OpenAIBrandFileAnalysis['marketing_intelligence'];
    contentSystem: OpenAIBrandFileAnalysis['content_system'];
    businessNotes: OpenAIBrandFileAnalysis['business_notes'];
    analysisProvider: BrandAnalysisProvider;
    analysisModel: string;
    sourceFileName: string;
    sourceFileType: string;
    detectedLanguage?: string;
    rawAnalysis: OpenAIBrandFileAnalysis;
}

export interface BrandAnalysisDocumentPayload {
    file_name: string;
    file_type: string;
    mime_type: string;
    size_bytes: number;
    base64_data?: string;
    text_content?: string;
}

const DIRECT_FILE_MIME_BY_EXT: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const TEXT_MIME_BY_EXT: Record<string, string> = {
    txt: 'text/plain',
    text: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
};

const MARKET_TO_ISO2: Record<string, string> = {
    sa: 'SA',
    ksa: 'SA',
    'saudi arabia': 'SA',
    'السعودية': 'SA',
    eg: 'EG',
    egypt: 'EG',
    'مصر': 'EG',
    ae: 'AE',
    uae: 'AE',
    'united arab emirates': 'AE',
    'الإمارات': 'AE',
    us: 'US',
    usa: 'US',
    'united states': 'US',
    'الولايات المتحدة': 'US',
    qa: 'QA',
    qatar: 'QA',
    'قطر': 'QA',
    kw: 'KW',
    kuwait: 'KW',
    'الكويت': 'KW',
    bh: 'BH',
    bahrain: 'BH',
    'البحرين': 'BH',
    om: 'OM',
    oman: 'OM',
    'عمان': 'OM',
    jo: 'JO',
    jordan: 'JO',
    'الأردن': 'JO',
    ma: 'MA',
    morocco: 'MA',
    'المغرب': 'MA',
};

function trimOrEmpty(value: string | null | undefined): string {
    return typeof value === 'string' ? value.trim() : '';
}

function uniqueItems(values: Array<string | null | undefined>): string[] {
    return Array.from(new Set(values.map(trimOrEmpty).filter(Boolean)));
}

function listToParagraph(items: string[]): string {
    return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function buildAudienceEntries(analysis: OpenAIBrandFileAnalysis): BrandImportData['brandAudiences'] {
    const description = uniqueItems(analysis.brand_summary.target_audience).join(' • ');
    if (!description && analysis.marketing_intelligence.customer_pain_points.length === 0) {
        return [];
    }

    return [
        {
            personaName: analysis.brand_summary.target_audience[0] || 'Primary audience',
            description,
            keyEmotions: uniqueItems(analysis.marketing_intelligence.customer_desires).slice(0, 6),
            painPoints: uniqueItems(analysis.marketing_intelligence.customer_pain_points).slice(0, 6),
        },
    ];
}

function buildKnowledgeEntries(analysis: OpenAIBrandFileAnalysis): BrandImportData['knowledgeEntries'] {
    const entries: BrandImportData['knowledgeEntries'] = [];

    analysis.marketing_intelligence.main_products_or_services.forEach((item) => {
        entries.push({
            type: 'product',
            title: item,
            content: item,
        });
    });

    if (analysis.marketing_intelligence.customer_pain_points.length > 0) {
        entries.push({
            type: 'faq',
            title: 'Customer pain points',
            content: listToParagraph(uniqueItems(analysis.marketing_intelligence.customer_pain_points)),
        });
    }

    if (analysis.marketing_intelligence.customer_desires.length > 0) {
        entries.push({
            type: 'faq',
            title: 'Customer desires',
            content: listToParagraph(uniqueItems(analysis.marketing_intelligence.customer_desires)),
        });
    }

    const advantageBlocks = uniqueItems([
        ...analysis.marketing_intelligence.competitive_advantages,
        ...analysis.marketing_intelligence.proof_points,
    ]);
    if (advantageBlocks.length > 0) {
        entries.push({
            type: 'policy',
            title: 'Competitive advantages and proof points',
            content: listToParagraph(advantageBlocks),
        });
    }

    if (analysis.marketing_intelligence.objections.length > 0) {
        entries.push({
            type: 'scenario_script',
            title: 'Common objections to address',
            content: listToParagraph(uniqueItems(analysis.marketing_intelligence.objections)),
        });
    }

    return entries;
}

function buildDocumentSummary(analysis: OpenAIBrandFileAnalysis): string {
    const parts = uniqueItems([
        analysis.brand_summary.positioning,
        analysis.brand_summary.core_offer,
        analysis.brand_summary.main_value_proposition,
    ]);
    return parts.slice(0, 3).join(' ');
}

function normalizeCountryCode(market: string): string | undefined {
    const trimmed = trimOrEmpty(market);
    if (!trimmed) return undefined;
    if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
    return MARKET_TO_ISO2[trimmed.toLowerCase()];
}

function buildStyleGuidelines(analysis: OpenAIBrandFileAnalysis): string[] {
    return uniqueItems([
        analysis.brand_identity.visual_direction,
        ...analysis.brand_identity.typography.map((item) => `Typography: ${item}`),
        ...analysis.brand_identity.colors.map((item) => `Color: ${item}`),
        ...analysis.content_system.do.map((item) => `Do: ${item}`),
        ...analysis.content_system.dont.map((item) => `Don't: ${item}`),
    ]);
}

function scoreToneStrength(analysis: OpenAIBrandFileAnalysis): number {
    const intensitySignals = uniqueItems([
        analysis.brand_summary.positioning,
        ...analysis.brand_identity.personality,
        ...analysis.marketing_intelligence.competitive_advantages,
    ]).length;
    return Math.min(1, Math.max(0.25, Number((0.35 + intensitySignals * 0.08).toFixed(2))));
}

function scoreToneSentiment(analysis: OpenAIBrandFileAnalysis): number {
    const warmthSignals = uniqueItems([
        analysis.brand_identity.tone_of_voice,
        ...analysis.marketing_intelligence.customer_desires,
    ]).length;
    return Math.min(1, Math.max(0.2, Number((0.3 + warmthSignals * 0.06).toFixed(2))));
}

export function getBrandFileExt(name: string): string {
    return name.split('.').pop()?.toLowerCase() ?? '';
}

export function getBrandFileMimeType(name: string, fallback = 'text/plain'): string {
    const ext = getBrandFileExt(name);
    return DIRECT_FILE_MIME_BY_EXT[ext] ?? TEXT_MIME_BY_EXT[ext] ?? fallback;
}

export function isBrandFileBinaryExt(ext: string): boolean {
    return ext in DIRECT_FILE_MIME_BY_EXT;
}

export function isSupportedBrandFileExt(ext: string): boolean {
    return ext in DIRECT_FILE_MIME_BY_EXT || ext in TEXT_MIME_BY_EXT;
}

export function mapOpenAIAnalysisToBrandImport(analysis: OpenAIBrandFileAnalysis): BrandImportData {
    const keySellingPoints = uniqueItems([
        analysis.brand_summary.main_value_proposition,
        ...analysis.marketing_intelligence.competitive_advantages,
        ...analysis.marketing_intelligence.proof_points,
    ]);

    const valueProp = trimOrEmpty(analysis.brand_summary.main_value_proposition);
    const audienceSummary = uniqueItems(analysis.brand_summary.target_audience).join(' • ');

    return {
        name: trimOrEmpty(analysis.brand_summary.brand_name),
        businessType: trimOrEmpty(analysis.brand_summary.business_type) || undefined,
        industry: trimOrEmpty(analysis.brand_summary.industry),
        market: trimOrEmpty(analysis.brand_summary.market) || undefined,
        country: normalizeCountryCode(analysis.brand_summary.market),
        website: undefined,
        targetAudienceSummary: audienceSummary || undefined,
        missionStatement: trimOrEmpty(analysis.brand_identity.mission) || undefined,
        visionStatement: trimOrEmpty(analysis.brand_identity.vision) || undefined,
        brandStory: trimOrEmpty(analysis.brand_identity.logo_notes) || undefined,
        brandArchetype: undefined,
        valueProp: valueProp || undefined,
        coreOffer: trimOrEmpty(analysis.brand_summary.core_offer) || undefined,
        positioning: trimOrEmpty(analysis.brand_summary.positioning) || undefined,
        brandColors: uniqueItems(analysis.brand_identity.colors),
        brandHashtags: [],
        values: uniqueItems(analysis.brand_identity.values),
        keySellingPoints,
        styleGuidelines: buildStyleGuidelines(analysis),
        contentPillars: uniqueItems(analysis.content_system.recommended_content_pillars),
        postingStrategy: trimOrEmpty(analysis.content_system.caption_style) || undefined,
        brandVoice: {
            toneDescription: uniqueItems([
                analysis.brand_identity.tone_of_voice,
                ...analysis.brand_identity.personality,
            ]),
            keywords: uniqueItems([
                ...analysis.brand_identity.personality,
                ...analysis.marketing_intelligence.competitive_advantages,
            ]),
            negativeKeywords: uniqueItems(analysis.content_system.dont),
            toneStrength: scoreToneStrength(analysis),
            toneSentiment: scoreToneSentiment(analysis),
            voiceGuidelines: {
                dos: uniqueItems(analysis.content_system.do),
                donts: uniqueItems(analysis.content_system.dont),
            },
        },
        brandAudiences: buildAudienceEntries(analysis),
        knowledgeEntries: buildKnowledgeEntries(analysis),
        sampleContent: [],
        documentTitle: trimOrEmpty(analysis.source_file.file_name) || undefined,
        documentSummary: buildDocumentSummary(analysis) || undefined,
        marketingIntelligence: {
            ...analysis.marketing_intelligence,
            main_products_or_services: uniqueItems(analysis.marketing_intelligence.main_products_or_services),
            customer_pain_points: uniqueItems(analysis.marketing_intelligence.customer_pain_points),
            customer_desires: uniqueItems(analysis.marketing_intelligence.customer_desires),
            competitive_advantages: uniqueItems(analysis.marketing_intelligence.competitive_advantages),
            proof_points: uniqueItems(analysis.marketing_intelligence.proof_points),
            objections: uniqueItems(analysis.marketing_intelligence.objections),
            content_angles: uniqueItems(analysis.marketing_intelligence.content_angles),
            ad_angles: uniqueItems(analysis.marketing_intelligence.ad_angles),
        },
        contentSystem: {
            ...analysis.content_system,
            recommended_content_pillars: uniqueItems(analysis.content_system.recommended_content_pillars),
            suggested_hooks: uniqueItems(analysis.content_system.suggested_hooks),
            cta_suggestions: uniqueItems(analysis.content_system.cta_suggestions),
            do: uniqueItems(analysis.content_system.do),
            dont: uniqueItems(analysis.content_system.dont),
        },
        businessNotes: {
            ...analysis.business_notes,
            missing_information: uniqueItems(analysis.business_notes.missing_information),
            risks_or_inconsistencies: uniqueItems(analysis.business_notes.risks_or_inconsistencies),
            recommended_next_questions: uniqueItems(analysis.business_notes.recommended_next_questions),
            confidence_score: Number.isFinite(analysis.business_notes.confidence_score)
                ? analysis.business_notes.confidence_score
                : 0,
        },
        analysisProvider: 'openai',
        analysisModel: trimOrEmpty(analysis.source_file.model),
        sourceFileName: trimOrEmpty(analysis.source_file.file_name),
        sourceFileType: trimOrEmpty(analysis.source_file.file_type),
        detectedLanguage: trimOrEmpty(analysis.source_file.detected_language) || undefined,
        rawAnalysis: analysis,
    };
}

export function calcBrandImportCompleteness(data: BrandImportData): number {
    const checks = [
        !!data.name,
        !!data.businessType,
        !!data.industry,
        !!data.market,
        !!data.targetAudienceSummary,
        !!data.positioning,
        !!data.coreOffer,
        !!data.valueProp,
        !!data.missionStatement,
        !!data.visionStatement,
        data.values.length > 0,
        data.brandVoice.toneDescription.length > 0,
        data.styleGuidelines.length > 0,
        data.brandColors.length > 0,
        data.brandAudiences.length > 0,
        data.marketingIntelligence.main_products_or_services.length > 0,
        data.marketingIntelligence.customer_pain_points.length > 0,
        data.marketingIntelligence.competitive_advantages.length > 0,
        data.contentPillars.length > 0,
        data.contentSystem.suggested_hooks.length > 0,
        data.contentSystem.cta_suggestions.length > 0,
        data.businessNotes.recommended_next_questions.length > 0,
        data.analysisProvider === 'openai',
        !!data.analysisModel,
    ];

    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
