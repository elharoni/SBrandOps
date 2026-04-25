// services/campaignBrainService.ts
// Campaign Brain — DB CRUD layer for all campaign brain tables
// All operations are scoped by brand_id via Supabase RLS

import { supabase } from './supabaseClient';
import type {
    CBGoal, CBCampaign, CBContentPlan, CBContentItem,
    CBCreativeBrief, CBDesignPrompt, CBApproval, CBPublishingJob,
    CampaignBrainStatus, CBItemStatus, CampaignGoalType,
    CBStrategyDocument, CBBriefData, CBCaption, CBMediaAsset,
    CBPerformanceLearning,
} from '../types';

// ── Goals ─────────────────────────────────────────────────────────────────────

export async function getGoals(brandId: string): Promise<CBGoal[]> {
    const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapGoal);
}

export async function createGoal(brandId: string, input: {
    title: string;
    description?: string;
    goalType: CampaignGoalType;
    kpis?: Array<{ metric: string; target: number; unit: string }>;
    targetDate?: string;
}): Promise<CBGoal> {
    const { data, error } = await supabase
        .from('goals')
        .insert({
            brand_id:    brandId,
            title:       input.title,
            description: input.description,
            goal_type:   input.goalType,
            kpis:        input.kpis ?? [],
            target_date: input.targetDate ?? null,
        })
        .select()
        .single();
    if (error) throw error;
    return mapGoal(data);
}

export async function updateGoal(id: string, updates: Partial<{
    title: string;
    goalType: CampaignGoalType;
    kpis: Array<{ metric: string; target: number; unit: string }>;
    targetDate: string;
    status: string;
    progress: number;
}>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (updates.title !== undefined)      row.title       = updates.title;
    if (updates.goalType !== undefined)   row.goal_type   = updates.goalType;
    if (updates.kpis !== undefined)       row.kpis        = updates.kpis;
    if (updates.targetDate !== undefined) row.target_date = updates.targetDate;
    if (updates.status !== undefined)     row.status      = updates.status;
    if (updates.progress !== undefined)   row.progress    = updates.progress;
    const { error } = await supabase.from('goals').update(row).eq('id', id);
    if (error) throw error;
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

export async function getCampaigns(brandId: string): Promise<CBCampaign[]> {
    const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapCampaign);
}

export async function getCampaign(id: string): Promise<CBCampaign> {
    const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();
    if (error) throw error;
    return mapCampaign(data);
}

export async function createCampaign(brandId: string, input: {
    name: string;
    description?: string;
    goalId?: string;
    startDate?: string;
    endDate?: string;
    budget?: number;
    platforms?: string[];
}): Promise<CBCampaign> {
    const { data, error } = await supabase
        .from('campaigns')
        .insert({
            brand_id:     brandId,
            name:         input.name,
            description:  input.description,
            goal_id:      input.goalId ?? null,
            start_date:   input.startDate ?? null,
            end_date:     input.endDate ?? null,
            budget:       input.budget ?? null,
            platforms:    input.platforms ?? [],
            strategy_data: {},
        })
        .select()
        .single();
    if (error) throw error;
    return mapCampaign(data);
}

export async function updateCampaignStrategy(id: string, strategy: CBStrategyDocument): Promise<void> {
    const { error } = await supabase
        .from('campaigns')
        .update({ strategy_data: strategy })
        .eq('id', id);
    if (error) throw error;
}

export async function updateCampaignStatus(id: string, status: CampaignBrainStatus): Promise<void> {
    const { error } = await supabase
        .from('campaigns')
        .update({ status })
        .eq('id', id);
    if (error) throw error;
}

export async function deleteCampaign(id: string): Promise<void> {
    const { error } = await supabase.from('campaigns').delete().eq('id', id);
    if (error) throw error;
}

// ── Content Plans ─────────────────────────────────────────────────────────────

export async function getContentPlan(campaignId: string): Promise<CBContentPlan | null> {
    const { data, error } = await supabase
        .from('content_plans')
        .select('*')
        .eq('campaign_id', campaignId)
        .maybeSingle();
    if (error) throw error;
    return data ? mapContentPlan(data) : null;
}

export async function createContentPlan(brandId: string, campaignId: string, title: string): Promise<CBContentPlan> {
    const { data, error } = await supabase
        .from('content_plans')
        .insert({ brand_id: brandId, campaign_id: campaignId, title })
        .select()
        .single();
    if (error) throw error;
    return mapContentPlan(data);
}

