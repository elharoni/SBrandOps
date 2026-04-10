// components/pages/IdeaOpsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { BrainstormedIdea, BrandHubProfile, NotificationType, IdeaTestPlan, SocialPlatform, PLATFORM_ASSETS, ContentStatus } from '../../types';
import { brainstormContentIdeas, generateIdeaTestPlan } from '../../services/geminiService';
import { getBrainstormedIdeas, addBrainstormedIdea } from '../../services/ideaOpsService';

interface IdeaOpsPageProps {
    brandProfile: BrandHubProfile;
    addNotification: (type: NotificationType, message: string) => void;
    onConvertToContent?: (idea: BrainstormedIdea) => void;
    onNavigate?: (page: string) => void;
}

// ─── Idea Test Plan Modal ──────────────────────────────────────────────────────
const IdeaTestPlanModal: React.FC<{
    idea: BrainstormedIdea;
    onClose: () => void;
    brandProfile: BrandHubProfile;
}> = ({ idea, onClose, brandProfile }) => {
    const [plan, setPlan] = useState<IdeaTestPlan | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        generateIdeaTestPlan(idea.title, brandProfile.brandAudiences[0]?.description || 'جمهور عام', brandProfile)
            .then(setPlan)
            .finally(() => setIsLoading(false));
    }, [idea, brandProfile]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-light-card dark:bg-dark-card rounded-[1.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-light-border dark:border-dark-border" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-light-border dark:border-dark-border flex justify-between items-center">
                    <div>
                        <h2 className="text-base font-bold text-light-text dark:text-dark-text">🧪 خطة اختبار الفكرة</h2>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{idea.title}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-light-bg dark:hover:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary transition-colors">
                        <i className="fas fa-times text-sm" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto space-y-5">
                    {isLoading ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <i className="fas fa-brain text-brand-purple animate-pulse text-xl" />
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Gemini يحلل الفكرة ويجهز الخطة...</p>
                            </div>
                            {[1,2,3].map(i => <div key={i} className="h-16 bg-light-bg dark:bg-dark-bg rounded-xl animate-pulse" />)}
                        </div>
                    ) : plan ? (
                        <>
                            <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-xl p-4">
                                <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wide mb-2">ملخص الاستراتيجية</h3>
                                <p className="text-sm text-light-text dark:text-dark-text leading-relaxed">{plan.aiSummary}</p>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mb-3">📱 المنصات المقترحة</h3>
                                <div className="space-y-2">
                                    {plan.recommendedPlatforms.map((p, i) => (
                                        <div key={i} className="bg-light-bg dark:bg-dark-bg p-3 rounded-xl flex items-start gap-3">
                                            <span className="text-xs font-bold text-brand-primary bg-brand-primary/10 px-2 py-1 rounded-lg flex-shrink-0">{p.platform}</span>
                                            <div>
                                                <p className="text-xs font-semibold text-light-text dark:text-dark-text">{p.format}</p>
                                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{p.justification}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mb-2">💬 نقاط الحوار الرئيسية</h3>
                                <ul className="space-y-1.5">
                                    {plan.keyTalkingPoints.map((p, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                            <i className="fas fa-circle-check text-emerald-500 mt-0.5 text-xs flex-shrink-0" />
                                            {p}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-light-bg dark:bg-dark-bg p-3 rounded-xl">
                                    <h3 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">🎯 CTA المقترح</h3>
                                    <p className="text-sm font-bold text-brand-primary">{plan.suggestedCTA}</p>
                                </div>
                                <div className="bg-light-bg dark:bg-dark-bg p-3 rounded-xl">
                                    <h3 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">📊 مقاييس النجاح</h3>
                                    <ul className="space-y-0.5">
                                        {plan.successMetrics.slice(0, 3).map((m, i) => (
                                            <li key={i} className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{m}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </>
                    ) : (
                        <p className="text-center text-red-400 text-sm py-4">فشل تحليل الفكرة — حاول مرة أخرى</p>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Idea Card ────────────────────────────────────────────────────────────────
const PLATFORM_ICON_MAP: Partial<Record<string, string>> = {
    Instagram: 'fa-instagram', Facebook: 'fa-facebook', Twitter: 'fa-twitter', X: 'fa-x-twitter',
    TikTok: 'fa-tiktok', LinkedIn: 'fa-linkedin', YouTube: 'fa-youtube',
};

const ANGLE_COLORS: Record<string, string> = {
    Educational:  'bg-blue-500/10 text-blue-500',
    Entertaining: 'bg-pink-500/10 text-pink-500',
    Inspirational:'bg-amber-500/10 text-amber-500',
    Promotional:  'bg-emerald-500/10 text-emerald-500',
    Controversial:'bg-red-500/10 text-red-500',
};

const IdeaCard: React.FC<{
    idea: BrainstormedIdea;
    onTest: () => void;
    onConvert: () => void;
    index: number;
}> = ({ idea, onTest, onConvert, index }) => {
    const [hovered, setHovered] = useState(false);
    const iconClass = PLATFORM_ICON_MAP[idea.platform] || 'fa-share-alt';
    const angleColor = ANGLE_COLORS[idea.angle] || 'bg-light-card text-light-text-secondary dark:bg-dark-card dark:text-dark-text-secondary';

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={`relative flex flex-col bg-light-card dark:bg-dark-card border rounded-[1.25rem] overflow-hidden transition-all duration-200
                ${hovered ? 'border-brand-primary/40 shadow-lg shadow-brand-primary/10 -translate-y-0.5' : 'border-light-border dark:border-dark-border'}
            `}
            style={{ animationDelay: `${index * 60}ms` }}
        >
            {/* Card top accent */}
            <div className="h-1 bg-gradient-to-r from-brand-primary to-brand-secondary" />

            <div className="p-4 flex flex-col flex-grow">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                            <i className={`fab ${iconClass} text-brand-primary text-sm`} />
                        </div>
                        <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">{idea.platform}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${angleColor}`}>
                        {idea.angle}
                    </span>
                </div>

                {/* Title */}
                <h4 className="font-bold text-light-text dark:text-dark-text text-sm leading-snug mb-2">{idea.title}</h4>

                {/* Description */}
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed flex-grow mb-4">{idea.description}</p>

                {/* Format badge */}
                <div className="mb-4">
                    <span className="text-xs bg-light-bg dark:bg-dark-bg px-2.5 py-1 rounded-full text-light-text-secondary dark:text-dark-text-secondary border border-light-border/50 dark:border-dark-border/50">
                        <i className="fas fa-film text-[10px] me-1.5 opacity-60" />{idea.format}
                    </span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 mt-auto">
                    <button
                        onClick={onConvert}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 transition-all hover:shadow-md hover:shadow-brand-primary/20"
                        title="تحويل هذه الفكرة مباشرة إلى بطاقة في خطة المحتوى"
                    >
                        <i className="fas fa-arrow-right-to-bracket text-[10px]" />
                        تحويل لمحتوى
                    </button>
                    <button
                        onClick={onTest}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-light-border dark:border-dark-border text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:border-brand-secondary hover:text-brand-secondary transition-all"
                        title="اختبار جدوى الفكرة وإنشاء خطة بالـ AI"
                    >
                        <i className="fas fa-flask text-[10px]" />
                        اختبار
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Empty State ──────────────────────────────────────────────────────────────
const IdeasEmptyState: React.FC<{ onGetStarted: () => void }> = ({ onGetStarted }) => (
    <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 rounded-2xl bg-brand-primary/10 flex items-center justify-center mb-5">
            <i className="fas fa-lightbulb text-3xl text-brand-primary" />
        </div>
        <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">لا توجد أفكار بعد</h3>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary max-w-sm leading-relaxed mb-6">
            اكتب موضوعًا في الأعلى وسيقوم Gemini بتوليد أفكار محتوى مخصصة لبراندك — جاهزة للتحويل لمحتوى فوراً
        </p>
        <button
            onClick={onGetStarted}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-primary text-white text-sm font-bold hover:-translate-y-0.5 transition-all shadow-primary-glow"
        >
            <i className="fas fa-magic" />
            ابدأ توليد الأفكار
        </button>
    </div>
);

// ─── Topic Suggestions ────────────────────────────────────────────────────────
const TOPIC_SUGGESTIONS = [
    'إطلاق منتج جديد', 'خلف الكواليس', 'قصة نجاح عميل',
    'نصائح سريعة', 'مقارنة المنتجات', 'عروض الموسم', 'أسئلة شائعة',
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export const IdeaOpsPage: React.FC<IdeaOpsPageProps> = ({ brandProfile, addNotification, onConvertToContent, onNavigate }) => {
    const [topic, setTopic] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [ideas, setIdeas] = useState<BrainstormedIdea[]>([]);
    const [ideaToTest, setIdeaToTest] = useState<BrainstormedIdea | null>(null);
    const [convertedIds, setConvertedIds] = useState<Set<number>>(new Set());
    const inputRef = React.useRef<HTMLInputElement>(null);

    const fetchIdeas = useCallback(async () => {
        const existingIdeas = await getBrainstormedIdeas('brand-1');
        setIdeas(existingIdeas);
    }, []);

    useEffect(() => { fetchIdeas(); }, [fetchIdeas]);

    const handleBrainstorm = async () => {
        if (!topic.trim()) {
            addNotification(NotificationType.Warning, 'أدخل موضوعًا أولاً لتوليد الأفكار');
            inputRef.current?.focus();
            return;
        }
        setIsLoading(true);
        try {
            const newIdeas = await brainstormContentIdeas(topic, brandProfile);
            setIdeas(prev => [...newIdeas, ...prev]);
            addNotification(NotificationType.Success, `✨ تم توليد ${newIdeas.length} أفكار جديدة عن "${topic}"`);
            setTopic('');
        } catch (error) {
            addNotification(NotificationType.Error, 'فشل توليد الأفكار — تحقق من الاتصال وحاول مرة أخرى');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConvert = (idea: BrainstormedIdea, index: number) => {
        setConvertedIds(prev => new Set([...prev, index]));
        if (onConvertToContent) {
            onConvertToContent(idea);
        }
        addNotification(NotificationType.Success, `✅ تم تحويل "${idea.title}" إلى بطاقة في خطة المحتوى`);
        // Navigate to content-ops after a short delay so user sees the toast
        if (onNavigate) {
            setTimeout(() => onNavigate('content-ops'), 1200);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleBrainstorm();
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">بنك الأفكار</h1>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                        {ideas.length > 0
                            ? `${ideas.length} فكرة جاهزة — اضغط "تحويل لمحتوى" لإضافتها مباشرة لخطة المحتوى`
                            : 'اكتب موضوعًا وسيولد Gemini أفكار محتوى مخصصة لبراندك'
                        }
                    </p>
                </div>
                {ideas.length > 0 && (
                    <button
                        onClick={() => onNavigate?.('content-ops')}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-light-border dark:border-dark-border text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:border-brand-primary hover:text-brand-primary transition-colors flex-shrink-0"
                    >
                        <i className="fas fa-columns text-xs" />
                        عرض خطة المحتوى
                    </button>
                )}
            </div>

            {/* Brainstorm Input */}
            <div className="surface-panel rounded-[1.5rem] p-5 border border-light-border dark:border-dark-border">
                <label className="block text-sm font-bold text-light-text dark:text-dark-text mb-3">
                    <i className="fas fa-magic text-brand-primary me-2" />
                    عن ماذا تريد محتوى؟
                </label>
                <div className="flex gap-3">
                    <input
                        ref={inputRef}
                        type="text"
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="مثال: خصم رمضان على منتجاتنا الجديدة..."
                        className="flex-1 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl py-3 px-4 text-light-text dark:text-dark-text placeholder:text-light-text-secondary dark:placeholder:text-dark-text-secondary focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-shadow text-sm"
                    />
                    <button
                        onClick={handleBrainstorm}
                        disabled={isLoading}
                        className="flex items-center gap-2 bg-gradient-to-r from-brand-pink to-brand-purple text-white font-bold py-3 px-5 rounded-xl disabled:opacity-60 hover:shadow-lg hover:-translate-y-0.5 transition-all flex-shrink-0 text-sm"
                    >
                        {isLoading
                            ? <><i className="fas fa-circle-notch fa-spin" />جاري التفكير...</>
                            : <><i className="fas fa-magic" />✨ ولّد أفكار</>
                        }
                    </button>
                </div>

                {/* Topic Suggestions */}
                <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">اقتراحات:</span>
                    {TOPIC_SUGGESTIONS.map(s => (
                        <button
                            key={s}
                            onClick={() => setTopic(s)}
                            className="text-xs px-2.5 py-1 rounded-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-brand-primary hover:text-brand-primary transition-colors"
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Bar — when ideas exist */}
            {ideas.length > 0 && (
                <div className="flex items-center gap-4 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    <span className="flex items-center gap-1.5">
                        <i className="fas fa-lightbulb text-amber-500" />
                        <strong className="text-light-text dark:text-dark-text">{ideas.length}</strong> فكرة
                    </span>
                    <span className="w-px h-4 bg-light-border dark:bg-dark-border" />
                    <span className="flex items-center gap-1.5">
                        <i className="fas fa-check-circle text-emerald-500" />
                        <strong className="text-light-text dark:text-dark-text">{convertedIds.size}</strong> تم تحويلها لمحتوى
                    </span>
                    <span className="w-px h-4 bg-light-border dark:bg-dark-border" />
                    <span className="flex items-center gap-1.5">
                        <i className="fas fa-clock text-brand-primary" />
                        <strong className="text-light-text dark:text-dark-text">{ideas.length - convertedIds.size}</strong> في الانتظار
                    </span>
                </div>
            )}

            {/* Ideas Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ideas.length === 0 && !isLoading
                    ? <IdeasEmptyState onGetStarted={() => inputRef.current?.focus()} />
                    : ideas.map((idea, index) => (
                        <div key={index} className={`transition-opacity duration-300 ${convertedIds.has(index) ? 'opacity-40' : 'opacity-100'}`}>
                            <IdeaCard
                                idea={idea}
                                index={index}
                                onTest={() => setIdeaToTest(idea)}
                                onConvert={() => handleConvert(idea, index)}
                            />
                            {convertedIds.has(index) && (
                                <p className="text-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-2">
                                    <i className="fas fa-check-circle me-1" />
                                    تم إضافتها لخطة المحتوى
                                </p>
                            )}
                        </div>
                    ))
                }

                {/* Loading skeleton cards */}
                {isLoading && [1,2,3,4,5,6].map(i => (
                    <div key={i} className="bg-light-card dark:bg-dark-card rounded-[1.25rem] border border-light-border dark:border-dark-border p-4 space-y-3 animate-pulse">
                        <div className="flex gap-2">
                            <div className="w-8 h-8 rounded-xl bg-light-bg dark:bg-dark-bg" />
                            <div className="flex-1 h-4 rounded bg-light-bg dark:bg-dark-bg mt-2" />
                        </div>
                        <div className="h-4 rounded bg-light-bg dark:bg-dark-bg w-3/4" />
                        <div className="h-3 rounded bg-light-bg dark:bg-dark-bg" />
                        <div className="h-3 rounded bg-light-bg dark:bg-dark-bg w-5/6" />
                        <div className="h-8 rounded-xl bg-light-bg dark:bg-dark-bg mt-2" />
                    </div>
                ))}
            </div>

            {/* Test Plan Modal */}
            {ideaToTest && (
                <IdeaTestPlanModal
                    idea={ideaToTest}
                    onClose={() => setIdeaToTest(null)}
                    brandProfile={brandProfile}
                />
            )}
        </div>
    );
};
