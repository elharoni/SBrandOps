// services/mediaProjectService.ts
// Media Production Flow — خدمة إدارة مشاريع الميديا الإبداعية

import { supabase } from './supabaseClient';
import {
    MediaProject,
    MediaProjectSummary,
    MediaProjectPiece,
    MediaProjectReview,
    MediaCampaignInsight,
    CreativeBrief,
    IdeaMatrixAngle,
    MediaProjectGoal,
    MediaProjectOutputType,
    MediaProjectPriority,
    MediaProjectStatus,
    MediaPieceStatus,
    MediaReviewLevel,
    MediaReviewStatus,
} from '../types';

// ── Row Mappers ───────────────────────────────────────────────────────────────

function mapProject(row: any): MediaProject {
    return {
        id: row.id,
        brandId: row.brand_id,
        title: row.title,
        goal: row.goal as MediaProjectGoal,
        outputType: row.output_type as MediaProjectOutputType,
        campaign: row.campaign ?? undefined,
        productOffer: row.product_offer ?? undefined,
        cta: row.cta ?? undefined,
        platforms: row.platforms ?? [],
        deadline: row.deadline ?? undefined,
        priority: row.priority as MediaProjectPriority,
        status: row.status as MediaProjectStatus,
        brief: row.brief ?? null,
        ideaMatrix: row.idea_matrix ?? [],
        performance: row.performance ?? {},
        notes: row.notes ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapSummary(row: any): MediaProjectSummary {
    return {
        id: row.id,
        brandId: row.brand_id,
        title: row.title,
        goal: row.goal as MediaProjectGoal,
        outputType: row.output_type as MediaProjectOutputType,
        campaign: row.campaign ?? undefined,
        platforms: row.platforms ?? [],
        deadline: row.deadline ?? undefined,
        priority: row.priority as MediaProjectPriority,
        status: row.status as MediaProjectStatus,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        piecesCount: Number(row.pieces_count ?? 0),
        masterCount: Number(row.master_count ?? 0),
        approvedPieces: Number(row.approved_pieces ?? 0),
        pendingReviews: Number(row.pending_reviews ?? 0),
    };
}

function mapPiece(row: any): MediaProjectPiece {
    return {
        id: row.id,
        projectId: row.project_id,
        brandId: row.brand_id,
        isMaster: row.is_master ?? false,
        variantOf: row.variant_of ?? undefined,
        title: row.title,
        content: row.content ?? '',
        track: row.track ?? undefined,
        format: row.format ?? undefined,
        angle: row.angle ?? undefined,
        hook: row.hook ?? undefined,
        script: row.script ?? undefined,
        platform: row.platform ?? undefined,
        variantLabel: row.variant_label ?? undefined,
        status: row.status as MediaPieceStatus,
        notes: row.notes ?? undefined,
        publishedPostId: row.published_post_id ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapReview(row: any): MediaProjectReview {
    return {
        id: row.id,
        projectId: row.project_id,
        brandId: row.brand_id,
        pieceId: row.piece_id ?? undefined,
        reviewLevel: row.review_level as MediaReviewLevel,
        status: row.status as MediaReviewStatus,
        reviewerName: row.reviewer_name ?? undefined,
        comment: row.comment ?? undefined,
        createdAt: row.created_at,
    };
}

// ── Projects — Read ───────────────────────────────────────────────────────────

export async function getMediaProjects(brandId: string): Promise<MediaProjectSummary[]> {
    if (!brandId) return [];
    const { data, error } = await supabase
        .from('media_project_summary')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapSummary);
}

export async function getMediaProject(projectId: string): Promise<MediaProject> {
    const { data, error } = await supabase
        .from('media_projects')
        .select('*')
        .eq('id', projectId)
        .single();
    if (error) throw error;
    return mapProject(data);
}

// ── Projects — Write ──────────────────────────────────────────────────────────

export interface CreateMediaProjectInput {
    brandId: string;
    title: string;
    goal: MediaProjectGoal;
    outputType: MediaProjectOutputType;
    campaign?: string;
    productOffer?: string;
    cta?: string;
    platforms?: string[];
    deadline?: string;
    priority?: MediaProjectPriority;
    notes?: string;
}

export async function createMediaProject(input: CreateMediaProjectInput): Promise<MediaProject> {
    const { data, error } = await supabase
        .from('media_projects')
        .insert({
            brand_id: input.brandId,
            title: input.title,
            goal: input.goal,
            output_type: input.outputType,
            campaign: input.campaign ?? null,
            product_offer: input.productOffer ?? null,
            cta: input.cta ?? null,
            platforms: input.platforms ?? [],
            deadline: input.deadline ?? null,
            priority: input.priority ?? 'normal',
            notes: input.notes ?? null,
            status: 'request',
        })
        .select()
        .single();
    if (error) throw error;
    return mapProject(data);
}

export async function updateMediaProject(
    projectId: string,
    updates: Partial<{
        title: string;
        status: MediaProjectStatus;
        brief: CreativeBrief | null;
        ideaMatrix: IdeaMatrixAngle[];
        priority: MediaProjectPriority;
        deadline: string;
        notes: string;
        performance: Record<string, unknown>;
        campaign: string;
        productOffer: string;
        cta: string;
        platforms: string[];
    }>,
): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (updates.title !== undefined)        payload.title = updates.title;
    if (updates.status !== undefined)       payload.status = updates.status;
    if (updates.brief !== undefined)        payload.brief = updates.brief;
    if (updates.ideaMatrix !== undefined)   payload.idea_matrix = updates.ideaMatrix;
    if (updates.priority !== undefined)     payload.priority = updates.priority;
    if (updates.deadline !== undefined)     payload.deadline = updates.deadline;
    if (updates.notes !== undefined)        payload.notes = updates.notes;
    if (updates.performance !== undefined)  payload.performance = updates.performance;
    if (updates.campaign !== undefined)     payload.campaign = updates.campaign;
    if (updates.productOffer !== undefined) payload.product_offer = updates.productOffer;
    if (updates.cta !== undefined)          payload.cta = updates.cta;
    if (updates.platforms !== undefined)    payload.platforms = updates.platforms;

    const { error } = await supabase
        .from('media_projects')
        .update(payload)
        .eq('id', projectId);
    if (error) throw error;
}

export async function deleteMediaProject(projectId: string): Promise<void> {
    const { error } = await supabase
        .from('media_projects')
        .delete()
        .eq('id', projectId);
    if (error) throw error;
}

// ── Pieces — Read ─────────────────────────────────────────────────────────────

export async function getProjectPieces(projectId: string): Promise<MediaProjectPiece[]> {
    const { data, error } = await supabase
        .from('media_project_pieces')
        .select('*')
        .eq('project_id', projectId)
        .order('is_master', { ascending: false })
        .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapPiece);
}

// ── Pieces — Write ────────────────────────────────────────────────────────────

export interface CreatePieceInput {
    projectId: string;
    brandId: string;
    title: string;
    isMaster?: boolean;
    variantOf?: string;
    track?: string;
    format?: string;
    angle?: string;
    hook?: string;
    script?: string;
    platform?: string;
    variantLabel?: string;
    content?: string;
    notes?: string;
}

export async function createProjectPiece(input: CreatePieceInput): Promise<MediaProjectPiece> {
    const { data, error } = await supabase
        .from('media_project_pieces')
        .insert({
            project_id: input.projectId,
            brand_id: input.brandId,
            title: input.title,
            is_master: input.isMaster ?? false,
            variant_of: input.variantOf ?? null,
            track: input.track ?? null,
            format: input.format ?? null,
            angle: input.angle ?? null,
            hook: input.hook ?? null,
            script: input.script ?? null,
            platform: input.platform ?? null,
            variant_label: input.variantLabel ?? null,
            content: input.content ?? '',
            notes: input.notes ?? null,
            status: 'draft',
        })
        .select()
        .single();
    if (error) throw error;
    return mapPiece(data);
}

export async function updateProjectPiece(
    pieceId: string,
    updates: Partial<{
        title: string;
        content: string;
        status: MediaPieceStatus;
        script: string;
        hook: string;
        notes: string;
        isMaster: boolean;
        publishedPostId: string;
    }>,
): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (updates.title !== undefined)           payload.title = updates.title;
    if (updates.content !== undefined)         payload.content = updates.content;
    if (updates.status !== undefined)          payload.status = updates.status;
    if (updates.script !== undefined)          payload.script = updates.script;
    if (updates.hook !== undefined)            payload.hook = updates.hook;
    if (updates.notes !== undefined)           payload.notes = updates.notes;
    if (updates.isMaster !== undefined)        payload.is_master = updates.isMaster;
    if (updates.publishedPostId !== undefined) payload.published_post_id = updates.publishedPostId;

    const { error } = await supabase
        .from('media_project_pieces')
        .update(payload)
        .eq('id', pieceId);
    if (error) throw error;
}