// ── Content Items ─────────────────────────────────────────────────────────────

export async function getContentItems(campaignId: string): Promise<CBContentItem[]> {
    const { data, error } = await supabase
        .from('content_items')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapContentItem);
}

export async function getContentItem(id: string): Promise<CBContentItem> {
    const { data, error } = await supabase
        .from('content_items')
        .select('*')
        .eq('id', id)
        .single();
    if (error) throw error;
    return mapContentItem(data);
}

export async function createContentItem(brandId: string, input: {
    campaignId: string;
    contentPlanId?: string;
    title: string;
    contentType: string;
    platform: string;
    format: string;
    scheduledAt?: string;
    sortOrder?: number;
}): Promise<CBContentItem> {
    const { data, error } = await supabase
        .from('content_items')
        .insert({
            brand_id:        brandId,
            campaign_id:     input.campaignId,
            content_plan_id: input.contentPlanId ?? null,
            title:           input.title,
            content_type:    input.contentType,
            platform:        input.platform,
            status:          'draft',
            scheduled_at:    input.scheduledAt ?? null,
            sort_order:      input.sortOrder ?? 0,
        })
        .select()
        .single();
    if (error) throw error;
    return mapContentItem(data);
}

export async function updateContentItemStatus(id: string, status: CBItemStatus): Promise<void> {
    const { error } = await supabase
        .from('content_items')
        .update({ status })
        .eq('id', id);
    if (error) throw error;
}

export async function updateContentItem(id: string, updates: Partial<{
    title: string;
    caption: string;
    mediaUrl: string;
    briefData: CBBriefData;
    designPrompt: string;
    brandFitScore: number;
    scheduledAt: string;
    status: CBItemStatus;
}>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (updates.title !== undefined)         row.title            = updates.title;
    if (updates.caption !== undefined)       row.caption          = updates.caption;
    if (updates.mediaUrl !== undefined)      row.media_url        = updates.mediaUrl;
    if (updates.briefData !== undefined)     row.brief_data       = updates.briefData;
    if (updates.designPrompt !== undefined)  row.design_prompt    = updates.designPrompt;
    if (updates.brandFitScore !== undefined) row.brand_fit_score  = updates.brandFitScore;
    if (updates.scheduledAt !== undefined)   row.scheduled_at     = updates.scheduledAt;
    if (updates.status !== undefined)        row.status           = updates.status;
    const { error } = await supabase.from('content_items').update(row).eq('id', id);
    if (error) throw error;
}

export async function deleteContentItem(id: string): Promise<void> {
    const { error } = await supabase.from('content_items').delete().eq('id', id);
    if (error) throw error;
}

// ── Creative Briefs ────────────────────────────────────────────────────────────

export async function getCreativeBrief(contentItemId: string): Promise<CBCreativeBrief | null> {
    const { data, error } = await supabase
        .from('creative_briefs')
        .select('*')
        .eq('content_item_id', contentItemId)
        .maybeSingle();
    if (error) throw error;
    return data ? mapCreativeBrief(data) : null;
}

export async function upsertCreativeBrief(brandId: string, contentItemId: string, input: {
    objective: string;
    targetSegment?: string;
    keyMessage: string;
    tone?: string;
    hooks?: string[];
    cta?: string;
    visualDirection?: string;
    negativeSpace?: string;
    slideStructure?: unknown[];
}): Promise<CBCreativeBrief> {
    const existing = await getCreativeBrief(contentItemId);
    const row = {
        brand_id:          brandId,
        content_item_id:   contentItemId,
        objective:         input.objective,
        target_segment:    input.targetSegment ?? null,
        key_message:       input.keyMessage,
        tone:              input.tone ?? null,
        hooks:             input.hooks ?? [],
        cta:               input.cta ?? null,
        visual_direction:  input.visualDirection ?? null,
        negative_space:    input.negativeSpace ?? null,
        slide_structure:   input.slideStructure ?? [],
        version:           existing ? existing.version + 1 : 1,
    };

    if (existing) {
        const { data, error } = await supabase
            .from('creative_briefs')
            .update(row)
            .eq('id', existing.id)
            .select()
            .single();
        if (error) throw error;
        return mapCreativeBrief(data);
    } else {
        const { data, error } = await supabase
            .from('creative_briefs')
            .insert(row)
            .select()
            .single();
        if (error) throw error;
        return mapCreativeBrief(data);
    }
}

