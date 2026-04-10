// services/designWorkflowsService.ts
import { supabase } from './supabaseClient';
import { DesignWorkflow, DesignWorkflowStatus, DESIGN_FORMAT_MAP, BrandHubProfile } from '../types';

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapRow(row: any): DesignWorkflow {
    return {
        id:             row.id,
        brandId:        row.brand_id,
        name:           row.name,
        nameEn:         row.name_en || row.name,
        description:    row.description || '',
        icon:           row.icon || 'fa-magic',
        category:       row.category,
        formats:        Array.isArray(row.formats) ? row.formats : [],
        steps:          Array.isArray(row.steps) ? row.steps : [],
        promptTemplate: row.prompt_template || '',
        useBrandColors: row.use_brand_colors ?? true,
        useBrandVoice:  row.use_brand_voice ?? true,
        status:         (row.status as DesignWorkflowStatus) || 'active',
        variantsCount:  (row.variants_count as 1 | 2 | 3) || 3,
        createdAt:      row.created_at,
        updatedAt:      row.updated_at ?? undefined,
        lastUsedAt:     row.last_used_at ?? undefined,
        usageCount:     row.usage_count ?? 0,
        isDefault:      row.is_default ?? false,
    };
}

// ── Default Workflows ─────────────────────────────────────────────────────────