// ── Reviews — Read ────────────────────────────────────────────────────────────

export async function getProjectReviews(projectId: string): Promise<MediaProjectReview[]> {
    const { data, error } = await supabase
        .from('media_project_reviews')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapReview);
}

// ── Reviews — Write ───────────────────────────────────────────────────────────

export async function addProjectReview(
    projectId: string,
    brandId: string,
    review: {
        reviewLevel: MediaReviewLevel;
        status: MediaReviewStatus;
        reviewerName?: string;
        comment?: string;
        pieceId?: string;
    },
): Promise<MediaProjectReview> {
    const { data, error } = await supabase
        .from('media_project_reviews')
        .insert({
            project_id: projectId,
            brand_id: brandId,
            piece_id: review.pieceId ?? null,
            review_level: review.reviewLevel,
            status: review.status,
            reviewer_name: review.reviewerName ?? null,
            comment: review.comment ?? null,
        })
        .select()
        .single();
    if (error) throw error;
    return mapReview(data);
}

// ── Status Helpers ────────────────────────────────────────────────────────────

export const PROJECT_STATUS_ORDER: MediaProjectStatus[] = [
    'request', 'brief', 'matrix', 'production', 'review', 'approved', 'published',
];

export function getNextStatus(current: MediaProjectStatus): MediaProjectStatus | null {
    const idx = PROJECT_STATUS_ORDER.indexOf(current);
    if (idx === -1 || idx >= PROJECT_STATUS_ORDER.length - 1) return null;
    return PROJECT_STATUS_ORDER[idx + 1];
}

