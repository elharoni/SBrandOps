// services/workflowService.ts — Real Supabase Implementation
import { supabase } from './supabaseClient';
import { Workflow } from '../types';

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapRowToWorkflow(row: any): Workflow {
    return {
        id: row.id,
        name: row.name,
        description: row.description || '',
        trigger: row.trigger_type,
        steps: Array.isArray(row.steps) ? row.steps : [],
    };
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getWorkflows(brandId: string): Promise<Workflow[]> {
    const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('getWorkflows error:', error);
        return [];
    }
    return (data || []).map(mapRowToWorkflow);
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createWorkflow(
    brandId: string,
    workflow: Omit<Workflow, 'id'>
): Promise<Workflow> {
    const { data, error } = await supabase
        .from('workflows')
        .insert({
            brand_id: brandId,
            name: workflow.name,
            description: workflow.description,
            trigger_type: workflow.trigger,
            is_active: true,
            steps: workflow.steps,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return mapRowToWorkflow(data);
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateWorkflow(
    brandId: string,
    workflowId: string,
    updates: Partial<Omit<Workflow, 'id'>>
): Promise<Workflow> {
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined)        payload.name         = updates.name;
    if (updates.description !== undefined) payload.description  = updates.description;
    if (updates.trigger !== undefined)     payload.trigger_type = updates.trigger;
    if (updates.steps !== undefined)       payload.steps        = updates.steps;

    const { data, error } = await supabase
        .from('workflows')
        .update(payload)
        .eq('id', workflowId)
        .eq('brand_id', brandId)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return mapRowToWorkflow(data);
}

// ── Toggle Active ─────────────────────────────────────────────────────────────

export async function toggleWorkflowActive(
    brandId: string,
    workflowId: string,
    isActive: boolean
): Promise<void> {
    const { error } = await supabase
        .from('workflows')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', workflowId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteWorkflow(brandId: string, workflowId: string): Promise<void> {
    const { error } = await supabase
        .from('workflows')
        .delete()
        .eq('id', workflowId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}
