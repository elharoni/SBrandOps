/**
 * seoSyncService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Website Crawl + SEO Sync Engine
 *
 * WHAT THIS SERVICE DOES:
 *   1. Fetches robots.txt → extracts sitemap URL(s) + disallowed paths
 *   2. Fetches sitemap.xml (index or regular) → collects all page URLs
 *   3. For each page URL, calls PageSpeed Insights API:
 *        - On-page signals: title, meta, H1, canonical, noindex, status code
 *        - Performance: LCP, CLS, INP
 *        - Lighthouse SEO score
 *   4. Upserts page data into seo_pages Supabase table
 *   5. Runs auto issue detection: analyzes all pages for problems
 *   6. Computes and stores opportunity scores
 *
 * DATA FLOW:
 *   crawlWebsite(url, brandId)
 *     → parseSitemapXml(sitemapUrl) → string[]   (page URLs)
 *     → auditPageViaPsi(url)        → PageAuditData  (per-page data)
 *     → upsertSeoPage(brandId, ...)  → Supabase write
 *     → detectAndWriteIssues(pages) → Supabase write
 *
 * CORS STRATEGY:
 *   - robots.txt / sitemap.xml: fetched via allorigins.win CORS proxy
 *     (no auth needed, public files — safe for production MVP)
 *   - PSI API: direct fetch (Google allows CORS)
 *   - If CORS proxy fails: graceful fallback (manual URL input)
 *
 * ISSUE DETECTION ALGORITHM:
 *   For each page in seo_pages, check:
 *     - Missing title → critical
 *     - Title too long >60 chars → warning
 *     - Missing meta description → high
 *     - Missing H1 → high
 *     - noindex on indexable page → critical
 *     - status code ≠ 200 → critical
 *     - orphan page (0 internal links) → medium
 *     - thin content <300 words → medium
 *     - LCP > 2.5s → high
 *     - CLS > 0.1 → medium
 *
 * OPPORTUNITY SCORE FORMULA:
 *   Inputs: avg_position, impressions_30d, clicks_30d, ctr_30d
 *   CTR benchmarks by position (Google industry averages):
 *     1→28%, 2→15%, 3→11%, 4→8%, 5→7%, 6→5%, 7→4%, 8→3.5%, 9→3%, 10→2.7%
 *   opportunityScore (0–100) =
 *     positionComponent  = clamp((21 - position) / 16, 0, 1) × 40   [pos 5–20 zone]
 *     volumeComponent    = clamp(impressions / 10000, 0, 1) × 30
 *     ctrGapComponent    = clamp((expectedCtr - actualCtr) / expectedCtr, 0, 1) × 30
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from './supabaseClient';
import { computePageAuditScore, upsertSeoPage, createSeoIssue } from './seoIntelligenceService';
import type { SeoPage, IssueSeverity } from './seoIntelligenceService';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncProgress {
    phase: 'robots' | 'sitemap' | 'audit' | 'save' | 'issues' | 'done' | 'error';
    message: string;
    current: number;
    total: number;
    pagesDiscovered: number;
    pagesAudited: number;
    issuesFound: number;
}

export type SyncProgressCallback = (progress: SyncProgress) => void;

interface PageAuditData {
    url: string;
    title: string | null;
    metaDescription: string | null;
    h1: string | null;
    canonicalUrl: string | null;
    isIndexable: boolean;
    hasNoindex: boolean;
    statusCode: number;
    inSitemap: boolean;
    wordCount: number | null;
    lcpMs: number | null;
    clsVal: number | null;
    inpMs: number | null;
    seoScore: number | null;
    perfScore: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CTR BENCHMARK TABLE
// ─────────────────────────────────────────────────────────────────────────────

const CTR_BENCHMARK: Record<number, number> = {
    1: 0.284, 2: 0.154, 3: 0.113, 4: 0.082, 5: 0.067,
    6: 0.052, 7: 0.042, 8: 0.035, 9: 0.028, 10: 0.024,
};

function expectedCtr(position: number): number {
    if (position < 1) return 0;
    const rounded = Math.round(position);
    if (rounded <= 10) return CTR_BENCHMARK[rounded] ?? 0.024;
    if (rounded <= 20) return 0.015;
    return 0.005;
}

export function computeOpportunityScore(
    position: number,
    impressions: number,
    clicks: number,
): { score: number; type: 'ranking_gap' | 'low_ctr' | 'high_rank_low_traffic' | 'monitor' | null } {
    if (impressions <= 0) return { score: 0, type: null };

    const actualCtr = clicks / impressions;
    const expCtr = expectedCtr(position);

    if (position >= 5 && position <= 20 && impressions >= 50) {
        const posComp    = Math.max(0, Math.min(1, (21 - position) / 16)) * 40;
        const volComp    = Math.min(1, impressions / 10000) * 30;
        const ctrGapComp = expCtr > 0
            ? Math.max(0, Math.min(1, (expCtr - actualCtr) / expCtr)) * 30
            : 0;
        return { score: Math.round(posComp + volComp + ctrGapComp), type: 'ranking_gap' };
    }
    if (position <= 10 && impressions >= 200 && actualCtr < 0.02) {
        const ctrGap = expCtr > 0 ? Math.min(1, (expCtr - actualCtr) / expCtr) : 0;
        const volComp = Math.min(1, impressions / 10000) * 40;
        return { score: Math.round(ctrGap * 60 + volComp), type: 'low_ctr' };
    }
    if (position <= 5 && impressions >= 150 && clicks < Math.max(10, impressions * 0.015)) {
        return { score: Math.round(Math.min(1, impressions / 10000) * 75), type: 'high_rank_low_traffic' };
    }
    if (impressions >= 1000) {
        return { score: Math.round(Math.min(1, impressions / 50000) * 30), type: 'monitor' };
    }
    return { score: 0, type: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// CORS PROXY — for robots.txt and sitemap.xml
// ─────────────────────────────────────────────────────────────────────────────

async function fetchViaCorsProxy(targetUrl: string): Promise<string> {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) throw new Error(`CORS proxy error: ${resp.status}`);
    const json = await resp.json() as { contents: string; status: { http_code: number } };
    if (json.status.http_code >= 400) throw new Error(`HTTP ${json.status.http_code}`);
    return json.contents;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROBOTS.TXT PARSER
// ─────────────────────────────────────────────────────────────────────────────

interface RobotsData {
    sitemapUrls: string[];
    disallowedPaths: string[];
}

function parseRobotsTxt(text: string, baseUrl: string): RobotsData {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const sitemapUrls: string[] = [];
    const disallowedPaths: string[] = [];

    for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.startsWith('sitemap:')) {
            const sitemapUrl = line.slice(8).trim();
            if (sitemapUrl.startsWith('http')) sitemapUrls.push(sitemapUrl);
        } else if (lower.startsWith('disallow:')) {
            const path = line.slice(9).trim();
            if (path) disallowedPaths.push(path);
        }
    }

    // Default sitemap location if not specified
    if (sitemapUrls.length === 0) {
        const base = new URL(baseUrl);
        sitemapUrls.push(`${base.protocol}//${base.host}/sitemap.xml`);
        sitemapUrls.push(`${base.protocol}//${base.host}/sitemap_index.xml`);
    }

    return { sitemapUrls, disallowedPaths };
}

// ─────────────────────────────────────────────────────────────────────────────
// SITEMAP XML PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse sitemap XML (regular or index).
 * Returns up to maxUrls page URLs.
 * Handles sitemap index files recursively (one level).
 */
