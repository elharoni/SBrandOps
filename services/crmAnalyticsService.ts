/**
 * CRM Analytics Service
 * Computes and retrieves:
 *  - RFM scores (Recency / Frequency / Monetary)
 *  - Retention cohorts (monthly)
 *  - Revenue by lifecycle segment
 *  - Churn trends (monthly)
 *  - Cross-sell / upsell opportunities
 */

import { supabase } from './supabaseClient';
import {
    CrmRfmScore, CrmRfmSegment,
    CrmRetentionCohort,
    CrmRevenueBySegment,
    CrmChurnTrend,
    CrmCrossSellOpportunity,
} from '../types';

// ── Row mappers ───────────────────────────────────────────────────────────────

function rowToRfm(row: Record<string, unknown>): CrmRfmScore {
    return {
        id:           row.id as string,
        brandId:      row.brand_id as string,
        customerId:   row.customer_id as string,
        recencyDays:  Number(row.recency_days ?? 0),
        frequency:    Number(row.frequency ?? 0),
        monetary:     Number(row.monetary ?? 0),
        rScore:       Number(row.r_score ?? 1),
        fScore:       Number(row.f_score ?? 1),
        mScore:       Number(row.m_score ?? 1),
        rfmScore:     Number(row.rfm_score ?? 3),
        rfmSegment:   (row.rfm_segment as CrmRfmSegment) ?? 'cant_lose',
        calculatedAt: row.calculated_at as string,
    };
}

function rowToCohort(row: Record<string, unknown>): CrmRetentionCohort {
    return {
        id:             row.id as string,
        brandId:        row.brand_id as string,
        cohortMonth:    row.cohort_month as string,
        periodNumber:   Number(row.period_number ?? 0),
        cohortSize:     Number(row.cohort_size ?? 0),
        retainedCount:  Number(row.retained_count ?? 0),
        retentionRate:  Number(row.retention_rate ?? 0),
        calculatedAt:   row.calculated_at as string,
    };
}

// ── RFM ───────────────────────────────────────────────────────────────────────

export async function getRfmScores(
    brandId: string,
    segment?: CrmRfmSegment
): Promise<CrmRfmScore[]> {
    try {
        let q = supabase
            .from('crm_rfm_scores')
            .select('*')
            .eq('brand_id', brandId)
            .order('rfm_score', { ascending: false });

        if (segment) q = q.eq('rfm_segment', segment);

        const { data, error } = await q;
        if (error || !data) return [];
        return data.map(r => rowToRfm(r as Record<string, unknown>));
    } catch {
        return MOCK_RFM_SCORES;
    }
}

export async function getRfmDistribution(
    brandId: string
): Promise<{ segment: CrmRfmSegment; count: number; label: string; color: string }[]> {
    try {
        const { data, error } = await supabase
            .from('crm_rfm_scores')
            .select('rfm_segment')
            .eq('brand_id', brandId);

        if (error || !data) return RFM_SEGMENT_META.map(m => ({ ...m, count: 0 }));

        const counts = new Map<CrmRfmSegment, number>();
        for (const row of data) {
            const seg = (row as Record<string, unknown>).rfm_segment as CrmRfmSegment;
            counts.set(seg, (counts.get(seg) ?? 0) + 1);
        }

        return RFM_SEGMENT_META.map(meta => ({
            ...meta,
            count: counts.get(meta.segment) ?? 0,
        }));
    } catch {
        return MOCK_RFM_DISTRIBUTION;
    }
}

/**
 * Compute RFM scores from raw orders and upsert into crm_rfm_scores.
 * Runs entirely client-side from the already-loaded customer+order data.
 */