// ── Design Prompts ─────────────────────────────────────────────────────────────

export async function getDesignPrompts(contentItemId: string): Promise<CBDesignPrompt[]> {
    const { data, error } = await supabase
        .from('design_prompts')
        .select('*')
        .eq('content_item_id', contentItemId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapDesignPrompt);
}

export async function createDesignPrompt(brandId: string, input: {
    contentItemId: string;
    creativeBriefId?: string;
    promptText: string;
    negativePrompt?: string;
    model?: string;
    aspectRatio?: string;
    stylePreset?: string;
}): Promise<CBDesignPrompt> {
    const { data, error } = await supabase
        .from('design_prompts')
        .insert({
            brand_id:           brandId,
            content_item_id:    input.contentItemId,
            creative_brief_id:  input.creativeBriefId ?? null,
            prompt_text:        input.promptText,
            negative_prompt:    input.negativePrompt ?? null,
            model:              input.model ?? 'imagen-3.0-generate-002',
            aspect_ratio:       input.aspectRatio ?? '1:1',
            style_preset:       input.stylePreset ?? null,
            generation_status:  'pending',
        })
        .select()
        .single();
    if (error) throw error;
    return mapDesignPrompt(data);
}

export async function updateDesignPromptResult(id: string, imageUrl: string): Promise<void> {
    const { error } = await supabase
        .from('design_prompts')
        .update({ generated_image_url: imageUrl, generation_status: 'done', generated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
}

export async function selectDesignPrompt(contentItemId: string, selectedId: string): Promise<void> {
    await supabase.from('design_prompts').update({ is_selected: false }).eq('content_item_id', contentItemId);
    const { error } = await supabase.from('design_prompts').update({ is_selected: true }).eq('id', selectedId);
    if (error) throw error;
}

// ── Approvals ─────────────────────────────────────────────────────────────────

export async function getPendingApprovals(brandId: string): Promise<CBApproval[]> {
    const { data, error } = await supabase
        .from('approvals')
        .select('*')
        .eq('brand_id', brandId)
        .eq('decision', 'pending')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapApproval);
}

export async function createApproval(brandId: string, contentItemId: string): Promise<CBApproval> {
    const { data, error } = await supabase
        .from('approvals')
        .insert({
            brand_id:        brandId,
            content_item_id: contentItemId,
            decision:        'pending',
            review_type:     'final',
            expires_at:      new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();
    if (error) throw error;
    return mapApproval(data);
}

export async function submitApproval(id: string, decision: 'approved' | 'rejected' | 'needs_changes', notes?: string): Promise<void> {
    const { error } = await supabase
        .from('approvals')
        .update({ decision, notes: notes ?? null, reviewed_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
}

// ── Publishing Jobs ────────────────────────────────────────────────────────────

export async function schedulePublishingJob(brandId: string, contentItemId: string, platform: string, scheduledAt: string): Promise<CBPublishingJob> {
    const { data, error } = await supabase
        .from('publishing_jobs')
        .insert({
            brand_id:        brandId,
            content_item_id: contentItemId,
            platform,
            scheduled_at:    scheduledAt,
            status:          'queued',
        })
        .select()
        .single();
    if (error) throw error;
    return mapPublishingJob(data);
}

export async function getPublishingJobs(contentItemId: string): Promise<CBPublishingJob[]> {
    const { data, error } = await supabase
        .from('publishing_jobs')
        .select('*')
        .eq('content_item_id', contentItemId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapPublishingJob);
}

// ── Campaign health ───────────────────────────────────────────────────────────

export async function getCampaignHealth(campaignId: string): Promise<number> {
    const { data, error } = await supabase.rpc('get_campaign_health', { p_campaign_id: campaignId });
    if (error) return 0;
    return (data as number) ?? 0;
}

// ── Row mappers ───────────────────────────────────────────────────────────────

function mapGoal(row: Record<string, unknown>): CBGoal {
    return {
        id:          row.id as string,
        brandId:     row.brand_id as string,
        title:       row.title as string,
        description: row.description as string | undefined,
        goalType:    (row.goal_type as string) as CampaignGoalType,
        kpis:        (row.kpis as CBGoal['kpis']) ?? [],
        targetDate:  row.target_date as string | undefined,
        status:      row.status as CBGoal['status'],
        progress:    (row.progress as number) ?? 0,
        createdAt:   row.created_at as string,
    };
}

function mapCampaign(row: Record<string, unknown>): CBCampaign {
    return {
        id:             row.id as string,
        brandId:        row.brand_id as string,
        goalId:         row.goal_id as string | undefined,
        name:           row.name as string,
        description:    row.description as string | undefined,
        status:         (row.status as string) as CampaignBrainStatus,
        strategyData:   (row.strategy_data as CBStrategyDocument) ?? {},
        startDate:      row.start_date as string | undefined,
        endDate:        row.end_date as string | undefined,
        budget:         row.budget as number | undefined,
        currency:       (row.currency as string) ?? 'SAR',
        platforms:      (row.platforms as string[]) ?? [],
        contentCount:   (row.content_count as number) ?? 0,
        publishedCount: (row.published_count as number) ?? 0,
        healthScore:    (row.health_score as number) ?? 0,
        createdAt:      row.created_at as string,
        updatedAt:      row.updated_at as string,
    };
}

function mapContentPlan(row: Record<string, unknown>): CBContentPlan {
    return {
        id:         row.id as string,
        brandId:    row.brand_id as string,
        campaignId: row.campaign_id as string,
        title:      row.title as string,
        totalItems: (row.total_items as number) ?? 0,
        status:     (row.status as string) as CBContentPlan['status'],
        createdAt:  row.created_at as string,
    };
}

function mapContentItem(row: Record<string, unknown>): CBContentItem {
    return {
        id:            row.id as string,
        brandId:       row.brand_id as string,
        campaignId:    row.campaign_id as string | undefined,
        contentPlanId: row.content_plan_id as string | undefined,
        title:         row.title as string,
        contentType:   (row.content_type as string) as CBContentItem['contentType'],
        platform:      row.platform as string,
        format:        (row.content_type as string) as CBContentItem['format'],
        status:        (row.status as string) as CBItemStatus,
        caption:       row.caption as string | undefined,
        mediaUrl:      row.media_url as string | undefined,
        briefData:     row.brief_data as CBBriefData | undefined,
        designPrompt:  row.design_prompt as string | undefined,
        brandFitScore: row.brand_fit_score as number | undefined,
        scheduledAt:   row.scheduled_at as string | undefined,
        publishedAt:   row.published_at as string | undefined,
        sortOrder:     (row.sort_order as number) ?? 0,
        createdAt:     row.created_at as string,
        updatedAt:     row.updated_at as string,
    };
}

function mapCreativeBrief(row: Record<string, unknown>): CBCreativeBrief {
    return {
        id:              row.id as string,
        brandId:         row.brand_id as string,
        contentItemId:   row.content_item_id as string,
        objective:       row.objective as string,
        targetSegment:   row.target_segment as string | undefined,
        keyMessage:      row.key_message as string,
        tone:            row.tone as string | undefined,
        hooks:           (row.hooks as string[]) ?? [],
        cta:             row.cta as string | undefined,
        visualDirection: row.visual_direction as string | undefined,
        negativeSpace:   row.negative_space as string | undefined,
        slideStructure:  (row.slide_structure as CBCreativeBrief['slideStructure']) ?? [],
        version:         (row.version as number) ?? 1,
        isApproved:      (row.is_approved as boolean) ?? false,
        createdAt:       row.created_at as string,
    };
}

function mapDesignPrompt(row: Record<string, unknown>): CBDesignPrompt {
    return {
        id:                 row.id as string,
        brandId:            row.brand_id as string,
        contentItemId:      row.content_item_id as string,
        creativeBriefId:    row.creative_brief_id as string | undefined,
        promptText:         row.prompt_text as string,
        negativePrompt:     row.negative_prompt as string | undefined,
        model:              (row.model as string) ?? 'imagen-3.0-generate-002',
        aspectRatio:        (row.aspect_ratio as string) ?? '1:1',
        stylePreset:        row.style_preset as string | undefined,
        generatedImageUrl:  row.generated_image_url as string | undefined,
        generationStatus:   (row.generation_status as string) as CBDesignPrompt['generationStatus'],
        isSelected:         (row.is_selected as boolean) ?? false,
        version:            (row.version as number) ?? 1,
        createdAt:          row.created_at as string,
    };
}

function mapApproval(row: Record<string, unknown>): CBApproval {
    return {
        id:               row.id as string,
        brandId:          row.brand_id as string,
        contentItemId:    row.content_item_id as string,
        decision:         (row.decision as string) as CBApproval['decision'],
        reviewType:       (row.review_type as string) as CBApproval['reviewType'],
        notes:            row.notes as string | undefined,
        changesRequested: (row.changes_requested as string[]) ?? [],
        expiresAt:        row.expires_at as string | undefined,
        createdAt:        row.created_at as string,
    };
}

function mapPublishingJob(row: Record<string, unknown>): CBPublishingJob {
    return {
        id:             row.id as string,
        brandId:        row.brand_id as string,
        contentItemId:  row.content_item_id as string,
        platform:       row.platform as string,
        scheduledAt:    row.scheduled_at as string,
        status:         (row.status as string) as CBPublishingJob['status'],
        attempts:       (row.attempts as number) ?? 0,
        platformPostId: row.platform_post_id as string | undefined,
        platformUrl:    row.platform_url as string | undefined,
        publishedAt:    row.published_at as string | undefined,
        lastError:      row.last_error as string | undefined,
        createdAt:      row.created_at as string,
    };
}

function mapCaption(row: Record<string, unknown>): CBCaption {
    return {
        id:            row.id as string,
        brandId:       row.brand_id as string,
        contentItemId: row.content_item_id as string,
        platform:      (row.platform as string) ?? 'instagram',
        version:       (row.version as number) ?? 1,
        captionText:   row.caption_text as string,
        headline:      row.headline as string | undefined,
        hashtags:      (row.hashtags as string[]) ?? [],
        cta:           row.cta as string | undefined,
        altText:       row.alt_text as string | undefined,
        charCount:     (row.char_count as number) ?? 0,
        language:      (row.language as string) ?? 'ar',
        isSelected:    (row.is_selected as boolean) ?? false,
        createdAt:     row.created_at as string,
    };
}

function mapMediaAsset(row: Record<string, unknown>): CBMediaAsset {
    return {
        id:             row.id as string,
        brandId:        row.brand_id as string,
        contentItemId:  row.content_item_id as string | undefined,
        designPromptId: row.design_prompt_id as string | undefined,
        name:           (row.name as string) ?? 'Untitled',
        url:            row.url as string,
        type:           (row.type as string) ?? 'image',
        source:         (row.source as string) ?? 'ai',
        provider:       row.provider as string | undefined,
        aiScore:        row.ai_score as number | undefined,
        aspectRatio:    row.aspect_ratio as string | undefined,
        width:          row.width as number | undefined,
        height:         row.height as number | undefined,
        prompt:         row.prompt as string | undefined,
        tags:           (row.tags as string[]) ?? [],
        isSelected:     (row.is_selected as boolean) ?? false,
        createdAt:      row.created_at as string,
    };
}

// ── Captions ──────────────────────────────────────────────────────────────────

export async function getCaptions(contentItemId: string, platform?: string): Promise<CBCaption[]> {
    let q = supabase
        .from('captions')
        .select('*')
        .eq('content_item_id', contentItemId)
        .order('version', { ascending: true });
    if (platform) q = q.eq('platform', platform);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(mapCaption);
}

export async function createCaption(brandId: string, input: {
    contentItemId: string;
    platform: string;
    captionText: string;
    headline?: string;
    hashtags?: string[];
    cta?: string;
    altText?: string;
    language?: string;
    version?: number;
}): Promise<CBCaption> {
    const { data: existing } = await supabase
        .from('captions')
        .select('version')
        .eq('content_item_id', input.contentItemId)
        .eq('platform', input.platform)
        .order('version', { ascending: false })
        .limit(1);

    const nextVersion = input.version ?? ((existing?.[0]?.version ?? 0) + 1);

    const { data, error } = await supabase
        .from('captions')
        .insert({
            brand_id:        brandId,
            content_item_id: input.contentItemId,
            platform:        input.platform,
            version:         nextVersion,
            caption_text:    input.captionText,
            headline:        input.headline ?? null,
            hashtags:        input.hashtags ?? [],
            cta:             input.cta ?? null,
            alt_text:        input.altText ?? null,
            language:        input.language ?? 'ar',
            is_selected:     false,
        })
        .select()
        .single();
    if (error) throw error;
    return mapCaption(data);
}

export async function selectCaption(contentItemId: string, captionId: string, platform: string): Promise<void> {
    await supabase
        .from('captions')
        .update({ is_selected: false })
        .eq('content_item_id', contentItemId)
        .eq('platform', platform);
    const { error } = await supabase
        .from('captions')
        .update({ is_selected: true })
        .eq('id', captionId);
    if (error) throw error;
}

// ── Media Assets ──────────────────────────────────────────────────────────────

export async function getMediaAssets(contentItemId: string): Promise<CBMediaAsset[]> {
    const { data, error } = await supabase
        .from('media_assets')
        .select('*')
        .eq('content_item_id', contentItemId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapMediaAsset);
}

export async function createMediaAsset(brandId: string, input: {
    contentItemId?: string;
    designPromptId?: string;
    name?: string;
    url: string;
    type?: string;
    source?: string;
    provider?: string;
    aiScore?: number;
    aspectRatio?: string;
    prompt?: string;
    tags?: string[];
}): Promise<CBMediaAsset> {
    const { data, error } = await supabase
        .from('media_assets')
        .insert({
            brand_id:         brandId,
            content_item_id:  input.contentItemId ?? null,
            design_prompt_id: input.designPromptId ?? null,
            name:             input.name ?? 'Generated Asset',
            url:              input.url,
            type:             input.type ?? 'image',
            source:           input.source ?? 'ai',
            provider:         input.provider ?? null,
            ai_score:         input.aiScore ?? null,
            aspect_ratio:     input.aspectRatio ?? '1:1',
            prompt:           input.prompt ?? null,
            tags:             input.tags ?? [],
            is_selected:      false,
        })
        .select()
        .single();
    if (error) throw error;
    return mapMediaAsset(data);
}

export async function selectMediaAsset(contentItemId: string, assetId: string): Promise<void> {
    await supabase
        .from('media_assets')
        .update({ is_selected: false })
        .eq('content_item_id', contentItemId);
    const { error } = await supabase
        .from('media_assets')
        .update({ is_selected: true })
        .eq('id', assetId);
    if (error) throw error;
}

export async function updateMediaAssetScore(id: string, aiScore: number): Promise<void> {
    const { error } = await supabase
        .from('media_assets')
        .update({ ai_score: aiScore })
        .eq('id', id);
    if (error) throw error;
}

// ── Performance & Learnings ───────────────────────────────────────────────────

export async function getPublishedPostsForCampaign(campaignId: string): Promise<Array<{
    platformPostId: string;
    platform: string;
    reach: number;
    engagementRate: number;
    saves: number;
    clicks: number;
    profileVisits: number;
    publishedAt: string;
}>> {
    const { data, error } = await supabase
        .from('platform_posts')
        .select('platform_post_id, platform, reach, engagement_rate, saves, clicks, profile_visits, published_at, content_items!inner(campaign_id)')
        .eq('content_items.campaign_id', campaignId)
        .order('published_at', { ascending: false });
    if (error) return [];
    return (data ?? []).map((r: Record<string, unknown>) => ({
        platformPostId: r.platform_post_id as string,
        platform:       r.platform as string,
        reach:          (r.reach as number) ?? 0,
        engagementRate: (r.engagement_rate as number) ?? 0,
        saves:          (r.saves as number) ?? 0,
        clicks:         (r.clicks as number) ?? 0,
        profileVisits:  (r.profile_visits as number) ?? 0,
        publishedAt:    r.published_at as string,
    }));
}

export async function saveLearningsToBrandMemory(brandId: string, learnings: CBPerformanceLearning[]): Promise<void> {
    const rows = learnings.map(l => {
        const memType = l.type === 'success' ? 'high_performing_post'
                      : l.type === 'weakness' ? 'avoided_topic'
                      : 'audience_insight';
        const prefix = l.type === 'success' ? '✓' : l.type === 'weakness' ? '⚠' : '→';
        return {
            brand_id:    brandId,
            memory_type: memType,
            content:     `${prefix} ${l.text}`,
            context:     { source: 'campaign_brain_performance', timestamp: new Date().toISOString() },
            importance:  l.type === 'success' ? 8 : l.type === 'weakness' ? 7 : 6,
        };
    });
    if (rows.length > 0) {
        const { error } = await supabase.from('brand_memory').insert(rows);
        if (error) throw error;
    }
}

export async function getLearningsCount(brandId: string): Promise<number> {
    const { count } = await supabase
        .from('brand_memory')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .in('memory_type', ['high_performing_post', 'avoided_topic', 'audience_insight']);
    return count ?? 0;
}