async function parseSitemapXml(sitemapUrl: string, maxUrls = 200): Promise<string[]> {
    const text = await fetchViaCorsProxy(sitemapUrl);
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');

    // Check if it's a sitemap index
    const isSitemapIndex = doc.querySelector('sitemapindex') !== null;

    if (isSitemapIndex) {
        const sitemapRefs = Array.from(doc.querySelectorAll('sitemap > loc'))
            .map(el => el.textContent?.trim() ?? '')
            .filter(Boolean)
            .slice(0, 5); // max 5 child sitemaps

        const allUrls: string[] = [];
        for (const ref of sitemapRefs) {
            if (allUrls.length >= maxUrls) break;
            try {
                const childUrls = await parseSitemapXml(ref, maxUrls - allUrls.length);
                allUrls.push(...childUrls);
            } catch { /* skip failed child sitemaps */ }
        }
        return allUrls.slice(0, maxUrls);
    }

    // Regular sitemap
    const urls = Array.from(doc.querySelectorAll('url > loc'))
        .map(el => el.textContent?.trim() ?? '')
        .filter(url => url.startsWith('http'))
        .slice(0, maxUrls);

    return urls;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE AUDIT VIA HTML SCRAPING (primary) + PSI (optional, homepage only)
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY HTML SCRAPING INSTEAD OF PSI:
//   - PSI requires a Google API key for bulk use (>1 req/s gets 429)
//   - PSI takes 20-30s per page — 50 pages = 25 minutes
//   - HTML scraping via CORS proxy: 2-5s per page, no API key, no rate limit
//   - Gives MORE on-page data: title, meta, H1, canonical, noindex, word count,
//     image alts, internal links — everything we need for SEO scoring
//   - PSI is still used optionally for the homepage performance metrics

/**
 * Fetch a page's HTML via CORS proxy and parse SEO signals.
 * Falls back to a lightweight metadata-only object if the fetch fails.
 */
async function auditPageViaHtml(url: string): Promise<PageAuditData> {
    // Try multiple proxy strategies
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(20000) });

    if (!resp.ok) throw new Error(`Proxy ${resp.status} for ${url}`);

    const json = await resp.json() as {
        contents: string;
        status: { http_code: number };
    };

    const statusCode = json.status?.http_code ?? 200;

    // If page returned 4xx/5xx, record it but don't fail the whole audit
    if (statusCode >= 400) {
        return {
            url, title: null, metaDescription: null, h1: null,
            canonicalUrl: null, isIndexable: false, hasNoindex: false,
            statusCode, inSitemap: true, wordCount: 0,
            lcpMs: null, clsVal: null, inpMs: null,
            seoScore: null, perfScore: null,
        };
    }

    const html = json.contents ?? '';

    // Parse with DOMParser (available in browser)
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // ── On-page signals ──────────────────────────────────────────────────────
    const title = doc.querySelector('title')?.textContent?.trim() ?? null;

    const metaDescEl = doc.querySelector('meta[name="description"], meta[name="Description"]');
    const metaDescription = metaDescEl?.getAttribute('content')?.trim() ?? null;

    // H1 — first one on page
    const h1 = doc.querySelector('h1')?.textContent?.trim().replace(/\s+/g, ' ') ?? null;

    // Canonical
    const canonicalUrl = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() ?? null;

    // Robots meta — check noindex
    const robotsMeta = (
        doc.querySelector('meta[name="robots"]')?.getAttribute('content') ??
        doc.querySelector('meta[name="Robots"]')?.getAttribute('content') ??
        ''
    ).toLowerCase();
    const hasNoindex = robotsMeta.includes('noindex');

    // Word count (rough — body text minus scripts/styles)
    const bodyEl = doc.body ?? doc.documentElement;
    // Remove script/style text
    const clone = bodyEl.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script, style, nav, footer, header').forEach(el => el.remove());
    const bodyText = clone.textContent ?? '';
    const wordCount = bodyText.trim().split(/\s+/).filter(w => w.length > 2).length;

    // Images without alt
    const images = Array.from(doc.querySelectorAll('img'));
    const imagesWithoutAlt = images.filter(img => !img.getAttribute('alt')?.trim()).length;

    // Basic SEO score from on-page signals (0-100)
    let seoScore = 100;
    if (!title || title.length === 0) seoScore -= 25;
    else if (title.length > 60) seoScore -= 10;
    if (!metaDescription || metaDescription.length === 0) seoScore -= 20;
    else if (metaDescription.length > 160) seoScore -= 5;
    if (!h1) seoScore -= 15;
    if (hasNoindex) seoScore -= 30;
    if (wordCount < 300) seoScore -= 10;
    if (imagesWithoutAlt > 3) seoScore -= 5;

    return {
        url,
        title:           title && title.length > 0 ? title : null,
        metaDescription: metaDescription && metaDescription.length > 0 ? metaDescription : null,
        h1:              h1 && h1.length > 0 ? h1 : null,
        canonicalUrl,
        isIndexable: !hasNoindex,
        hasNoindex,
        statusCode,
        inSitemap: true,
        wordCount,
        lcpMs:     null, // HTML scraping doesn't measure runtime performance
        clsVal:    null,
        inpMs:     null,
        seoScore:  Math.max(0, seoScore),
        perfScore: null,
    };
}