export async function computeAndUpsertRfmScores(brandId: string): Promise<number> {
    try {
        // Aggregate per customer from crm_orders
        const { data: orders, error: ordErr } = await supabase
            .from('crm_orders')
            .select('customer_id, total, order_date, status')
            .eq('brand_id', brandId)
            .neq('status', 'cancelled')
            .neq('status', 'failed');

        if (ordErr || !orders) return 0;

        type Agg = { lastDate: string; count: number; total: number };
        const byCustomer = new Map<string, Agg>();

        for (const o of orders) {
            const row = o as Record<string, unknown>;
            const cid  = row.customer_id as string;
            const date = row.order_date as string ?? '';
            const tot  = Number(row.total ?? 0);
            const prev = byCustomer.get(cid);
            if (!prev) {
                byCustomer.set(cid, { lastDate: date, count: 1, total: tot });
            } else {
                byCustomer.set(cid, {
                    lastDate: date > prev.lastDate ? date : prev.lastDate,
                    count: prev.count + 1,
                    total: prev.total + tot,
                });
            }
        }

        if (byCustomer.size === 0) return 0;

        // Compute quartile thresholds for scoring
        const now = new Date();
        const recencies  = [...byCustomer.values()].map(a => Math.floor((now.getTime() - new Date(a.lastDate || now).getTime()) / 86_400_000));
        const frequencies = [...byCustomer.values()].map(a => a.count);
        const monetaries  = [...byCustomer.values()].map(a => a.total);

        const quantile = (arr: number[], q: number) => {
            const sorted = [...arr].sort((a, b) => a - b);
            const idx = Math.floor(sorted.length * q);
            return sorted[idx] ?? 0;
        };

        const rQ = [quantile(recencies, 0.8), quantile(recencies, 0.6), quantile(recencies, 0.4), quantile(recencies, 0.2)];
        const fQ = [quantile(frequencies, 0.2), quantile(frequencies, 0.4), quantile(frequencies, 0.6), quantile(frequencies, 0.8)];
        const mQ = [quantile(monetaries, 0.2), quantile(monetaries, 0.4), quantile(monetaries, 0.6), quantile(monetaries, 0.8)];

        const score5 = (val: number, q: number[], lowerIsBetter: boolean): number => {
            if (lowerIsBetter) {
                if (val <= q[0]) return 5;
                if (val <= q[1]) return 4;
                if (val <= q[2]) return 3;
                if (val <= q[3]) return 2;
                return 1;
            } else {
                if (val >= q[3]) return 5;
                if (val >= q[2]) return 4;
                if (val >= q[1]) return 3;
                if (val >= q[0]) return 2;
                return 1;
            }
        };

        const classifySegment = (r: number, f: number, m: number): CrmRfmSegment => {
            const avg = (r + f + m) / 3;
            if (r === 5 && f >= 4)                 return 'champions';
            if (r >= 4 && f >= 3 && m >= 3)        return 'loyal';
            if (r >= 3 && f >= 2 && m >= 2)        return 'potential_loyal';
            if (r >= 4 && f <= 1)                  return 'new_customers';
            if (r >= 3 && f <= 2)                  return 'promising';
            if (r === 3 && f >= 3)                 return 'need_attention';
            if (r === 2 && f >= 2)                 return 'about_to_sleep';
            if (r <= 2 && f >= 3 && m >= 3)        return 'at_risk';
            if (r <= 2 && f >= 4 && m >= 4)        return 'cant_lose';
            if (avg <= 1.5)                         return 'lost';
            return 'need_attention';
        };

        const upsertRows: Record<string, unknown>[] = [];
        for (const [customerId, agg] of byCustomer) {
            const recDays = Math.floor((now.getTime() - new Date(agg.lastDate || now).getTime()) / 86_400_000);
            const r = score5(recDays, rQ, true);
            const f = score5(agg.count, fQ, false);
            const m = score5(agg.total, mQ, false);
            upsertRows.push({
                brand_id:      brandId,
                customer_id:   customerId,
                recency_days:  recDays,
                frequency:     agg.count,
                monetary:      agg.total,
                r_score:       r,
                f_score:       f,
                m_score:       m,
                rfm_score:     r + f + m,
                rfm_segment:   classifySegment(r, f, m),
                calculated_at: now.toISOString(),
            });
        }

        // Batch upsert in chunks of 200
        const chunkSize = 200;
        for (let i = 0; i < upsertRows.length; i += chunkSize) {
            await supabase
                .from('crm_rfm_scores')
                .upsert(upsertRows.slice(i, i + chunkSize), { onConflict: 'brand_id,customer_id' });
        }

        return upsertRows.length;
    } catch {
        return 0;
    }
}

