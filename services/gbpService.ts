import { GBPData, GBPPost, GBPPostCTA, GBPQuestion, GBPReview } from '../types';
import { supabase } from './supabaseClient';

// --- Helpers ---
function buildEmptyGBPData(): GBPData {
    return {
        info: { name: '', address: '', phone: '', website: '' },
        posts: [],
        questions: [],
        reviews: [],
    };
}

// --- Main Service Functions ---

export async function getGBPData(brandId: string): Promise<GBPData> {
    try {
        const [infoResult, postsResult, questionsResult, reviewsResult] = await Promise.allSettled([
            supabase.from('gbp_info').select('*').eq('brand_id', brandId).single(),
            supabase.from('gbp_posts').select('*').eq('brand_id', brandId).order('created_at', { ascending: false }),
            supabase.from('gbp_questions').select('*').eq('brand_id', brandId).order('created_at', { ascending: false }),
            supabase.from('gbp_reviews').select('*').eq('brand_id', brandId).order('created_at', { ascending: false }),
        ]);

        const info = infoResult.status === 'fulfilled' && infoResult.value.data
            ? {
                name: infoResult.value.data.name || '',
                address: infoResult.value.data.address || '',
                phone: infoResult.value.data.phone || '',
                website: infoResult.value.data.website || '',
            }
            : buildEmptyGBPData().info;

        const posts: GBPPost[] = postsResult.status === 'fulfilled'
            ? (postsResult.value.data || []).map((p: any) => ({
                id: p.id,
                content: p.content,
                cta: p.cta as GBPPostCTA,
                createdAt: new Date(p.created_at),
                imageUrl: p.image_url,
            }))
            : [];

        const questions: GBPQuestion[] = questionsResult.status === 'fulfilled'
            ? (questionsResult.value.data || []).map((q: any) => ({
                id: q.id,
                questionText: q.question_text,
                author: q.author,
                answerText: q.answer_text,
            }))
            : [];

        const reviews: GBPReview[] = reviewsResult.status === 'fulfilled'
            ? (reviewsResult.value.data || []).map((r: any) => ({
                id: r.id,
                author: r.author,
                rating: r.rating,
                comment: r.comment,
                createdAt: new Date(r.created_at),
                reply: r.reply,
            }))
            : [];

        return { info, posts, questions, reviews };

    } catch (error) {
        console.warn('⚠️ GBP data fetch failed, returning empty state:', error);
        return buildEmptyGBPData();
    }
}

export async function updateGBPInfo(brandId: string, info: GBPData['info']): Promise<void> {
    const { error } = await supabase
        .from('gbp_info')
        .upsert({
            brand_id: brandId,
            name: info.name,
            address: info.address,
            phone: info.phone,
            website: info.website,
        }, { onConflict: 'brand_id' });

    if (error) throw error;
}

export async function addGBPPost(brandId: string, post: Omit<GBPPost, 'id' | 'createdAt' | 'imageUrl'>): Promise<GBPPost> {
    const { data, error } = await supabase
        .from('gbp_posts')
        .insert([{
            brand_id: brandId,
            content: post.content,
            cta: post.cta,
        }])
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        content: data.content,
        cta: data.cta as GBPPostCTA,
        createdAt: new Date(data.created_at),
    };
}

export async function answerGBPQuestion(brandId: string, questionId: string, answerText: string): Promise<GBPQuestion> {
    const { data, error } = await supabase
        .from('gbp_questions')
        .update({ answer_text: answerText })
        .eq('id', questionId)
        .eq('brand_id', brandId)
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        questionText: data.question_text,
        author: data.author,
        answerText: data.answer_text,
    };
}

export async function replyToGBPReview(brandId: string, reviewId: string, replyText: string): Promise<GBPReview> {
    const { data, error } = await supabase
        .from('gbp_reviews')
        .update({ reply: replyText })
        .eq('id', reviewId)
        .eq('brand_id', brandId)
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        author: data.author,
        rating: data.rating,
        comment: data.comment,
        createdAt: new Date(data.created_at),
        reply: data.reply,
    };
}
