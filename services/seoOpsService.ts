/**
 * SEO Ops Service
 * CRUD for seo_keywords + seo_articles tables.
 * Includes SEO scoring logic (client-side) and WordPress export.
 */
import { supabase } from './supabaseClient';
import { SeoKeyword, SeoArticle, SeoArticleStatus, SeoFaqItem, SeoScoreResult, WpExportPayload } from '../types';

// ── Row mappers ───────────────────────────────────────────────────────────────

function rowToKeyword(r: Record<string, unknown>): SeoKeyword {
    return {
        id:            r.id as string,
        brandId:       r.brand_id as string,
        keyword:       r.keyword as string,
        searchIntent:  (r.search_intent as SeoKeyword['searchIntent']) ?? 'informational',
        difficulty:    (r.difficulty as SeoKeyword['difficulty']) ?? 'medium',
        priorityScore: Number(r.priority_score ?? 50),
        monthlyVolume: (r.monthly_volume as string) ?? '',
        notes:         (r.notes as string) ?? '',
        createdAt:     r.created_at as string,
    };
}

function rowToArticle(r: Record<string, unknown>): SeoArticle {
    return {
        id:               r.id as string,
        brandId:          r.brand_id as string,
        keywordId:        r.keyword_id as string | undefined,
        keyword:          r.keyword as string,
        h1:               (r.h1 as string) ?? '',
        h2s:              (r.h2s as string[]) ?? [],
        intro:            (r.intro as string) ?? '',
        body:             (r.body as string) ?? '',
        faq:              (r.faq as SeoFaqItem[]) ?? [],
        metaTitle:        (r.meta_title as string) ?? '',
        metaDescription:  (r.meta_description as string) ?? '',
        readabilityScore: Number(r.readability_score ?? 0),
        keywordDensity:   Number(r.keyword_density ?? 0),
        seoScore:         Number(r.seo_score ?? 0),
        wordCount:        Number(r.word_count ?? 0),
        status:           (r.status as SeoArticleStatus) ?? 'draft',
        wpPostId:         r.wp_post_id as number | undefined,
        createdAt:        r.created_at as string,
        updatedAt:        r.updated_at as string,
    };
}

// ── Keywords ──────────────────────────────────────────────────────────────────

export async function getSeoKeywords(brandId: string): Promise<SeoKeyword[]> {
    try {
        const { data, error } = await supabase
            .from('seo_keywords')
            .select('*')
            .eq('brand_id', brandId)
            .order('priority_score', { ascending: false });
        if (error || !data) return [];
        return data.map(r => rowToKeyword(r as Record<string, unknown>));
    } catch { return []; }
}

export async function saveSeoKeywords(
    brandId: string,
    keywords: Omit<SeoKeyword, 'id' | 'brandId' | 'createdAt'>[]
): Promise<SeoKeyword[]> {
    try {
        const rows = keywords.map(k => ({
            brand_id:       brandId,
            keyword:        k.keyword,
            search_intent:  k.searchIntent,
            difficulty:     k.difficulty,
            priority_score: k.priorityScore,
            monthly_volume: k.monthlyVolume,
            notes:          k.notes,
        }));
        const { data, error } = await supabase
            .from('seo_keywords')
            .insert(rows)
            .select();
        if (error || !data) return [];
        return data.map(r => rowToKeyword(r as Record<string, unknown>));
    } catch { return []; }
}

export async function deleteSeoKeyword(keywordId: string): Promise<boolean> {
    try {
        const { error } = await supabase.from('seo_keywords').delete().eq('id', keywordId);
        return !error;
    } catch { return false; }
}

// ── Articles ──────────────────────────────────────────────────────────────────

export async function getSeoArticles(brandId: string): Promise<SeoArticle[]> {
    try {
        const { data, error } = await supabase
            .from('seo_articles')
            .select('*')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false });
        if (error || !data) return [];
        return data.map(r => rowToArticle(r as Record<string, unknown>));
    } catch { return []; }
}