export const STATUS_LABELS: Record<MediaProjectStatus, { ar: string; en: string; color: string }> = {
    request:    { ar: 'طلب',        en: 'Request',    color: 'text-gray-400 bg-gray-400/10' },
    brief:      { ar: 'بريف',       en: 'Brief',      color: 'text-blue-400 bg-blue-400/10' },
    matrix:     { ar: 'أفكار',      en: 'Matrix',     color: 'text-purple-400 bg-purple-400/10' },
    production: { ar: 'إنتاج',      en: 'Production', color: 'text-amber-400 bg-amber-400/10' },
    review:     { ar: 'مراجعة',     en: 'Review',     color: 'text-orange-400 bg-orange-400/10' },
    approved:   { ar: 'مُعتمد',     en: 'Approved',   color: 'text-emerald-400 bg-emerald-400/10' },
    published:  { ar: 'منشور',      en: 'Published',  color: 'text-green-400 bg-green-400/10' },
    archived:   { ar: 'أرشيف',      en: 'Archived',   color: 'text-gray-500 bg-gray-500/10' },
};

export const GOAL_LABELS: Record<string, { ar: string; en: string; icon: string }> = {
    awareness:   { ar: 'رفع الوعي',        en: 'Awareness',   icon: 'fa-bullhorn' },
    engagement:  { ar: 'رفع التفاعل',      en: 'Engagement',  icon: 'fa-comments' },
    conversion:  { ar: 'تحويل وبيع',       en: 'Conversion',  icon: 'fa-dollar-sign' },
    leads:       { ar: 'توليد عملاء',      en: 'Leads',       icon: 'fa-user-plus' },
    retention:   { ar: 'تحفيز العودة',     en: 'Retention',   icon: 'fa-rotate-left' },
    traffic:     { ar: 'زيادة الزيارات',   en: 'Traffic',     icon: 'fa-arrow-trend-up' },
};

export const OUTPUT_TYPE_LABELS: Record<string, { ar: string; en: string; icon: string }> = {
    static:   { ar: 'تصميم ثابت',   en: 'Static',   icon: 'fa-image' },
    carousel: { ar: 'كاروسيل',      en: 'Carousel', icon: 'fa-images' },
    reel:     { ar: 'ريل / فيديو',  en: 'Reel',     icon: 'fa-film' },
    story:    { ar: 'ستوري',        en: 'Story',    icon: 'fa-circle-notch' },
    ad:       { ar: 'إعلان',        en: 'Ad',       icon: 'fa-rectangle-ad' },
    motion:   { ar: 'موشن جرافيك', en: 'Motion',   icon: 'fa-wand-magic-sparkles' },
    mixed:    { ar: 'متعدد',        en: 'Mixed',    icon: 'fa-layer-group' },
};

// ── Learning Loop — Campaign Insights ─────────────────────────────────────────

function mapInsight(row: any): MediaCampaignInsight {
    return {
        id: row.id,
        projectId: row.project_id,
        brandId: row.brand_id,
        whatWorked: row.what_worked ?? '',
        whatToImprove: row.what_to_improve ?? '',
        nextCampaignRecommendation: row.next_campaign_recommendation ?? '',
        creativeScore: row.creative_score ?? 0,
        piecesSummary: row.pieces_summary ?? [],
        generatedAt: row.generated_at,
        createdAt: row.created_at,
    };
}

export async function getProjectInsights(projectId: string): Promise<MediaCampaignInsight | null> {
    const { data, error } = await supabase
        .from('media_campaign_insights')
        .select('*')
        .eq('project_id', projectId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data ? mapInsight(data) : null;
}

export async function saveProjectInsights(
    projectId: string,
    brandId: string,
    insight: {
        whatWorked: string;
        whatToImprove: string;
        nextCampaignRecommendation: string;
        creativeScore: number;
        piecesSummary: Array<{ id: string; title: string; format?: string; status: string }>;
    },
): Promise<MediaCampaignInsight> {
    const { data, error } = await supabase
        .from('media_campaign_insights')
        .insert({
            project_id: projectId,
            brand_id: brandId,
            what_worked: insight.whatWorked,
            what_to_improve: insight.whatToImprove,
            next_campaign_recommendation: insight.nextCampaignRecommendation,
            creative_score: insight.creativeScore,
            pieces_summary: insight.piecesSummary,
        })
        .select()
        .single();
    if (error) throw error;
    return mapInsight(data);
}
