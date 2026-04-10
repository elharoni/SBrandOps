// services/contentOpsService.ts
import { ContentPiece, ContentStatus, Comment } from '../types';
import { supabase } from './supabaseClient';

export async function getContentPipeline(brandId: string): Promise<ContentPiece[]> {
    const { data, error } = await supabase
        .from('content_pieces')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching content pipeline:', error);
        return [];
    }

    return data.map((item: any) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        status: item.status as ContentStatus,
        generatedContent: item.generated_content,
        assignee: item.assignee_id, // In a real app, we'd join with users table
        dueDate: item.due_date ?? undefined,
        comments: [], // Comments would be in a separate table in a full implementation
        media: [] // Media would be in a separate table or array column
    }));
}

export async function addContentPiece(brandId: string, piece: Omit<ContentPiece, 'id' | 'comments' | 'media'>): Promise<ContentPiece> {
    const { data, error } = await supabase
        .from('content_pieces')
        .insert([{
            brand_id: brandId,
            title: piece.title,
            type: piece.type,
            status: piece.status,
            generated_content: piece.generatedContent,
            due_date: piece.dueDate,
            assignee_id: piece.assignee
        }])
        .select()
        .single();

    if (error) {
        console.error('Error adding content piece:', error);
        throw error;
    }

    return {
        id: data.id,
        title: data.title,
        type: data.type,
        status: data.status as ContentStatus,
        generatedContent: data.generated_content,
        assignee: data.assignee_id,
        dueDate: data.due_date ?? undefined,
        comments: [],
        media: []
    };
}

export async function updateContentPiece(brandId: string, pieceId: string, updates: Partial<ContentPiece>): Promise<void> {
    const dbUpdates: any = {};
    if (updates.title) dbUpdates.title = updates.title;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.generatedContent) dbUpdates.generated_content = updates.generatedContent;
    if (updates.dueDate) dbUpdates.due_date = updates.dueDate;

    const { error } = await supabase
        .from('content_pieces')
        .update(dbUpdates)
        .eq('id', pieceId)
        .eq('brand_id', brandId);

    if (error) {
        console.error('Error updating content piece:', error);
        throw error;
    }
}

export async function deleteContentPiece(brandId: string, pieceId: string): Promise<void> {
    const { error } = await supabase
        .from('content_pieces')
        .delete()
        .eq('id', pieceId)
        .eq('brand_id', brandId);

    if (error) {
        console.error('Error deleting content piece:', error);
        throw error;
    }
}

export async function addComment(brandId: string, pieceId: string, comment: Comment): Promise<void> {
    // For now, comments are not in the schema to keep it simple.
    // In a full implementation, we would insert into a 'comments' table.
    console.log('Adding comment (not persisted yet):', comment);
}