// ── Retention Cohorts ─────────────────────────────────────────────────────────

export async function getRetentionCohorts(brandId: string): Promise<CrmRetentionCohort[]> {
    try {
        const { data, error } = await supabase
            .from('crm_retention_cohorts')
            .select('*')
            .eq('brand_id', brandId)
            .order('cohort_month', { ascending: false })
            .order('period_number', { ascending: true });

        if (error || !data) return [];
        return data.map(r => rowToCohort(r as Record<string, unknown>));
    } catch {
        return MOCK_COHORTS;
    }
}

/**
 * Compute monthly retention cohorts from crm_orders and upsert.
 */
export async function computeAndUpsertCohorts(brandId: string): Promise<number> {
    try {
        const { data: orders, error } = await supabase
            .from('crm_orders')
            .select('customer_id, order_date')
            .eq('brand_id', brandId)
            .not('order_date', 'is', null);

        if (error || !orders) return 0;

        // Find first order month per customer
        const firstMonth = new Map<string, string>();
        for (const o of orders) {
            const row = o as Record<string, unknown>;
            const cid  = row.customer_id as string;
            const date = (row.order_date as string).slice(0, 7); // YYYY-MM
            if (!firstMonth.has(cid) || date < firstMonth.get(cid)!) {
                firstMonth.set(cid, date);
            }
        }

        // Build cohort → period → set of customers
        type CohortMap = Map<string, Map<number, Set<string>>>;
        const cohortMap: CohortMap = new Map();

        for (const o of orders) {
            const row = o as Record<string, unknown>;
            const cid  = row.customer_id as string;
            const mon  = (row.order_date as string).slice(0, 7);
            const cohort = firstMonth.get(cid);
            if (!cohort) continue;

            const [cy, cm] = cohort.split('-').map(Number);
            const [oy, om] = mon.split('-').map(Number);
            const period = (oy - cy) * 12 + (om - cm);

            if (!cohortMap.has(cohort)) cohortMap.set(cohort, new Map());
            const periods = cohortMap.get(cohort)!;
            if (!periods.has(period)) periods.set(period, new Set());
            periods.get(period)!.add(cid);
        }

        const upsertRows: Record<string, unknown>[] = [];
        for (const [cohort, periods] of cohortMap) {
            const cohortSize = periods.get(0)?.size ?? 0;
            if (cohortSize === 0) continue;
            for (const [period, customers] of periods) {
                upsertRows.push({
                    brand_id:       brandId,
                    cohort_month:   cohort,
                    period_number:  period,
                    cohort_size:    cohortSize,
                    retained_count: customers.size,
                    retention_rate: Math.round((customers.size / cohortSize) * 100 * 100) / 100,
                    calculated_at:  new Date().toISOString(),
                });
            }
        }

        const chunkSize = 200;
        for (let i = 0; i < upsertRows.length; i += chunkSize) {
            await supabase
                .from('crm_retention_cohorts')
                .upsert(upsertRows.slice(i, i + chunkSize), { onConflict: 'brand_id,cohort_month,period_number' });
        }

        return upsertRows.length;
    } catch {
        return 0;
    }
}

// ── Revenue by segment ────────────────────────────────────────────────────────

export async function getRevenueBySegment(brandId: string): Promise<CrmRevenueBySegment[]> {
    try {
        const { data, error } = await supabase
            .from('crm_customers')
            .select('lifecycle_stage, ltv')
            .eq('brand_id', brandId);

        if (error || !data) return [];

        type Acc = { revenue: number; count: number };
        const acc = new Map<string, Acc>();
        let grandTotal = 0;

        for (const row of data) {
            const r      = row as Record<string, unknown>;
            const seg    = (r.lifecycle_stage as string) ?? 'new';
            const ltv    = Number(r.ltv ?? 0);
            grandTotal  += ltv;
            const prev   = acc.get(seg) ?? { revenue: 0, count: 0 };
            acc.set(seg, { revenue: prev.revenue + ltv, count: prev.count + 1 });
        }

        return [...acc.entries()]
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .map(([segment, v]) => ({
                segment,
                revenue: v.revenue,
                customerCount: v.count,
                avgLtv: v.count > 0 ? v.revenue / v.count : 0,
                percentageOfTotal: grandTotal > 0 ? (v.revenue / grandTotal) * 100 : 0,
            }));
    } catch {
        return MOCK_REVENUE_BY_SEGMENT;
    }
}

