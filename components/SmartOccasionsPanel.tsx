import React, { useState, useMemo } from 'react';
import { BrandHubProfile, PublisherBrief } from '../types';
import { OCCASIONS, getUpcomingOccasions, filterOccasionsForBrand, getDaysUntil, Occasion } from '../data/occasions';
import { callAIProxy, Type } from '../services/aiProxy';

interface Props {
    brandProfile: BrandHubProfile;
    onSendToPublisher: (brief: PublisherBrief) => void;
}

const COUNTRY_NAMES: Record<string, string> = {
    SA: 'السعودية', EG: 'مصر', AE: 'الإمارات', KW: 'الكويت',
    BH: 'البحرين', QA: 'قطر', OM: 'عُمان', JO: 'الأردن',
    LB: 'لبنان', MA: 'المغرب',
};

const COUNTRIES = Object.entries(COUNTRY_NAMES).map(([code, name]) => ({ code, name }));

const TYPE_LABELS: Record<string, string> = {
    national: 'وطني', international: 'عالمي',
    industry: 'صناعي', religious: 'ديني', commercial: 'تجاري',
};

const TYPE_COLORS: Record<string, string> = {
    national:      'bg-green-500/20 text-green-400 border-green-500/30',
    international: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    industry:      'bg-violet-500/20 text-violet-400 border-violet-500/30',
    religious:     'bg-amber-500/20 text-amber-400 border-amber-500/30',
    commercial:    'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

const URGENCY_COLOR = (days: number) => {
    if (days <= 3)  return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    if (days <= 7)  return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    if (days <= 14) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    return 'text-dark-text-secondary bg-dark-bg border-dark-border';
};

const OccasionCard: React.FC<{
    occasion: Occasion;
    onGenerate: (o: Occasion) => void;
    isGenerating: boolean;
}> = ({ occasion, onGenerate, isGenerating }) => {
    const days = getDaysUntil(occasion);
    const urgency = URGENCY_COLOR(days);

    return (
        <div className="rounded-2xl border border-dark-border bg-dark-bg hover:border-dark-border/80 transition-all group overflow-hidden">
            {/* Top gradient strip */}
            <div className={`h-1 w-full bg-gradient-to-r ${occasion.color}`} />

            <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                        <span className="text-2xl leading-none">{occasion.emoji}</span>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-dark-text leading-snug">{occasion.nameAr}</p>
                            <p className="text-[10px] text-dark-text-secondary mt-0.5">{occasion.nameEn}</p>
                        </div>
                    </div>
                    <div className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold ${urgency}`}>
                        <i className="fas fa-clock text-[8px]" />
                        {days === 0 ? 'اليوم!' : days === 1 ? 'غداً' : `${days} يوم`}
                    </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TYPE_COLORS[occasion.type]}`}>
                        {TYPE_LABELS[occasion.type]}
                    </span>
                    <span className="text-[10px] text-dark-text-secondary">
                        {occasion.month}/{occasion.day}
                    </span>
                </div>

                <p className="text-[11px] text-dark-text-secondary leading-relaxed mb-3">
                    {occasion.contentAngle}
                </p>

                <div className="flex flex-wrap gap-1 mb-3">
                    {occasion.hashtags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[9px] font-mono text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded-md">
                            {tag}
                        </span>
                    ))}
                </div>

                <button
                    onClick={() => onGenerate(occasion)}
                    disabled={isGenerating}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary text-white text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                    {isGenerating ? (
                        <><i className="fas fa-circle-notch fa-spin text-xs" /> يولّد بريف...</>
                    ) : (
                        <><i className="fas fa-wand-magic-sparkles text-xs" /> أنشئ محتوى بـ AI</>
                    )}
                </button>
            </div>
        </div>
    );
};

