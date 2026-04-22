const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'services/seoSyncService.ts');
let content = fs.readFileSync(filePath, 'utf8');

// ── Replace the entire PSI audit section with HTML scraping ──────────────────

const oldPsiSection = `// ─────────────────────────────────────────────────────────────────────────────
// PAGE AUDIT VIA PSI
// ─────────────────────────────────────────────────────────────────────────────

async function auditPageViaPsi(url: string): Promise<PageAuditData> {
    const params = new URLSearchParams({ url, strategy: 'mobile' });
    (['performance', 'seo'] as const).forEach(c => params.append('category', c));
    const apiKey = (import.meta.env as Record<string, string>)['VITE_GOOGLE_API_KEY'];
    if (apiKey) params.set('key', apiKey);

    const resp = await fetch(
        \`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?\${params.toString()}\`,
        { signal: AbortSignal.timeout(30000) }
    );

    if (!resp.ok) throw new Error(\`PSI error \${resp.status}\`);

    const psi = await resp.json() as {
        lighthouseResult: {
            categories?: { performance?: { score: number }; seo?: { score: number } };
            audits: Record<string, { score: number | null; numericValue?: number; displayValue?: string; title?: string }>;
        };
        loadingExperience?: {
            metrics?: {
                LARGEST_CONTENTFUL_PAINT_MS?: { percentile: number };
                CUMULATIVE_LAYOUT_SHIFT_SCORE?: { percentile: number };
                INTERACTION_TO_NEXT_PAINT?: { percentile: number };
            };
        };
    };

    const audits = psi.lighthouseResult.audits;
    const cwv    = psi.loadingExperience?.metrics;

    // On-page signals from Lighthouse audits
    const hasMeta     = (audits['meta-description']?.score ?? 0) >= 0.9;
    const hasTitle    = (audits['document-title']?.score ?? 0) >= 0.9;
    const isCrawlable = (audits['is-crawlable']?.score ?? 1) >= 0.9;

    // Extract title text from displayValue of document-title audit
    const titleText = hasTitle
        ? (audits['document-title']?.displayValue ?? null)
        : null;

    // LCP (ms) — prefer real-user CrUX
    const lcpMs = cwv?.LARGEST_CONTENTFUL_PAINT_MS?.percentile
        ?? audits['largest-contentful-paint']?.numericValue
        ?? null;

    // CLS — CrUX stores as ×100 integer
    const clsRaw = cwv?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile;
    const clsVal = clsRaw != null
        ? clsRaw / 100
        : (audits['cumulative-layout-shift']?.numericValue ?? null);

    // INP / TBT
    const inpMs = cwv?.INTERACTION_TO_NEXT_PAINT?.percentile
        ?? audits['interaction-to-next-paint']?.numericValue
        ?? audits['total-blocking-time']?.numericValue
        ?? null;

    const statusCode = Math.round(audits['http-status-code']?.numericValue ?? 200);

    return {
        url,
        title:           titleText,
        metaDescription: hasMeta ? '__present__' : null,
        h1:              null, // Lighthouse doesn't expose H1 text directly
        canonicalUrl:    null,
        isIndexable:     isCrawlable,
        hasNoindex:      !isCrawlable,
        statusCode,
        inSitemap:       true, // we discovered it from sitemap
        wordCount:       null,
        lcpMs,
        clsVal,
        inpMs,
        seoScore:        Math.round((psi.lighthouseResult.categories?.seo?.score ?? 0) * 100),
        perfScore:       Math.round((psi.lighthouseResult.categories?.performance?.score ?? 0) * 100),
    };
}`;

const newHtmlSection = `// ─────────────────────────────────────────────────────────────────────────────
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
    const proxyUrl = \`https://api.allorigins.win/get?url=\${encodeURIComponent(url)}\`;
    const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(20000) });

    if (!resp.ok) throw new Error(\`Proxy \${resp.status} for \${url}\`);

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
    const h1 = doc.querySelector('h1')?.textContent?.trim().replace(/\\s+/g, ' ') ?? null;

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
    const wordCount = bodyText.trim().split(/\\s+/).filter(w => w.length > 2).length;

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
            \`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?\${params.toString()}\`,
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
}`;

if (content.includes('auditPageViaPsi') && !content.includes('auditPageViaHtml')) {
    content = content.replace(oldPsiSection, newHtmlSection);
    console.log('Replaced PSI section with HTML scraping');
} else if (content.includes('auditPageViaHtml')) {
    console.log('HTML scraping already present');
} else {
    console.log('WARN: Could not find PSI section to replace');
}

// ── Replace the crawl loop to use HTML scraping ──────────────────────────────
const oldCrawlLoop = `    // ── Step 3: Audit each page via PSI ─────────────────────────────────────
    // Batch to avoid rate limits (PSI allows ~400 req/100s per IP without key)
    const BATCH_SIZE = 5;
    const DELAY_MS   = 1000; // 1s between batches

    for (let i = 0; i < pageUrls.length; i += BATCH_SIZE) {
        const batch = pageUrls.slice(i, i + BATCH_SIZE);

        onProgress?.({
            phase: 'audit',
            message: \`يدقق الصفحات \${i + 1}–\${Math.min(i + BATCH_SIZE, pageUrls.length)} من \${pageUrls.length}...\`,
            current: i, total: pageUrls.length,
            pagesDiscovered: pageUrls.length, pagesAudited, issuesFound: allIssues.length,
        });

        const batchResults = await Promise.allSettled(batch.map(url => auditPageViaPsi(url)));
        for (const result of batchResults) {
            if (result.status === 'fulfilled') {
                auditedPages.push(result.value);
                allIssues.push(...detectIssuesFromPage(result.value));
                pagesAudited++;
            } else {
                pagesFailed++;
                errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
            }
        }

        if (i + BATCH_SIZE < pageUrls.length) {
            await new Promise(res => setTimeout(res, DELAY_MS));
        }
    }`;

const newCrawlLoop = `    // ── Step 3: Audit each page via HTML scraping ─────────────────────────────
    // Sequential with 300ms delay — avoids hammering the CORS proxy
    // HTML scraping: ~2-5s per page, no API key, gets title/meta/H1/canonical/noindex
    const DELAY_MS = 300;

    for (let i = 0; i < pageUrls.length; i++) {
        onProgress?.({
            phase: 'audit',
            message: \`يدقق الصفحة \${i + 1} من \${pageUrls.length}: \${pageUrls[i].replace(/^https?:\\/\\/[^/]+/, '').slice(0, 40) || '/'}\`,
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
            errors.push(\`\${pageUrls[i]}: \${e instanceof Error ? e.message : String(e)}\`);
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
    }`;

if (content.includes(oldCrawlLoop)) {
    content = content.replace(oldCrawlLoop, newCrawlLoop);
    console.log('Updated crawl loop to use HTML scraping');
} else if (content.includes('auditPageViaHtml(pageUrls[i])')) {
    console.log('Crawl loop already updated');
} else {
    console.log('WARN: Could not find crawl loop to update');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done. File size:', fs.statSync(filePath).size, 'bytes');