// ── Churn trends ──────────────────────────────────────────────────────────────

export async function getChurnTrends(brandId: string, months = 12): Promise<CrmChurnTrend[]> {
    try {
        // Count customers whose lifecycle moved to 'churned' per month
        // Approximation: count customers with last_order_date in that month who are now 'churned'
        const { data, error } = await supabase
            .from('crm_customers')
            .select('lifecycle_stage, last_order_date, created_at')
            .eq('brand_id', brandId);

        if (error || !data) return [];

        const now = new Date();
        const trends: CrmChurnTrend[] = [];

        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
            const monthEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime();

            let totalAtStart = 0;
            let churned      = 0;

            for (const row of data) {
                const r         = row as Record<string, unknown>;
                const created   = new Date(r.created_at as string).getTime();
                const lastOrder = r.last_order_date ? new Date(r.last_order_date as string).getTime() : null;
                const stage     = r.lifecycle_stage as string;

                // Was active at start of month?
                if (created <= monthStart) totalAtStart++;

                // Churned if last order was in this month range and is now 'churned'
                if (lastOrder && lastOrder >= monthStart && lastOrder <= monthEnd && stage === 'churned') {
                    churned++;
                }
            }

            trends.push({
                month,
                churnedCount:  churned,
                churnRate:     totalAtStart > 0 ? Math.round((churned / totalAtStart) * 10000) / 100 : 0,
                totalAtStart,
            });
        }

        return trends;
    } catch {
        return MOCK_CHURN_TRENDS;
    }
}

// ── Cross-sell / Upsell Opportunities ────────────────────────────────────────

export async function getCrossSellOpportunities(brandId: string, limit = 20): Promise<CrmCrossSellOpportunity[]> {
    try {
        // Target: customers with 1–2 orders, high spend, not churned — prime upsell targets
        const { data, error } = await supabase
            .from('crm_customers')
            .select('id, first_name, last_name, email, lifecycle_stage, total_orders, ltv, last_order_date')
            .eq('brand_id', brandId)
            .lte('total_orders', 3)
            .gte('ltv', 500)
            .not('lifecycle_stage', 'eq', 'churned')
            .order('ltv', { ascending: false })
            .limit(limit);

        if (error || !data) return [];

        return data.map(row => {
            const r = row as Record<string, unknown>;
            const firstName = (r.first_name as string) ?? '';
            const lastName  = (r.last_name as string)  ?? '';
            const name      = [firstName, lastName].filter(Boolean).join(' ') || (r.email as string) || 'عميل';
            return {
                customerId:          r.id as string,
                customerName:        name,
                currentSegment:      (r.lifecycle_stage as string) ?? 'new',
                recommendedProducts: CROSS_SELL_RECOMMENDATIONS[(r.lifecycle_stage as string) ?? 'new'] ?? [],
                potentialValue:      Number(r.ltv ?? 0) * 1.5,
                lastOrderDate:       r.last_order_date as string | undefined,
            };
        });
    } catch {
        return MOCK_CROSS_SELL;
    }
}

// ── Top customers by segment ──────────────────────────────────────────────────

export async function getTopCustomersByRfm(
    brandId: string,
    segment: CrmRfmSegment,
    limit = 10
): Promise<{ customerId: string; name: string; rfmScore: number; monetary: number }[]> {
    try {
        const { data, error } = await supabase
            .from('crm_rfm_scores')
            .select('customer_id, rfm_score, monetary')
            .eq('brand_id', brandId)
            .eq('rfm_segment', segment)
            .order('rfm_score', { ascending: false })
            .limit(limit);

        if (error || !data) return [];

        // Enrich with customer names
        const ids = (data as Record<string, unknown>[]).map(r => r.customer_id as string);
        const { data: customers } = await supabase
            .from('crm_customers')
            .select('id, first_name, last_name, email')
            .in('id', ids);

        const nameMap = new Map<string, string>();
        for (const c of (customers ?? []) as Record<string, unknown>[]) {
            const n = [(c.first_name as string) ?? '', (c.last_name as string) ?? ''].filter(Boolean).join(' ')
                   || (c.email as string) || 'عميل';
            nameMap.set(c.id as string, n);
        }

        return (data as Record<string, unknown>[]).map(r => ({
            customerId: r.customer_id as string,
            name:       nameMap.get(r.customer_id as string) ?? 'عميل',
            rfmScore:   Number(r.rfm_score ?? 0),
            monetary:   Number(r.monetary ?? 0),
        }));
    } catch {
        return [];
    }
}

