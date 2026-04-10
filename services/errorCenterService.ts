import { OperationalError, ErrorSeverity, ErrorSource, ErrorStatus } from '../types';
import { supabase } from './supabaseClient';

// ── Mapper ────────────────────────────────────────────────────────────────────
function mapRowToError(row: any): OperationalError {
    return {
        id: row.id,
        title: row.title,
        description: row.description || '',
        severity: (row.severity as ErrorSeverity) || ErrorSeverity.Warning,
        source: (row.source as ErrorSource) || ErrorSource.SocialOps,
        timestamp: new Date(row.created_at),
        resolutionLink: row.resolution_link || undefined,
        status: (row.status as ErrorStatus) || ErrorStatus.New,
    };
}

// ── Read ──────────────────────────────────────────────────────────────────────
export async function getErrors(brandId: string): Promise<OperationalError[]> {
    try {
        const { data, error } = await supabase
            .from('operational_errors')
            .select('*')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('⚠️ getErrors fallback to empty (table may not exist):', error.message);
            return [];
        }

        return (data || []).map(mapRowToError);
    } catch (err) {
        console.warn('⚠️ getErrors failed:', err);
        return [];
    }
}

// ── Create (log a new error) ──────────────────────────────────────────────────
export async function logOperationalError(
    brandId: string,
    err: Omit<OperationalError, 'id' | 'timestamp' | 'status'>
): Promise<void> {
    try {
        await supabase.from('operational_errors').insert({
            brand_id: brandId,
            title: err.title,
            description: err.description,
            severity: err.severity,
            source: err.source,
            resolution_link: err.resolutionLink,
            status: ErrorStatus.New,
        });
    } catch (e) {
        console.warn('⚠️ Failed to log operational error:', e);
    }
}

// ── Update status ─────────────────────────────────────────────────────────────
export async function updateErrorStatus(
    brandId: string,
    errorId: string,
    status: ErrorStatus
): Promise<void> {
    const { error } = await supabase
        .from('operational_errors')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', errorId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}