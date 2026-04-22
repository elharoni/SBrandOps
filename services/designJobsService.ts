// services/designJobsService.ts
import { supabase } from './supabaseClient';
import { DesignJob, DesignJobStatus, DesignWorkflow, DesignAsset, BrandHubProfile, NotificationType } from '../types';
import { generateImageFromPrompt, enhanceArabicDesignPrompt, AIImageProvider } from './geminiService';
import { buildFinalPrompt, incrementWorkflowUsage } from './designWorkflowsService';
import { createDesignAsset } from './designAssetsService';
import { uploadFile } from './storageService';

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapRow(row: any): DesignJob {
    return {
        id:              row.id,
        brandId:         row.brand_id,
        workflowId:      row.workflow_id ?? undefined,
        workflowName:    row.workflow_name ?? undefined,
        inputs:          row.inputs || {},
        format:          row.format,
        status:          row.status as DesignJobStatus,
        prompt:          row.prompt || '',
        enhancedPrompt:  row.enhanced_prompt ?? undefined,
        assets:          Array.isArray(row.assets) ? row.assets : [],
        selectedAssetId: row.selected_asset_id ?? undefined,
        error:           row.error ?? undefined,
        createdAt:       row.created_at,
    };
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getDesignJobs(brandId: string, limit = 20): Promise<DesignJob[]> {
    const { data, error } = await supabase
        .from('design_jobs')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) { console.error('getDesignJobs error:', error); return []; }
    return (data || []).map(mapRow);
}

// ── Create / Update ───────────────────────────────────────────────────────────

export async function createDesignJob(
    brandId: string,
    job: Pick<DesignJob, 'workflowId' | 'workflowName' | 'inputs' | 'format' | 'prompt'>
): Promise<DesignJob> {
    const { data, error } = await supabase
        .from('design_jobs')
        .insert({
            brand_id:      brandId,
            workflow_id:   job.workflowId ?? null,
            workflow_name: job.workflowName ?? null,
            inputs:        job.inputs,
            format:        job.format,
            status:        'pending',
            prompt:        job.prompt,
            assets:        [],
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return mapRow(data);
}

async function updateDesignJob(jobId: string, updates: Record<string, any>): Promise<void> {
    await supabase.from('design_jobs').update(updates).eq('id', jobId);
}

export async function selectJobVariant(jobId: string, assetId: string): Promise<void> {
    await supabase
        .from('design_jobs')
        .update({ selected_asset_id: assetId })
        .eq('id', jobId);
}

// ── Core: Run a Design Job ────────────────────────────────────────────────────

/**
 * يشغّل الـ job كاملاً:
 * 1. يبني الـ prompt من workflow + inputs + brand context
 * 2. يحسّن العربي لو لزم (gemini-2.5-flash)
 * 3. يستدعي Imagen 4.0 (variantsCount مرات)
 * 4. يرفع كل صورة على Supabase Storage
 * 5. يحفظ كـ DesignAsset في المكتبة
 * 6. يُحدّث الـ job
 */
export async function runDesignJob(
    job: DesignJob,
    workflow: DesignWorkflow,
    brandProfile: BrandHubProfile | null,
    brandId: string,
    onProgress?: (msg: string) => void,
    imageProvider: AIImageProvider = 'google',
): Promise<DesignJob> {
    try {
        await updateDesignJob(job.id, { status: 'generating' });
        onProgress?.('جاري تحسين الـ prompt...');

        // 1. Build base prompt
        const basePrompt = buildFinalPrompt(workflow, job.inputs, brandProfile);

        // 2. Enhance Arabic prompt via gemini-2.5-flash
        const brandColors = brandProfile?.styleGuidelines
            ?.filter(g => g.toLowerCase().includes('color') || g.includes('#'))
            .join(', ');

        const { enhancedPrompt, arabicTextSuggestions } = await enhanceArabicDesignPrompt(
            basePrompt,
            brandProfile?.brandName,
            brandColors
        );

        await updateDesignJob(job.id, { prompt: basePrompt, enhanced_prompt: enhancedPrompt });
        onProgress?.('جاري توليد التصاميم بـ Imagen 4.0...');

        // 3. Generate variants using count parameter
        const count       = workflow.variantsCount || 3;
        const aspectRatio = job.format.aspectRatio;
        // generateImageFromPrompt now returns string[] — pass count directly
        const dataUrls = await generateImageFromPrompt(enhancedPrompt, aspectRatio, imageProvider, count);

        onProgress?.('جاري رفع الصور على المكتبة...');

        // 4. Upload each image & save as DesignAsset
        const savedAssets: DesignAsset[] = [];
        for (let i = 0; i < dataUrls.length; i++) {
            const dataUrl = dataUrls[i];
            try {
                // data URL → File
                const res   = await fetch(dataUrl);
                const blob  = await res.blob();
                const fname = `design-${Date.now()}-v${i + 1}.jpg`;
                const file  = new File([blob], fname, { type: 'image/jpeg' });

                // Upload to Supabase Storage bucket: 'design-assets'
                const uploadResult = await uploadFile(file, 'design-assets', brandId);
                const finalUrl     = uploadResult.success && uploadResult.url ? uploadResult.url : dataUrl;

                // Save DesignAsset record
                const asset = await createDesignAsset(brandId, {
                    name:        `${workflow.name} — variant ${i + 1}`,
                    url:         finalUrl,
                    thumbnailUrl: finalUrl,
                    type:        'image',
                    source:      'ai-generated',
                    tags:        [workflow.category, job.format.format],
                    width:       job.format.width,
                    height:      job.format.height,
                    aspectRatio: job.format.aspectRatio,
                    prompt:      enhancedPrompt,
                });
                savedAssets.push(asset);
            } catch (assetErr) {
                console.error(`Failed to save variant ${i + 1}:`, assetErr);
                // push a fallback asset with the data URL so UI still shows it
                savedAssets.push({
                    id:          crypto.randomUUID(),
                    brandId,
                    name:        `${workflow.name} — variant ${i + 1}`,
                    url:         dataUrl,
                    type:        'image',
                    source:      'ai-generated',
                    tags:        [],
                    createdAt:   new Date().toISOString(),
                });
            }
        }

        // 5. Update job to done
        await updateDesignJob(job.id, {
            status:           'done',
            assets:           savedAssets,
            enhanced_prompt:  enhancedPrompt,
        });

        // 6. Increment workflow usage (non-blocking)
        if (workflow.brandId && workflow.id) {
            incrementWorkflowUsage(brandId, workflow.id).catch(() => {});
        }

        return {
            ...job,
            status:          'done',
            prompt:          basePrompt,
            enhancedPrompt,
            assets:          savedAssets,
        };

    } catch (err: any) {
        const errMsg = err?.message || 'فشل توليد التصميم';
        await updateDesignJob(job.id, { status: 'error', error: errMsg });
        return { ...job, status: 'error', error: errMsg };
    }
}