// ── Demographics ──────────────────────────────────────────────────────────────

export interface DemographicItem { label: string; count: number; percent: number }

export interface CrmDemographics {
    total: number;
    gender: DemographicItem[];
    ageGroups: DemographicItem[];
    languages: DemographicItem[];
    cities: DemographicItem[];
    consentRate: number;
}

export async function getCustomerDemographics(brandId: string): Promise<CrmDemographics | null> {
    try {
        const { data, error } = await supabase
            .from('crm_customers')
            .select('gender, birth_date, language, metadata, marketing_consent')
            .eq('brand_id', brandId);

        if (error) return null;
        if (!data || data.length === 0) return { total: 0, gender: [], ageGroups: [], languages: [], cities: [], consentRate: 0 };

        const now = new Date();
        const genderMap: Record<string, number> = {};
        const ageMap: Record<string, number> = { 'أقل من 18': 0, '18–24': 0, '25–34': 0, '35–44': 0, '45–54': 0, '55+': 0, 'غير محدد': 0 };
        const langMap: Record<string, number> = {};
        const cityMap: Record<string, number> = {};
        let consentCount = 0;
        const total = data.length;

        for (const row of data as Record<string, unknown>[]) {
            const gender = ((row.gender as string) || 'غير محدد').toLowerCase();
            const gLabel = gender === 'male' ? 'ذكر' : gender === 'female' ? 'أنثى' : gender === 'ذكر' || gender === 'أنثى' ? gender : 'غير محدد';
            genderMap[gLabel] = (genderMap[gLabel] ?? 0) + 1;

            const bd = row.birth_date as string | undefined;
            if (bd) {
                const age = now.getFullYear() - new Date(bd).getFullYear();
                if (age < 18)       ageMap['أقل من 18']++;
                else if (age < 25)  ageMap['18–24']++;
                else if (age < 35)  ageMap['25–34']++;
                else if (age < 45)  ageMap['35–44']++;
                else if (age < 55)  ageMap['45–54']++;
                else                ageMap['55+']++;
            } else {
                ageMap['غير محدد']++;
            }

            const lang = (row.language as string) || 'غير محدد';
            langMap[lang] = (langMap[lang] ?? 0) + 1;

            const meta = (row.metadata as Record<string, unknown>) ?? {};
            const city = (meta.city as string) || 'غير محدد';
            cityMap[city] = (cityMap[city] ?? 0) + 1;

            if (row.marketing_consent) consentCount++;
        }

        const toItems = (map: Record<string, number>): DemographicItem[] =>
            Object.entries(map)
                .filter(([, c]) => c > 0)
                .map(([label, count]) => ({ label, count, percent: Math.round((count / total) * 100) }))
                .sort((a, b) => b.count - a.count);

        return {
            total,
            gender:      toItems(genderMap),
            ageGroups:   Object.entries(ageMap).filter(([, c]) => c > 0).map(([label, count]) => ({ label, count, percent: Math.round((count / total) * 100) })),
            languages:   toItems(langMap).slice(0, 8),
            cities:      toItems(cityMap).slice(0, 10),
            consentRate: total > 0 ? Math.round((consentCount / total) * 100) : 0,
        };
    } catch {
        return null;
    }
}

// ── Marketing Attribution ─────────────────────────────────────────────────────

export interface AttributionItem {
    source: string;
    count: number;
    percent: number;
    totalSpent: number;
    avgLtv: number;
}