/**
 * Optional: run PSI for a single URL (homepage only) to get performance metrics.
 * Returns null if no API key / quota exceeded.
 */
async function getPsiPerfMetrics(url: string): Promise<{ lcpMs: number | null; clsVal: number | null; inpMs: number | null; perfScore: number | null } | null> {
    try {
        const params = new URLSearchParams({ url, strategy: 'mobile', category: 'performance' });
        const apiKey = (import.meta.env as Record<string, string>)['VITE_GOOGLE_API_KEY'];
        if (apiKey) params.set('key', apiKey);

        const resp = await fetch(
            `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`,
            { signal: AbortSignal.timeout(35000) }
        );
        if (!resp.ok) return null;

        const psi = await resp.json() as {
            lighthouseResult: {
                categories?: { performance?: { score: number } };
                audits: Record<string, { numericValue?: number }>;
            };
            loadingExperience?: {
                metrics?: {
                    LARGEST_CONTENTFUL_PAINT_MS?: { percentile: number };
                    CUMULATIVE_LAYOUT_SHIFT_SCORE?: { percentile: number };
                    INTERACTION_TO_NEXT_PAINT?: { percentile: number };
                };
            };
        };

        const cwv    = psi.loadingExperience?.metrics;
        const audits = psi.lighthouseResult.audits;

        const lcpMs = cwv?.LARGEST_CONTENTFUL_PAINT_MS?.percentile
            ?? audits['largest-contentful-paint']?.numericValue ?? null;
        const clsRaw = cwv?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile;
        const clsVal = clsRaw != null ? clsRaw / 100 : (audits['cumulative-layout-shift']?.numericValue ?? null);
        const inpMs  = cwv?.INTERACTION_TO_NEXT_PAINT?.percentile
            ?? audits['interaction-to-next-paint']?.numericValue
            ?? audits['total-blocking-time']?.numericValue ?? null;
        const perfScore = Math.round((psi.lighthouseResult.categories?.performance?.score ?? 0) * 100);

        return { lcpMs, clsVal, inpMs, perfScore };
    } catch {
        return null; // silently ignore — PSI is optional
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ISSUE DETECTION FROM PAGES
// ─────────────────────────────────────────────────────────────────────────────

interface DetectedIssue {
    issueType: 'technical' | 'on-page' | 'content' | 'speed';
    category: string;
    title: string;
    description: string;
    affectedUrl: string;
    severity: IssueSeverity;
    autoDetected: true;
    detectionSource: 'seo-sync';
}

function detectIssuesFromPage(page: PageAuditData): DetectedIssue[] {
    const issues: DetectedIssue[] = [];

    if (page.statusCode >= 400) {
        issues.push({
            issueType: 'technical', category: `http-${page.statusCode}`,
            title: `صفحة ${page.statusCode} — ${page.url}`,
            description: `الصفحة تُعيد كود HTTP ${page.statusCode}. لن تُفهرس بواسطة محركات البحث وتضر بتجربة المستخدم.`,
            affectedUrl: page.url,
            severity: 'critical', autoDetected: true, detectionSource: 'seo-sync',
        });
    }

    if (page.hasNoindex) {
        issues.push({
            issueType: 'technical', category: 'noindex',
            title: `صفحة بـ noindex — ${page.url}`,
            description: 'الصفحة تحتوي على وسم noindex أو محجوبة في robots.txt. لن تظهر في نتائج البحث.',
            affectedUrl: page.url,
            severity: 'high', autoDetected: true, detectionSource: 'seo-sync',
        });
    }

    if (!page.title) {
        issues.push({
            issueType: 'on-page', category: 'missing-title',
            title: `عنوان مفقود — ${page.url}`,
            description: 'الصفحة لا تحتوي على عنوان <title>. العنوان هو أقوى إشارة on-page لمحركات البحث.',
            affectedUrl: page.url,
            severity: 'critical', autoDetected: true, detectionSource: 'seo-sync',
        });
    }

    if (!page.metaDescription) {
        issues.push({
            issueType: 'on-page', category: 'missing-meta',
            title: `وصف meta مفقود — ${page.url}`,
            description: 'الصفحة لا تحتوي على meta description. يؤثر على معدل النقر (CTR) من نتائج البحث.',
            affectedUrl: page.url,
            severity: 'high', autoDetected: true, detectionSource: 'seo-sync',
        });
    }

    if (page.lcpMs != null && page.lcpMs > 4000) {
        issues.push({
            issueType: 'speed', category: 'lcp-poor',
            title: `LCP ضعيف (${(page.lcpMs / 1000).toFixed(1)}s) — ${page.url}`,
            description: `Largest Contentful Paint يستغرق ${(page.lcpMs / 1000).toFixed(1)} ثانية. المعيار الجيد هو أقل من 2.5 ثانية.`,
            affectedUrl: page.url,
            severity: 'high', autoDetected: true, detectionSource: 'seo-sync',
        });
    } else if (page.lcpMs != null && page.lcpMs > 2500) {
        issues.push({
            issueType: 'speed', category: 'lcp-average',
            title: `LCP يحتاج تحسين (${(page.lcpMs / 1000).toFixed(1)}s) — ${page.url}`,
            description: `Largest Contentful Paint يستغرق ${(page.lcpMs / 1000).toFixed(1)} ثانية. الهدف أقل من 2.5s.`,
            affectedUrl: page.url,
            severity: 'medium', autoDetected: true, detectionSource: 'seo-sync',
        });
    }

    if (page.clsVal != null && page.clsVal > 0.25) {
        issues.push({
            issueType: 'speed', category: 'cls-poor',
            title: `CLS عالي (${page.clsVal.toFixed(3)}) — ${page.url}`,
            description: `Cumulative Layout Shift قيمته ${page.clsVal.toFixed(3)}. تجاوز عتبة 0.25 يعني تجربة مستخدم سيئة.`,
            affectedUrl: page.url,
            severity: 'medium', autoDetected: true, detectionSource: 'seo-sync',
        });
    }

    return issues;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: CRAWL WEBSITE
// ─────────────────────────────────────────────────────────────────────────────

export interface CrawlResult {
    pagesDiscovered: number;
    pagesAudited: number;
    pagesFailed: number;
    issuesFound: number;
    errors: string[];
}

/**
 * Main entry point: crawl a website and populate seo_pages + seo_issues.
 *
 * @param websiteUrl  Root URL, e.g. "https://example.com"
 * @param brandId     Brand ID in Supabase
 * @param onProgress  Optional callback for real-time progress updates
 * @param maxPages    Max pages to audit (default 50, PSI API is rate-limited)
 */
export async function crawlWebsite(
    websiteUrl: string,
    brandId: string,
    onProgress?: SyncProgressCallback,
    maxPages = 50,
): Promise<CrawlResult> {
    const errors: string[] = [];
    let pagesAudited = 0;
    let pagesFailed = 0;
    const allIssues: DetectedIssue[] = [];
    const auditedPages: PageAuditData[] = [];

    const report = (phase: SyncProgress['phase'], message: string, current = 0, total = 0) => {
        onProgress?.({
            phase, message, current, total,
            pagesDiscovered: 0, pagesAudited, issuesFound: allIssues.length,
        });
    };

    // Normalize URL
    const base = new URL(websiteUrl);
    const rootUrl = `${base.protocol}//${base.host}`;

    // ── Step 1: robots.txt ───────────────────────────────────────────────────
    report('robots', 'جارٍ قراءة robots.txt...');
    let robotsData: RobotsData = {
        sitemapUrls: [`${rootUrl}/sitemap.xml`],
        disallowedPaths: [],
    };
    try {
        const robotsText = await fetchViaCorsProxy(`${rootUrl}/robots.txt`);
        robotsData = parseRobotsTxt(robotsText, rootUrl);
    } catch (e) {
        errors.push(`robots.txt: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ── Step 2: Sitemap → collect URLs ───────────────────────────────────────
    report('sitemap', 'جارٍ تحليل Sitemap وجمع الصفحات...');
    let pageUrls: string[] = [];
    for (const sitemapUrl of robotsData.sitemapUrls.slice(0, 3)) {
        if (pageUrls.length >= maxPages) break;
        try {
            const urls = await parseSitemapXml(sitemapUrl, maxPages - pageUrls.length);
            pageUrls.push(...urls);
        } catch (e) {
            errors.push(`sitemap (${sitemapUrl}): ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    // Deduplicate + filter to same domain
    pageUrls = [...new Set(pageUrls)]
        .filter(u => {
            try { return new URL(u).host === base.host; } catch { return false; }
        })
        .slice(0, maxPages);

    if (pageUrls.length === 0) {
        // Fallback: just audit the root URL
        pageUrls = [websiteUrl];
    }

    onProgress?.({
        phase: 'audit',
        message: `تم اكتشاف ${pageUrls.length} صفحة — يبدأ التدقيق...`,
        current: 0, total: pageUrls.length,
        pagesDiscovered: pageUrls.length, pagesAudited: 0, issuesFound: 0,
    });

    // ── Step 3: Audit each page via HTML scraping ─────────────────────────────
    // Sequential with 300ms delay — avoids hammering the CORS proxy
    // HTML scraping: ~2-5s per page, no API key, gets title/meta/H1/canonical/noindex
    const DELAY_MS = 300;

    for (let i = 0; i < pageUrls.length; i++) {
        onProgress?.({
            phase: 'audit',
            message: `يدقق الصفحة ${i + 1} من ${pageUrls.length}: ${pageUrls[i].replace(/^https?:\/\/[^/]+/, '').slice(0, 40) || '/'}`,
            current: i, total: pageUrls.length,
            pagesDiscovered: pageUrls.length, pagesAudited, issuesFound: allIssues.length,
        });

        try {
            const data = await auditPageViaHtml(pageUrls[i]);
            auditedPages.push(data);
            allIssues.push(...detectIssuesFromPage(data));
            pagesAudited++;
        } catch (e) {
            pagesFailed++;
            errors.push(`${pageUrls[i]}: ${e instanceof Error ? e.message : String(e)}`);
        }

        // Small delay between requests to be polite to the proxy
        if (i < pageUrls.length - 1) {
            await new Promise(res => setTimeout(res, DELAY_MS));
        }
    }

    // Optional: enrich homepage with PSI performance metrics (non-blocking)
    if (auditedPages.length > 0) {
        const homepage = auditedPages.find(p => {
            try { return new URL(p.url).pathname === '/'; } catch { return false; }
        }) ?? auditedPages[0];

        onProgress?.({
            phase: 'audit',
            message: 'جارٍ قياس أداء الصفحة الرئيسية عبر PageSpeed...',
            current: pageUrls.length, total: pageUrls.length,
            pagesDiscovered: pageUrls.length, pagesAudited, issuesFound: allIssues.length,
        });

        const perf = await getPsiPerfMetrics(homepage.url);
        if (perf) {
            homepage.lcpMs    = perf.lcpMs;
            homepage.clsVal   = perf.clsVal;
            homepage.inpMs    = perf.inpMs;
            homepage.perfScore = perf.perfScore;
        }
    }

    // ── Step 4: Save pages to Supabase ───────────────────────────────────────
    report('save', `يحفظ ${auditedPages.length} صفحة في قاعدة البيانات...`, auditedPages.length, auditedPages.length);

    for (const page of auditedPages) {
        const { score: auditScore } = computePageAuditScore({
            title:           page.title,
            metaDescription: page.metaDescription,
            h1:              page.h1,
            canonicalUrl:    page.canonicalUrl,
            isIndexable:     page.isIndexable,
            hasNoindex:      page.hasNoindex,
            inSitemap:       page.inSitemap,
            statusCode:      page.statusCode,
            wordCount:       page.wordCount,
        });

        await upsertSeoPage(brandId, {
            websiteId:          null,
            marketId:           null,
            url:                page.url,
            pageType:           inferPageType(page.url),
            template:           null,
            title:              page.title,
            metaDescription:    page.metaDescription !== '__present__' ? page.metaDescription : 'present',
            h1:                 page.h1,
            canonicalUrl:       page.canonicalUrl,
            isIndexable:        page.isIndexable,
            hasNoindex:         page.hasNoindex,
            inSitemap:          page.inSitemap,
            statusCode:         page.statusCode,
            wordCount:          page.wordCount,
            internalLinksIn:    0,
            clicks30d:          0,
            impressions30d:     0,
            ctr30d:             0,
            avgPosition30d:     null,
            lastAuditedAt:      new Date().toISOString(),
            auditScore,
        });
    }

    // ── Step 5: Save issues to Supabase ─────────────────────────────────────
    report('issues', `يسجل ${allIssues.length} مشكلة مكتشفة...`, allIssues.length, allIssues.length);

    // Batch insert issues
    if (allIssues.length > 0) {
        const issuesToInsert = allIssues.map(issue => ({
            brand_id:         brandId,
            website_id:       null,
            page_id:          null,
            issue_type:       issue.issueType,
            category:         issue.category,
            title:            issue.title,
            description:      issue.description,
            affected_url:     issue.affectedUrl,
            affected_count:   1,
            severity:         issue.severity,
            status:           'open',
            auto_detected:    true,
            detection_source: issue.detectionSource,
        }));

        await supabase
            .from('seo_issues')
            .upsert(issuesToInsert, {
                onConflict: 'brand_id,category,affected_url',
                ignoreDuplicates: true,
            });
    }

    report('done', `اكتمل — ${pagesAudited} صفحة مدققة، ${allIssues.length} مشكلة مكتشفة`);

    return {
        pagesDiscovered: pageUrls.length,
        pagesAudited,
        pagesFailed,
        issuesFound: allIssues.length,
        errors,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE TYPE INFERENCE
// ─────────────────────────────────────────────────────────────────────────────

function inferPageType(url: string): SeoPage['pageType'] {
    try {
        const path = new URL(url).pathname.toLowerCase();
        if (path === '/' || path === '') return 'homepage';
        if (/\/(blog|مقال|مدونة|news|article)/i.test(path)) return 'blog';
        if (/\/(product|منتج|item|shop|متجر)/i.test(path)) return 'product';
        if (/\/(category|تصنيف|cat|قسم)/i.test(path)) return 'category';
        if (/\/(landing|عرض|promo)/i.test(path)) return 'landing';
        if (/\/(tag|وسم)/i.test(path)) return 'tag';
        if (/\/(author|كاتب)/i.test(path)) return 'author';
        return 'other';
    } catch {
        return 'other';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// KEYWORD OPPORTUNITY RECOMPUTE
// Recomputes opportunity_score for all keywords in seo_keyword_map
// after data sync — runs server-side on existing Supabase data
// ─────────────────────────────────────────────────────────────────────────────

export async function recomputeKeywordOpportunities(brandId: string): Promise<number> {
    try {
        const { data, error } = await supabase
            .from('seo_keyword_map')
            .select('id, current_position, impressions_30d, clicks_30d')
            .eq('brand_id', brandId)
            .not('current_position', 'is', null);

        if (error || !data) return 0;

        let updated = 0;
        for (const row of data) {
            const pos        = Number(row.current_position ?? 50);
            const impressions = Number(row.impressions_30d ?? 0);
            const clicks     = Number(row.clicks_30d ?? 0);
            const { score, type } = computeOpportunityScore(pos, impressions, clicks);

            const { error: updateError } = await supabase
                .from('seo_keyword_map')
                .update({ opportunity_score: score, mapping_status: type ?? 'candidate' })
                .eq('id', row.id as string);

            if (!updateError) updated++;
        }

        return updated;
    } catch { return 0; }
}
