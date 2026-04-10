import { AdsDashboardData, AdCampaign, CampaignStatus, AdPlatform, CampaignGoal } from '../types';
import { supabase } from './supabaseClient';

// --- Helper: Map DB row to AdCampaign ---
function mapToAdCampaign(row: any): AdCampaign {
    return {
        id: row.id,
        name: row.name,
        platform: row.platform as AdPlatform,
        status: row.status as CampaignStatus,
        budget: row.budget ?? 0,
        dailyBudget: row.daily_budget ?? undefined,
        goal: row.goal as CampaignGoal,
        startDate: new Date(row.start_date),
        endDate: new Date(row.end_date),
        metrics: {
            spend: row.spend ?? 0,
            roas: row.roas ?? 0,
            cpa: row.cpa ?? 0,
            ctr: row.ctr ?? 0,
            impressions: row.impressions ?? 0,
        },
        recommendation: row.recommendation ?? undefined,
        creatives: row.creatives ?? [],
    };
}

// --- Main Service Functions ---

export async function getAdCampaigns(brandId: string): Promise<AdCampaign[]> {
    try {
        const { data, error } = await supabase
            .from('ad_campaigns')
            .select('*')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapToAdCampaign);
    } catch (error) {
        console.warn('⚠️ Failed to fetch ad campaigns:', error);
        return [];
    }
}

export async function getAdsDashboardData(brandId: string): Promise<AdsDashboardData> {
    try {
        const { data: campaigns, error } = await supabase
            .from('ad_campaigns')
            .select('platform, spend, roas, impressions, conversions, created_at')
            .eq('brand_id', brandId);

        if (error) throw error;

        const totalSpend = (campaigns || []).reduce((sum, c) => sum + (c.spend ?? 0), 0);
        const totalImpressions = (campaigns || []).reduce((sum, c) => sum + (c.impressions ?? 0), 0);
        const totalConversions = (campaigns || []).reduce((sum, c) => sum + (c.conversions ?? 0), 0);
        const overallRoas = totalSpend > 0
            ? parseFloat(((campaigns || []).reduce((sum, c) => sum + ((c.roas ?? 0) * (c.spend ?? 0)), 0) / totalSpend).toFixed(2))
            : 0;

        // Spend grouped by platform
        const spendMap: Record<string, number> = {};
        (campaigns || []).forEach(c => {
            const plat = c.platform as AdPlatform;
            spendMap[plat] = (spendMap[plat] || 0) + (c.spend ?? 0);
        });

        const spendByPlatform = Object.entries(spendMap).map(([platform, spend]) => ({
            platform: platform as AdPlatform,
            spend,
        }));

        // Performance over time (weekly aggregation)
        const weekMap: Record<string, { spend: number; roasTotal: number; count: number }> = {};
        (campaigns || []).forEach(c => {
            const week = new Date(c.created_at).toISOString().split('T')[0].substring(0, 8) + '01'; // Month-week approx
            if (!weekMap[week]) weekMap[week] = { spend: 0, roasTotal: 0, count: 0 };
            weekMap[week].spend += c.spend ?? 0;
            weekMap[week].roasTotal += c.roas ?? 0;
            weekMap[week].count += 1;
        });

        const performanceOverTime = Object.entries(weekMap)
            .map(([date, data]) => ({
                date,
                spend: data.spend,
                roas: data.count > 0 ? parseFloat((data.roasTotal / data.count).toFixed(2)) : 0,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return {
            overallMetrics: {
                totalSpend,
                overallRoas,
                totalImpressions,
                totalConversions,
            },
            spendByPlatform,
            performanceOverTime,
        };
    } catch (error) {
        console.warn('⚠️ Failed to fetch ads dashboard data:', error);
        return {
            overallMetrics: { totalSpend: 0, overallRoas: 0, totalImpressions: 0, totalConversions: 0 },
            spendByPlatform: [],
            performanceOverTime: [],
        };
    }
}

export async function createAdCampaign(brandId: string, campaign: Omit<AdCampaign, 'id'>): Promise<AdCampaign> {
    const { data, error } = await supabase
        .from('ad_campaigns')
        .insert([{
            brand_id: brandId,
            name: campaign.name,
            platform: campaign.platform,
            status: campaign.status,
            budget: campaign.budget,
            daily_budget: campaign.dailyBudget,
            goal: campaign.goal,
            start_date: campaign.startDate.toISOString(),
            end_date: campaign.endDate.toISOString(),
            spend: campaign.metrics.spend,
            roas: campaign.metrics.roas,
            cpa: campaign.metrics.cpa,
            ctr: campaign.metrics.ctr,
            impressions: campaign.metrics.impressions,
            creatives: campaign.creatives,
        }])
        .select()
        .single();

    if (error) throw error;
    return mapToAdCampaign(data);
}

export async function updateAdCampaign(brandId: string, campaignId: string, updates: Partial<AdCampaign>): Promise<void> {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.budget !== undefined) dbUpdates.budget = updates.budget;
    if (updates.metrics) {
        dbUpdates.spend = updates.metrics.spend;
        dbUpdates.roas = updates.metrics.roas;
        dbUpdates.cpa = updates.metrics.cpa;
        dbUpdates.ctr = updates.metrics.ctr;
        dbUpdates.impressions = updates.metrics.impressions;
    }

    const { error } = await supabase
        .from('ad_campaigns')
        .update(dbUpdates)
        .eq('id', campaignId)
        .eq('brand_id', brandId);

    if (error) throw error;
}