export const SmartOccasionsPanel: React.FC<Props> = ({ brandProfile, onSendToPublisher }) => {
    const [country, setCountry] = useState<string>('SA');
    const [filter, setFilter] = useState<'upcoming' | 'national' | 'international' | 'commercial' | 'religious'>('upcoming');
    const [generatingId, setGeneratingId] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const occasions = useMemo(() => {
        let list = filter === 'upcoming'
            ? getUpcomingOccasions(60)
            : OCCASIONS.filter(o => o.type === filter);

        list = filterOccasionsForBrand(list, country, brandProfile.industry || '');

        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(o =>
                o.nameAr.includes(q) || o.nameEn.toLowerCase().includes(q)
            );
        }

        return list.slice(0, 20);
    }, [filter, country, brandProfile.industry, search]);

    const handleGenerate = async (occasion: Occasion) => {
        setGeneratingId(occasion.id);
        try {
            const res = await callAIProxy({
                model: 'gemini-2.5-flash',
                feature: 'occasion-brief-generator',
                prompt: `أنت خبير تسويق رقمي. براند "${brandProfile.brandName}" (${brandProfile.industry}) يريد إنشاء محتوى بمناسبة "${occasion.nameAr}".

هوية البراند:
- القيم: ${brandProfile.values?.join('، ') || 'غير محدد'}
- نقاط البيع: ${brandProfile.keySellingPoints?.slice(0, 3).join('، ') || 'غير محدد'}
- نبرة الصوت: ${brandProfile.brandVoice?.toneDescription?.slice(0, 2).join('، ') || 'مهني وودود'}
- الجمهور: ${brandProfile.brandAudiences?.[0]?.personaName || 'عام'}

زاوية المحتوى المقترحة: ${occasion.contentAngle}

أنشئ brief تسويقي احترافي يتضمن:
1. عنوان جذاب للمنشور (مختصر وقوي)
2. نص المنشور الكامل بأسلوب البراند (3-5 جمل)
3. دعوة للإجراء (CTA)
4. 5-8 هاشتاق مناسبة

اكتب كل شيء بالعربية واجعله يتناسب تماماً مع هوية البراند وروح المناسبة.`,
                schema: {
                    type: Type.OBJECT,
                    properties: {
                        title:    { type: Type.STRING },
                        content:  { type: Type.STRING },
                        cta:      { type: Type.STRING },
                        hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                },
            });

            const data = typeof res.text === 'string' ? JSON.parse(res.text) : res.text as any;
            const fullContent = `${data.content}\n\n${data.cta}\n\n${(data.hashtags || occasion.hashtags).join(' ')}`;

            const brief: PublisherBrief = {
                id: crypto.randomUUID(),
                source: 'social-search',
                title: `${occasion.emoji} ${occasion.nameAr} — ${brandProfile.brandName}`,
                query: occasion.nameAr,
                objective: data.title,
                angle: data.content,
                competitors: [],
                keywords: [],
                hashtags: data.hashtags || occasion.hashtags,
                suggestedPlatforms: [],
                cta: data.cta,
                notes: [occasion.contentAngle],
            };

            onSendToPublisher(brief);
        } catch {
            // fallback brief without AI
            const brief: PublisherBrief = {
                id: crypto.randomUUID(),
                source: 'social-search',
                title: `${occasion.emoji} ${occasion.nameAr}`,
                query: occasion.nameAr,
                objective: occasion.contentAngle,
                angle: occasion.contentAngle,
                competitors: [],
                keywords: [],
                hashtags: occasion.hashtags,
                suggestedPlatforms: [],
                notes: [],
            };
            onSendToPublisher(brief);
        } finally {
            setGeneratingId(null);
        }
    };

    const filterTabs = [
        { id: 'upcoming',      label: 'القادمة',    icon: 'fa-calendar-day' },
        { id: 'commercial',    label: 'تجارية',     icon: 'fa-tag' },
        { id: 'national',      label: 'وطنية',      icon: 'fa-flag' },
        { id: 'international', label: 'عالمية',     icon: 'fa-globe' },
        { id: 'religious',     label: 'دينية',      icon: 'fa-star-and-crescent' },
    ] as const;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-gradient-to-br from-brand-primary/10 to-brand-secondary/5 border-b border-dark-border px-5 py-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-primary-glow">
                        <i className="fas fa-calendar-star text-white text-sm" />
                    </div>
                    <div>
                        <h2 className="font-bold text-dark-text text-base">محرك المناسبات الذكي</h2>
                        <p className="text-[11px] text-dark-text-secondary">اصنع محتوى مناسب في اللحظة الصحيحة</p>
                    </div>
                </div>

                {/* Country + Search */}
                <div className="flex gap-2 mb-3">
                    <select
                        value={country}
                        onChange={e => setCountry(e.target.value)}
                        className="flex-shrink-0 bg-dark-bg border border-dark-border text-dark-text text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-brand-primary"
                    >
                        {COUNTRIES.map(c => (
                            <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                    </select>
                    <div className="relative flex-1">
                        <i className="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-dark-text-secondary text-xs" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="ابحث عن مناسبة..."
                            className="w-full bg-dark-bg border border-dark-border text-dark-text text-xs rounded-xl pr-8 pl-3 py-2 focus:outline-none focus:border-brand-primary placeholder-dark-text-secondary"
                        />
                    </div>
                </div>

                {/* Filter tabs */}
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                    {filterTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id)}
                            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                filter === tab.id
                                    ? 'bg-brand-primary text-white shadow-primary-glow'
                                    : 'bg-dark-bg border border-dark-border text-dark-text-secondary hover:border-brand-primary/50'
                            }`}
                        >
                            <i className={`fas ${tab.icon} text-[9px]`} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Brand context pill */}
            <div className="px-5 py-2.5 border-b border-dark-border bg-dark-card flex items-center gap-2">
                <i className="fas fa-layer-group text-brand-primary text-xs" />
                <p className="text-[11px] text-dark-text-secondary">
                    مخصص لـ <span className="font-semibold text-brand-primary">{brandProfile.brandName}</span>
                    {brandProfile.industry && <> · <span className="text-dark-text">{brandProfile.industry}</span></>}
                </p>
                <span className="mr-auto text-[10px] text-dark-text-secondary">{occasions.length} مناسبة</span>
            </div>

            {/* Occasions grid */}
            <div className="flex-1 overflow-y-auto p-4">
                {occasions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                        <i className="fas fa-calendar-times text-dark-text-secondary text-3xl" />
                        <p className="text-dark-text font-semibold text-sm">لا توجد مناسبات</p>
                        <p className="text-dark-text-secondary text-xs">جرب فئة أو دولة مختلفة</p>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                        {occasions.map(occasion => (
                            <OccasionCard
                                key={occasion.id}
                                occasion={occasion}
                                onGenerate={handleGenerate}
                                isGenerating={generatingId === occasion.id}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer stats */}
            <div className="border-t border-dark-border px-5 py-3 bg-dark-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                        <span className="text-[10px] text-dark-text-secondary">
                            {getUpcomingOccasions(7).length} مناسبة هذا الأسبوع
                        </span>
                    </div>
                </div>
                <span className="text-[10px] text-dark-text-secondary">
                    <i className="fas fa-database text-[8px] ml-1" />
                    {OCCASIONS.length}+ مناسبة في القاعدة
                </span>
            </div>
        </div>
    );
};
