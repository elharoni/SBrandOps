/**
 * SEOOpsPage — Full SEO Hub
 * Tabs: Keyword Research | Content Writer | Content Pipeline | Technical SEO | Local SEO
 * SEO-1 (Keywords) · SEO-2 (Writer) · SEO-3 (Score) · SEO-4 (WP Export) · SEO-5 (Pipeline)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { BrandHubProfile, GBPData, NotificationType, SeoKeyword, SeoArticle, SeoArticleStatus } from '../../types';
import { LocalSEOManager } from '../seo/LocalSEOManager';
import { TechnicalSEOAudit } from '../seo/TechnicalSEOAudit';
import {
    getSeoKeywords, saveSeoKeywords, deleteSeoKeyword,
    getSeoArticles, createSeoArticle, updateSeoArticle, deleteSeoArticle,
    scoreArticle, exportToWordPress,
} from '../../services/seoOpsService';
import { generateKeywordResearch, generateSeoArticle } from '../../services/geminiService';

// ─── Tab type ────────────────────────────────────────────────────────────────
type ActiveTab = 'keywords' | 'writer' | 'pipeline' | 'technical' | 'local';

interface SEOOpsPageProps {
    addNotification: (type: NotificationType, message: string) => void;
    brandProfile: BrandHubProfile;
    gbpData: GBPData;
    brandId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const DIFFICULTY_COLOR: Record<string, string> = {
    low:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    high:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const INTENT_COLOR: Record<string, string> = {
    informational:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    navigational:   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    commercial:     'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    transactional:  'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

const STATUS_LABEL: Record<SeoArticleStatus, string> = {
    draft:      'مسودة',
    optimizing: 'تحسين',
    ready:      'جاهز',
    published:  'منشور',
};

const STATUS_COLOR: Record<SeoArticleStatus, string> = {
    draft:      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    optimizing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    ready:      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    published:  'bg-brand-primary/10 text-brand-primary',
};

const SCORE_COLOR = (score: number) =>
    score >= 80 ? 'text-green-600 dark:text-green-400'
    : score >= 60 ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-red-500 dark:text-red-400';

// ─── Tab: Keyword Research ────────────────────────────────────────────────────
interface KwResearchTabProps {
    brandProfile: BrandHubProfile;
    brandId: string;
    addNotification: (type: NotificationType, message: string) => void;
    savedKeywords: SeoKeyword[];
    onKeywordsSaved: () => void;
}

const KeywordResearchTab: React.FC<KwResearchTabProps> = ({ brandProfile, brandId, addNotification, savedKeywords, onKeywordsSaved }) => {
    const [topic, setTopic] = useState('');
    const [generating, setGenerating] = useState(false);
    const [results, setResults] = useState<Omit<SeoKeyword, 'id' | 'brandId' | 'createdAt'>[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState(false);

    const handleGenerate = async () => {
        if (!topic.trim()) return;
        setGenerating(true);
        setResults([]);
        setSelected(new Set());
        try {
            const kws = await generateKeywordResearch(topic.trim(), brandProfile);
            setResults(kws);
            setSelected(new Set(kws.map((_, i) => i)));
        } catch {
            addNotification(NotificationType.Error, 'خطأ في توليد الكلمات المفتاحية');
        } finally {
            setGenerating(false);
        }
    };

    const toggleSelect = (i: number) => {
        setSelected(prev => {
            const n = new Set(prev);
            if (n.has(i)) n.delete(i); else n.add(i);
            return n;
        });
    };

    const handleSave = async () => {
        const toSave = results.filter((_, i) => selected.has(i));
        if (!toSave.length) return;
        setSaving(true);
        const saved = await saveSeoKeywords(brandId, toSave);
        setSaving(false);
        if (saved.length > 0) {
            addNotification(NotificationType.Success, `تم حفظ ${saved.length} كلمة مفتاحية`);
            onKeywordsSaved();
            setResults([]);
        } else {
            addNotification(NotificationType.Error, 'فشل الحفظ — حاول مرة ثانية');
        }
    };

    return (
        <div className="space-y-6">
            {/* Search bar */}
            <div className="flex gap-3">
                <input
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                    placeholder="أدخل الموضوع أو المجال (مثال: تسويق رقمي، كريم ترطيب)"
                    className="flex-1 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
                <button
                    onClick={handleGenerate}
                    disabled={generating || !topic.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary-dark transition-colors disabled:opacity-50"
                >
                    {generating ? <><i className="fas fa-spinner fa-spin" /> جاري البحث...</> : <><i className="fas fa-magic" /> بحث بالذكاء</>}
                </button>
            </div>

            {/* Results */}
            {results.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-light-text dark:text-dark-text">
                            <span className="text-brand-primary">{results.length}</span> كلمة — اختر ما تريد حفظه
                        </p>
                        <div className="flex gap-2">
                            <button onClick={() => setSelected(new Set(results.map((_, i) => i)))} className="text-xs text-brand-primary hover:underline">تحديد الكل</button>
                            <button onClick={() => setSelected(new Set())} className="text-xs text-light-text-secondary dark:text-dark-text-secondary hover:underline">إلغاء الكل</button>
                        </div>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-light-border dark:border-dark-border">
                        <table className="w-full text-sm">
                            <thead className="bg-light-surface dark:bg-dark-surface text-light-text-secondary dark:text-dark-text-secondary text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-3 text-start w-8"></th>
                                    <th className="px-4 py-3 text-start">الكلمة المفتاحية</th>
                                    <th className="px-4 py-3 text-start">النية</th>
                                    <th className="px-4 py-3 text-start">الصعوبة</th>
                                    <th className="px-4 py-3 text-center">الأولوية</th>
                                    <th className="px-4 py-3 text-start">الحجم / شهر</th>
                                    <th className="px-4 py-3 text-start">ملاحظات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-light-border dark:divide-dark-border">
                                {results.map((kw, i) => (
                                    <tr key={i} className={`hover:bg-light-border/30 dark:hover:bg-dark-border/30 transition-colors ${selected.has(i) ? '' : 'opacity-50'}`}>
                                        <td className="px-4 py-3">
                                            <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSelect(i)} className="rounded accent-brand-primary" />
                                        </td>
                                        <td className="px-4 py-3 font-medium text-light-text dark:text-dark-text">{kw.keyword}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INTENT_COLOR[kw.searchIntent] ?? ''}`}>{kw.searchIntent}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DIFFICULTY_COLOR[kw.difficulty] ?? ''}`}>{kw.difficulty}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="font-bold text-brand-primary">{kw.priorityScore}</span>
                                        </td>
                                        <td className="px-4 py-3 text-light-text-secondary dark:text-dark-text-secondary">{kw.monthlyVolume || '—'}</td>
                                        <td className="px-4 py-3 text-light-text-secondary dark:text-dark-text-secondary text-xs max-w-[200px] truncate">{kw.notes || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving || selected.size === 0}
                        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                        {saving ? <><i className="fas fa-spinner fa-spin" /> يحفظ...</> : <><i className="fas fa-save" /> حفظ {selected.size} كلمة</>}
                    </button>
                </div>
            )}

            {/* Saved keywords */}
            {savedKeywords.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">الكلمات المحفوظة ({savedKeywords.length})</h3>
                    <div className="flex flex-wrap gap-2">
                        {savedKeywords.map(kw => (
                            <div key={kw.id} className="flex items-center gap-1.5 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-lg px-3 py-1.5 text-xs">
                                <span className="font-medium text-light-text dark:text-dark-text">{kw.keyword}</span>
                                <span className={`px-1.5 py-0.5 rounded-full ${DIFFICULTY_COLOR[kw.difficulty] ?? ''}`}>{kw.difficulty}</span>
                                <span className="font-bold text-brand-primary">{kw.priorityScore}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Tab: Content Writer ──────────────────────────────────────────────────────
interface WriterTabProps {
    brandProfile: BrandHubProfile;
    brandId: string;
    addNotification: (type: NotificationType, message: string) => void;
    savedKeywords: SeoKeyword[];
    onArticleCreated: () => void;
}

const ContentWriterTab: React.FC<WriterTabProps> = ({ brandProfile, brandId, addNotification, savedKeywords, onArticleCreated }) => {
    const [keyword, setKeyword] = useState('');
    const [generating, setGenerating] = useState(false);
    const [draft, setDraft] = useState<Partial<SeoArticle> | null>(null);
    const [saving, setSaving] = useState(false);
    // WP export modal
    const [wpModal, setWpModal] = useState(false);
    const [wpCreds, setWpCreds] = useState({ siteUrl: '', username: '', appPassword: '' });
    const [exporting, setExporting] = useState(false);

    const scoreResult = draft
        ? scoreArticle(draft.keyword ?? '', draft.h1 ?? '', (draft.intro ?? '') + '\n' + (draft.body ?? ''), draft.h2s ?? [])
        : null;

    const handleGenerate = async () => {
        if (!keyword.trim()) return;
        setGenerating(true);
        setDraft(null);
        try {
            const article = await generateSeoArticle(keyword.trim(), brandProfile);
            setDraft({ ...article, keyword: keyword.trim() });
        } catch {
            addNotification(NotificationType.Error, 'فشل توليد المقال — حاول مرة ثانية');
        } finally {
            setGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!draft) return;
        setSaving(true);
        const result = await createSeoArticle(brandId, {
            keywordId:        undefined,
            keyword:          draft.keyword ?? keyword,
            h1:               draft.h1 ?? '',
            h2s:              draft.h2s ?? [],
            intro:            draft.intro ?? '',
            body:             draft.body ?? '',
            faq:              draft.faq ?? [],
            metaTitle:        draft.metaTitle ?? '',
            metaDescription:  draft.metaDescription ?? '',
            readabilityScore: scoreResult?.readabilityScore ?? 0,
            keywordDensity:   scoreResult?.keywordDensity ?? 0,
            seoScore:         scoreResult?.score ?? 0,
            wordCount:        scoreResult?.wordCount ?? 0,
            status:           'draft',
            wpPostId:         undefined,
        });
        setSaving(false);
        if (result) {
            addNotification(NotificationType.Success, 'تم حفظ المقال في خط الإنتاج');
            onArticleCreated();
            setDraft(null);
            setKeyword('');
        } else {
            addNotification(NotificationType.Error, 'فشل الحفظ');
        }
    };

    const handleWpExport = async () => {
        if (!draft || !wpCreds.siteUrl || !wpCreds.username || !wpCreds.appPassword) return;
        setExporting(true);
        // Build a fake SeoArticle to pass to exportToWordPress
        const fakeArticle: SeoArticle = {
            id: 'temp', brandId,
            keyword: draft.keyword ?? keyword,
            h1: draft.h1 ?? '', h2s: draft.h2s ?? [],
            intro: draft.intro ?? '', body: draft.body ?? '',
            faq: draft.faq ?? [],
            metaTitle: draft.metaTitle ?? '',
            metaDescription: draft.metaDescription ?? '',
            readabilityScore: 0, keywordDensity: 0,
            seoScore: 0, wordCount: 0,
            status: 'draft',
            createdAt: '', updatedAt: '',
        };
        const res = await exportToWordPress(fakeArticle, wpCreds);
        setExporting(false);
        if (res.success) {
            addNotification(NotificationType.Success, `تم النشر على WordPress! Post ID: ${res.postId}`);
            setWpModal(false);
        } else {
            addNotification(NotificationType.Error, res.error ?? 'فشل التصدير');
        }
    };

    return (
        <div className="space-y-6">
            {/* Keyword selector */}
            <div className="flex gap-3">
                <div className="flex-1">
                    <input
                        value={keyword}
                        onChange={e => setKeyword(e.target.value)}
                        placeholder="اكتب الكلمة المفتاحية أو اختر من المحفوظات..."
                        className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                    {savedKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {savedKeywords.slice(0, 8).map(kw => (
                                <button key={kw.id} onClick={() => setKeyword(kw.keyword)}
                                    className="text-xs px-2.5 py-1 bg-brand-primary/10 text-brand-primary rounded-full hover:bg-brand-primary/20 transition-colors">
                                    {kw.keyword}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button onClick={handleGenerate} disabled={generating || !keyword.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary-dark transition-colors disabled:opacity-50 self-start">
                    {generating ? <><i className="fas fa-spinner fa-spin" /> يكتب...</> : <><i className="fas fa-pen-fancy" /> اكتب مقال</>}
                </button>
            </div>

            {generating && (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center">
                        <i className="fas fa-robot text-2xl text-brand-primary animate-pulse" />
                    </div>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">يكتب الذكاء الاصطناعي مقالك SEO...</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">هذا قد يستغرق 20-40 ثانية</p>
                </div>
            )}

            {draft && !generating && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Article editor — 2/3 */}
                    <div className="lg:col-span-2 space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">H1 — العنوان الرئيسي</label>
                            <input value={draft.h1 ?? ''} onChange={e => setDraft(d => d ? { ...d, h1: e.target.value } : d)}
                                className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary font-bold" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">المقدمة</label>
                            <textarea value={draft.intro ?? ''} onChange={e => setDraft(d => d ? { ...d, intro: e.target.value } : d)} rows={4}
                                className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">المحتوى الرئيسي</label>
                            <textarea value={draft.body ?? ''} onChange={e => setDraft(d => d ? { ...d, body: e.target.value } : d)} rows={12}
                                className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none font-mono" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">Meta Title</label>
                            <input value={draft.metaTitle ?? ''} onChange={e => setDraft(d => d ? { ...d, metaTitle: e.target.value } : d)}
                                className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">Meta Description</label>
                            <textarea value={draft.metaDescription ?? ''} onChange={e => setDraft(d => d ? { ...d, metaDescription: e.target.value } : d)} rows={2}
                                className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none" />
                        </div>
                        {/* FAQ */}
                        {(draft.faq ?? []).length > 0 && (
                            <div>
                                <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-2">الأسئلة الشائعة (FAQ)</label>
                                <div className="space-y-2">
                                    {(draft.faq ?? []).map((item, i) => (
                                        <div key={i} className="bg-light-border/20 dark:bg-dark-border/20 rounded-xl p-3 space-y-1">
                                            <p className="text-sm font-semibold text-light-text dark:text-dark-text">س: {item.question}</p>
                                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">ج: {item.answer}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-3 pt-2">
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary-dark transition-colors disabled:opacity-50">
                                {saving ? <><i className="fas fa-spinner fa-spin" /> يحفظ...</> : <><i className="fas fa-save" /> حفظ في خط الإنتاج</>}
                            </button>
                            <button onClick={() => setWpModal(true)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
                                <i className="fab fa-wordpress" /> تصدير لـ WordPress
                            </button>
                            <button onClick={() => { setDraft(null); setKeyword(''); }}
                                className="px-4 py-2.5 border border-light-border dark:border-dark-border rounded-xl text-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/30 dark:hover:bg-dark-border/30 transition-colors">
                                إلغاء
                            </button>
                        </div>
                    </div>

                    {/* SEO Score panel — 1/3 */}
                    {scoreResult && (
                        <div className="space-y-4">
                            <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl p-5 space-y-4">
                                <div className="text-center">
                                    <div className={`text-5xl font-black ${SCORE_COLOR(scoreResult.score)}`}>{scoreResult.score}</div>
                                    <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">SEO Score / 100</div>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-light-text-secondary dark:text-dark-text-secondary">عدد الكلمات</span>
                                        <span className="font-semibold">{scoreResult.wordCount}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-light-text-secondary dark:text-dark-text-secondary">كثافة الكلمة</span>
                                        <span className="font-semibold">{scoreResult.keywordDensity}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-light-text-secondary dark:text-dark-text-secondary">سهولة القراءة</span>
                                        <span className="font-semibold">{scoreResult.readabilityScore}</span>
                                    </div>
                                </div>
                                {scoreResult.suggestions.length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase">اقتراحات التحسين</p>
                                        {scoreResult.suggestions.map((s, i) => (
                                            <div key={i} className="flex items-start gap-2 text-xs text-yellow-600 dark:text-yellow-400">
                                                <i className="fas fa-exclamation-triangle mt-0.5 shrink-0" />
                                                <span>{s}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {scoreResult.suggestions.length === 0 && (
                                    <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                                        <i className="fas fa-check-circle" />
                                        <span>ممتاز! المقال محسّن بالكامل</span>
                                    </div>
                                )}
                            </div>
                            {/* H2s list */}
                            {(draft.h2s ?? []).length > 0 && (
                                <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl p-4 space-y-2">
                                    <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase">هيكل المقال</p>
                                    {(draft.h2s ?? []).map((h, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm">
                                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-mono">H2</span>
                                            <span className="text-light-text dark:text-dark-text">{h}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* WordPress Export Modal */}
            {wpModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                                <i className="fab fa-wordpress text-blue-500" /> تصدير لـ WordPress
                            </h3>
                            <button onClick={() => setWpModal(false)} className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text">
                                <i className="fas fa-times" />
                            </button>
                        </div>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">يستخدم WordPress Application Passwords — إعدادات → المستخدمون → Application Passwords</p>
                        <div className="space-y-3">
                            <input value={wpCreds.siteUrl} onChange={e => setWpCreds(c => ({ ...c, siteUrl: e.target.value }))}
                                placeholder="https://yoursite.com" dir="ltr"
                                className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                            <input value={wpCreds.username} onChange={e => setWpCreds(c => ({ ...c, username: e.target.value }))}
                                placeholder="WordPress Username" dir="ltr"
                                className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                            <input type="password" value={wpCreds.appPassword} onChange={e => setWpCreds(c => ({ ...c, appPassword: e.target.value }))}
                                placeholder="Application Password (xxxx xxxx xxxx)" dir="ltr"
                                className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handleWpExport} disabled={exporting || !wpCreds.siteUrl}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                                {exporting ? <><i className="fas fa-spinner fa-spin" /> يرسل...</> : <><i className="fas fa-upload" /> نشر كمسودة</>}
                            </button>
                            <button onClick={() => setWpModal(false)}
                                className="px-4 py-2.5 border border-light-border dark:border-dark-border rounded-xl text-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/30 dark:hover:bg-dark-border/30">
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Tab: Content Pipeline (Kanban) ──────────────────────────────────────────
const KANBAN_COLS: { status: SeoArticleStatus; label: string; color: string }[] = [
    { status: 'draft',      label: 'مسودة',  color: 'border-gray-300 dark:border-gray-600' },
    { status: 'optimizing', label: 'تحسين',  color: 'border-yellow-400' },
    { status: 'ready',      label: 'جاهز',   color: 'border-green-400' },
    { status: 'published',  label: 'منشور',  color: 'border-brand-primary' },
];

interface PipelineTabProps {
    articles: SeoArticle[];
    addNotification: (type: NotificationType, message: string) => void;
    onRefresh: () => void;
}

const ContentPipelineTab: React.FC<PipelineTabProps> = ({ articles, addNotification, onRefresh }) => {
    const [movingId, setMovingId] = useState<string | null>(null);

    const moveArticle = async (id: string, newStatus: SeoArticleStatus) => {
        setMovingId(id);
        const ok = await updateSeoArticle(id, { status: newStatus });
        setMovingId(null);
        if (ok) {
            addNotification(NotificationType.Success, `تم نقل المقال إلى "${STATUS_LABEL[newStatus]}"`);
            onRefresh();
        } else {
            addNotification(NotificationType.Error, 'فشل التحديث');
        }
    };

    const removeArticle = async (id: string) => {
        const ok = await deleteSeoArticle(id);
        if (ok) { addNotification(NotificationType.Success, 'تم حذف المقال'); onRefresh(); }
        else addNotification(NotificationType.Error, 'فشل الحذف');
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {KANBAN_COLS.map(col => {
                const colArticles = articles.filter(a => a.status === col.status);
                return (
                    <div key={col.status} className={`bg-light-surface dark:bg-dark-surface rounded-2xl border-t-4 ${col.color} p-4 space-y-3 min-h-[200px]`}>
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-light-text dark:text-dark-text text-sm">{col.label}</h3>
                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary bg-light-border/40 dark:bg-dark-border/40 rounded-full px-2 py-0.5">{colArticles.length}</span>
                        </div>
                        {colArticles.map(article => (
                            <div key={article.id} className="bg-light-card dark:bg-dark-card rounded-xl p-3 space-y-2 shadow-sm">
                                <p className="text-sm font-medium text-light-text dark:text-dark-text leading-tight line-clamp-2">{article.h1 || article.keyword}</p>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className={`font-bold ${SCORE_COLOR(article.seoScore)}`}>{article.seoScore}</span>
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary">•</span>
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary">{article.wordCount} كلمة</span>
                                </div>
                                <p className="text-xs text-brand-primary font-medium truncate">{article.keyword}</p>
                                {/* Move buttons */}
                                <div className="flex gap-1 flex-wrap">
                                    {KANBAN_COLS.filter(c => c.status !== col.status).map(c => (
                                        <button key={c.status} disabled={movingId === article.id}
                                            onClick={() => moveArticle(article.id, c.status)}
                                            className={`text-xs px-2 py-0.5 rounded-full border border-light-border dark:border-dark-border hover:bg-light-border/30 dark:hover:bg-dark-border/30 transition-colors ${STATUS_COLOR[c.status]}`}>
                                            → {STATUS_LABEL[c.status]}
                                        </button>
                                    ))}
                                    <button onClick={() => removeArticle(article.id)}
                                        className="text-xs px-2 py-0.5 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                        <i className="fas fa-trash-alt" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {colArticles.length === 0 && (
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary text-center py-4">لا توجد مقالات</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const SEOOpsPage: React.FC<SEOOpsPageProps> = ({ addNotification, brandProfile, gbpData, brandId }) => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('keywords');
    const [savedKeywords, setSavedKeywords] = useState<SeoKeyword[]>([]);
    const [articles, setArticles] = useState<SeoArticle[]>([]);
    const [loadingKw, setLoadingKw] = useState(false);
    const [loadingArt, setLoadingArt] = useState(false);

    const loadKeywords = useCallback(async () => {
        if (!brandId) return;
        setLoadingKw(true);
        const kws = await getSeoKeywords(brandId);
        setSavedKeywords(kws);
        setLoadingKw(false);
    }, [brandId]);

    const loadArticles = useCallback(async () => {
        if (!brandId) return;
        setLoadingArt(true);
        const arts = await getSeoArticles(brandId);
        setArticles(arts);
        setLoadingArt(false);
    }, [brandId]);

    useEffect(() => { loadKeywords(); }, [loadKeywords]);
    useEffect(() => { loadArticles(); }, [loadArticles]);

    const TABS: { id: ActiveTab; label: string; icon: string }[] = [
        { id: 'keywords',  label: 'بحث الكلمات',   icon: 'fa-search' },
        { id: 'writer',    label: 'كتابة المحتوى',  icon: 'fa-pen-fancy' },
        { id: 'pipeline',  label: 'خط الإنتاج',    icon: 'fa-columns' },
        { id: 'technical', label: 'التدقيق الفني',  icon: 'fa-cogs' },
        { id: 'local',     label: 'SEO المحلي',    icon: 'fa-map-marker-alt' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">عمليات تحسين محركات البحث</h1>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                        {savedKeywords.length} كلمة مفتاحية · {articles.length} مقال
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {(loadingKw || loadingArt) && <i className="fas fa-circle-notch fa-spin text-brand-primary" />}
                    <button onClick={() => { loadKeywords(); loadArticles(); }}
                        className="flex items-center gap-2 px-4 py-2 border border-light-border dark:border-dark-border rounded-xl text-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/30 dark:hover:bg-dark-border/30 transition-colors">
                        <i className="fas fa-sync-alt" /> تحديث
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-light-border dark:border-dark-border">
                <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="SEO Tabs">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === tab.id
                                    ? 'border-brand-primary text-brand-primary'
                                    : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text hover:border-gray-300 dark:hover:border-gray-500'
                            }`}>
                            <i className={`fas ${tab.icon} text-xs`} />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab content */}
            <div>
                {activeTab === 'keywords' && (
                    <KeywordResearchTab
                        brandProfile={brandProfile}
                        brandId={brandId}
                        addNotification={addNotification}
                        savedKeywords={savedKeywords}
                        onKeywordsSaved={loadKeywords}
                    />
                )}
                {activeTab === 'writer' && (
                    <ContentWriterTab
                        brandProfile={brandProfile}
                        brandId={brandId}
                        addNotification={addNotification}
                        savedKeywords={savedKeywords}
                        onArticleCreated={loadArticles}
                    />
                )}
                {activeTab === 'pipeline' && (
                    <ContentPipelineTab
                        articles={articles}
                        addNotification={addNotification}
                        onRefresh={loadArticles}
                    />
                )}
                {activeTab === 'technical' && <TechnicalSEOAudit addNotification={addNotification} />}
                {activeTab === 'local' && <LocalSEOManager addNotification={addNotification} initialData={gbpData} />}
            </div>
        </div>
    );
};
