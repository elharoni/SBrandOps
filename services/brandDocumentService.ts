// services/brandDocumentService.ts
// مكتبة وثائق التعلم للبراند

import { supabase } from './supabaseClient';

export type BrandDocType =
    | 'brand_book'
    | 'sample_content'
    | 'competitor_analysis'
    | 'market_research'
    | 'style_guide'
    | 'other';

export const DOC_TYPE_LABELS: Record<BrandDocType, string> = {
    brand_book:           'كتاب البراند',
    sample_content:       'محتوى نموذجي',
    competitor_analysis:  'تحليل منافسين',
    market_research:      'بحث سوق',
    style_guide:          'دليل الأسلوب',
    other:                'أخرى',
};

export interface BrandDocument {
    id: string;
    brandId: string;
    title: string;
    docType: BrandDocType;
    content: string;
    charCount: number;
    fileName?: string;
    fileType?: string;
    analysisProvider?: string;
    analysisModel?: string;
    analysisJson?: Record<string, unknown>;
    detectedLanguage?: string;
    extractedSummary?: string;
    fieldsFound: Record<string, boolean | number>;
    completenessScore: number;
    memoryEntriesSaved: number;
    knowledgeEntriesSaved: number;
    createdAt: string;
    updatedAt?: string;
}

function mapRow(row: any): BrandDocument {
    return {
        id: row.id,
        brandId: row.brand_id,
        title: row.title,
        docType: (row.doc_type ?? 'other') as BrandDocType,
        content: row.content,
        charCount: row.char_count ?? 0,
        fileName: row.file_name ?? undefined,
        fileType: row.file_type ?? undefined,
        analysisProvider: row.analysis_provider ?? undefined,
        analysisModel: row.analysis_model ?? undefined,
        analysisJson: row.analysis_json ?? undefined,
        detectedLanguage: row.detected_language ?? undefined,
        extractedSummary: row.extracted_summary ?? undefined,
        fieldsFound: row.fields_found ?? {},
        completenessScore: row.completeness_score ?? 0,
        memoryEntriesSaved: row.memory_entries_saved ?? 0,
        knowledgeEntriesSaved: row.knowledge_entries_saved ?? 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at ?? undefined,
    };
}

export async function getBrandDocuments(brandId: string): Promise<BrandDocument[]> {
    const { data, error } = await supabase
        .from('brand_documents')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });

    if (error) {
        console.warn('[BrandDocuments] fetch error:', error.message);
        return [];
    }
    return (data ?? []).map(mapRow);
}

export async function addBrandDocument(
    brandId: string,
    doc: Pick<BrandDocument, 'title' | 'docType' | 'content' | 'extractedSummary' | 'fieldsFound' | 'completenessScore' | 'memoryEntriesSaved' | 'knowledgeEntriesSaved'> & {
        fileName?: string;
        fileType?: string;
        analysisProvider?: string;
        analysisModel?: string;
        analysisJson?: Record<string, unknown>;
        detectedLanguage?: string;
    },
): Promise<BrandDocument> {
    const { data, error } = await supabase
        .from('brand_documents')
        .insert({
            brand_id: brandId,
            title: doc.title,
            doc_type: doc.docType,
            content: doc.content,
            file_name: doc.fileName ?? null,
            file_type: doc.fileType ?? null,
            analysis_provider: doc.analysisProvider ?? null,
            analysis_model: doc.analysisModel ?? null,
            analysis_json: doc.analysisJson ?? null,
            detected_language: doc.detectedLanguage ?? null,
            extracted_summary: doc.extractedSummary ?? null,
            fields_found: doc.fieldsFound,
            completeness_score: doc.completenessScore,
            memory_entries_saved: doc.memoryEntriesSaved,
            knowledge_entries_saved: doc.knowledgeEntriesSaved,
        })
        .select()
        .single();

    if (error || !data) throw new Error(error?.message ?? 'Failed to save document');
    return mapRow(data);
}

export async function deleteBrandDocument(brandId: string, docId: string): Promise<void> {
    const { error } = await supabase
        .from('brand_documents')
        .delete()
        .eq('id', docId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}
