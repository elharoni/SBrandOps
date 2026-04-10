/**
 * seoIntelligenceService.ts
 * ─────────────────────────────────────────────────────────────────────────
 * SEO Operating System — Intelligence Layer
 *
 * Responsibilities:
 *   1. Page Inventory — CRUD for seo_pages
 *   2. Keyword Ops    — clusters + keyword_map CRUD + gap detection
 *   3. Issue Tracker  — create / update / resolve + auto-detection
 *   4. Opportunities  — low CTR, ranking gap, decay, cannibalization
 *   5. Content Briefs — CRUD + pipeline queries
 *   6. Change Log     — record changes + measure impact
 *   7. Publish QA     — pre/post publish checklist
 *   8. Overview KPIs  — aggregated from fact tables (no live API)
 *
 * ALL reads are from local fact tables — NEVER calls external APIs directly.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { supabase } from './supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type PageType = 'homepage' | 'category' | 'product' | 'blog' | 'landing' | 'tag' | 'author' | 'other';
export type IssueType = 'technical' | 'on-page' | 'content' | 'internal-linking' | 'schema' | 'speed' | 'indexation';
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IssueStatus = 'open' | 'in-progress' | 'resolved' | 'ignored' | 'wont-fix';
export type MappingStatus = 'mapped' | 'candidate' | 'gap' | 'cannibal' | 'orphan' | 'won' | 'lost';
export type SearchIntent = 'informational' | 'navigational' | 'commercial' | 'transactional';
export type ChangeType = 'title' | 'meta' | 'h1' | 'content' | 'internal-links' | 'canonical' | 'speed' | 'schema' | 'robots-txt' | 'sitemap' | 'redirect' | 'technical';
export type BriefStatus = 'draft' | 'in-review' | 'approved' | 'assigned' | 'in-progress' | 'published';

export interface SeoMarket {
    id:             string;
    brandId:        string;
    websiteId:      string | null;
    marketName:     string;
    countryCode:    string | null;
    languageCode:   string | null;
    primaryDomain:  string | null;
    hreflang:       string | null;
    isPrimary:      boolean;
    status:         string;
    createdAt:      string;
}

export interface SeoPage {
    id:                 string;
    brandId:            string;
    websiteId:          string | null;
    marketId:           string | null;
    url:                string;
    pageType:           PageType;
    template:           string | null;
    title:              string | null;
    metaDescription:    string | null;
    h1:                 string | null;
    canonicalUrl:       string | null;
    isIndexable:        boolean;
    hasNoindex:         boolean;
    inSitemap:          boolean | null;
    statusCode:         number | null;
    wordCount:          number | null;
    internalLinksIn:    number;
    clicks30d:          number;
    impressions30d:     number;
    ctr30d:             number;
    avgPosition30d:     number | null;
    lastAuditedAt:      string | null;
    auditScore:         number | null;
    createdAt:          string;
    updatedAt:          string;
}

export interface SeoKeywordCluster {
    id:             string;
    brandId:        string;
    marketId:       string | null;
    clusterName:    string;
    topic:          string | null;
    primaryKeyword: string;
    intent:         SearchIntent;
    pillarPageId:   string | null;
    status:         string;
    notes:          string | null;
    createdAt:      string;
}

export interface SeoKeywordMapping {
    id:                 string;
    brandId:            string;
    clusterId:          string | null;
    marketId:           string | null;
    keyword:            string;
    intent:             SearchIntent;
    isBranded:          boolean;
    monthlyVolume:      number | null;
    difficulty:         number | null;
    targetPageId:       string | null;
    targetUrl:          string | null;
    currentPosition:    number | null;
    impressions30d:     number;
    clicks30d:          number;
    ctr30d:             number;
    positionDelta:      number | null;
    mappingStatus:      MappingStatus;
    cannibalizationUrl: string | null;
    opportunityScore:   number | null;
    notes:              string | null;
    lastSyncedAt:       string | null;
    createdAt:          string;
}

export interface SeoIssue {
    id:                 string;
    brandId:            string;
    websiteId:          string | null;
    pageId:             string | null;
    issueType:          IssueType;
    category:           string | null;
    title:              string;
    description:        string | null;
    affectedUrl:        string | null;
    affectedCount:      number;
    severity:           IssueSeverity;
    businessImpact:     string | null;
    status:             IssueStatus;
    assigneeUserId:     string | null;
    dueDate:            string | null;
    detectedAt:         string;
    resolvedAt:         string | null;
    resolutionNotes:    string | null;
    autoDetected:       boolean;
    detectionSource:    string | null;
    createdAt:          string;
}

export interface SeoContentBrief {
    id:                     string;
    brandId:                string;
    pageId:                 string | null;
    clusterId:              string | null;
    targetKeyword:          string;
    secondaryKeywords:      string[];
    searchIntent:           SearchIntent;
    contentType:            string;
    wordCountTarget:        number;
    suggestedTitle:         string | null;
    suggestedMeta:          string | null;
    h2Suggestions:          Array<{ text: string; angle?: string; keyword?: string }>;
    entities:               Array<{ entity: string; type?: string; importance?: string }>;
    faqSuggestions:         Array<{ question: string; answer_hint?: string }>;
    internalLinksSuggestions: Array<{ anchor: string; target_url: string; reason?: string }>;
    schemaType:             string | null;
    competitorUrls:         string[];
    status:                 BriefStatus;
    priority:               string;
    dueDate:                string | null;
    aiGenerated:            boolean;
    createdAt:              string;
    updatedAt:              string;
    // Joined
    clusterName?:           string;
    targetUrl?:             string;
}

export interface SeoChangeLog {
    id:                     string;
    brandId:                string;
    pageId:                 string | null;
    issueId:                string | null;
    changeType:             ChangeType;
    description:            string;
    changedUrl:             string | null;
    changedAt:              string;
    baselineClicks:         number | null;
    baselineImpressions:    number | null;
    baselinePosition:       number | null;
    postClicks:             number | null;
    postImpressions:        number | null;
    postPosition:           number | null;
    measuredAt:             string | null;
    clicksImpactPct:        number | null;
    positionImpact:         number | null;
}

export interface SeoOpportunity {
    brandId:            string;
    pageUrl:            string;
    impressions30d:     number;
    clicks30d:          number;
    avgPosition:        number;
    ctr:                number;
    opportunityScore:   number;
    opportunityType:    'ranking_gap' | 'low_ctr' | 'high_rank_low_traffic' | 'monitor';
    lastDataDate:       string;
}

export interface SeoOverviewKPIs {
    totalClicks30d:         number;
    totalImpressions30d:    number;
    avgCtr30d:              number;
    avgPosition30d:         number;
    indexedPages:           number;
    nonIndexedPages:        number;
    openIssues:             number;
    criticalIssues:         number;
    topWinners:             Array<{ url: string; clicksDelta: number; positionDelta: number }>;
    topLosers:              Array<{ url: string; clicksDelta: number; positionDelta: number }>;
    brandedVsNonBranded:    { brandedClicks: number; nonBrandedClicks: number };
}

export interface SeoDataScope {
    connectionId?: string | null;
    searchConsoleConnectionId?: string | null;
    analyticsConnectionId?: string | null;
    searchConsolePropertyId?: string | null;
    analyticsPropertyId?: string | null;
    websiteId?: string | null;
    websiteUrl?: string | null;
}

type NormalizedSeoScope = {
    searchConsoleConnectionId?: string;
    analyticsConnectionId?: string;
    searchConsolePropertyId?: string;
    analyticsPropertyId?: string;
    websiteId?: string;
    websiteUrl?: string;
    websitePathPrefix: string;
};

function normalizeUrlPath(value: string | null | undefined): string {
    if (!value) {
        return '/';
    }

    try {
        if (value.startsWith('/')) {
            return value === '/' ? '/' : value.replace(/\/+$/, '');
        }

        const parsed = new URL(value);
        return parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/+$/, '');
    } catch {
        return value.startsWith('/') ? value : `/${value.replace(/^\/+/, '')}`;
    }
}

function normalizeSeoScope(scopeOrConnectionId?: string | SeoDataScope): NormalizedSeoScope {
    if (typeof scopeOrConnectionId === 'string') {
        return {
            searchConsoleConnectionId: scopeOrConnectionId,
            analyticsConnectionId: scopeOrConnectionId,
            websitePathPrefix: '/',
        };
    }

    return {
        searchConsoleConnectionId:
            scopeOrConnectionId?.searchConsoleConnectionId
            ?? scopeOrConnectionId?.connectionId
            ?? undefined,
        analyticsConnectionId:
            scopeOrConnectionId?.analyticsConnectionId
            ?? scopeOrConnectionId?.connectionId
            ?? undefined,
        searchConsolePropertyId: scopeOrConnectionId?.searchConsolePropertyId ?? undefined,
        analyticsPropertyId: scopeOrConnectionId?.analyticsPropertyId ?? undefined,
        websiteId: scopeOrConnectionId?.websiteId ?? undefined,
        websiteUrl: scopeOrConnectionId?.websiteUrl ?? undefined,
        websitePathPrefix: normalizeUrlPath(scopeOrConnectionId?.websiteUrl),
    };
}

function matchesScopedPath(pathValue: string | null | undefined, scope: NormalizedSeoScope): boolean {
    if (!pathValue || scope.websitePathPrefix === '/') {
        return true;
    }

    const normalizedPath = normalizeUrlPath(pathValue);
    return normalizedPath === scope.websitePathPrefix || normalizedPath.startsWith(`${scope.websitePathPrefix}/`);
}

function scopeRowsToWebsite<T extends Record<string, unknown>>(
    rows: T[],
    scope: NormalizedSeoScope,
    pathKeys: string[],
): T[] {
    if (scope.websitePathPrefix === '/') {
        return rows;
    }

    return rows.filter((row) =>
        pathKeys.some((key) => matchesScopedPath((row[key] as string | null | undefined) ?? null, scope)),
    );
}

function applySearchConsoleFactScope(query: any, scope: NormalizedSeoScope): any {
    let next = query;
    if (scope.searchConsoleConnectionId) {
        next = next.eq('connection_id', scope.searchConsoleConnectionId);
    }
    if (scope.searchConsolePropertyId) {
        next = next.eq('search_console_property_id', scope.searchConsolePropertyId);
    }

    return next;
}

function applyAnalyticsFactScope(query: any, scope: NormalizedSeoScope): any {
    let next = query;
    if (scope.analyticsConnectionId) {
        next = next.eq('connection_id', scope.analyticsConnectionId);
    }
    if (scope.analyticsPropertyId) {
        next = next.eq('analytics_property_id', scope.analyticsPropertyId);
    }

    return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW MAPPERS
// ─────────────────────────────────────────────────────────────────────────────

function toMarket(r: Record<string, unknown>): SeoMarket {
    return {
        id:             r.id as string,
        brandId:        r.brand_id as string,
        websiteId:      r.website_id as string | null,
        marketName:     r.market_name as string,
        countryCode:    r.country_code as string | null,
        languageCode:   r.language_code as string | null,
        primaryDomain:  r.primary_domain as string | null,
        hreflang:       r.hreflang as string | null,
        isPrimary:      Boolean(r.is_primary),
        status:         (r.status as string) ?? 'active',
        createdAt:      r.created_at as string,
    };
}

function toPage(r: Record<string, unknown>): SeoPage {
    return {
        id:                 r.id as string,
        brandId:            r.brand_id as string,
        websiteId:          r.website_id as string | null,
        marketId:           r.market_id as string | null,
        url:                r.url as string,
        pageType:           (r.page_type as PageType) ?? 'other',
        template:           r.template as string | null,
        title:              r.title as string | null,
        metaDescription:    r.meta_description as string | null,
        h1:                 r.h1 as string | null,
        canonicalUrl:       r.canonical_url as string | null,
        isIndexable:        Boolean(r.is_indexable ?? true),
        hasNoindex:         Boolean(r.has_noindex),
        inSitemap:          r.in_sitemap as boolean | null,
        statusCode:         r.status_code as number | null,
        wordCount:          r.word_count as number | null,
        internalLinksIn:    Number(r.internal_links_in ?? 0),
        clicks30d:          Number(r.clicks_30d ?? 0),
        impressions30d:     Number(r.impressions_30d ?? 0),
        ctr30d:             Number(r.ctr_30d ?? 0),
        avgPosition30d:     r.avg_position_30d as number | null,
        lastAuditedAt:      r.last_audited_at as string | null,
        auditScore:         r.audit_score as number | null,
        createdAt:          r.created_at as string,
        updatedAt:          r.updated_at as string,
    };
}

function toCluster(r: Record<string, unknown>): SeoKeywordCluster {
    return {
        id:             r.id as string,
        brandId:        r.brand_id as string,
        marketId:       r.market_id as string | null,
        clusterName:    r.cluster_name as string,
        topic:          r.topic as string | null,
        primaryKeyword: r.primary_keyword as string,
        intent:         (r.intent as SearchIntent) ?? 'informational',
        pillarPageId:   r.pillar_page_id as string | null,
        status:         (r.status as string) ?? 'active',
        notes:          r.notes as string | null,
        createdAt:      r.created_at as string,
    };
}

function toKeywordMap(r: Record<string, unknown>): SeoKeywordMapping {
    return {
        id:                 r.id as string,
        brandId:            r.brand_id as string,
        clusterId:          r.cluster_id as string | null,
        marketId:           r.market_id as string | null,
        keyword:            r.keyword as string,
        intent:             (r.intent as SearchIntent) ?? 'informational',
        isBranded:          Boolean(r.is_branded),
        monthlyVolume:      r.monthly_volume as number | null,
        difficulty:         r.difficulty as number | null,
        targetPageId:       r.target_page_id as string | null,
        targetUrl:          r.target_url as string | null,
        currentPosition:    r.current_position as number | null,
        impressions30d:     Number(r.impressions_30d ?? 0),
        clicks30d:          Number(r.clicks_30d ?? 0),
        ctr30d:             Number(r.ctr_30d ?? 0),
        positionDelta:      r.position_delta as number | null,
        mappingStatus:      (r.mapping_status as MappingStatus) ?? 'candidate',
        cannibalizationUrl: r.cannibalization_url as string | null,
        opportunityScore:   r.opportunity_score as number | null,
        notes:              r.notes as string | null,
        lastSyncedAt:       r.last_synced_at as string | null,
        createdAt:          r.created_at as string,
    };
}

function toIssue(r: Record<string, unknown>): SeoIssue {
    return {
        id:                 r.id as string,
        brandId:            r.brand_id as string,
        websiteId:          r.website_id as string | null,
        pageId:             r.page_id as string | null,
        issueType:          r.issue_type as IssueType,
        category:           r.category as string | null,
        title:              r.title as string,
        description:        r.description as string | null,
        affectedUrl:        r.affected_url as string | null,
        affectedCount:      Number(r.affected_count ?? 1),
        severity:           (r.severity as IssueSeverity) ?? 'medium',
        businessImpact:     r.business_impact as string | null,
        status:             (r.status as IssueStatus) ?? 'open',
        assigneeUserId:     r.assignee_user_id as string | null,
        dueDate:            r.due_date as string | null,
        detectedAt:         r.detected_at as string,
        resolvedAt:         r.resolved_at as string | null,
        resolutionNotes:    r.resolution_notes as string | null,
        autoDetected:       Boolean(r.auto_detected),
        detectionSource:    r.detection_source as string | null,
        createdAt:          r.created_at as string,
    };
}

function toBrief(r: Record<string, unknown>): SeoContentBrief {
    return {
        id:                         r.id as string,
        brandId:                    r.brand_id as string,
        pageId:                     r.page_id as string | null,
        clusterId:                  r.cluster_id as string | null,
        targetKeyword:              r.target_keyword as string,
        secondaryKeywords:          (r.secondary_keywords as string[]) ?? [],
        searchIntent:               (r.search_intent as SearchIntent) ?? 'informational',
        contentType:                (r.content_type as string) ?? 'article',
        wordCountTarget:            Number(r.word_count_target ?? 1000),
        suggestedTitle:             r.suggested_title as string | null,
        suggestedMeta:              r.suggested_meta as string | null,
        h2Suggestions:              (r.h2_suggestions as SeoContentBrief['h2Suggestions']) ?? [],
        entities:                   (r.entities as SeoContentBrief['entities']) ?? [],
        faqSuggestions:             (r.faq_suggestions as SeoContentBrief['faqSuggestions']) ?? [],
        internalLinksSuggestions:   (r.internal_links_suggestions as SeoContentBrief['internalLinksSuggestions']) ?? [],
        schemaType:                 r.schema_type as string | null,
        competitorUrls:             (r.competitor_urls as string[]) ?? [],
        status:                     (r.status as BriefStatus) ?? 'draft',
        priority:                   (r.priority as string) ?? 'medium',
        dueDate:                    r.due_date as string | null,
        aiGenerated:                Boolean(r.ai_generated ?? true),
        createdAt:                  r.created_at as string,
        updatedAt:                  r.updated_at as string,
        clusterName:                r.cluster_name as string | undefined,
        targetUrl:                  r.target_url as string | undefined,
    };
}

function toChangeLog(r: Record<string, unknown>): SeoChangeLog {
    return {
        id:                     r.id as string,
        brandId:                r.brand_id as string,
        pageId:                 r.page_id as string | null,
        issueId:                r.issue_id as string | null,
        changeType:             r.change_type as ChangeType,
        description:            r.description as string,
        changedUrl:             r.changed_url as string | null,
        changedAt:              r.changed_at as string,
        baselineClicks:         r.baseline_clicks as number | null,
        baselineImpressions:    r.baseline_impressions as number | null,
        baselinePosition:       r.baseline_position as number | null,
        postClicks:             r.post_clicks as number | null,
        postImpressions:        r.post_impressions as number | null,
        postPosition:           r.post_position as number | null,
        measuredAt:             r.measured_at as string | null,
        clicksImpactPct:        r.clicks_impact_pct as number | null,
        positionImpact:         r.position_impact as number | null,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1 — MARKETS
// ─────────────────────────────────────────────────────────────────────────────

export async function getSeoMarkets(brandId: string): Promise<SeoMarket[]> {
    try {
        const { data, error } = await supabase
            .from('seo_markets')
            .select('*')
            .eq('brand_id', brandId)
            .order('is_primary', { ascending: false });
        if (error || !data) return [];
        return data.map(r => toMarket(r as Record<string, unknown>));
    } catch { return []; }
}

export async function createSeoMarket(
    brandId: string,
    market: Omit<SeoMarket, 'id' | 'brandId' | 'createdAt'>
): Promise<SeoMarket | null> {
    try {
        const { data, error } = await supabase
            .from('seo_markets')
            .insert([{
                brand_id:       brandId,
                website_id:     market.websiteId,
                market_name:    market.marketName,
                country_code:   market.countryCode,
                language_code:  market.languageCode,
                primary_domain: market.primaryDomain,
                hreflang:       market.hreflang,
                is_primary:     market.isPrimary,
                status:         market.status,
            }])
            .select()
            .single();
        if (error || !data) return null;
        return toMarket(data as Record<string, unknown>);
    } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2 — PAGE INVENTORY
// ─────────────────────────────────────────────────────────────────────────────

export async function getSeoPages(
    brandId: string,
    filters?: {
        pageType?: PageType;
        isIndexable?: boolean;
        websiteId?: string;
        marketId?: string;
        search?: string;
        limit?: number;
        offset?: number;
    }
): Promise<{ pages: SeoPage[]; total: number }> {
    try {
        let query = supabase
            .from('seo_pages')
            .select('*', { count: 'exact' })
            .eq('brand_id', brandId);

        if (filters?.pageType)    query = query.eq('page_type', filters.pageType);
        if (filters?.isIndexable !== undefined) query = query.eq('is_indexable', filters.isIndexable);
        if (filters?.websiteId)   query = query.eq('website_id', filters.websiteId);
        if (filters?.marketId)    query = query.eq('market_id', filters.marketId);
        if (filters?.search)      query = query.ilike('url', `%${filters.search}%`);

        query = query
            .order('impressions_30d', { ascending: false })
            .range(filters?.offset ?? 0, (filters?.offset ?? 0) + (filters?.limit ?? 50) - 1);

        const { data, error, count } = await query;
        if (error || !data) return { pages: [], total: 0 };
        return {
            pages: data.map(r => toPage(r as Record<string, unknown>)),
            total: count ?? 0,
        };
    } catch { return { pages: [], total: 0 }; }
}

export async function upsertSeoPage(
    brandId: string,
    page: Omit<SeoPage, 'id' | 'brandId' | 'createdAt' | 'updatedAt'>
): Promise<SeoPage | null> {
    try {
        const { data, error } = await supabase
            .from('seo_pages')
            .upsert({
                brand_id:           brandId,
                website_id:         page.websiteId,
                market_id:          page.marketId,
                url:                page.url,
                page_type:          page.pageType,
                template:           page.template,
                title:              page.title,
                meta_description:   page.metaDescription,
                h1:                 page.h1,
                canonical_url:      page.canonicalUrl,
                is_indexable:       page.isIndexable,
                has_noindex:        page.hasNoindex,
                in_sitemap:         page.inSitemap,
                status_code:        page.statusCode,
                word_count:         page.wordCount,
                internal_links_in:  page.internalLinksIn,
                clicks_30d:         page.clicks30d,
                impressions_30d:    page.impressions30d,
                ctr_30d:            page.ctr30d,
                avg_position_30d:   page.avgPosition30d,
                last_audited_at:    page.lastAuditedAt ?? new Date().toISOString(),
                audit_score:        page.auditScore,
                updated_at:         new Date().toISOString(),
            }, { onConflict: 'brand_id,url' })
            .select()
            .single();
        if (error || !data) return null;
        return toPage(data as Record<string, unknown>);
    } catch { return null; }
}

/** Compute on-page audit score: 0-100 */
export function computePageAuditScore(page: Partial<SeoPage>): { score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;

    if (!page.title)                            { issues.push('Missing title tag');         score -= 15; }
    else if (page.title.length > 60)            { issues.push('Title too long (>60 chars)'); score -= 5;  }
    else if (page.title.length < 30)            { issues.push('Title too short (<30 chars)'); score -= 5; }

    if (!page.metaDescription)                  { issues.push('Missing meta description');  score -= 10; }
    else if (page.metaDescription.length > 160) { issues.push('Meta description too long'); score -= 3;  }

    if (!page.h1)                               { issues.push('Missing H1');                score -= 10; }

    if (page.hasNoindex)                        { issues.push('Has noindex — not indexable'); score -= 20; }

    if (page.canonicalUrl && !page.url.startsWith(page.canonicalUrl.split('?')[0])) {
                                                  issues.push('Canonical points to different URL'); score -= 10; }

    if (page.inSitemap === false)               { issues.push('Not in sitemap');             score -= 5;  }

    if (!page.wordCount || page.wordCount < 300) { issues.push('Thin content (<300 words)'); score -= 10; }

    if (page.statusCode && page.statusCode >= 400) { issues.push(`HTTP ${page.statusCode} error`); score -= 25; }

    if ((page.internalLinksIn ?? 0) === 0)      { issues.push('Orphan page — 0 internal links'); score -= 10; }

    return { score: Math.max(0, score), issues };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 3 — KEYWORD CLUSTERS
// ─────────────────────────────────────────────────────────────────────────────

export async function getKeywordClusters(brandId: string): Promise<SeoKeywordCluster[]> {
    try {
        const { data, error } = await supabase
            .from('seo_keyword_clusters')
            .select('*')
            .eq('brand_id', brandId)
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        if (error || !data) return [];
        return data.map(r => toCluster(r as Record<string, unknown>));
    } catch { return []; }
}

export async function createKeywordCluster(
    brandId: string,
    cluster: Omit<SeoKeywordCluster, 'id' | 'brandId' | 'createdAt'>
): Promise<SeoKeywordCluster | null> {
    try {
        const { data, error } = await supabase
            .from('seo_keyword_clusters')
            .insert([{
                brand_id:       brandId,
                market_id:      cluster.marketId,
                cluster_name:   cluster.clusterName,
                topic:          cluster.topic,
                primary_keyword: cluster.primaryKeyword,
                intent:         cluster.intent,
                pillar_page_id: cluster.pillarPageId,
                status:         cluster.status,
                notes:          cluster.notes,
            }])
            .select()
            .single();
        if (error || !data) return null;
        return toCluster(data as Record<string, unknown>);
    } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4 — KEYWORD MAP
// ─────────────────────────────────────────────────────────────────────────────

export async function getKeywordMap(
    brandId: string,
    filters?: {
        clusterId?: string;
        status?: MappingStatus;
        intent?: SearchIntent;
        isBranded?: boolean;
        positionMin?: number;
        positionMax?: number;
        limit?: number;
    }
): Promise<SeoKeywordMapping[]> {
    try {
        let query = supabase
            .from('seo_keyword_map')
            .select('*')
            .eq('brand_id', brandId);

        if (filters?.clusterId)  query = query.eq('cluster_id', filters.clusterId);
        if (filters?.status)     query = query.eq('mapping_status', filters.status);
        if (filters?.intent)     query = query.eq('intent', filters.intent);
        if (filters?.isBranded !== undefined) query = query.eq('is_branded', filters.isBranded);
        if (filters?.positionMin !== undefined) query = query.gte('current_position', filters.positionMin);
        if (filters?.positionMax !== undefined) query = query.lte('current_position', filters.positionMax);

        query = query
            .order('opportunity_score', { ascending: false })
            .limit(filters?.limit ?? 200);

        const { data, error } = await query;
        if (error || !data) return [];
        return data.map(r => toKeywordMap(r as Record<string, unknown>));
    } catch { return []; }
}

export async function upsertKeywordMapping(
    brandId: string,
    mapping: Omit<SeoKeywordMapping, 'id' | 'brandId' | 'createdAt' | 'lastSyncedAt'>
): Promise<SeoKeywordMapping | null> {
    try {
        const { data, error } = await supabase
            .from('seo_keyword_map')
            .upsert({
                brand_id:               brandId,
                cluster_id:             mapping.clusterId,
                market_id:              mapping.marketId,
                keyword:                mapping.keyword,
                intent:                 mapping.intent,
                is_branded:             mapping.isBranded,
                monthly_volume:         mapping.monthlyVolume,
                difficulty:             mapping.difficulty,
                target_page_id:         mapping.targetPageId,
                target_url:             mapping.targetUrl,
                current_position:       mapping.currentPosition,
                impressions_30d:        mapping.impressions30d,
                clicks_30d:             mapping.clicks30d,
                ctr_30d:                mapping.ctr30d,
                position_delta:         mapping.positionDelta,
                mapping_status:         mapping.mappingStatus,
                cannibalization_url:    mapping.cannibalizationUrl,
                opportunity_score:      mapping.opportunityScore,
                notes:                  mapping.notes,
                updated_at:             new Date().toISOString(),
            }, { onConflict: 'id' })
            .select()
            .single();
        if (error || !data) return null;
        return toKeywordMap(data as Record<string, unknown>);
    } catch { return null; }
}

/**
 * Detect keyword gaps from GSC query facts:
 * Queries with impressions > threshold but no mapping or no target URL.
 */
export async function detectKeywordGaps(
    brandId: string,
    minImpressions: number = 50,
    scope?: SeoDataScope,
): Promise<Array<{ query: string; impressions: number; clicks: number; avgPosition: number; ctr: number }>> {
    try {
        const normalizedScope = normalizeSeoScope(scope);
        // Get queries from facts
        const query: any = applySearchConsoleFactScope(
            supabase
                .from('seo_query_facts')
                .select('query, page_url, impressions, clicks, position, ctr')
                .eq('brand_id', brandId)
                .gte('fact_date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
                .order('impressions', { ascending: false })
                .limit(500),
            normalizedScope,
        );

        const { data: facts } = await query;
        const scopedFacts = scopeRowsToWebsite(facts ?? [], normalizedScope, ['page_url']);
        if (!scopedFacts.length) return [];

        // Aggregate by query
        const queryMap = new Map<string, { impressions: number; clicks: number; positions: number[]; ctrs: number[] }>();
        for (const row of scopedFacts) {
            const q = row.query as string;
            const existing = queryMap.get(q) ?? { impressions: 0, clicks: 0, positions: [], ctrs: [] };
            existing.impressions += Number(row.impressions ?? 0);
            existing.clicks += Number(row.clicks ?? 0);
            existing.positions.push(Number(row.position ?? 50));
            existing.ctrs.push(Number(row.ctr ?? 0));
            queryMap.set(q, existing);
        }

        // Get already-mapped keywords
        const { data: mapped } = await supabase
            .from('seo_keyword_map')
            .select('keyword')
            .eq('brand_id', brandId)
            .not('target_url', 'is', null);

        const mappedSet = new Set((mapped ?? []).map(r => (r.keyword as string).toLowerCase()));

        const gaps: ReturnType<typeof detectKeywordGaps> extends Promise<infer T> ? T : never = [];
        for (const [queryText, agg] of queryMap.entries()) {
            if (agg.impressions < minImpressions) continue;
            if (mappedSet.has(queryText.toLowerCase())) continue;
            const avgPosition = agg.positions.reduce((a, b) => a + b, 0) / agg.positions.length;
            const avgCtr = agg.impressions > 0 ? agg.clicks / agg.impressions : 0;
            gaps.push({
                query: queryText,
                impressions: agg.impressions,
                clicks: agg.clicks,
                avgPosition: Math.round(avgPosition * 10) / 10,
                ctr: Math.round(avgCtr * 10000) / 10000,
            });
        }

        return gaps.sort((a, b) => b.impressions - a.impressions).slice(0, 100);
    } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 5 — ISSUE TRACKER
// ─────────────────────────────────────────────────────────────────────────────

export async function getSeoIssues(
    brandId: string,
    filters?: {
        status?: IssueStatus | IssueStatus[];
        issueType?: IssueType;
        severity?: IssueSeverity;
        websiteId?: string;
        limit?: number;
    }
): Promise<SeoIssue[]> {
    try {
        let query = supabase
            .from('seo_issues')
            .select('*')
            .eq('brand_id', brandId);

        if (filters?.status) {
            if (Array.isArray(filters.status)) query = query.in('status', filters.status);
            else query = query.eq('status', filters.status);
        }
        if (filters?.issueType) query = query.eq('issue_type', filters.issueType);
        if (filters?.severity)  query = query.eq('severity', filters.severity);
        if (filters?.websiteId) query = query.eq('website_id', filters.websiteId);

        query = query
            .order('severity', { ascending: true })   // critical first (alphabetic hack: c < h < m)
            .order('detected_at', { ascending: false })
            .limit(filters?.limit ?? 200);

        const { data, error } = await query;
        if (error || !data) return [];
        return data.map(r => toIssue(r as Record<string, unknown>));
    } catch { return []; }
}

export async function createSeoIssue(
    brandId: string,
    issue: Omit<SeoIssue, 'id' | 'brandId' | 'detectedAt' | 'createdAt'>
): Promise<SeoIssue | null> {
    try {
        const { data, error } = await supabase
            .from('seo_issues')
            .insert([{
                brand_id:           brandId,
                website_id:         issue.websiteId,
                page_id:            issue.pageId,
                issue_type:         issue.issueType,
                category:           issue.category,
                title:              issue.title,
                description:        issue.description,
                affected_url:       issue.affectedUrl,
                affected_count:     issue.affectedCount,
                severity:           issue.severity,
                business_impact:    issue.businessImpact,
                status:             issue.status,
                assignee_user_id:   issue.assigneeUserId,
                due_date:           issue.dueDate,
                auto_detected:      issue.autoDetected,
                detection_source:   issue.detectionSource,
            }])
            .select()
            .single();
        if (error || !data) return null;
        return toIssue(data as Record<string, unknown>);
    } catch { return null; }
}

export async function updateIssueStatus(
    issueId: string,
    status: IssueStatus,
    resolutionNotes?: string
): Promise<boolean> {
    try {
        const update: Record<string, unknown> = {
            status,
            updated_at: new Date().toISOString(),
        };
        if (status === 'resolved') {
            update.resolved_at = new Date().toISOString();
        }
        if (resolutionNotes) {
            update.resolution_notes = resolutionNotes;
        }
        const { error } = await supabase
            .from('seo_issues')
            .update(update)
            .eq('id', issueId);
        return !error;
    } catch { return false; }
}

export async function assignIssue(
    issueId: string,
    assigneeUserId: string,
    dueDate?: string
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('seo_issues')
            .update({
                assignee_user_id: assigneeUserId,
                due_date:         dueDate ?? null,
                status:           'in-progress',
                updated_at:       new Date().toISOString(),
            })
            .eq('id', issueId);
        return !error;
    } catch { return false; }
}

/**
 * Auto-detect issues from url_inspection_facts and seo_query_facts.
 * Returns count of newly created issues.
 */
async function runAutoIssueDetectionLegacy(
    brandId: string,
    websiteId?: string
): Promise<{ detected: number; types: Record<string, number> }> {
    const types: Record<string, number> = {};
    let detected = 0;

    try {
        // 1. Indexation issues from url_inspection_facts
        const { data: inspection } = await supabase
            .from('url_inspection_facts')
            .select('page_url, verdict, coverage_state, mobile_usability, robots_txt_state, indexing_state')
            .eq('brand_id', brandId)
            .in('verdict', ['NEUTRAL', 'FAIL'])
            .order('fact_date', { ascending: false })
            .limit(500);

        if (inspection) {
            const issuesToInsert = inspection.map(row => ({
                brand_id:           brandId,
                website_id:         websiteId ?? null,
                issue_type:         'indexation',
                category:           row.coverage_state as string,
                title:              `Indexation Issue — ${row.coverage_state}`,
                description:        `Page ${row.page_url} has verdict: ${row.verdict}. Coverage: ${row.coverage_state}. Indexing state: ${row.indexing_state}`,
                affected_url:       row.page_url as string,
                severity:           (row.verdict === 'FAIL' ? 'high' : 'medium') as IssueSeverity,
                auto_detected:      true,
                detection_source:   'gsc-sync',
                external_ref:       row.coverage_state as string,
            }));

            if (issuesToInsert.length > 0) {
                const { data: inserted } = await supabase
                    .from('seo_issues')
                    .upsert(issuesToInsert, { onConflict: 'brand_id,category,affected_url', ignoreDuplicates: true })
                    .select('id');
                const count = inserted?.length ?? 0;
                types['indexation'] = count;
                detected += count;
            }
        }

        // 2. Low CTR opportunities from v_seo_opportunities view
        const { data: opps } = await supabase
            .from('v_seo_opportunities')
            .select('*')
            .eq('brand_id', brandId)
            .eq('opportunity_type', 'low_ctr')
            .gt('impressions_30d', 200)
            .limit(50);

        if (opps && opps.length > 0) {
            const issuesFromCtr = opps.map(o => ({
                brand_id:           brandId,
                website_id:         websiteId ?? null,
                issue_type:         'on-page',
                category:           'low-ctr',
                title:              `Low CTR — ${(o.page_url as string).split('/').slice(-2).join('/')}`,
                description:        `${o.impressions_30d} impressions, ${((o.ctr as number) * 100).toFixed(2)}% CTR. Avg position: ${(o.avg_position as number).toFixed(1)}. Improve title & meta to capture intent.`,
                affected_url:       o.page_url as string,
                severity:           ((o.impressions_30d as number) > 1000 ? 'high' : 'medium') as IssueSeverity,
                business_impact:    'visibility',
                auto_detected:      true,
                detection_source:   'gsc-sync',
            }));

            const { data: inserted } = await supabase
                .from('seo_issues')
                .upsert(issuesFromCtr, { onConflict: 'brand_id,category,affected_url', ignoreDuplicates: true })
                .select('id');
            const count = inserted?.length ?? 0;
            types['low_ctr'] = count;
            detected += count;
        }

        return { detected, types };
    } catch { return { detected: 0, types: {} }; }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 6 — OPPORTUNITIES ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export async function runAutoIssueDetection(
    brandId: string,
    scope?: string | SeoDataScope,
): Promise<{ detected: number; types: Record<string, number> }> {
    const types: Record<string, number> = {};
    let detected = 0;

    try {
        const normalizedScope = normalizeSeoScope(scope);
        const websiteId = normalizedScope.websiteId ?? null;

        const inspectionQuery = applySearchConsoleFactScope(
            supabase
                .from('url_inspection_facts')
                .select('url, verdict, coverage_state, indexing_state, inspection_date')
                .eq('brand_id', brandId)
                .order('inspection_date', { ascending: false })
                .limit(500),
            normalizedScope,
        );

        const { data: inspection } = await inspectionQuery;
        const scopedInspection = scopeRowsToWebsite(inspection ?? [], normalizedScope, ['url']);
        const inspectionIssues = scopedInspection
            .filter((row) => ['NEUTRAL', 'FAIL'].includes(String(row.verdict ?? '').toUpperCase()))
            .map((row) => ({
                brand_id: brandId,
                website_id: websiteId,
                issue_type: 'indexation',
                category: String(row.coverage_state ?? 'coverage'),
                title: `Indexation Issue - ${String(row.coverage_state ?? 'Review')}`,
                description: `Page ${String(row.url ?? '')} has verdict ${String(row.verdict ?? 'UNKNOWN')}. Coverage: ${String(row.coverage_state ?? 'unknown')}. Indexing state: ${String(row.indexing_state ?? 'unknown')}.`,
                affected_url: String(row.url ?? ''),
                affected_count: 1,
                severity: (String(row.verdict ?? '').toUpperCase() === 'FAIL' ? 'high' : 'medium') as IssueSeverity,
                auto_detected: true,
                detection_source: 'search_console_sync',
            }))
            .filter((row) => row.affected_url);

        if (inspectionIssues.length > 0) {
            const { data: inserted } = await supabase
                .from('seo_issues')
                .upsert(inspectionIssues, { onConflict: 'brand_id,category,affected_url', ignoreDuplicates: true })
                .select('id');
            const count = inserted?.length ?? 0;
            types.indexation = count;
            detected += count;
        }

        const lowCtrOpportunities = await getOpportunities(brandId, 'low_ctr', normalizedScope);
        const lowCtrIssues = lowCtrOpportunities.slice(0, 50).map((opportunity) => ({
            brand_id: brandId,
            website_id: websiteId,
            issue_type: 'on-page',
            category: 'low-ctr',
            title: `Low CTR - ${normalizeUrlPath(opportunity.pageUrl)}`,
            description: `${opportunity.impressions30d} impressions, ${(opportunity.ctr * 100).toFixed(2)}% CTR, avg position ${opportunity.avgPosition.toFixed(1)}. Update title and meta to win more clicks.`,
            affected_url: opportunity.pageUrl,
            affected_count: 1,
            severity: (opportunity.impressions30d >= 1000 ? 'high' : 'medium') as IssueSeverity,
            business_impact: 'visibility',
            auto_detected: true,
            detection_source: 'search_console_sync',
        }));

        if (lowCtrIssues.length > 0) {
            const { data: inserted } = await supabase
                .from('seo_issues')
                .upsert(lowCtrIssues, { onConflict: 'brand_id,category,affected_url', ignoreDuplicates: true })
                .select('id');
            const count = inserted?.length ?? 0;
            types.low_ctr = count;
            detected += count;
        }

        return { detected, types };
    } catch {
        return { detected: 0, types: {} };
    }
}

async function getOpportunitiesLegacy(
    brandId: string,
    type?: SeoOpportunity['opportunityType']
): Promise<SeoOpportunity[]> {
    try {
        let query = supabase
            .from('v_seo_opportunities')
            .select('*')
            .eq('brand_id', brandId)
            .order('opportunity_score', { ascending: false })
            .limit(100);

        if (type) query = query.eq('opportunity_type', type);

        const { data, error } = await query;
        if (error || !data) return [];
        return data.map(r => ({
            brandId:            r.brand_id as string,
            pageUrl:            r.page_url as string,
            impressions30d:     Number(r.impressions_30d ?? 0),
            clicks30d:          Number(r.clicks_30d ?? 0),
            avgPosition:        Number(r.avg_position ?? 50),
            ctr:                Number(r.ctr ?? 0),
            opportunityScore:   Number(r.opportunity_score ?? 0),
            opportunityType:    r.opportunity_type as SeoOpportunity['opportunityType'],
            lastDataDate:       r.last_data_date as string,
        }));
    } catch { return []; }
}

async function getCannibalizationIssuesLegacy(
    brandId: string
): Promise<Array<{ query: string; competingPages: number; pages: string[]; totalImpressions: number; totalClicks: number; bestPosition: number }>> {
    try {
        const { data, error } = await supabase
            .from('v_seo_cannibalization')
            .select('*')
            .eq('brand_id', brandId)
            .order('total_impressions', { ascending: false })
            .limit(50);

        if (error || !data) return [];
        return data.map(r => ({
            query:              r.query as string,
            competingPages:     Number(r.competing_pages ?? 0),
            pages:              (r.pages as string[]) ?? [],
            totalImpressions:   Number(r.total_impressions ?? 0),
            totalClicks:        Number(r.total_clicks ?? 0),
            bestPosition:       Number(r.best_position ?? 100),
        }));
    } catch { return []; }
}

/** Pages ranking 5-20 — highest ROI zone for optimization */
async function getRankingGapPagesLegacy(
    brandId: string
): Promise<Array<{ url: string; avgPosition: number; impressions: number; clicks: number; potentialClicks: number }>> {
    try {
        const opps = await getOpportunities(brandId, 'ranking_gap');
        return opps.map(o => ({
            url:            o.pageUrl,
            avgPosition:    o.avgPosition,
            impressions:    o.impressions30d,
            clicks:         o.clicks30d,
            // Estimate: if CTR improves to 5% (typical for top 5)
            potentialClicks: Math.round(o.impressions30d * 0.05),
        }));
    } catch { return []; }
}

/** Orphan pages: indexed but 0 internal links pointing to them */
async function getOrphanPagesLegacy(brandId: string): Promise<SeoPage[]> {
    try {
        const { data, error } = await supabase
            .from('seo_pages')
            .select('*')
            .eq('brand_id', brandId)
            .eq('is_indexable', true)
            .eq('internal_links_in', 0)
            .order('impressions_30d', { ascending: false })
            .limit(100);
        if (error || !data) return [];
        return data.map(r => toPage(r as Record<string, unknown>));
    } catch { return []; }
}

/** Decayed pages: high clicks historically, low now — requires trend data */
async function getDecayedPagesLegacy(
    brandId: string,
    connectionId?: string
): Promise<Array<{ url: string; recentClicks: number; olderClicks: number; decayPct: number }>> {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        const sixtyDaysAgo  = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];
        const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

        let recentQ = supabase
            .from('seo_page_facts')
            .select('page_url, clicks, impressions')
            .eq('brand_id', brandId)
            .gte('fact_date', thirtyDaysAgo);
        if (connectionId) recentQ = recentQ.eq('connection_id', connectionId);

        let olderQ = supabase
            .from('seo_page_facts')
            .select('page_url, clicks, impressions')
            .eq('brand_id', brandId)
            .gte('fact_date', ninetyDaysAgo)
            .lt('fact_date', sixtyDaysAgo);
        if (connectionId) olderQ = olderQ.eq('connection_id', connectionId);

        const [{ data: recent }, { data: older }] = await Promise.all([recentQ, olderQ]);
        if (!recent || !older) return [];

        // Aggregate
        const recentMap = new Map<string, number>();
        for (const r of recent) recentMap.set(r.page_url as string, (recentMap.get(r.page_url as string) ?? 0) + Number(r.clicks ?? 0));

        const olderMap = new Map<string, number>();
        for (const r of older) olderMap.set(r.page_url as string, (olderMap.get(r.page_url as string) ?? 0) + Number(r.clicks ?? 0));

        const decayed: ReturnType<typeof getDecayedPages> extends Promise<infer T> ? T : never = [];
        for (const [url, olderClicks] of olderMap.entries()) {
            if (olderClicks < 20) continue; // ignore tiny pages
            const recentClicks = recentMap.get(url) ?? 0;
            const decayPct = ((olderClicks - recentClicks) / olderClicks) * 100;
            if (decayPct > 30) {
                decayed.push({ url, recentClicks, olderClicks, decayPct: Math.round(decayPct) });
            }
        }

        return decayed.sort((a, b) => b.decayPct - a.decayPct).slice(0, 50);
    } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 7 — CONTENT BRIEFS
// ─────────────────────────────────────────────────────────────────────────────

export async function getOpportunities(
    brandId: string,
    type?: SeoOpportunity['opportunityType'],
    scope?: string | SeoDataScope,
): Promise<SeoOpportunity[]> {
    try {
        const normalizedScope = normalizeSeoScope(scope);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        const query = applySearchConsoleFactScope(
            supabase
                .from('seo_page_facts')
                .select('page_url, clicks, impressions, position, fact_date')
                .eq('brand_id', brandId)
                .gte('fact_date', thirtyDaysAgo)
                .limit(10000),
            normalizedScope,
        );

        const { data, error } = await query;
        if (error || !data) return [];

        const scopedFacts = scopeRowsToWebsite(data, normalizedScope, ['page_url']);
        const pageMap = new Map<string, {
            pageUrl: string;
            impressions: number;
            clicks: number;
            positions: number[];
            lastDataDate: string;
        }>();

        for (const row of scopedFacts) {
            const pageUrl = String(row.page_url ?? '');
            if (!pageUrl) {
                continue;
            }

            const existing = pageMap.get(pageUrl) ?? {
                pageUrl,
                impressions: 0,
                clicks: 0,
                positions: [],
                lastDataDate: '',
            };

            existing.impressions += Number(row.impressions ?? 0);
            existing.clicks += Number(row.clicks ?? 0);
            existing.positions.push(Number(row.position ?? 50));
            existing.lastDataDate = String(row.fact_date ?? existing.lastDataDate);
            pageMap.set(pageUrl, existing);
        }

        const results: SeoOpportunity[] = [];
        for (const aggregate of pageMap.values()) {
            if (aggregate.impressions <= 0) {
                continue;
            }

            const avgPosition = aggregate.positions.reduce((sum, value) => sum + value, 0) / aggregate.positions.length;
            const ctr = aggregate.clicks / aggregate.impressions;

            let opportunityType: SeoOpportunity['opportunityType'] | null = null;
            let opportunityScore = 0;

            if (avgPosition >= 5 && avgPosition <= 20 && aggregate.impressions >= 50) {
                opportunityType = 'ranking_gap';
                opportunityScore = aggregate.impressions * Math.max(1, 21 - avgPosition);
            } else if (avgPosition <= 10 && aggregate.impressions >= 200 && ctr < 0.02) {
                opportunityType = 'low_ctr';
                opportunityScore = aggregate.impressions * Math.max(0.5, (0.025 - ctr) * 100);
            } else if (avgPosition <= 5 && aggregate.impressions >= 150 && aggregate.clicks < Math.max(10, Math.round(aggregate.impressions * 0.015))) {
                opportunityType = 'high_rank_low_traffic';
                opportunityScore = aggregate.impressions * 0.75;
            } else if (aggregate.impressions >= 1000) {
                opportunityType = 'monitor';
                opportunityScore = aggregate.impressions * 0.05;
            }

            if (!opportunityType || (type && opportunityType !== type)) {
                continue;
            }

            results.push({
                brandId: brandId,
                pageUrl: aggregate.pageUrl,
                impressions30d: aggregate.impressions,
                clicks30d: aggregate.clicks,
                avgPosition: Math.round(avgPosition * 10) / 10,
                ctr: Math.round(ctr * 10000) / 10000,
                opportunityScore: Math.round(opportunityScore),
                opportunityType,
                lastDataDate: aggregate.lastDataDate,
            });
        }

        return results
            .sort((left, right) => right.opportunityScore - left.opportunityScore)
            .slice(0, 100);
    } catch {
        return [];
    }
}

export async function getCannibalizationIssues(
    brandId: string,
    scope?: string | SeoDataScope,
): Promise<Array<{ query: string; competingPages: number; pages: string[]; totalImpressions: number; totalClicks: number; bestPosition: number }>> {
    try {
        const normalizedScope = normalizeSeoScope(scope);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        const query = applySearchConsoleFactScope(
            supabase
                .from('seo_query_facts')
                .select('query, page_url, impressions, clicks, position')
                .eq('brand_id', brandId)
                .gte('fact_date', thirtyDaysAgo)
                .limit(10000),
            normalizedScope,
        );

        const { data, error } = await query;
        if (error || !data) return [];

        const scopedFacts = scopeRowsToWebsite(data, normalizedScope, ['page_url']);
        const queryMap = new Map<string, Map<string, { impressions: number; clicks: number; bestPosition: number }>>();

        for (const row of scopedFacts) {
            const queryText = String(row.query ?? '').trim();
            const pageUrl = String(row.page_url ?? '').trim();
            if (!queryText || !pageUrl) {
                continue;
            }

            const pageMap = queryMap.get(queryText) ?? new Map<string, { impressions: number; clicks: number; bestPosition: number }>();
            const metrics = pageMap.get(pageUrl) ?? {
                impressions: 0,
                clicks: 0,
                bestPosition: Number(row.position ?? 100),
            };

            metrics.impressions += Number(row.impressions ?? 0);
            metrics.clicks += Number(row.clicks ?? 0);
            metrics.bestPosition = Math.min(metrics.bestPosition, Number(row.position ?? 100));
            pageMap.set(pageUrl, metrics);
            queryMap.set(queryText, pageMap);
        }

        return Array.from(queryMap.entries())
            .map(([queryText, pageMap]) => {
                const pageEntries = Array.from(pageMap.entries()).sort((left, right) => right[1].impressions - left[1].impressions);
                return {
                    query: queryText,
                    competingPages: pageEntries.length,
                    pages: pageEntries.map(([pageUrl]) => pageUrl),
                    totalImpressions: pageEntries.reduce((sum, [, metrics]) => sum + metrics.impressions, 0),
                    totalClicks: pageEntries.reduce((sum, [, metrics]) => sum + metrics.clicks, 0),
                    bestPosition: pageEntries.reduce((best, [, metrics]) => Math.min(best, metrics.bestPosition), 100),
                };
            })
            .filter((row) => row.competingPages > 1 && row.totalImpressions >= 50)
            .sort((left, right) => right.totalImpressions - left.totalImpressions)
            .slice(0, 50);
    } catch {
        return [];
    }
}

export async function getRankingGapPages(
    brandId: string,
    scope?: string | SeoDataScope,
): Promise<Array<{ url: string; avgPosition: number; impressions: number; clicks: number; potentialClicks: number }>> {
    try {
        const opportunities = await getOpportunities(brandId, 'ranking_gap', scope);
        return opportunities.map((opportunity) => ({
            url: opportunity.pageUrl,
            avgPosition: opportunity.avgPosition,
            impressions: opportunity.impressions30d,
            clicks: opportunity.clicks30d,
            potentialClicks: Math.round(opportunity.impressions30d * 0.05),
        }));
    } catch {
        return [];
    }
}

export async function getOrphanPages(
    brandId: string,
    scope?: string | SeoDataScope,
): Promise<SeoPage[]> {
    try {
        const normalizedScope = normalizeSeoScope(scope);
        let query = supabase
            .from('seo_pages')
            .select('*')
            .eq('brand_id', brandId)
            .eq('is_indexable', true)
            .eq('internal_links_in', 0)
            .order('impressions_30d', { ascending: false })
            .limit(100);

        if (normalizedScope.websiteId) {
            query = query.eq('website_id', normalizedScope.websiteId);
        }

        const { data, error } = await query;
        if (error || !data) return [];
        return data.map((row) => toPage(row as Record<string, unknown>));
    } catch {
        return [];
    }
}

export async function getDecayedPages(
    brandId: string,
    scope?: string | SeoDataScope,
): Promise<Array<{ url: string; recentClicks: number; olderClicks: number; decayPct: number }>> {
    try {
        const normalizedScope = normalizeSeoScope(scope);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        const sixtyDaysAgo  = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];
        const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

        const recentQuery = applySearchConsoleFactScope(
            supabase
                .from('seo_page_facts')
                .select('page_url, clicks')
                .eq('brand_id', brandId)
                .gte('fact_date', thirtyDaysAgo)
                .limit(10000),
            normalizedScope,
        );
        const olderQuery = applySearchConsoleFactScope(
            supabase
                .from('seo_page_facts')
                .select('page_url, clicks')
                .eq('brand_id', brandId)
                .gte('fact_date', ninetyDaysAgo)
                .lt('fact_date', sixtyDaysAgo)
                .limit(10000),
            normalizedScope,
        );

        const [{ data: recent }, { data: older }] = await Promise.all([recentQuery, olderQuery]);
        if (!recent || !older) return [];

        const scopedRecent = scopeRowsToWebsite(recent, normalizedScope, ['page_url']);
        const scopedOlder = scopeRowsToWebsite(older, normalizedScope, ['page_url']);

        const recentMap = new Map<string, number>();
        for (const row of scopedRecent) {
            const pageUrl = String(row.page_url ?? '');
            if (!pageUrl) {
                continue;
            }

            recentMap.set(pageUrl, (recentMap.get(pageUrl) ?? 0) + Number(row.clicks ?? 0));
        }

        const olderMap = new Map<string, number>();
        for (const row of scopedOlder) {
            const pageUrl = String(row.page_url ?? '');
            if (!pageUrl) {
                continue;
            }

            olderMap.set(pageUrl, (olderMap.get(pageUrl) ?? 0) + Number(row.clicks ?? 0));
        }

        const decayed: Array<{ url: string; recentClicks: number; olderClicks: number; decayPct: number }> = [];
        for (const [url, olderClicks] of olderMap.entries()) {
            if (olderClicks < 20) {
                continue;
            }

            const recentClicks = recentMap.get(url) ?? 0;
            const decayPct = ((olderClicks - recentClicks) / olderClicks) * 100;
            if (decayPct > 30) {
                decayed.push({ url, recentClicks, olderClicks, decayPct: Math.round(decayPct) });
            }
        }

        return decayed.sort((left, right) => right.decayPct - left.decayPct).slice(0, 50);
    } catch {
        return [];
    }
}

export async function getContentBriefs(
    brandId: string,
    filters?: { status?: BriefStatus; clusterId?: string; limit?: number }
): Promise<SeoContentBrief[]> {
    try {
        const { data, error } = await supabase
            .from('v_seo_brief_pipeline')
            .select('*')
            .eq('brand_id', brandId)
            .limit(filters?.limit ?? 100);
        if (error || !data) return [];
        return data.map(r => toBrief(r as Record<string, unknown>));
    } catch { return []; }
}

export async function createContentBrief(
    brandId: string,
    brief: Omit<SeoContentBrief, 'id' | 'brandId' | 'createdAt' | 'updatedAt'>
): Promise<SeoContentBrief | null> {
    try {
        const { data, error } = await supabase
            .from('seo_content_briefs')
            .insert([{
                brand_id:                   brandId,
                page_id:                    brief.pageId,
                cluster_id:                 brief.clusterId,
                target_keyword:             brief.targetKeyword,
                secondary_keywords:         brief.secondaryKeywords,
                search_intent:              brief.searchIntent,
                content_type:               brief.contentType,
                word_count_target:          brief.wordCountTarget,
                suggested_title:            brief.suggestedTitle,
                suggested_meta:             brief.suggestedMeta,
                h2_suggestions:             brief.h2Suggestions,
                entities:                   brief.entities,
                faq_suggestions:            brief.faqSuggestions,
                internal_links_suggestions: brief.internalLinksSuggestions,
                schema_type:                brief.schemaType,
                competitor_urls:            brief.competitorUrls,
                status:                     brief.status,
                priority:                   brief.priority,
                due_date:                   brief.dueDate,
                ai_generated:               brief.aiGenerated,
            }])
            .select()
            .single();
        if (error || !data) return null;
        return toBrief(data as Record<string, unknown>);
    } catch { return null; }
}

export async function updateBriefStatus(
    briefId: string,
    status: BriefStatus
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('seo_content_briefs')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', briefId);
        return !error;
    } catch { return false; }
}

/**
 * Build a content brief scaffold from keyword + GSC data.
 * The actual AI generation (H2s, FAQ, entities) is done by geminiService.
 * This returns the data skeleton + enriched GSC context.
 */
export async function buildBriefContext(
    brandId: string,
    keyword: string
): Promise<{
    keyword: string;
    impressions: number;
    avgPosition: number;
    ctr: number;
    topRankingUrls: string[];
    relatedQueries: string[];
    opportunityScore: number;
}> {
    try {
        // Pull GSC data for this keyword
        const { data: queryData } = await supabase
            .from('seo_query_facts')
            .select('page_url, impressions, clicks, position, ctr')
            .eq('brand_id', brandId)
            .ilike('query', `%${keyword}%`)
            .gte('fact_date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
            .order('impressions', { ascending: false })
            .limit(20);

        const totalImpressions  = queryData?.reduce((s, r) => s + Number(r.impressions ?? 0), 0) ?? 0;
        const totalClicks       = queryData?.reduce((s, r) => s + Number(r.clicks ?? 0), 0) ?? 0;
        const avgPosition       = queryData?.length
            ? queryData.reduce((s, r) => s + Number(r.position ?? 50), 0) / queryData.length
            : 50;
        const ctr               = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
        const topUrls           = [...new Set(queryData?.map(r => r.page_url as string) ?? [])].slice(0, 5);
        const opportunityScore  = totalImpressions * (1 - ctr);

        // Related queries (same brand, 30 days, containing similar terms)
        const { data: related } = await supabase
            .from('seo_query_facts')
            .select('query')
            .eq('brand_id', brandId)
            .ilike('query', `%${keyword.split(' ')[0]}%`)
            .gte('fact_date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
            .order('impressions', { ascending: false })
            .limit(20);

        const relatedQueries = [...new Set(related?.map(r => r.query as string) ?? [])]
            .filter(q => q.toLowerCase() !== keyword.toLowerCase())
            .slice(0, 10);

        return {
            keyword,
            impressions:        totalImpressions,
            avgPosition:        Math.round(avgPosition * 10) / 10,
            ctr:                Math.round(ctr * 10000) / 10000,
            topRankingUrls:     topUrls,
            relatedQueries,
            opportunityScore:   Math.round(opportunityScore),
        };
    } catch {
        return { keyword, impressions: 0, avgPosition: 50, ctr: 0, topRankingUrls: [], relatedQueries: [], opportunityScore: 0 };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 8 — CHANGE LOG
// ─────────────────────────────────────────────────────────────────────────────

export async function recordSeoChange(
    brandId: string,
    change: Omit<SeoChangeLog, 'id' | 'brandId' | 'changedAt' | 'measuredAt' | 'clicksImpactPct' | 'positionImpact'>
): Promise<SeoChangeLog | null> {
    try {
        const { data, error } = await supabase
            .from('seo_change_log')
            .insert([{
                brand_id:               brandId,
                page_id:                change.pageId,
                issue_id:               change.issueId,
                change_type:            change.changeType,
                description:            change.description,
                changed_url:            change.changedUrl,
                baseline_clicks:        change.baselineClicks,
                baseline_impressions:   change.baselineImpressions,
                baseline_position:      change.baselinePosition,
            }])
            .select()
            .single();
        if (error || !data) return null;
        return toChangeLog(data as Record<string, unknown>);
    } catch { return null; }
}

export async function measureChangeImpact(
    changeId: string,
    brandId: string,
    changedUrl: string
): Promise<{ updated: boolean; clicksImpactPct: number | null; positionImpact: number | null }> {
    try {
        // Pull last 30 days clicks for this URL
        const { data: recent } = await supabase
            .from('seo_page_facts')
            .select('clicks, impressions, position')
            .eq('brand_id', brandId)
            .eq('page_url', changedUrl)
            .gte('fact_date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);

        if (!recent || recent.length === 0) return { updated: false, clicksImpactPct: null, positionImpact: null };

        const postClicks   = recent.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
        const postPosition = recent.reduce((s, r) => s + Number(r.position ?? 50), 0) / recent.length;

        const { error } = await supabase
            .from('seo_change_log')
            .update({
                post_clicks:    postClicks,
                post_position:  Math.round(postPosition * 10) / 10,
                measured_at:    new Date().toISOString(),
            })
            .eq('id', changeId);

        if (error) return { updated: false, clicksImpactPct: null, positionImpact: null };

        // Fetch computed columns
        const { data: updated } = await supabase
            .from('seo_change_log')
            .select('clicks_impact_pct, position_impact')
            .eq('id', changeId)
            .single();

        return {
            updated: true,
            clicksImpactPct: updated?.clicks_impact_pct as number | null,
            positionImpact:  updated?.position_impact as number | null,
        };
    } catch { return { updated: false, clicksImpactPct: null, positionImpact: null }; }
}

export async function getChangeLogs(
    brandId: string,
    limit: number = 50
): Promise<SeoChangeLog[]> {
    try {
        const { data, error } = await supabase
            .from('seo_change_log')
            .select('*')
            .eq('brand_id', brandId)
            .order('changed_at', { ascending: false })
            .limit(limit);
        if (error || !data) return [];
        return data.map(r => toChangeLog(r as Record<string, unknown>));
    } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 9 — PRE/POST PUBLISH QA
// ─────────────────────────────────────────────────────────────────────────────

export interface PublishQAResult {
    pageUrl:            string;
    stage:              'pre-publish' | 'post-publish';
    checks:             Record<string, boolean | null>;
    qaScore:            number;
    blockers:           string[];    // must-fix before publish
    warnings:           string[];    // should-fix
}

export function runPrePublishQA(page: Partial<SeoPage>): PublishQAResult {
    const checks: Record<string, boolean | null> = {
        is_indexable:       page.isIndexable ?? null,
        canonical_correct:  page.canonicalUrl ? page.canonicalUrl === page.url : null,
        title_present:      !!page.title && page.title.length >= 20,
        meta_present:       !!page.metaDescription && page.metaDescription.length >= 50,
        h1_present:         !!page.h1,
        in_sitemap:         page.inSitemap ?? null,
        internal_links_ok:  (page.internalLinksIn ?? 0) > 0,
        speed_ok:           null, // requires external check
        schema_present:     false, // schemaTypes requires a separate fetch
    };

    const blockers: string[] = [];
    const warnings: string[] = [];

    if (checks.is_indexable === false)          blockers.push('Page is not indexable (noindex set)');
    if (checks.title_present === false)         blockers.push('Missing or too-short title tag');
    if (checks.h1_present === false)            blockers.push('Missing H1 tag');
    if (checks.canonical_correct === false)     warnings.push('Canonical URL mismatch');
    if (checks.meta_present === false)          warnings.push('Missing or too-short meta description');
    if (checks.in_sitemap === false)            warnings.push('Page not found in sitemap');
    if (checks.internal_links_ok === false)     warnings.push('No internal links pointing to this page');
    if (checks.schema_present === false)        warnings.push('No structured data / schema markup');

    const passCount = Object.values(checks).filter(v => v === true).length;
    const totalChecked = Object.values(checks).filter(v => v !== null).length;
    const qaScore = totalChecked > 0 ? Math.round((passCount / totalChecked) * 100) : 0;

    return { pageUrl: page.url ?? '', stage: 'pre-publish', checks, qaScore, blockers, warnings };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 10 — OVERVIEW KPIs
// ─────────────────────────────────────────────────────────────────────────────

export async function getSeoOverviewKPIs(
    brandId: string,
    scope?: string | SeoDataScope,
): Promise<SeoOverviewKPIs> {
    try {
        const normalizedScope = normalizeSeoScope(scope);
        const thirtyDays = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        const sixtyDays = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];

        const [
            { data: recentPageFacts },
            { data: olderPageFacts },
            { data: pages },
            { data: issues },
            { data: brandedFacts },
        ] = await Promise.all([
            applySearchConsoleFactScope(
                supabase
                    .from('seo_page_facts')
                    .select('page_url, clicks, impressions, position')
                    .eq('brand_id', brandId)
                    .gte('fact_date', thirtyDays)
                    .limit(10000),
                normalizedScope,
            ),
            applySearchConsoleFactScope(
                supabase
                    .from('seo_page_facts')
                    .select('page_url, clicks, impressions, position')
                    .eq('brand_id', brandId)
                    .gte('fact_date', sixtyDays)
                    .lt('fact_date', thirtyDays)
                    .limit(10000),
                normalizedScope,
            ),
            (() => {
                let query = supabase
                    .from('seo_pages')
                    .select('id, is_indexable')
                    .eq('brand_id', brandId);

                if (normalizedScope.websiteId) {
                    query = query.eq('website_id', normalizedScope.websiteId);
                }

                return query;
            })(),
            (() => {
                let query = supabase
                    .from('seo_issues')
                    .select('id, severity')
                    .eq('brand_id', brandId)
                    .in('status', ['open', 'in-progress']);

                if (normalizedScope.websiteId) {
                    query = query.eq('website_id', normalizedScope.websiteId);
                }

                return query;
            })(),
            applySearchConsoleFactScope(
                supabase
                    .from('seo_query_facts')
                    .select('clicks, is_branded, page_url')
                    .eq('brand_id', brandId)
                    .gte('fact_date', thirtyDays)
                    .limit(10000),
                normalizedScope,
            ),
        ]);

        const scopedRecentPageFacts = scopeRowsToWebsite(recentPageFacts ?? [], normalizedScope, ['page_url']);
        const scopedOlderPageFacts = scopeRowsToWebsite(olderPageFacts ?? [], normalizedScope, ['page_url']);
        const scopedBrandedFacts = scopeRowsToWebsite(brandedFacts ?? [], normalizedScope, ['page_url']);

        const recentByUrl = new Map<string, { clicks: number; impressions: number; positions: number[] }>();
        for (const row of scopedRecentPageFacts) {
            const url = String(row.page_url ?? '');
            if (!url) {
                continue;
            }

            const metrics = recentByUrl.get(url) ?? { clicks: 0, impressions: 0, positions: [] };
            metrics.clicks += Number(row.clicks ?? 0);
            metrics.impressions += Number(row.impressions ?? 0);
            metrics.positions.push(Number(row.position ?? 50));
            recentByUrl.set(url, metrics);
        }

        const totalClicks30d = Array.from(recentByUrl.values()).reduce((sum, metrics) => sum + metrics.clicks, 0);
        const totalImpressions30d = Array.from(recentByUrl.values()).reduce((sum, metrics) => sum + metrics.impressions, 0);
        const avgCtr30d = totalImpressions30d > 0 ? totalClicks30d / totalImpressions30d : 0;
        const allPositions = Array.from(recentByUrl.values()).flatMap((metrics) => metrics.positions);
        const avgPosition30d = allPositions.length > 0
            ? allPositions.reduce((sum, position) => sum + position, 0) / allPositions.length
            : 0;

        const indexedPages = (pages ?? []).filter((page) => page.is_indexable).length;
        const nonIndexedPages = (pages ?? []).filter((page) => !page.is_indexable).length;
        const openIssues = (issues ?? []).length;
        const criticalIssues = (issues ?? []).filter((issue) => issue.severity === 'critical').length;

        const olderByUrl = new Map<string, { clicks: number }>();
        for (const row of scopedOlderPageFacts) {
            const url = String(row.page_url ?? '');
            if (!url) {
                continue;
            }

            const metrics = olderByUrl.get(url) ?? { clicks: 0 };
            metrics.clicks += Number(row.clicks ?? 0);
            olderByUrl.set(url, metrics);
        }

        const deltas = Array.from(recentByUrl.entries()).map(([url, metrics]) => {
            const olderClicks = olderByUrl.get(url)?.clicks ?? 0;
            const recentAvgPosition = metrics.positions.reduce((sum, position) => sum + position, 0) / (metrics.positions.length || 1);
            return {
                url,
                clicksDelta: metrics.clicks - olderClicks,
                positionDelta: 0 - recentAvgPosition,
            };
        });

        let brandedClicks = 0;
        let nonBrandedClicks = 0;
        for (const row of scopedBrandedFacts) {
            if (row.is_branded) {
                brandedClicks += Number(row.clicks ?? 0);
            } else {
                nonBrandedClicks += Number(row.clicks ?? 0);
            }
        }

        return {
            totalClicks30d,
            totalImpressions30d,
            avgCtr30d: Math.round(avgCtr30d * 10000) / 10000,
            avgPosition30d: Math.round(avgPosition30d * 10) / 10,
            indexedPages,
            nonIndexedPages,
            openIssues,
            criticalIssues,
            topWinners: [...deltas]
                .sort((left, right) => right.clicksDelta - left.clicksDelta)
                .slice(0, 5)
                .map((delta) => ({
                    url: delta.url,
                    clicksDelta: delta.clicksDelta,
                    positionDelta: Math.round(delta.positionDelta * 10) / 10,
                })),
            topLosers: [...deltas]
                .sort((left, right) => left.clicksDelta - right.clicksDelta)
                .slice(0, 5)
                .map((delta) => ({
                    url: delta.url,
                    clicksDelta: delta.clicksDelta,
                    positionDelta: Math.round(delta.positionDelta * 10) / 10,
                })),
            brandedVsNonBranded: { brandedClicks, nonBrandedClicks },
        };
    } catch {
        return {
            totalClicks30d: 0,
            totalImpressions30d: 0,
            avgCtr30d: 0,
            avgPosition30d: 0,
            indexedPages: 0,
            nonIndexedPages: 0,
            openIssues: 0,
            criticalIssues: 0,
            topWinners: [],
            topLosers: [],
            brandedVsNonBranded: { brandedClicks: 0, nonBrandedClicks: 0 },
        };
    }
}

async function getSeoOverviewKPIsLegacy(
    brandId: string,
    connectionId?: string
): Promise<SeoOverviewKPIs> {
    try {
        const thirtyDays = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        const sixtyDays  = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];

        // Parallel fetches
        const [
            { data: recentPageFacts },
            { data: olderPageFacts },
            { data: pages },
            { data: issues },
            { data: brandedFacts },
        ] = await Promise.all([
            // Last 30d page performance
            supabase.from('seo_page_facts').select('page_url, clicks, impressions, position')
                .eq('brand_id', brandId)
                .gte('fact_date', thirtyDays)
                .then(q => connectionId ? { data: q.data?.filter(r => r) } : q),

            // 30-60d for comparison
            supabase.from('seo_page_facts').select('page_url, clicks, impressions, position')
                .eq('brand_id', brandId)
                .gte('fact_date', sixtyDays)
                .lt('fact_date', thirtyDays),

            // Indexed pages count
            supabase.from('seo_pages').select('id, is_indexable')
                .eq('brand_id', brandId),

            // Open issues
            supabase.from('seo_issues').select('id, severity')
                .eq('brand_id', brandId)
                .in('status', ['open', 'in-progress']),

            // Branded vs non-branded
            supabase.from('seo_query_facts').select('query, clicks, is_branded')
                .eq('brand_id', brandId)
                .gte('fact_date', thirtyDays)
                .limit(2000),
        ]);

        // Aggregate last 30d
        const recentByUrl = new Map<string, { clicks: number; impressions: number; positions: number[] }>();
        for (const r of (recentPageFacts ?? [])) {
            const url = r.page_url as string;
            const existing = recentByUrl.get(url) ?? { clicks: 0, impressions: 0, positions: [] };
            existing.clicks      += Number(r.clicks ?? 0);
            existing.impressions += Number(r.impressions ?? 0);
            existing.positions.push(Number(r.position ?? 50));
            recentByUrl.set(url, existing);
        }

        const totalClicks30d      = [...recentByUrl.values()].reduce((s, v) => s + v.clicks, 0);
        const totalImpressions30d = [...recentByUrl.values()].reduce((s, v) => s + v.impressions, 0);
        const avgCtr30d           = totalImpressions30d > 0 ? totalClicks30d / totalImpressions30d : 0;
        const allPositions        = [...recentByUrl.values()].flatMap(v => v.positions);
        const avgPosition30d      = allPositions.length > 0 ? allPositions.reduce((a, b) => a + b, 0) / allPositions.length : 0;

        // Page counts
        const indexedPages    = (pages ?? []).filter(p => p.is_indexable).length;
        const nonIndexedPages = (pages ?? []).filter(p => !p.is_indexable).length;

        // Issue counts
        const openIssues     = (issues ?? []).length;
        const criticalIssues = (issues ?? []).filter(i => i.severity === 'critical').length;

        // Winners & losers (vs previous 30d)
        const olderByUrl = new Map<string, { clicks: number }>();
        for (const r of (olderPageFacts ?? [])) {
            const url = r.page_url as string;
            const existing = olderByUrl.get(url) ?? { clicks: 0 };
            existing.clicks += Number(r.clicks ?? 0);
            olderByUrl.set(url, existing);
        }

        const deltas = [...recentByUrl.entries()].map(([url, agg]) => {
            const older = olderByUrl.get(url)?.clicks ?? 0;
            const recentAvgPos = agg.positions.reduce((a, b) => a + b, 0) / (agg.positions.length || 1);
            return { url, clicksDelta: agg.clicks - older, positionDelta: 0 - recentAvgPos };
        });

        const topWinners = deltas.sort((a, b) => b.clicksDelta - a.clicksDelta).slice(0, 5);
        const topLosers  = deltas.sort((a, b) => a.clicksDelta - b.clicksDelta).slice(0, 5);

        // Branded vs non-branded
        let brandedClicks = 0, nonBrandedClicks = 0;
        for (const r of (brandedFacts ?? [])) {
            if (r.is_branded) brandedClicks    += Number(r.clicks ?? 0);
            else              nonBrandedClicks += Number(r.clicks ?? 0);
        }

        return {
            totalClicks30d,
            totalImpressions30d,
            avgCtr30d:      Math.round(avgCtr30d * 10000) / 10000,
            avgPosition30d: Math.round(avgPosition30d * 10) / 10,
            indexedPages,
            nonIndexedPages,
            openIssues,
            criticalIssues,
            topWinners:     topWinners.map(d => ({ url: d.url, clicksDelta: d.clicksDelta, positionDelta: Math.round(d.positionDelta * 10) / 10 })),
            topLosers:      topLosers.map(d => ({ url: d.url, clicksDelta: d.clicksDelta, positionDelta: Math.round(d.positionDelta * 10) / 10 })),
            brandedVsNonBranded: { brandedClicks, nonBrandedClicks },
        };
    } catch {
        return {
            totalClicks30d: 0, totalImpressions30d: 0, avgCtr30d: 0, avgPosition30d: 0,
            indexedPages: 0, nonIndexedPages: 0, openIssues: 0, criticalIssues: 0,
            topWinners: [], topLosers: [], brandedVsNonBranded: { brandedClicks: 0, nonBrandedClicks: 0 },
        };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 11 — BUSINESS IMPACT (SEO → Revenue)
// ─────────────────────────────────────────────────────────────────────────────

export interface SeoBusinessImpactRow {
    pageUrl:            string;
    seoClicks30d:       number;
    seoImpressions30d:  number;
    avgPosition30d:     number;
    sessions30d:        number;
    conversions30d:     number;
    revenue30d:         number;
    revenuePerSession:  number;
    avgTimeOnPage:      number;
    bounceRate:         number | null;
}

export async function getSeoBusinessImpact(
    brandId: string,
    scope?: string | SeoDataScope,
): Promise<SeoBusinessImpactRow[]> {
    try {
        const normalizedScope = normalizeSeoScope(scope);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

        const [
            { data: seoFacts, error: seoError },
            { data: analyticsFacts, error: analyticsError },
        ] = await Promise.all([
            applySearchConsoleFactScope(
                supabase
                    .from('seo_page_facts')
                    .select('page_url, clicks, impressions, position')
                    .eq('brand_id', brandId)
                    .gte('fact_date', thirtyDaysAgo)
                    .limit(10000),
                normalizedScope,
            ),
            applyAnalyticsFactScope(
                supabase
                    .from('analytics_page_facts')
                    .select('landing_page, sessions, bounced_sessions, avg_engagement_time_sec, key_events, transactions, revenue')
                    .eq('brand_id', brandId)
                    .gte('fact_date', thirtyDaysAgo)
                    .limit(10000),
                normalizedScope,
            ),
        ]);

        if (seoError || analyticsError || !seoFacts) {
            return [];
        }

        const scopedSeoFacts = scopeRowsToWebsite(seoFacts, normalizedScope, ['page_url']);
        const scopedAnalyticsFacts = scopeRowsToWebsite(analyticsFacts ?? [], normalizedScope, ['landing_page']);

        const seoByPath = new Map<string, { pageUrl: string; clicks: number; impressions: number; positions: number[] }>();
        for (const row of scopedSeoFacts) {
            const pageUrl = String(row.page_url ?? '');
            if (!pageUrl) {
                continue;
            }

            const pathKey = normalizeUrlPath(pageUrl);
            const metrics = seoByPath.get(pathKey) ?? {
                pageUrl,
                clicks: 0,
                impressions: 0,
                positions: [],
            };

            metrics.clicks += Number(row.clicks ?? 0);
            metrics.impressions += Number(row.impressions ?? 0);
            metrics.positions.push(Number(row.position ?? 50));
            seoByPath.set(pathKey, metrics);
        }

        const analyticsByPath = new Map<string, {
            sessions: number;
            conversions: number;
            revenue: number;
            totalEngagementTime: number;
            bouncedSessions: number;
        }>();
        for (const row of scopedAnalyticsFacts) {
            const landingPage = String(row.landing_page ?? '');
            if (!landingPage) {
                continue;
            }

            const pathKey = normalizeUrlPath(landingPage);
            const sessions = Number(row.sessions ?? 0);
            const conversions = Number(row.transactions ?? 0) > 0
                ? Number(row.transactions ?? 0)
                : Number(row.key_events ?? 0);
            const metrics = analyticsByPath.get(pathKey) ?? {
                sessions: 0,
                conversions: 0,
                revenue: 0,
                totalEngagementTime: 0,
                bouncedSessions: 0,
            };

            metrics.sessions += sessions;
            metrics.conversions += conversions;
            metrics.revenue += Number(row.revenue ?? 0);
            metrics.totalEngagementTime += Number(row.avg_engagement_time_sec ?? 0) * sessions;
            metrics.bouncedSessions += Number(row.bounced_sessions ?? 0);
            analyticsByPath.set(pathKey, metrics);
        }

        return Array.from(seoByPath.entries())
            .map(([pathKey, seoMetrics]) => {
                const analyticsMetrics = analyticsByPath.get(pathKey);
                const avgPosition30d = seoMetrics.positions.length
                    ? seoMetrics.positions.reduce((sum, position) => sum + position, 0) / seoMetrics.positions.length
                    : 0;
                const sessions30d = analyticsMetrics?.sessions ?? 0;
                const revenue30d = analyticsMetrics?.revenue ?? 0;

                return {
                    pageUrl: seoMetrics.pageUrl,
                    seoClicks30d: seoMetrics.clicks,
                    seoImpressions30d: seoMetrics.impressions,
                    avgPosition30d: Math.round(avgPosition30d * 10) / 10,
                    sessions30d,
                    conversions30d: analyticsMetrics?.conversions ?? 0,
                    revenue30d,
                    revenuePerSession: sessions30d > 0 ? revenue30d / sessions30d : 0,
                    avgTimeOnPage: sessions30d > 0 ? (analyticsMetrics?.totalEngagementTime ?? 0) / sessions30d : 0,
                    bounceRate: sessions30d > 0 ? (analyticsMetrics?.bouncedSessions ?? 0) / sessions30d : null,
                };
            })
            .sort((left, right) => {
                if (right.revenue30d !== left.revenue30d) {
                    return right.revenue30d - left.revenue30d;
                }

                return right.seoClicks30d - left.seoClicks30d;
            })
            .slice(0, 100);
    } catch {
        return [];
    }
}

async function getSeoBusinessImpactLegacy(brandId: string): Promise<SeoBusinessImpactRow[]> {
    try {
        const { data, error } = await supabase
            .from('v_seo_business_impact')
            .select('*')
            .eq('brand_id', brandId)
            .order('revenue_30d', { ascending: false })
            .limit(100);
        if (error || !data) return [];
        return data.map(r => ({
            pageUrl:            r.page_url as string,
            seoClicks30d:       Number(r.seo_clicks_30d ?? 0),
            seoImpressions30d:  Number(r.seo_impressions_30d ?? 0),
            avgPosition30d:     Number(r.avg_position_30d ?? 0),
            sessions30d:        Number(r.sessions_30d ?? 0),
            conversions30d:     Number(r.conversions_30d ?? 0),
            revenue30d:         Number(r.revenue_30d ?? 0),
            revenuePerSession:  Number(r.revenue_per_session ?? 0),
            avgTimeOnPage:      Number(r.avg_time_on_page ?? 0),
            bounceRate:         r.bounce_rate as number | null,
        }));
    } catch { return []; }
}
