import { supabase } from './supabaseClient';

export type TodayPriority = {
    type: 'inbox' | 'approvals' | 'ad_alert';
    count: number;
    label: string;
    action: string;
    urgent: boolean;
};

export type TodayAdAlert = {
    id: string;
    name: string;
    roas: number | null;
    budget: number;
    spend: number;
};

export type TodayAiBrief = {
    opportunity: string;
    risk: string;
    recommendation: string;
    action: string;
};

export type TodaySummary = {
    brand: {
        id: string;
        name: string;
        logo_url: string | null;
    };
    stats: {
        unread_inbox: number;
        pending_approvals: number;
        ad_alerts: number;
        posts_today: number;
    };
    priorities: TodayPriority[];
    ad_alerts: TodayAdAlert[];
    ai_brief: TodayAiBrief | null;
};

export async function fetchTodaySummary(brandId: string): Promise<TodaySummary> {
    const { data, error } = await supabase.functions.invoke('today-summary', {
        body: { brand_id: brandId },
    });

    if (error) throw new Error(error.message ?? 'Failed to load today summary');
    if (!data) throw new Error('Empty response from today-summary');

    return data as TodaySummary;
}