export interface CrmMarketingAttribution {
    bySource: AttributionItem[];
    byChannel: { channel: string; count: number; percent: number }[];
    consentRate: number;
    lifecycleBySource: { source: string; lead: number; active: number; vip: number; churned: number }[];
}

export async function getMarketingAttribution(brandId: string): Promise<CrmMarketingAttribution | null> {
    try {
        const { data, error } = await supabase
            .from('crm_customers')
            .select('acquisition_source, acquisition_channel, lifecycle_stage, total_spent, ltv, marketing_consent')
            .eq('brand_id', brandId);

        if (error) return null;
        if (!data || data.length === 0) return { bySource: [], byChannel: [], consentRate: 0, lifecycleBySource: [] };

        const total = data.length;
        const sourceMap: Record<string, { count: number; spent: number; ltv: number }> = {};
        const channelMap: Record<string, number> = {};
        const lifecycleBySource: Record<string, { lead: number; active: number; vip: number; churned: number }> = {};
        let consentCount = 0;

        for (const row of data as Record<string, unknown>[]) {
            const source  = (row.acquisition_source as string) || 'غير محدد';
            const channel = (row.acquisition_channel as string) || 'غير محدد';
            const stage   = (row.lifecycle_stage as string) || '';
            const spent   = Number(row.total_spent ?? 0);
            const ltv     = Number(row.ltv ?? 0);

            if (!sourceMap[source]) sourceMap[source] = { count: 0, spent: 0, ltv: 0 };
            sourceMap[source].count++;
            sourceMap[source].spent += spent;
            sourceMap[source].ltv   += ltv;

            channelMap[channel] = (channelMap[channel] ?? 0) + 1;

            if (!lifecycleBySource[source]) lifecycleBySource[source] = { lead: 0, active: 0, vip: 0, churned: 0 };
            if (stage === 'lead' || stage === 'prospect')             lifecycleBySource[source].lead++;
            else if (stage === 'active' || stage === 'repeat' || stage === 'first_purchase') lifecycleBySource[source].active++;
            else if (stage === 'vip')                                  lifecycleBySource[source].vip++;
            else if (stage === 'churned')                              lifecycleBySource[source].churned++;

            if (row.marketing_consent) consentCount++;
        }

        const bySource: AttributionItem[] = Object.entries(sourceMap)
            .map(([source, v]) => ({
                source,
                count:      v.count,
                percent:    Math.round((v.count / total) * 100),
                totalSpent: v.spent,
                avgLtv:     v.count > 0 ? Math.round(v.ltv / v.count) : 0,
            }))
            .sort((a, b) => b.count - a.count);

        const byChannel = Object.entries(channelMap)
            .map(([channel, count]) => ({ channel, count, percent: Math.round((count / total) * 100) }))
            .sort((a, b) => b.count - a.count);

        const lifecycleArr = Object.entries(lifecycleBySource)
            .map(([source, v]) => ({ source, ...v }))
            .sort((a, b) => (b.active + b.vip) - (a.active + a.vip))
            .slice(0, 6);

        return {
            bySource,
            byChannel,
            consentRate: total > 0 ? Math.round((consentCount / total) * 100) : 0,
            lifecycleBySource: lifecycleArr,
        };
    } catch {
        return null;
    }
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export const RFM_SEGMENT_META: { segment: CrmRfmSegment; label: string; labelAr: string; color: string; bg: string; description: string }[] = [
    { segment: 'champions',      label: 'Champions',       labelAr: 'أبطال',             color: 'text-purple-700', bg: 'bg-purple-100', description: 'Bought recently, buy often, spend the most' },
    { segment: 'loyal',          label: 'Loyal',           labelAr: 'مخلصون',            color: 'text-indigo-700', bg: 'bg-indigo-100', description: 'Regular buyers with high value' },
    { segment: 'potential_loyal',label: 'Potential Loyal', labelAr: 'مخلصون محتملون',   color: 'text-blue-700',   bg: 'bg-blue-100',   description: 'Recent customers with average frequency' },
    { segment: 'new_customers',  label: 'New Customers',   labelAr: 'عملاء جدد',         color: 'text-green-700',  bg: 'bg-green-100',  description: 'Just joined, first order recently' },
    { segment: 'promising',      label: 'Promising',       labelAr: 'واعدون',            color: 'text-teal-700',   bg: 'bg-teal-100',   description: 'Recent shoppers, haven\'t spent much yet' },
    { segment: 'need_attention', label: 'Need Attention',  labelAr: 'يحتاجون انتباهاً', color: 'text-yellow-700', bg: 'bg-yellow-100', description: 'Above average recency/frequency but need engagement' },
    { segment: 'about_to_sleep', label: 'About to Sleep',  labelAr: 'على وشك الاختفاء', color: 'text-orange-700', bg: 'bg-orange-100', description: 'Below-average recency, need re-engagement' },
    { segment: 'at_risk',        label: 'At Risk',         labelAr: 'في خطر',            color: 'text-red-700',    bg: 'bg-red-100',    description: 'Used to buy often but haven\'t recently' },
    { segment: 'cant_lose',      label: 'Can\'t Lose',     labelAr: 'لا يُفرَّط فيهم',  color: 'text-rose-700',   bg: 'bg-rose-100',   description: 'Made big purchases but not recently' },
    { segment: 'lost',           label: 'Lost',            labelAr: 'فقدناهم',           color: 'text-gray-600',   bg: 'bg-gray-100',   description: 'Lowest recency, frequency, and monetary' },
];

const CROSS_SELL_RECOMMENDATIONS: Record<string, string[]> = {
    new:            ['منتج مكمّل', 'عرض الترقية', 'حزمة القيمة'],
    active:         ['اشتراك متميز', 'إضافات VIP', 'كود خصم حصري'],
    vip:            ['منتج حصري', 'وصول مبكر', 'خدمة شخصية'],
    at_risk:        ['خصم إعادة تفعيل', 'عرض استرداد', 'هدية مجانية'],
    promising:      ['منتجات الأكثر مبيعاً', 'بكجات ذكية', 'كود خصم'],
    loyal:          ['برنامج الولاء', 'ترقية العضوية', 'منتجات حصرية'],
    churned:        ['كود استرداد 30%', 'رسالة إعادة تفعيل', 'عرض مميز'],
};

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_RFM_SCORES: CrmRfmScore[] = [];

const MOCK_RFM_DISTRIBUTION = RFM_SEGMENT_META.map((meta, i) => ({
    ...meta,
    count: [42, 38, 27, 15, 22, 18, 14, 11, 8, 5][i] ?? 0,
}));

const MOCK_COHORTS: CrmRetentionCohort[] = [
    { id: '1', brandId: '', cohortMonth: '2025-10', periodNumber: 0, cohortSize: 120, retainedCount: 120, retentionRate: 100, calculatedAt: '' },
    { id: '2', brandId: '', cohortMonth: '2025-10', periodNumber: 1, cohortSize: 120, retainedCount:  72, retentionRate:  60, calculatedAt: '' },
    { id: '3', brandId: '', cohortMonth: '2025-10', periodNumber: 2, cohortSize: 120, retainedCount:  48, retentionRate:  40, calculatedAt: '' },
    { id: '4', brandId: '', cohortMonth: '2025-11', periodNumber: 0, cohortSize:  95, retainedCount:  95, retentionRate: 100, calculatedAt: '' },
    { id: '5', brandId: '', cohortMonth: '2025-11', periodNumber: 1, cohortSize:  95, retainedCount:  52, retentionRate:  55, calculatedAt: '' },
    { id: '6', brandId: '', cohortMonth: '2025-12', periodNumber: 0, cohortSize: 140, retainedCount: 140, retentionRate: 100, calculatedAt: '' },
];

const MOCK_REVENUE_BY_SEGMENT: CrmRevenueBySegment[] = [
    { segment: 'vip',      revenue: 280_000, customerCount:  45, avgLtv: 6_222, percentageOfTotal: 40 },
    { segment: 'active',   revenue: 210_000, customerCount: 210, avgLtv: 1_000, percentageOfTotal: 30 },
    { segment: 'loyal',    revenue: 105_000, customerCount:  90, avgLtv: 1_167, percentageOfTotal: 15 },
    { segment: 'new',      revenue:  42_000, customerCount: 140, avgLtv:   300, percentageOfTotal:  6 },
    { segment: 'at_risk',  revenue:  35_000, customerCount:  70, avgLtv:   500, percentageOfTotal:  5 },
    { segment: 'churned',  revenue:  28_000, customerCount: 120, avgLtv:   233, percentageOfTotal:  4 },
];

const MOCK_CHURN_TRENDS: CrmChurnTrend[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - i));
    return {
        month:         `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        churnedCount:  Math.floor(Math.random() * 20) + 5,
        churnRate:     Math.round((Math.random() * 4 + 1) * 100) / 100,
        totalAtStart:  Math.floor(Math.random() * 200) + 300,
    };
});

const MOCK_CROSS_SELL: CrmCrossSellOpportunity[] = [
    { customerId: 'c1', customerName: 'محمد العلي',    currentSegment: 'new',      recommendedProducts: ['منتج مكمّل', 'عرض ترقية'], potentialValue: 2_400 },
    { customerId: 'c2', customerName: 'سارة القحطاني', currentSegment: 'promising', recommendedProducts: ['بكجات ذكية', 'كود خصم'],   potentialValue: 1_800 },
    { customerId: 'c3', customerName: 'خالد الرشيدي',  currentSegment: 'active',   recommendedProducts: ['اشتراك متميز', 'VIP'],      potentialValue: 5_100 },
];

const MOCK_DEMOGRAPHICS: CrmDemographics = {
    total: 1250,
    gender:    [{ label: 'ذكر', count: 720, percent: 58 }, { label: 'أنثى', count: 430, percent: 34 }, { label: 'غير محدد', count: 100, percent: 8 }],
    ageGroups: [{ label: '25–34', count: 480, percent: 38 }, { label: '35–44', count: 310, percent: 25 }, { label: '18–24', count: 220, percent: 18 }, { label: '45–54', count: 150, percent: 12 }, { label: '55+', count: 50, percent: 4 }, { label: 'غير محدد', count: 40, percent: 3 }],
    languages: [{ label: 'ar', count: 980, percent: 78 }, { label: 'en', count: 200, percent: 16 }, { label: 'غير محدد', count: 70, percent: 6 }],
    cities:    [{ label: 'الرياض', count: 450, percent: 36 }, { label: 'جدة', count: 280, percent: 22 }, { label: 'الدمام', count: 160, percent: 13 }, { label: 'مكة', count: 110, percent: 9 }, { label: 'غير محدد', count: 250, percent: 20 }],
    consentRate: 72,
};

const MOCK_MARKETING: CrmMarketingAttribution = {
    bySource: [
        { source: 'social',      count: 420, percent: 34, totalSpent: 840_000,  avgLtv: 2_000 },
        { source: 'organic',     count: 310, percent: 25, totalSpent: 680_000,  avgLtv: 2_194 },
        { source: 'paid',        count: 250, percent: 20, totalSpent: 500_000,  avgLtv: 2_000 },
        { source: 'email',       count: 150, percent: 12, totalSpent: 375_000,  avgLtv: 2_500 },
        { source: 'referral',    count:  80, percent:  6, totalSpent: 200_000,  avgLtv: 2_500 },
        { source: 'غير محدد',   count:  40, percent:  3, totalSpent:  40_000,  avgLtv: 1_000 },
    ],
    byChannel: [
        { channel: 'instagram', count: 380, percent: 30 },
        { channel: 'google',    count: 290, percent: 23 },
        { channel: 'facebook',  count: 210, percent: 17 },
        { channel: 'tiktok',    count: 140, percent: 11 },
        { channel: 'email',     count: 150, percent: 12 },
        { channel: 'غير محدد', count:  80, percent:  7 },
    ],
    consentRate: 72,
    lifecycleBySource: [
        { source: 'social',   lead: 80, active: 280, vip: 40, churned: 20 },
        { source: 'organic',  lead: 50, active: 210, vip: 30, churned: 20 },
        { source: 'paid',     lead: 90, active: 130, vip: 15, churned: 15 },
        { source: 'email',    lead: 10, active: 110, vip: 20, churned: 10 },
    ],
};