const DEFAULT_WORKFLOWS: Omit<DesignWorkflow, 'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'lastUsedAt' | 'usageCount'>[] = [
    {
        name: 'منشور سوشيال ميديا',
        nameEn: 'Social Media Post',
        description: 'إنشاء تصميم احترافي لمنشورات السوشيال ميديا بألوان البراند تلقائياً',
        icon: 'fa-share-alt',
        category: 'social-post',
        formats: [
            DESIGN_FORMAT_MAP['instagram-post'],
            DESIGN_FORMAT_MAP['facebook-post'],
            DESIGN_FORMAT_MAP['twitter-post'],
        ],
        steps: [
            { id: 's1', order: 1, type: 'input-topic',     labelAr: 'موضوع المنشور',         labelEn: 'Post Topic' },
            { id: 's2', order: 2, type: 'input-tone',      labelAr: 'أسلوب التصميم',         labelEn: 'Design Tone',
              config: { options: ['احترافي', 'ودود', 'عاجل', 'ملهم', 'تعليمي'] } },
            { id: 's3', order: 3, type: 'apply-brand-colors', labelAr: 'ألوان البراند',      labelEn: 'Brand Colors' },
            { id: 's4', order: 4, type: 'generate-image',  labelAr: 'توليد التصميم',         labelEn: 'Generate' },
            { id: 's5', order: 5, type: 'select-variant',  labelAr: 'اختيار التصميم',        labelEn: 'Pick Variant' },
            { id: 's6', order: 6, type: 'review',          labelAr: 'مراجعة وحفظ',           labelEn: 'Review & Save' },
        ],
        promptTemplate: 'Create a professional social media visual for a brand called {brandName}. Topic: {topic}. Tone: {tone}. Use these brand colors as dominant palette: {brandColors}. Style: clean, modern, eye-catching, suitable for digital marketing. High quality, no text unless specified.',
        useBrandColors: true,
        useBrandVoice: true,
        status: 'active',
        variantsCount: 3,
        isDefault: true,
    },
    {
        name: 'ستوري وريل',
        nameEn: 'Story & Reel Cover',
        description: 'تصاميم رأسية للستوري والريلز على إنستاغرام وتيك توك',
        icon: 'fa-mobile-alt',
        category: 'story',
        formats: [
            DESIGN_FORMAT_MAP['instagram-story'],
            DESIGN_FORMAT_MAP['instagram-reel-cover'],
            DESIGN_FORMAT_MAP['tiktok-cover'],
        ],
        steps: [
            { id: 's1', order: 1, type: 'input-topic',        labelAr: 'موضوع الستوري',       labelEn: 'Story Topic' },
            { id: 's2', order: 2, type: 'input-text-overlay', labelAr: 'النص على الصورة (اختياري)', labelEn: 'Text Overlay' },
            { id: 's3', order: 3, type: 'apply-brand-colors', labelAr: 'ألوان البراند',       labelEn: 'Brand Colors' },
            { id: 's4', order: 4, type: 'generate-image',     labelAr: 'توليد التصميم',       labelEn: 'Generate' },
            { id: 's5', order: 5, type: 'select-variant',     labelAr: 'اختيار التصميم',      labelEn: 'Pick Variant' },
            { id: 's6', order: 6, type: 'review',             labelAr: 'مراجعة وحفظ',         labelEn: 'Review & Save' },
        ],
        promptTemplate: 'Create a vertical social story/reel cover for a brand called {brandName}. Topic: {topic}. Text concept: {textOverlay}. Brand colors: {brandColors}. Bold, mobile-first design, full bleed, dramatic composition. Vertical 9:16 format.',
        useBrandColors: true,
        useBrandVoice: false,
        status: 'active',
        variantsCount: 3,
        isDefault: true,
    },
    {
        name: 'حزمة إعلانية',
        nameEn: 'Ad Creative Pack',
        description: 'تصاميم إعلانية عالية التحويل لكمبانيا مدفوعة',
        icon: 'fa-bullhorn',
        category: 'ad-creative',
        formats: [
            DESIGN_FORMAT_MAP['ad-banner-square'],
            DESIGN_FORMAT_MAP['ad-banner-landscape'],
            DESIGN_FORMAT_MAP['instagram-story'],
        ],
        steps: [
            { id: 's1', order: 1, type: 'input-topic',        labelAr: 'المنتج أو العرض',    labelEn: 'Product / Offer' },
            { id: 's2', order: 2, type: 'input-tone',         labelAr: 'نوع الإعلان',        labelEn: 'Ad Type',
              config: { options: ['بيع مباشر', 'عرض حصري', 'إطلاق جديد', 'تذكير بالسلة'] } },
            { id: 's3', order: 3, type: 'input-text-overlay', labelAr: 'نص الـ CTA',         labelEn: 'CTA Text' },
            { id: 's4', order: 4, type: 'apply-brand-colors', labelAr: 'ألوان البراند',      labelEn: 'Brand Colors' },
            { id: 's5', order: 5, type: 'generate-image',     labelAr: 'توليد التصميم',      labelEn: 'Generate' },
            { id: 's6', order: 6, type: 'select-variant',     labelAr: 'اختيار التصميم',     labelEn: 'Pick Variant' },
            { id: 's7', order: 7, type: 'review',             labelAr: 'مراجعة وحفظ',        labelEn: 'Review & Save' },
        ],
        promptTemplate: 'Create a high-converting ad creative for a brand called {brandName}. Product/offer: {topic}. Ad type: {tone}. Call to action: {textOverlay}. Brand colors: {brandColors}. Design: urgency, clear value proposition, professional, conversion-optimized. No placeholder text.',
        useBrandColors: true,
        useBrandVoice: false,
        status: 'active',
        variantsCount: 3,
        isDefault: true,
    },
    {
        name: 'باقة تصاميم كمبانيا',
        nameEn: 'Campaign Visual Pack',
        description: 'توليد مجموعة متكاملة من التصاميم لكمبانيا واحدة بهوية بصرية موحدة',
        icon: 'fa-layer-group',
        category: 'campaign-pack',
        formats: [
            DESIGN_FORMAT_MAP['instagram-post'],
            DESIGN_FORMAT_MAP['instagram-story'],
            DESIGN_FORMAT_MAP['facebook-post'],
            DESIGN_FORMAT_MAP['linkedin-post'],
        ],
        steps: [
            { id: 's1', order: 1, type: 'input-topic',     labelAr: 'اسم الكمبانيا أو الفكرة الرئيسية', labelEn: 'Campaign Concept' },
            { id: 's2', order: 2, type: 'input-tone',      labelAr: 'أسلوب الكمبانيا',      labelEn: 'Campaign Tone',
              config: { options: ['احترافي', 'ملهم', 'مرح', 'عاجل', 'فاخر'] } },
            { id: 's3', order: 3, type: 'apply-brand-colors', labelAr: 'ألوان البراند',     labelEn: 'Brand Colors' },
            { id: 's4', order: 4, type: 'generate-image',  labelAr: 'توليد التصميم الأساسي', labelEn: 'Generate Base Design' },
            { id: 's5', order: 5, type: 'select-variant',  labelAr: 'اختيار التصميم الأساسي', labelEn: 'Pick Base Design' },
            { id: 's6', order: 6, type: 'review',          labelAr: 'مراجعة الباقة',         labelEn: 'Review Pack' },
        ],
        promptTemplate: 'Create a cohesive campaign visual for a brand called {brandName}. Campaign theme: {topic}. Tone: {tone}. Brand colors: {brandColors}. Design should work across multiple formats — consistent visual identity, memorable, campaign-worthy composition.',
        useBrandColors: true,
        useBrandVoice: true,
        status: 'active',
        variantsCount: 3,
        isDefault: true,
    },
    {
        name: 'توليد حر',
        nameEn: 'Free Generate',
        description: 'اكتب الـ prompt بنفسك لتوليد أي تصميم تريده',
        icon: 'fa-wand-magic-sparkles',
        category: 'custom',
        formats: [DESIGN_FORMAT_MAP['instagram-post']],
        steps: [
            { id: 's1', order: 1, type: 'select-format',  labelAr: 'اختيار المقاس',      labelEn: 'Select Format' },
            { id: 's2', order: 2, type: 'input-topic',    labelAr: 'وصف التصميم (Prompt)', labelEn: 'Design Prompt' },
            { id: 's3', order: 3, type: 'generate-image', labelAr: 'توليد التصميم',       labelEn: 'Generate' },
            { id: 's4', order: 4, type: 'select-variant', labelAr: 'اختيار التصميم',      labelEn: 'Pick Variant' },
            { id: 's5', order: 5, type: 'review',         labelAr: 'مراجعة وحفظ',         labelEn: 'Review & Save' },
        ],
        promptTemplate: '{topic}',
        useBrandColors: false,
        useBrandVoice: false,
        status: 'active',
        variantsCount: 3,
        isDefault: true,
    },
];