export async function createSeoArticle(brandId: string, article: Omit<SeoArticle, 'id' | 'brandId' | 'createdAt' | 'updatedAt'>): Promise<SeoArticle | null> {
    try {
        const score = scoreArticle(article.keyword, article.h1, article.intro + '\n' + article.body, article.h2s);
        const { data, error } = await supabase
            .from('seo_articles')
            .insert([{
                brand_id:          brandId,
                keyword_id:        article.keywordId ?? null,
                keyword:           article.keyword,
                h1:                article.h1,
                h2s:               article.h2s,
                intro:             article.intro,
                body:              article.body,
                faq:               article.faq,
                meta_title:        article.metaTitle,
                meta_description:  article.metaDescription,
                readability_score: score.readabilityScore,
                keyword_density:   score.keywordDensity,
                seo_score:         score.score,
                word_count:        score.wordCount,
                status:            article.status ?? 'draft',
            }])
            .select()
            .single();
        if (error || !data) return null;
        return rowToArticle(data as Record<string, unknown>);
    } catch { return null; }
}

export async function updateSeoArticle(
    articleId: string,
    updates: Partial<Pick<SeoArticle, 'h1' | 'h2s' | 'intro' | 'body' | 'faq' | 'metaTitle' | 'metaDescription' | 'status' | 'wpPostId'>>
): Promise<boolean> {
    try {
        const dbUp: Record<string, unknown> = {};
        if (updates.h1              !== undefined) dbUp.h1               = updates.h1;
        if (updates.h2s             !== undefined) dbUp.h2s              = updates.h2s;
        if (updates.intro           !== undefined) dbUp.intro            = updates.intro;
        if (updates.body            !== undefined) dbUp.body             = updates.body;
        if (updates.faq             !== undefined) dbUp.faq              = updates.faq;
        if (updates.metaTitle       !== undefined) dbUp.meta_title       = updates.metaTitle;
        if (updates.metaDescription !== undefined) dbUp.meta_description = updates.metaDescription;
        if (updates.status          !== undefined) dbUp.status           = updates.status;
        if (updates.wpPostId        !== undefined) dbUp.wp_post_id       = updates.wpPostId;

        if (updates.h1 || updates.body || updates.intro) {
            const merged = (updates.intro ?? '') + '\n' + (updates.body ?? '');
            const sc = scoreArticle(updates.h1 ?? '', updates.h1 ?? '', merged, updates.h2s ?? []);
            dbUp.seo_score         = sc.score;
            dbUp.readability_score = sc.readabilityScore;
            dbUp.keyword_density   = sc.keywordDensity;
            dbUp.word_count        = sc.wordCount;
        }

        const { error } = await supabase.from('seo_articles').update(dbUp).eq('id', articleId);
        return !error;
    } catch { return false; }
}

export async function deleteSeoArticle(articleId: string): Promise<boolean> {
    try {
        const { error } = await supabase.from('seo_articles').delete().eq('id', articleId);
        return !error;
    } catch { return false; }
}

// ── SEO-3: Article Scoring (client-side) ─────────────────────────────────────

/**
 * Scores an article based on SEO best practices.
 * Returns score 0-100 + suggestions.
 */
