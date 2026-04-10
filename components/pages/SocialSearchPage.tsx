import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AIContentIdea, CompetitiveWatchlist, NotificationType, PublisherBrief, SavedSearch, SocialSearchAnalysisResult, SocialPlatform } from '../../types';
import { analyzeSocialSearchQuery } from '../../services/geminiService';
import { createCompetitiveWatchlist, deleteCompetitiveWatchlist, getCompetitiveWatchlists, saveContentBrief, touchCompetitiveWatchlist } from '../../services/competitiveIntelService';
import { useLanguage } from '../../context/LanguageContext';
import { PageScaffold, PageSection } from '../shared/PageScaffold';
import { DonutBreakdown } from '../shared/LightweightCharts';

const SENTIMENT_COLORS: Record<string, string> = {
    positive: '#22c55e',
    neutral: '#6b7280',
    negative: '#ef4444',
};

const CONTENT_ICONS: { [key in AIContentIdea['type']]: string } = {
    Reel: 'fa-video',
    Static: 'fa-image',
    Article: 'fa-newspaper',
    Campaign: 'fa-bullhorn',
};

interface SocialSearchPageProps {
    brandId?: string;
    onSendToPublisher: (idea: AIContentIdea) => void;
    addNotification: (type: NotificationType, message: string) => void;
}