// ── Prompt Builder ────────────────────────────────────────────────────────────

export function buildFinalPrompt(
    workflow: DesignWorkflow,
    inputs: Record<string, any>,
    brandProfile?: BrandHubProfile | null
): string {
    const brandName   = brandProfile?.brandName || 'the brand';
    const brandColors = brandProfile?.styleGuidelines?.filter(g =>
        g.toLowerCase().includes('color') ||
        g.toLowerCase().includes('#') ||
        g.toLowerCase().includes('لون')
    ).join(', ') || 'professional brand colors';

    return workflow.promptTemplate
        .replace(/{brandName}/g,   brandName)
        .replace(/{brandColors}/g, brandColors)
        .replace(/{topic}/g,       inputs['input-topic']        || inputs.topic        || '')
        .replace(/{tone}/g,        inputs['input-tone']         || inputs.tone         || 'professional')
        .replace(/{textOverlay}/g, inputs['input-text-overlay'] || inputs.textOverlay  || '')
        .replace(/{cta}/g,         inputs['input-text-overlay'] || inputs.cta          || '');
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getDesignWorkflows(brandId: string): Promise<DesignWorkflow[]> {
    const { data, error } = await supabase
        .from('design_workflows')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: true });

    if (error) { console.error('getDesignWorkflows error:', error); return []; }
    return (data || []).map(mapRow);
}

// ── Seed Defaults ─────────────────────────────────────────────────────────────

export async function seedDefaultWorkflows(brandId: string): Promise<DesignWorkflow[]> {
    const existing = await getDesignWorkflows(brandId);
    if (existing.length > 0) return existing;

    const rows = DEFAULT_WORKFLOWS.map(wf => ({
        brand_id:        brandId,
        name:            wf.name,
        name_en:         wf.nameEn,
        description:     wf.description,
        icon:            wf.icon,
        category:        wf.category,
        formats:         wf.formats,
        steps:           wf.steps,
        prompt_template: wf.promptTemplate,
        use_brand_colors: wf.useBrandColors,
        use_brand_voice:  wf.useBrandVoice,
        status:          wf.status,
        variants_count:  wf.variantsCount,
        usage_count:     0,
        is_default:      true,
    }));

    const { data, error } = await supabase
        .from('design_workflows')
        .insert(rows)
        .select();

    if (error) { console.error('seedDefaultWorkflows error:', error); return []; }
    return (data || []).map(mapRow);
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createDesignWorkflow(
    brandId: string,
    wf: Omit<DesignWorkflow, 'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'lastUsedAt' | 'usageCount'>
): Promise<DesignWorkflow> {
    const { data, error } = await supabase
        .from('design_workflows')
        .insert({
            brand_id:        brandId,
            name:            wf.name,
            name_en:         wf.nameEn,
            description:     wf.description,
            icon:            wf.icon,
            category:        wf.category,
            formats:         wf.formats,
            steps:           wf.steps,
            prompt_template: wf.promptTemplate,
            use_brand_colors: wf.useBrandColors,
            use_brand_voice:  wf.useBrandVoice,
            status:          wf.status,
            variants_count:  wf.variantsCount,
            usage_count:     0,
            is_default:      false,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return mapRow(data);
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateDesignWorkflow(
    brandId: string,
    wfId: string,
    updates: Partial<Omit<DesignWorkflow, 'id' | 'brandId' | 'createdAt'>>
): Promise<DesignWorkflow> {
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined)          payload.name            = updates.name;
    if (updates.description !== undefined)   payload.description     = updates.description;
    if (updates.status !== undefined)        payload.status          = updates.status;
    if (updates.promptTemplate !== undefined) payload.prompt_template = updates.promptTemplate;

    const { data, error } = await supabase
        .from('design_workflows')
        .update(payload)
        .eq('id', wfId)
        .eq('brand_id', brandId)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return mapRow(data);
}

// ── Toggle Status ─────────────────────────────────────────────────────────────

export async function toggleDesignWorkflowStatus(
    brandId: string,
    wfId: string,
    status: DesignWorkflowStatus
): Promise<void> {
    const { error } = await supabase
        .from('design_workflows')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', wfId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}

// ── Increment Usage ───────────────────────────────────────────────────────────

export async function incrementWorkflowUsage(brandId: string, wfId: string): Promise<void> {
    const { error } = await supabase.rpc('increment_design_workflow_usage', {
        p_workflow_id: wfId,
        p_brand_id:    brandId,
    });
    // non-critical — ignore if RPC not available
    if (error) console.warn('incrementWorkflowUsage:', error.message);
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteDesignWorkflow(brandId: string, wfId: string): Promise<void> {
    const { error } = await supabase
        .from('design_workflows')
        .delete()
        .eq('id', wfId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}
