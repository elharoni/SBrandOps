// services/dbHealthService.ts
// Checks which database migrations have been applied by querying table existence.
import { supabase } from './supabaseClient';

export interface MigrationGroup {
    id: string;
    label: string;
    description: string;
    tables: string[];
    edgeFunctions?: string[];
    status?: 'applied' | 'missing' | 'partial' | 'checking';
    appliedCount?: number;
}

export const MIGRATION_GROUPS: MigrationGroup[] = [
    {
        id: '001-015',
        label: 'الجداول الأساسية (001–015)',
        description: 'brands, posts, analytics, team_members, oauth_tokens, cron jobs',
        tables: ['brands', 'posts', 'analytics_snapshots', 'team_members'],
    },
    {
        id: '016-017',
        label: 'CRM + Inbox (016–017)',
        description: 'customers, deals, conversations, inbox_items',
        tables: ['customers', 'deals', 'inbox_items'],
    },
    {
        id: '018-020',
        label: 'Marketing AI + SEO (018–020)',
        description: 'marketing_plans, seo_projects, performance indexes',
        tables: ['marketing_plans', 'seo_projects'],
    },
    {
        id: '021-029',
        label: 'Security + Storage (021–029)',
        description: 'encrypted oauth tokens, RLS fixes, media storage bucket, JSONB constraints',
        tables: ['oauth_tokens'],
    },
    {
        id: '030',
        label: 'Campaign Brain (030)',
        description: 'goals, campaigns, content_items, creative_briefs, design_prompts, approvals, publishing_jobs, platform_posts, performance_records, ai_feedback_logs',
        tables: ['goals', 'campaigns', 'content_items', 'creative_briefs', 'design_prompts', 'approvals', 'publishing_jobs', 'platform_posts', 'performance_records', 'ai_feedback_logs'],
        edgeFunctions: ['publish-content', 'analytics-learning'],
    },
    {
        id: '031',
        label: 'Brand Documents (031)',
        description: 'brand_documents — مكتبة الوثائق ومصادر ذكاء البراند',
        tables: ['brand_documents'],
    },
    {
        id: '032',
        label: 'Captions + Media Assets (032)',
        description: 'captions, media_assets — نسخ الكابشن وأصول التصميم',
        tables: ['captions', 'media_assets'],
    },
    {
        id: '033',
        label: 'Support Chat (033)',
        description: 'support_conversations, support_messages — نظام الدعم الفني',
        tables: ['support_conversations', 'support_messages'],
    },
];

async function tableExists(tableName: string): Promise<boolean> {
    // Try a minimal query — if the table doesn't exist Supabase returns a 42P01 error
    const { error } = await supabase
        .from(tableName)
        .select('id', { count: 'exact', head: true })
        .limit(0);
    // PGRST204 = no rows, which is fine. 42P01 = table doesn't exist.
    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) return false;
    return true;
}

export async function checkMigrationGroup(group: MigrationGroup): Promise<MigrationGroup> {
    const results = await Promise.all(group.tables.map(t => tableExists(t)));
    const appliedCount = results.filter(Boolean).length;
    const status: MigrationGroup['status'] =
        appliedCount === group.tables.length ? 'applied' :
        appliedCount === 0                   ? 'missing'  : 'partial';
    return { ...group, status, appliedCount };
}

export async function checkAllMigrations(): Promise<MigrationGroup[]> {
    return Promise.all(MIGRATION_GROUPS.map(g => checkMigrationGroup(g)));
}

export async function getOverallHealth(): Promise<{ applied: number; total: number; pct: number }> {
    const groups = await checkAllMigrations();
    const total = groups.length;
    const applied = groups.filter(g => g.status === 'applied').length;
    return { applied, total, pct: Math.round((applied / total) * 100) };
}