export const SocialSearchPage: React.FC<SocialSearchPageProps> = ({ brandId, onSendToPublisher, addNotification }) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<SocialSearchAnalysisResult | null>(null);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
    const [watchlists, setWatchlists] = useState<CompetitiveWatchlist[]>([]);
    const [showSaveInput, setShowSaveInput] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [currentSearchTerm, setCurrentSearchTerm] = useState('');
    const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null);
    const [isSavingWatchlist, setIsSavingWatchlist] = useState(false);
    const [savingBriefTitle, setSavingBriefTitle] = useState<string | null>(null);

    const copy = {
        kicker: ar ? 'تحليل المنافسين' : 'Competitive intelligence',
        title: ar ? 'مساحة إشارات السوق والمنافسين' : 'Market and competitor signal workspace',
        description: ar
            ? 'استخدم الصفحة لالتقاط ما يقوله السوق، أين ينمو التفاعل، ومن هم المنافسون الذين يستحوذون على الانتباه، ثم حوّل الإشارات إلى أفكار نشر.'
            : 'Use this page to capture what the market is saying, where engagement is growing, and which competitors are taking attention, then turn those signals into publishing ideas.',
        searchPlaceholder: ar ? 'ابحث عن براند منافس، منتج، هاشتاج، أو فئة سوقية...' : 'Search for a competitor, product, hashtag, or market category...',
        analyze: ar ? 'تحليل' : 'Analyze',
        saving: ar ? 'حفظ البحث' : 'Save search',
        save: ar ? 'حفظ' : 'Save',
        cancel: ar ? 'إلغاء' : 'Cancel',
        savePlaceholder: ar ? 'اسم البحث...' : 'Search name...',
        saveWatchlist: ar ? 'حفظ كـ watchlist' : 'Save as watchlist',
        watchlists: ar ? 'قوائم متابعة المنافسين' : 'Competitor watchlists',
        noWatchlists: ar ? 'لا توجد watchlists محفوظة بعد.' : 'No saved watchlists yet.',
        watchlistSaved: ar ? 'تم حفظ الـ watchlist.' : 'Watchlist saved.',
        watchlistExists: ar ? 'يوجد watchlist بنفس الاسم أو الاستعلام.' : 'A watchlist with the same name or query already exists.',
        watchlistDeleted: ar ? 'تم حذف الـ watchlist.' : 'Watchlist deleted.',
        watchlistSaveFailed: ar ? 'تعذر حفظ الـ watchlist في قاعدة البيانات.' : 'Could not save the watchlist to the database.',
        watchlistDeleteFailed: ar ? 'تعذر حذف الـ watchlist.' : 'Could not delete the watchlist.',
        rerun: ar ? 'إعادة التحليل' : 'Re-run',
        recent: ar ? 'آخر عمليات البحث' : 'Recent searches',
        saved: ar ? 'عمليات محفوظة' : 'Saved searches',
        initialTitle: ar ? 'ابدأ من سؤال تنافسي واضح' : 'Start with a clear competitive question',
        initialDescription: ar ? 'ابحث عن فئة، منافس، أو كلمة مفتاحية حتى تحصل على ملخص السوق، مؤشرات النمو، وفرص محتوى جاهزة للتنفيذ.' : 'Search a category, competitor, or keyword to get a market summary, growth signals, and content opportunities ready to use.',
        loadingTitle: ar ? 'جارٍ تحليل الإشارة التنافسية' : 'Analyzing competitive signal',
        loadingDescription: ar ? 'يتم تجهيز الملخص، اتجاهات المنصات، وفرص المحتوى.' : 'Preparing the summary, platform trends, and content opportunities.',
        searchFailed: ar ? 'فشل تحليل البحث. حاول مرة أخرى.' : 'Failed to analyze the search. Please try again.',
        duplicateSaved: ar ? 'يوجد بحث محفوظ بنفس الاسم.' : 'A saved search with the same name already exists.',
        savedSuccess: ar ? 'تم حفظ البحث بنجاح.' : 'Search saved successfully.',
        deletedSuccess: ar ? 'تم حذف البحث المحفوظ.' : 'Saved search deleted.',
        marketSnapshot: ar ? 'لقطة السوق' : 'Market snapshot',
        aiSummary: ar ? 'ملخص الذكاء الاصطناعي' : 'AI summary',
        contentPlays: ar ? 'فرص محتوى جاهزة' : 'Ready-to-use content plays',
        competitors: ar ? 'خريطة المنافسين' : 'Competitor map',
        competitorsDesc: ar ? 'المنافسون الأكثر ظهورًا عبر المنصات التي تم تحليلها.' : 'Competitors appearing most across the analyzed platforms.',
        platformTable: ar ? 'أداء المنصات' : 'Platform performance',
        hashtags: ar ? 'الهاشتاجات الصاعدة' : 'Rising hashtags',
        keywords: ar ? 'كلمات مرتبطة' : 'Related keywords',
        toPublisher: ar ? 'إرسال إلى الناشر' : 'Send to publisher',
        saveBrief: ar ? 'حفظ كـ brief' : 'Save as brief',
        briefSaved: ar ? 'تم حفظ الـ brief في قاعدة البيانات.' : 'Brief saved to the database.',
        briefSaveFailed: ar ? 'تعذر حفظ الـ brief.' : 'Could not save the brief.',
        noResults: ar ? 'لا توجد نتائج بعد.' : 'No results yet.',
        mentions: ar ? 'الإشارات' : 'Mentions',
        sentiment: ar ? 'المشاعر' : 'Sentiment',
        topPlatform: ar ? 'أقوى منصة' : 'Top platform',
        competitorCount: ar ? 'عدد المنافسين' : 'Competitors',
        growth: ar ? 'النمو الأسبوعي' : 'Weekly growth',
        engagement: ar ? 'التفاعل' : 'Engagement',
        dominantCompetitor: ar ? 'الأكثر حضورًا' : 'Most visible',
        opportunity: ar ? 'فرصة' : 'Opportunity',
        monitor: ar ? 'راقب' : 'Monitor',
        presets: ar ? 'اقتراحات سريعة' : 'Quick prompts',
        noSaved: ar ? 'لا توجد عمليات بحث محفوظة.' : 'No saved searches yet.',
        noRecent: ar ? 'لا توجد عمليات بحث حديثة.' : 'No recent searches yet.',
        openInPublisher: ar ? 'استخدم الفكرة في الناشر مباشرة' : 'Use the idea in publisher directly',
    };

    const searchPresets = [
        ar ? 'منافس مباشر في نفس الفئة' : 'direct competitor in same category',
        ar ? 'أفضل هاشتاجات لمنتج جديد' : 'best hashtags for a new product',
        ar ? 'اتجاهات المحتوى في السوق المحلي' : 'content trends in the local market',
        ar ? 'مقارنة تفاعل المنافسين على إنستجرام' : 'compare competitor engagement on Instagram',
    ];

    useEffect(() => {
        const storedRecents = localStorage.getItem('socialSearch_recent');
        const storedSaved = localStorage.getItem('socialSearch_saved');
        if (storedRecents) setRecentSearches(JSON.parse(storedRecents));
        if (storedSaved) setSavedSearches(JSON.parse(storedSaved));
    }, []);

    useEffect(() => {
        let isMounted = true;

        const loadPersistedWatchlists = async () => {
            if (!brandId) return;
            const persistedWatchlists = await getCompetitiveWatchlists(brandId);
            if (isMounted) {
                setWatchlists(persistedWatchlists);
            }
        };

        loadPersistedWatchlists().catch((loadError) => {
            console.error('Failed to load competitive watchlists:', loadError);
        });

        return () => {
            isMounted = false;
        };
    }, [brandId]);

    useEffect(() => {
        localStorage.setItem('socialSearch_recent', JSON.stringify(recentSearches));
    }, [recentSearches]);

    useEffect(() => {
        localStorage.setItem('socialSearch_saved', JSON.stringify(savedSearches));
    }, [savedSearches]);

    useEffect(() => {
        if (!brandId) {
            localStorage.setItem('socialSearch_watchlists', JSON.stringify(watchlists));
        }
    }, [brandId, watchlists]);

    const addRecentSearch = (searchQuery: string) => {
        setRecentSearches((prev) => {
            const next = [searchQuery, ...prev.filter((item) => item.toLowerCase() !== searchQuery.toLowerCase())];
            return next.slice(0, 6);
        });
    };

    const handleSearch = useCallback(async (searchQuery: string, options?: { watchlistId?: string | null }) => {
        if (!searchQuery.trim()) return;
        setQuery(searchQuery);
        setCurrentSearchTerm(searchQuery);
        setActiveWatchlistId(options?.watchlistId ?? null);
        setIsLoading(true);
        setError(null);
        setResult(null);
        setShowSaveInput(false);
        try {
            const analysis = await analyzeSocialSearchQuery(searchQuery.trim());
            setResult(analysis);
            addRecentSearch(searchQuery.trim());
        } catch (searchError) {
            console.error(searchError);
            setError(copy.searchFailed);
        } finally {
            setIsLoading(false);
        }
    }, [copy.searchFailed]);

    const handleSaveConfirm = () => {
        if (!saveName.trim() || !currentSearchTerm) return;
        if (savedSearches.some((item) => item.name.toLowerCase() === saveName.trim().toLowerCase())) {
            addNotification(NotificationType.Warning, copy.duplicateSaved);
            return;
        }
        const nextSearch: SavedSearch = {
            id: crypto.randomUUID(),
            name: saveName.trim(),
            query: currentSearchTerm,
        };
        setSavedSearches((prev) => [nextSearch, ...prev]);
        setSaveName('');
        setShowSaveInput(false);
        addNotification(NotificationType.Success, copy.savedSuccess);
    };

    const handleDeleteSavedSearch = (id: string) => {
        setSavedSearches((prev) => prev.filter((item) => item.id !== id));
        addNotification(NotificationType.Info, copy.deletedSuccess);
    };

    const handleSaveWatchlist = async () => {
        if (!result || !currentSearchTerm) return;
        const suggestedName = currentSearchTerm.trim();
        const competitorNames = competitorSummary.map((item) => item.name).slice(0, 5);
        const alreadyExists = watchlists.some((item) =>
            item.name.toLowerCase() === suggestedName.toLowerCase() || item.query.toLowerCase() === currentSearchTerm.toLowerCase()
        );
        if (alreadyExists) {
            addNotification(NotificationType.Warning, copy.watchlistExists);
            return;
        }

        const draftWatchlist: Omit<CompetitiveWatchlist, 'id' | 'brandId' | 'createdAt'> = {
            name: suggestedName,
            query: currentSearchTerm,
            competitors: competitorNames,
            keywords: result.relatedKeywords.slice(0, 6),
            lastRunAt: new Date().toISOString(),
        };

        if (!brandId) {
            setWatchlists((prev) => [
                {
                    id: crypto.randomUUID(),
                    createdAt: new Date().toISOString(),
                    ...draftWatchlist,
                },
                ...prev,
            ]);
            addNotification(NotificationType.Success, copy.watchlistSaved);
            return;
        }

        try {
            setIsSavingWatchlist(true);
            const savedWatchlist = await createCompetitiveWatchlist(brandId, draftWatchlist);
            setWatchlists((prev) => [savedWatchlist, ...prev]);
            addNotification(NotificationType.Success, copy.watchlistSaved);
        } catch (saveError) {
            console.error(saveError);
            addNotification(NotificationType.Error, copy.watchlistSaveFailed);
        } finally {
            setIsSavingWatchlist(false);
        }
    };

    const handleDeleteWatchlist = async (id: string) => {
        try {
            if (brandId) {
                await deleteCompetitiveWatchlist(brandId, id);
            }
            setWatchlists((prev) => prev.filter((item) => item.id !== id));
            addNotification(NotificationType.Info, copy.watchlistDeleted);
        } catch (deleteError) {
            console.error(deleteError);
            addNotification(NotificationType.Error, copy.watchlistDeleteFailed);
        }
    };

    const sentimentSegments = result ? [
        { label: ar ? 'إيجابي' : 'Positive', value: result.sentiment.positive, color: SENTIMENT_COLORS.positive },
        { label: ar ? 'محايد' : 'Neutral', value: result.sentiment.neutral, color: SENTIMENT_COLORS.neutral },
        { label: ar ? 'سلبي' : 'Negative', value: result.sentiment.negative, color: SENTIMENT_COLORS.negative },
    ] : [];

    const competitorSummary = useMemo(() => {
        if (!result) return [] as Array<{ name: string; appearances: number; platforms: string[]; highlight: string }>;
        const map = new Map<string, { name: string; appearances: number; platforms: Set<string> }>();
        result.platformPerformance.forEach((entry) => {
            entry.topCompetitors.forEach((competitor) => {
                const existing = map.get(competitor) || { name: competitor, appearances: 0, platforms: new Set<string>() };
                existing.appearances += 1;
                existing.platforms.add(entry.platform);
                map.set(competitor, existing);
            });
        });
        return Array.from(map.values())
            .sort((a, b) => b.appearances - a.appearances)
            .map((item) => ({
                name: item.name,
                appearances: item.appearances,
                platforms: Array.from(item.platforms),
                highlight: ar
                    ? `ظهر في ${item.appearances} إشارة عبر ${item.platforms.size} منصة.`
                    : `Appeared in ${item.appearances} signals across ${item.platforms.size} platforms.`,
            }));
    }, [ar, result]);

    const buildIdeaForPublisher = useCallback((idea: AIContentIdea): AIContentIdea => {
        const topCompetitors = competitorSummary.slice(0, 3).map((item) => item.name);
        const topHashtags = (result?.topHashtags || []).slice(0, 3).map((item) => item.tag);
        const platformPreference: Record<AIContentIdea['type'], SocialPlatform[]> = {
            Reel: [SocialPlatform.Instagram, SocialPlatform.TikTok],
            Static: [SocialPlatform.Instagram, SocialPlatform.Facebook],
            Article: [SocialPlatform.LinkedIn, SocialPlatform.Facebook],
            Campaign: [SocialPlatform.Instagram, SocialPlatform.LinkedIn, SocialPlatform.Facebook],
        };

        return {
            ...idea,
            suggestedPlatforms: platformPreference[idea.type],
            brief: {
                id: crypto.randomUUID(),
                watchlistId: activeWatchlistId ?? undefined,
                source: 'social-search',
                title: idea.title,
                query: currentSearchTerm,
                objective: ar
                    ? `استغلال الإشارات حول "${currentSearchTerm}" لصناعة محتوى يوضح الفرق التنافسي ويقود إلى تفاعل أو تحويل.`
                    : `Turn signals around "${currentSearchTerm}" into content that clarifies the competitive difference and drives engagement or conversion.`,
                angle: idea.description,
                competitors: topCompetitors,
                keywords: result?.relatedKeywords.slice(0, 5) || [],
                hashtags: topHashtags,
                suggestedPlatforms: platformPreference[idea.type],
                cta: ar ? 'اطلب التفاصيل أو جرّب الآن' : 'Request details or try it now',
                notes: [
                    ar ? 'ابدأ بأقوى نقطة اختلاف عن المنافس.' : 'Lead with the strongest differentiator versus competitors.',
                    ar ? 'استخدم صياغة قصيرة ثم ادعمها بدليل أو مثال.' : 'Keep the copy tight, then support it with proof or an example.',
                    ar ? 'لا تنقل لغة المنافس حرفيًا؛ استخدم صوت البراند الحالي.' : 'Do not mirror competitor language; keep the current brand voice.',
                ],
            },
        };
    }, [activeWatchlistId, ar, competitorSummary, currentSearchTerm, result?.relatedKeywords, result?.topHashtags]);

    const handleSaveBrief = useCallback(async (idea: AIContentIdea) => {
        if (!brandId) {
            addNotification(NotificationType.Warning, copy.briefSaveFailed);
            return;
        }

        const enhancedIdea = buildIdeaForPublisher(idea);
        if (!enhancedIdea.brief) {
            addNotification(NotificationType.Warning, copy.briefSaveFailed);
            return;
        }

        try {
            setSavingBriefTitle(idea.title);
            await saveContentBrief(brandId, enhancedIdea.brief as PublisherBrief);
            addNotification(NotificationType.Success, copy.briefSaved);
        } catch (saveError) {
            console.error(saveError);
            addNotification(NotificationType.Error, copy.briefSaveFailed);
        } finally {
            setSavingBriefTitle(null);
        }
    }, [addNotification, brandId, buildIdeaForPublisher, copy.briefSaveFailed, copy.briefSaved]);

    const snapshot = useMemo(() => {
        if (!result) return null;
        const totalMentions = result.platformPerformance.reduce((sum, item) => sum + item.resultsCount, 0);
        const topPlatform = [...result.platformPerformance].sort((a, b) => b.resultsCount - a.resultsCount)[0];
        return {
            totalMentions,
            topPlatform: topPlatform?.platform || '—',
            competitorCount: competitorSummary.length,
            topGrowth: topPlatform?.weeklyGrowth ?? 0,
        };
    }, [competitorSummary.length, result]);

    const renderEmptyState = () => (
        <PageSection title={copy.initialTitle} description={copy.initialDescription}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {searchPresets.map((preset) => (
                    <button
                        key={preset}
                        onClick={() => handleSearch(preset)}
                        className="surface-panel-soft rounded-[1.35rem] p-4 text-start transition-all hover:-translate-y-0.5 hover:shadow-primary-glow"
                    >
                        <p className="text-sm font-semibold text-light-text dark:text-dark-text">{preset}</p>
                        <p className="mt-2 text-xs text-light-text-secondary dark:text-dark-text-secondary">{copy.opportunity}</p>
                    </button>
                ))}
            </div>
        </PageSection>
    );

    const renderLoadingState = () => (
        <PageSection title={copy.loadingTitle} description={copy.loadingDescription}>
            <div className="py-14 text-center">
                <i className="fas fa-spinner fa-spin text-4xl text-brand-primary" />
            </div>
        </PageSection>
    );

    return (
        <PageScaffold
            kicker={copy.kicker}
            title={copy.title}
            description={copy.description}
            stats={snapshot ? [
                { label: copy.mentions, value: snapshot.totalMentions.toLocaleString(ar ? 'ar-EG' : 'en-US') },
                { label: copy.topPlatform, value: snapshot.topPlatform, tone: 'text-brand-primary' },
                { label: copy.competitorCount, value: String(snapshot.competitorCount) },
            ] : []}
        >
            <PageSection title={copy.marketSnapshot} description={copy.presets}>
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row">
                        <div className="relative flex-1">
                            <i className="fas fa-search absolute right-4 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary" />
                            <input
                                type="text"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                onKeyDown={(event) => event.key === 'Enter' && handleSearch(query)}
                                placeholder={copy.searchPlaceholder}
                                className="w-full rounded-2xl border border-light-border bg-light-bg py-3 ps-4 pe-12 text-sm text-light-text focus:border-brand-primary focus:outline-none dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                            />
                        </div>
                        <div className="flex gap-2">
                            {result && !isLoading && (
                                <button onClick={() => setShowSaveInput(true)} className="rounded-2xl border border-light-border bg-light-card px-4 py-3 text-sm font-semibold text-light-text transition-colors hover:border-brand-primary dark:border-dark-border dark:bg-dark-card dark:text-dark-text">
                                    {copy.saving}
                                </button>
                            )}
                            <button onClick={() => handleSearch(query)} disabled={isLoading} className="rounded-2xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-primary-glow disabled:opacity-60">
                                {copy.analyze}
                            </button>
                        </div>
                    </div>

                    {showSaveInput && (
                        <div className="flex flex-col gap-2 rounded-2xl border border-light-border bg-light-bg p-3 dark:border-dark-border dark:bg-dark-bg md:flex-row">
                            <input
                                type="text"
                                value={saveName}
                                onChange={(event) => setSaveName(event.target.value)}
                                onKeyDown={(event) => event.key === 'Enter' && handleSaveConfirm()}
                                placeholder={copy.savePlaceholder}
                                className="flex-1 rounded-xl border border-light-border bg-light-card px-3 py-2 text-sm focus:border-brand-primary focus:outline-none dark:border-dark-border dark:bg-dark-card"
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button onClick={handleSaveConfirm} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">{copy.save}</button>
                                <button onClick={() => setShowSaveInput(false)} className="rounded-xl border border-light-border px-4 py-2 text-sm font-semibold text-light-text dark:border-dark-border dark:text-dark-text">{copy.cancel}</button>
                            </div>
                        </div>
                    )}

                    <div className="grid gap-3 lg:grid-cols-2">
                        <div className="surface-panel-soft rounded-[1.35rem] p-4 lg:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">{copy.watchlists}</p>
                            <div className="mt-3 flex flex-wrap gap-3">
                                {watchlists.length > 0 ? watchlists.map((item) => (
                                    <div key={item.id} className="rounded-[1.2rem] border border-light-border bg-light-card px-4 py-3 dark:border-dark-border dark:bg-dark-card">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-light-text dark:text-dark-text">{item.name}</p>
                                                <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">{item.query}</p>
                                            </div>
                                            <button onClick={() => handleDeleteWatchlist(item.id)} className="text-light-text-secondary hover:text-rose-500 dark:text-dark-text-secondary">×</button>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {item.competitors.slice(0, 3).map((competitor) => (
                                                <span key={`${item.id}-${competitor}`} className="rounded-full bg-light-bg px-2 py-1 text-[11px] text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary">{competitor}</span>
                                            ))}
                                        </div>
                                            <button
                                                onClick={async () => {
                                                    await handleSearch(item.query, { watchlistId: item.id });
                                                    if (brandId) {
                                                        touchCompetitiveWatchlist(brandId, item.id).catch((touchError) => console.error(touchError));
                                                    }
                                                }}
                                            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-primary"
                                        >
                                            <i className="fas fa-rotate-right text-xs" />
                                            <span>{copy.rerun}</span>
                                        </button>
                                    </div>
                                )) : <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{copy.noWatchlists}</p>}
                            </div>
                        </div>

                        <div className="surface-panel-soft rounded-[1.35rem] p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">{copy.saved}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {savedSearches.length > 0 ? savedSearches.map((item) => (
                                    <div key={item.id} className="group inline-flex items-center rounded-full border border-light-border bg-light-card dark:border-dark-border dark:bg-dark-card">
                                        <button onClick={() => handleSearch(item.query)} className="px-3 py-1.5 text-sm text-light-text dark:text-dark-text">{item.name}</button>
                                        <button onClick={() => handleDeleteSavedSearch(item.id)} className="border-s border-light-border px-2 text-light-text-secondary transition-colors hover:text-red-500 dark:border-dark-border dark:text-dark-text-secondary">×</button>
                                    </div>
                                )) : <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{copy.noSaved}</p>}
                            </div>
                        </div>

                        <div className="surface-panel-soft rounded-[1.35rem] p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">{copy.recent}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {recentSearches.length > 0 ? recentSearches.map((item) => (
                                    <button key={item} onClick={() => handleSearch(item)} className="rounded-full border border-light-border bg-light-card px-3 py-1.5 text-sm text-light-text transition-colors hover:border-brand-primary dark:border-dark-border dark:bg-dark-card dark:text-dark-text">
                                        {item}
                                    </button>
                                )) : <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{copy.noRecent}</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </PageSection>

            {isLoading ? renderLoadingState() : result ? (
                <div className="space-y-6">
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
                        <PageSection title={copy.aiSummary} description={currentSearchTerm || copy.marketSnapshot}>
                            <p className="text-sm leading-7 text-light-text-secondary dark:text-dark-text-secondary">{result.aiSummary}</p>
                        </PageSection>

                        <PageSection title={copy.sentiment} description={currentSearchTerm || copy.marketSnapshot} actions={(
                            <button onClick={handleSaveWatchlist} disabled={isSavingWatchlist} className="rounded-2xl border border-light-border bg-light-card px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:border-brand-primary disabled:opacity-60 dark:border-dark-border dark:bg-dark-card dark:text-dark-text">
                                {copy.saveWatchlist}
                            </button>
                        )}>
                            <DonutBreakdown segments={sentimentSegments} centerLabel={ar ? 'المشاعر' : 'Sentiment'} />
                        </PageSection>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)]">
                        <PageSection title={copy.contentPlays} description={copy.openInPublisher}>
                            <div className="grid gap-3 md:grid-cols-2">
                                {result.contentIdeas.map((idea, index) => (
                                    <div key={`${idea.title}-${index}`} className="surface-panel-soft rounded-[1.35rem] p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-primary">{idea.type}</p>
                                                <h3 className="mt-2 text-sm font-semibold text-light-text dark:text-dark-text">{idea.title}</h3>
                                            </div>
                                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
                                                <i className={`fas ${CONTENT_ICONS[idea.type]}`} />
                                            </div>
                                        </div>
                                        <p className="mt-3 text-xs leading-6 text-light-text-secondary dark:text-dark-text-secondary">{idea.description}</p>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <button onClick={() => onSendToPublisher(buildIdeaForPublisher(idea))} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary">
                                                <i className="fas fa-paper-plane text-xs" />
                                                <span>{copy.toPublisher}</span>
                                            </button>
                                            <button
                                                onClick={() => handleSaveBrief(idea)}
                                                disabled={savingBriefTitle === idea.title}
                                                className="inline-flex items-center gap-2 rounded-xl border border-light-border px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:border-brand-primary disabled:opacity-60 dark:border-dark-border dark:text-dark-text"
                                            >
                                                <i className="fas fa-bookmark text-xs" />
                                                <span>{copy.saveBrief}</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </PageSection>

                        <PageSection title={copy.competitors} description={copy.competitorsDesc}>
                            <div className="space-y-3">
                                {competitorSummary.map((competitor) => (
                                    <div key={competitor.name} className="surface-panel-soft rounded-[1.35rem] p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">{competitor.name}</h3>
                                                <p className="mt-1 text-xs leading-6 text-light-text-secondary dark:text-dark-text-secondary">{competitor.highlight}</p>
                                            </div>
                                            <span className="rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-semibold text-brand-primary">{competitor.appearances}x</span>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {competitor.platforms.map((platform) => (
                                                <span key={`${competitor.name}-${platform}`} className="rounded-full bg-light-bg px-2.5 py-1 text-xs text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary">{platform}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </PageSection>
                    </div>

                    <PageSection title={copy.platformTable} description={copy.marketSnapshot}>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-light-border text-left text-xs uppercase tracking-[0.16em] text-light-text-secondary dark:border-dark-border dark:text-dark-text-secondary">
                                        <th className="pb-3">{ar ? 'المنصة' : 'Platform'}</th>
                                        <th className="pb-3">{copy.mentions}</th>
                                        <th className="pb-3">{copy.engagement}</th>
                                        <th className="pb-3">{copy.growth}</th>
                                        <th className="pb-3">{copy.dominantCompetitor}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.platformPerformance.map((entry) => (
                                        <tr key={entry.platform} className="border-b border-light-border/70 dark:border-dark-border/70">
                                            <td className="py-3 font-semibold text-light-text dark:text-dark-text">{entry.platform}</td>
                                            <td className="py-3 text-light-text-secondary dark:text-dark-text-secondary">{entry.resultsCount.toLocaleString(ar ? 'ar-EG' : 'en-US')}</td>
                                            <td className="py-3 text-light-text-secondary dark:text-dark-text-secondary">{entry.engagementRate}</td>
                                            <td className={`py-3 font-semibold ${entry.weeklyGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{entry.weeklyGrowth >= 0 ? '+' : ''}{entry.weeklyGrowth}%</td>
                                            <td className="py-3 text-light-text-secondary dark:text-dark-text-secondary">{entry.topCompetitors[0] || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </PageSection>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <PageSection title={copy.hashtags} description={copy.opportunity}>
                            <div className="space-y-3">
                                {result.topHashtags.map((tag) => (
                                    <div key={tag.tag} className="surface-panel-soft flex items-center justify-between rounded-[1.35rem] p-4">
                                        <div>
                                            <p className="text-sm font-semibold text-brand-primary">{tag.tag}</p>
                                            <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">{copy.monitor}</p>
                                        </div>
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tag.growth >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/10 text-rose-600 dark:text-rose-300'}`}>{tag.growth >= 0 ? '+' : ''}{tag.growth}%</span>
                                    </div>
                                ))}
                            </div>
                        </PageSection>

                        <PageSection title={copy.keywords} description={copy.marketSnapshot}>
                            <div className="flex flex-wrap gap-2">
                                {result.relatedKeywords.map((keyword) => (
                                    <button key={keyword} onClick={() => handleSearch(keyword)} className="rounded-full border border-light-border bg-light-card px-3 py-2 text-sm text-light-text transition-colors hover:border-brand-primary dark:border-dark-border dark:bg-dark-card dark:text-dark-text">
                                        {keyword}
                                    </button>
                                ))}
                            </div>
                        </PageSection>
                    </div>
                </div>
            ) : renderEmptyState()}

            {error && <p className="text-center text-sm text-rose-500">{error}</p>}
        </PageScaffold>
    );
};
