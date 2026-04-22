/**
 * seoAuditService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Real Technical SEO Audit via Google PageSpeed Insights API v5
 *
 * DATA FLOW:
 *   1. Call PSI API (mobile strategy) with all 4 Lighthouse categories
 *   2. Extract real Core Web Vitals from CrUX (real-user) data when available,
 *      fallback to Lighthouse lab data
 *   3. Map failing Lighthouse audit items → categorized AuditIssue objects
 *   4. Compute weighted overall SEO health score:
 *        overallScore = perf×0.30 + seo×0.35 + bestPractices×0.20 + a11y×0.15
 *
 * LIGHTHOUSE AUDITS MAPPED:
 *   Crawling/On-Page (seo category):
 *     meta-description, document-title, http-status-code, canonical,
 *     is-crawlable, robots-txt, link-text, image-alt, hreflang,
 *     crawlable-anchors, structured-data
 *   Performance:
 *     render-blocking-resources, uses-optimized-images, uses-long-cache-ttl,
 *     unminified-css, unminified-javascript, unused-css-rules,
 *     unused-javascript, uses-text-compression, offscreen-images,
 *     efficient-animated-content
 *   Schema:
 *     structured-data (also appears in crawling for issue count)
 *
 * SCORE THRESHOLDS (Lighthouse standard):
 *   good    ≥ 0.9  → green
 *   average ≥ 0.5  → yellow
 *   poor    <  0.5 → red
 *
 * Core Web Vitals thresholds (Google):
 *   LCP:  good ≤ 2500ms, needs improvement ≤ 4000ms, poor > 4000ms
 *   CLS:  good ≤ 0.10,   needs improvement ≤ 0.25,   poor > 0.25
 *   INP:  good ≤ 200ms,  needs improvement ≤ 500ms,  poor > 500ms
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { TechnicalSEOAuditResult, AuditIssue } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// PSI API TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface PsiAuditItem {
    score: number | null;
    numericValue?: number;
    displayValue?: string;
    description?: string;
    title?: string;
    details?: {
        items?: Array<Record<string, unknown>>;
        type?: string;
        summary?: Record<string, unknown>;
    };
}

interface PsiResponse {
    lighthouseResult: {
        categories: {
            performance?: { score: number };
            seo?: { score: number };
            'best-practices'?: { score: number };
            accessibility?: { score: number };
        };
        audits: Record<string, PsiAuditItem>;
    };
    loadingExperience?: {
        overall_category?: string;
        metrics?: {
            LARGEST_CONTENTFUL_PAINT_MS?: { percentile: number; category: string };
            CUMULATIVE_LAYOUT_SHIFT_SCORE?: { percentile: number; category: string };
            INTERACTION_TO_NEXT_PAINT?: { percentile: number; category: string };
            FIRST_CONTENTFUL_PAINT_MS?: { percentile: number; category: string };
        };
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// RATING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function lcpRating(ms: number): 'good' | 'average' | 'poor' {
    if (ms <= 2500) return 'good';
    if (ms <= 4000) return 'average';
    return 'poor';
}

function clsRating(cls: number): 'good' | 'average' | 'poor' {
    if (cls <= 0.10) return 'good';
    if (cls <= 0.25) return 'average';
    return 'poor';
}

function inpRating(ms: number): 'good' | 'average' | 'poor' {
    if (ms <= 200) return 'good';
    if (ms <= 500) return 'average';
    return 'poor';
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT ISSUE RECOMMENDATIONS (Arabic)
// ─────────────────────────────────────────────────────────────────────────────

const RECOMMENDATIONS: Record<string, string> = {
    'meta-description':
        'أضف وصف meta لكل صفحة بطول 120-160 حرفاً. الوصف الجيد يصف المحتوى ويشجع النقر من صفحات النتائج.',
    'document-title':
        'أضف عنوان page title فريداً بطول 30-60 حرفاً يتضمن الكلمة المفتاحية الأساسية. العنوان هو أقوى إشارة on-page.',
    'http-status-code':
        'الصفحة لا تُعيد HTTP 200. صفحات 4xx مكسورة وصفحات 5xx تُبلّغ عن خطأ في الخادم — كلاهما لا يُفهرس بشكل سليم.',
    'canonical':
        'أضف وسم <link rel="canonical"> يشير إلى النسخة المفضّلة من الصفحة. بدونه تخاطر بتوزيع إشارات SEO بين نسخ مكررة.',
    'is-crawlable':
        'الصفحة محجوبة عن الزحف بسبب noindex أو robots.txt. تأكد أن الصفحات المهمة مسموح بفهرستها.',
    'robots-txt':
        'مشكلة في ملف robots.txt. تحقق من أنه لا يحجب صفحات مهمة ويُسمح لروبوتات محركات البحث بالوصول.',
    'link-text':
        'استخدم نصوص روابط وصفية ومحددة مثل "دليل تهيئة المتجر" بدلاً من "اضغط هنا" أو "اقرأ المزيد".',
    'image-alt':
        'أضف نص alt وصفي لكل صورة يصف محتواها. يساعد محركات البحث على فهم الصور ويحسن الوصول للمكفوفين.',
    'hreflang':
        'راجع وسوم hreflang للتأكد من صحتها. الإشارات الخاطئة تُربك محركات البحث في تحديد اللغة/البلد المستهدف.',
    'crawlable-anchors':
        'بعض الروابط غير قابلة للزحف (onClick بدون href). تأكد أن جميع الروابط التنقلية تستخدم href صحيح.',
    'structured-data':
        'راجع البيانات المنظمة (Schema.org) المكتشفة في الصفحة وتأكد من صحة تنسيقها عبر Google Rich Results Test.',
    'render-blocking-resources':
        'موارد تعيق التحميل الأولي. استخدم defer أو async للـ JavaScript وأجّل تحميل CSS غير الحيوي.',
    'uses-optimized-images':
        'اضغط الصور واستخدم صيغ WebP أو AVIF بدلاً من JPEG/PNG القديمة. يمكن توفير 30-80% من حجم الصور.',
    'uses-long-cache-ttl':
        'حدد Cache-Control headers مناسبة للموارد الثابتة (صور, CSS, JS). يقلل تحميلات إعادة الزيارة بشكل كبير.',
    'unminified-css':
        'اضغط ملفات CSS لإزالة المسافات والتعليقات. يمكن تقليل حجمها 20-40%.',
    'unminified-javascript':
        'اضغط ملفات JavaScript. استخدم أدوات مثل Terser لتقليل الحجم وتسريع التحليل.',
    'unused-css-rules':
        'أزل قواعد CSS غير المستخدمة في الصفحة. استخدم أداة PurgeCSS أو Coverage في Chrome DevTools.',
    'unused-javascript':
        'أجّل تحميل JavaScript غير المطلوب للعرض الأولي. استخدم dynamic import() أو code splitting.',
    'uses-text-compression':
        'فعّل ضغط Brotli أو Gzip على الخادم لجميع ملفات النصوص (HTML, CSS, JS). يقلل الحجم 60-80%.',
    'offscreen-images':
        'استخدم loading="lazy" للصور خارج نطاق الشاشة. يسرّع التحميل الأولي ويوفر bandwidth.',
    'efficient-animated-content':
        'استخدم صيغة WebM بدلاً من GIF للرسوم المتحركة. حجم أصغر بكثير مع جودة أفضل.',
};

// ─────────────────────────────────────────────────────────────────────────────
// CORE: FETCH PSI API
// ─────────────────────────────────────────────────────────────────────────────

async function fetchPsi(url: string, strategy: 'mobile' | 'desktop' = 'mobile'): Promise<PsiResponse> {
    const params = new URLSearchParams({ url, strategy });
    // Request all 4 Lighthouse categories
    (['performance', 'seo', 'best-practices', 'accessibility'] as const).forEach(c =>
        params.append('category', c)
    );

    // Use VITE_GOOGLE_API_KEY if set — raises quota from 25k/day (vs ~400 req/100s without)
    const apiKey = (import.meta.env as Record<string, string>)['VITE_GOOGLE_API_KEY'];
    if (apiKey) params.set('key', apiKey);

    const resp = await fetch(
        `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`
    );

    if (!resp.ok) {
        const errorBody = await resp.text().catch(() => '');
        throw new Error(`PageSpeed Insights API error ${resp.status}: ${errorBody.slice(0, 200)}`);
    }

    return resp.json() as Promise<PsiResponse>;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT ITEM → AuditIssue MAPPER
// score === null  → unable to evaluate (skip)
// score >= 0.9   → pass (skip)
// score >= 0.5   → warning
// score <  0.5   → error
// ─────────────────────────────────────────────────────────────────────────────

function mapAuditToIssue(id: string, audit: PsiAuditItem): AuditIssue | null {
    if (audit.score === null || audit.score >= 0.9) return null;

    const severity: AuditIssue['severity'] = audit.score < 0.5 ? 'error' : 'warning';
    const itemCount = audit.details?.items?.length ?? 0;
    const countNote = itemCount > 0 ? ` (${itemCount} عنصر متأثر)` : '';
    const displayNote = audit.displayValue ? ` — ${audit.displayValue}` : '';

    return {
        id,
        severity,
        title: audit.title ?? id,
        description: `${audit.description ?? ''}${displayNote}${countNote}`.trim(),
        recommendation: RECOMMENDATIONS[id] ?? 'راجع هذا البند في تقرير Lighthouse للحصول على تفاصيل إضافية.',
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export async function runTechnicalSEOAudit(url: string): Promise<TechnicalSEOAuditResult> {
    const psi = await fetchPsi(url, 'mobile');
    const { lighthouseResult: lhr, loadingExperience: cwv } = psi;
    const cats   = lhr.categories;
    const audits = lhr.audits;

    // ── Category scores 0-100 ────────────────────────────────────────────────
    const perfScore = Math.round((cats.performance?.score   ?? 0) * 100);
    const seoScore  = Math.round((cats.seo?.score           ?? 0) * 100);
    const bpScore   = Math.round((cats['best-practices']?.score ?? 0) * 100);
    const a11yScore = Math.round((cats.accessibility?.score ?? 0) * 100);

    // Weighted overall: performance×30% + seo×35% + bestPractices×20% + accessibility×15%
    const overallScore = Math.round(
        perfScore  * 0.30 +
        seoScore   * 0.35 +
        bpScore    * 0.20 +
        a11yScore  * 0.15
    );

    // ── Core Web Vitals ──────────────────────────────────────────────────────
    // Prefer CrUX (real-user) data when available, fallback to Lighthouse lab
    const lcpMs = cwv?.metrics?.LARGEST_CONTENTFUL_PAINT_MS?.percentile
        ?? audits['largest-contentful-paint']?.numericValue
        ?? 0;

    // CrUX CLS is stored as integer ×100 (e.g. 12 = 0.12), lab data is direct float
    const clsRaw = cwv?.metrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile;
    const clsVal = clsRaw != null
        ? clsRaw / 100
        : (audits['cumulative-layout-shift']?.numericValue ?? 0);

    // Use INP if available (CrUX or lab), otherwise TBT as proxy
    const inpMs = cwv?.metrics?.INTERACTION_TO_NEXT_PAINT?.percentile
        ?? audits['interaction-to-next-paint']?.numericValue
        ?? audits['total-blocking-time']?.numericValue
        ?? 0;

    // ── Issue extraction ─────────────────────────────────────────────────────
    const SEO_AUDIT_IDS = [
        'meta-description', 'document-title', 'http-status-code',
        'canonical', 'is-crawlable', 'robots-txt',
        'link-text', 'image-alt', 'hreflang', 'crawlable-anchors',
    ];

    const PERF_AUDIT_IDS = [
        'render-blocking-resources', 'uses-optimized-images',
        'uses-long-cache-ttl', 'unminified-css', 'unminified-javascript',
        'unused-css-rules', 'unused-javascript', 'uses-text-compression',
        'offscreen-images', 'efficient-animated-content',
    ];

    const SCHEMA_AUDIT_IDS = ['structured-data'];

    function extractIssues(ids: string[]): AuditIssue[] {
        return ids
            .map(id => audits[id] ? mapAuditToIssue(id, audits[id]) : null)
            .filter((x): x is AuditIssue => x !== null);
    }

    const crawlingIssues = extractIssues(SEO_AUDIT_IDS);
    const perfIssues     = extractIssues(PERF_AUDIT_IDS);
    const schemaIssues   = extractIssues(SCHEMA_AUDIT_IDS);

    // ── Schema types found ───────────────────────────────────────────────────
    const sdItems = audits['structured-data']?.details?.items ?? [];
    const schemaTypesFound = [...new Set(
        sdItems
            .map(item => String(item['type'] ?? item['@type'] ?? ''))
            .filter(Boolean)
    )].slice(0, 10);

    // ── HTTP status code for crawling stats ──────────────────────────────────
    const httpStatus = Math.round(audits['http-status-code']?.numericValue ?? 200);

    return {
        overallScore,
        url,
        auditedAt: new Date(),
        scores: {
            performance:   perfScore,
            seo:           seoScore,
            bestPractices: bpScore,
            accessibility: a11yScore,
        },
        crawling: {
            totalUrls: 1,
            status200: httpStatus === 200 ? 1 : 0,
            status301: httpStatus === 301 ? 1 : 0,
            status404: httpStatus === 404 ? 1 : 0,
            issues:    crawlingIssues,
        },
        performance: {
            vitals: {
                lcp: { value: Math.round(lcpMs / 100) / 10, rating: lcpRating(lcpMs) },
                cls: { value: Math.round(clsVal * 1000) / 1000, rating: clsRating(clsVal) },
                inp: { value: Math.round(inpMs), rating: inpRating(inpMs) },
            },
            issues: perfIssues,
        },
        structuredData: {
            typesFound: schemaTypesFound,
            issues:     schemaIssues,
        },
    };
}