export function scoreArticle(keyword: string, h1: string, fullText: string, h2s: string[]): SeoScoreResult {
    const kw      = keyword.toLowerCase().trim();
    const text    = fullText.toLowerCase();
    const words   = fullText.split(/\s+/).filter(Boolean);
    const wc      = words.length;

    // Keyword density
    const kwCount  = (text.match(new RegExp(kw, 'g')) ?? []).length;
    const density  = wc > 0 ? Math.round((kwCount / wc) * 10000) / 100 : 0;

    // Flesch–Kincaid approximation (syllables estimated as vowel groups)
    const sentences   = fullText.split(/[.!?]+/).filter(s => s.trim().length > 0).length || 1;
    const syllables   = words.reduce((s, w) => s + Math.max(1, (w.match(/[aeiouأيوا]/gi) ?? []).length), 0);
    const fkScore     = Math.max(0, Math.min(100, Math.round(206.835 - 1.015 * (wc / sentences) - 84.6 * (syllables / wc))));

    // SEO score: weighted checks
    let score = 0;
    const suggestions: string[] = [];

    // Word count
    if (wc >= 800) score += 20; else { score += Math.round(wc / 800 * 20); suggestions.push(`المقال ${wc} كلمة — يُفضل 800+ كلمة`); }

    // H1 contains keyword
    if (h1.toLowerCase().includes(kw)) score += 15; else suggestions.push('أضف الكلمة المفتاحية في العنوان H1');

    // H2s contain keyword at least once
    if (h2s.some(h => h.toLowerCase().includes(kw))) score += 10; else suggestions.push('أضف الكلمة المفتاحية في أحد العناوين H2');

    // Keyword density 0.5-2.5%
    if (density >= 0.5 && density <= 2.5) score += 20; else {
        if (density < 0.5) suggestions.push(`كثافة الكلمة المفتاحية منخفضة (${density}%) — أضفها أكثر`);
        else suggestions.push(`كثافة الكلمة المفتاحية عالية (${density}%) — قلل التكرار`);
        score += 5;
    }

    // Number of H2s (3+)
    if (h2s.length >= 3) score += 10; else { score += h2s.length * 3; suggestions.push('أضف على الأقل 3 عناوين H2'); }

    // Readability
    if (fkScore >= 60) score += 15; else { score += Math.round(fkScore / 60 * 15); suggestions.push('المقال صعب القراءة — استخدم جمل أقصر'); }

    // First 100 words contain keyword
    const first100 = words.slice(0, 100).join(' ').toLowerCase();
    if (first100.includes(kw)) score += 10; else suggestions.push('أضف الكلمة المفتاحية في أول 100 كلمة');

    return {
        score:            Math.min(100, score),
        suggestions,
        keywordDensity:   density,
        readabilityScore: fkScore,
        wordCount:        wc,
    };
}

// ── SEO-4: WordPress Export ───────────────────────────────────────────────────

/**
 * Convert SeoArticle to WordPress REST API payload.
 */
export function articleToWpPayload(article: SeoArticle): WpExportPayload {
    // Build HTML content
    const faqHtml = article.faq.length > 0
        ? `<h2>الأسئلة الشائعة</h2>\n${article.faq.map(f => `<h3>${f.question}</h3><p>${f.answer}</p>`).join('\n')}`
        : '';

    const h2sHtml = article.h2s.map((h, i) => {
        const bodyPart = article.body.split('\n').slice(i * 3, (i + 1) * 3).join('\n');
        return `<h2>${h}</h2>\n<p>${bodyPart}</p>`;
    }).join('\n');

    const content = `<p>${article.intro}</p>\n\n${h2sHtml}\n\n${faqHtml}`;

    return {
        title:   article.h1,
        content,
        excerpt: article.metaDescription,
        status:  'draft',
        meta: {
            yoast_wpseo_title:    article.metaTitle,
            yoast_wpseo_metadesc: article.metaDescription,
        },
    };
}

/**
 * POST to WordPress REST API.
 * Requires: siteUrl (https://example.com), username, appPassword (Application Password).
 */
export async function exportToWordPress(
    article: SeoArticle,
    credentials: { siteUrl: string; username: string; appPassword: string }
): Promise<{ success: boolean; postId?: number; postUrl?: string; error?: string }> {
    try {
        const payload = articleToWpPayload(article);
        const url     = `${credentials.siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts`;
        const token   = btoa(`${credentials.username}:${credentials.appPassword}`);

        const res = await fetch(url, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Basic ${token}`,
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const err = await res.text();
            return { success: false, error: `WP API Error ${res.status}: ${err}` };
        }

        const data = await res.json() as { id: number; link: string };
        return { success: true, postId: data.id, postUrl: data.link };
    } catch (err) {
        return { success: false, error: String(err) };
    }
}
