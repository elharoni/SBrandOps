import React, { useState, useEffect } from 'react';
import { BrandHubProfile } from '../../types';
import { getBrandKnowledge } from '../../services/brandKnowledgeService';
import { getSocialAccounts } from '../../services/socialAccountService';
import { getBrandDocuments } from '../../services/brandDocumentService';

interface IntelligenceTabContentProps {
    profile: BrandHubProfile;
    brandId: string;
    onNavigate?: (page: string) => void;
    setActiveTab: (tab: 'identity' | 'voice' | 'audience' | 'ai-memory' | 'assets' | 'documents' | 'intelligence') => void;
}

type HubTab = 'identity' | 'voice' | 'audience';
interface FieldItem {
    label: string;
    done: boolean;
    pts: number;
    fix?: string;
    tab?: HubTab;
    route?: string;
}

export const IntelligenceTabContent: React.FC<IntelligenceTabContentProps> = ({
    profile,
    brandId,
    onNavigate,
    setActiveTab,
}) => {
    const [expandedCat, setExpandedCat] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [counts, setCounts] = useState({
        knowledgeCount: 0,
        knowledgeByType: {} as Record<string, number>,
        socialCount: 0,
        docCount: 0,
    });

    useEffect(() => {
        if (!brandId) return;
        setLoading(true);
        Promise.all([
            getBrandKnowledge(brandId),
            getSocialAccounts(brandId),
            getBrandDocuments(brandId),
        ]).then(([knowledge, accounts, docs]) => {
            const kByType = knowledge.reduce((acc, k) => { 
                acc[k.type] = (acc[k.type] || 0) + 1; 
                return acc; 
            }, {} as Record<string, number>);
            
            setCounts({
                knowledgeCount: knowledge.length,
                knowledgeByType: kByType,
                socialCount: accounts.length,
                docCount: docs.length,
            });
        }).catch(err => {
            console.error('[IntelligenceTab] Error loading details:', err);
        }).finally(() => {
            setLoading(false);
        });
    }, [brandId]);

    // ── Field-level checks ─────────────────────────────────────
    const identityFields: FieldItem[] = [
        { label: 'اسم البراند',        done: !!profile.brandName,                                       pts: 4, fix: 'أضف اسم البراند',    tab: 'identity' },
        { label: 'المجال / القطاع',     done: !!profile.industry,                                        pts: 4, fix: 'حدّد المجال',         tab: 'identity' },
        { label: 'وصف البراند',         done: !!profile.description,                                     pts: 4, fix: 'اكتب وصف البراند',   tab: 'identity' },
        { label: 'القيم الجوهرية',      done: (profile.values?.length ?? 0) > 0,                        pts: 4, fix: 'أضف قيم البراند',    tab: 'identity' },
        { label: 'الدولة / السوق',      done: !!profile.country,                                         pts: 4, fix: 'حدّد الدولة',         tab: 'identity' },
        { label: 'الموقع الإلكتروني',   done: !!profile.website,                                         pts: 4, fix: 'أضف رابط الموقع',   tab: 'identity' },
        { label: 'عرض القيمة',          done: !!profile.valueProp,                                       pts: 3, fix: 'اكتب عرض القيمة',   tab: 'identity' },
        { label: 'وعد البراند',         done: !!profile.brandPromise,                                    pts: 3, fix: 'اكتب وعد البراند',   tab: 'identity' },
    ];
    const identityPts = identityFields.filter(f => f.done).reduce((s, f) => s + f.pts, 0);

    const voiceFields: FieldItem[] = [
        { label: 'وصف النبرة',     done: (profile.brandVoice.toneDescription?.length ?? 0) > 0, pts: 5, fix: 'أضف وصف النبرة',       tab: 'voice' },
        { label: 'الكلمات المفتاحية', done: (profile.brandVoice.keywords?.length ?? 0) > 0,          pts: 5, fix: 'أضف كلمات مفتاحية',   tab: 'voice' },
        { label: 'كلمات يُتجنّب',  done: (profile.brandVoice.negativeKeywords?.length ?? 0) > 0,   pts: 5, fix: 'أضف كلمات محظورة',    tab: 'voice' },
        { label: 'إرشادات الصوت',   done: (profile.brandVoice.voiceGuidelines?.dos?.length ?? 0) > 0, pts: 5, fix: 'أضف إرشادات الصوت', tab: 'voice' },
    ];
    const voicePts = voiceFields.filter(f => f.done).reduce((s, f) => s + f.pts, 0);

    const aud = profile.brandAudiences ?? [];
    const audienceFields: FieldItem[] = [
        { label: 'شخصية جمهور واحدة على الأقل', done: aud.length >= 1,                             pts: 10, fix: 'أنشئ شخصية الجمهور',    tab: 'audience' },
        { label: 'شخصيتان مختلفتان',            done: aud.length >= 2,                             pts: 5,  fix: 'أضف شخصية ثانية',       tab: 'audience' },
        { label: 'نقاط الألم محدّدة',            done: (aud[0]?.painPoints?.length ?? 0) > 0,      pts: 5,  fix: 'أضف نقاط الألم للجمهور', tab: 'audience' },
    ];
    const audiencePts = Math.min(audienceFields.filter(f => f.done).reduce((s, f) => s + f.pts, 0), 20);

    const kc = counts.knowledgeCount;
    const knowledgeFields: FieldItem[] = [
        { label: '3 عناصر معرفة على الأقل',   done: kc >= 3,  pts: 5,  fix: 'أضف منتجات أو خدمات', route: 'brand-knowledge' },
        { label: '6 عناصر معرفة على الأقل',   done: kc >= 6,  pts: 5,  fix: 'أضف المزيد من المحتوى', route: 'brand-knowledge' },
        { label: '9 عناصر معرفة على الأقل',   done: kc >= 9,  pts: 5,  fix: 'أضف وثائق وسيناريوهات', route: 'brand-knowledge' },
        { label: '12 عنصر معرفة على الأقل',   done: kc >= 12, pts: 5,  fix: 'أكمل قاعدة المعرفة',    route: 'brand-knowledge' },
    ];
    const knowledgePts = Math.min(knowledgeFields.filter(f => f.done).reduce((s, f) => s + f.pts, 0), 20);

    const connFields: FieldItem[] = [
        { label: 'حساب تواصل اجتماعي واحد على الأقل', done: counts.socialCount > 0, pts: 10, fix: 'اربط حسابات التواصل', route: 'social-ops/accounts' },
    ];
    const connectionsPts = connFields.filter(f => f.done).reduce((s, f) => s + f.pts, 0);

    const totalScore = identityPts + voicePts + audiencePts + knowledgePts + connectionsPts;

    // ── AI confidence per capability ───────────────────────────
    const contentConf   = Math.round(((identityPts / 30 + voicePts / 20) / 2) * 100);
    const repliesConf   = Math.round(((audiencePts / 20 + knowledgePts / 20) / 2) * 100);
    const adsConf       = Math.round(((identityPts / 30 + voicePts / 20 + audiencePts / 20) / 3) * 100);
    const analyticsConf = connectionsPts > 0 ? Math.round(((connectionsPts / 10 + identityPts / 30) / 2) * 100) : 0;

    // ── Missing fields that need fixing (top priority first) ───
    const missingByTab: FieldItem[] = [
        ...identityFields, ...voiceFields, ...audienceFields,
        ...knowledgeFields, ...connFields,
    ].filter(f => !f.done && f.fix);

    const scoreColor     = totalScore >= 80 ? '#10B981' : totalScore >= 50 ? '#F59E0B' : '#EF4444';
    const scoreTextColor = totalScore >= 80 ? 'text-emerald-400' : totalScore >= 50 ? 'text-yellow-400' : 'text-red-400';
    const circ = 2 * Math.PI * 40;

    const CategoryBreakdown = ({ fields }: { fields: FieldItem[] }) => (
        <div className="mt-2.5 space-y-1.5 pr-3 border-r border-white/5 animate-fade-in">
            {fields.map(f => (
                <div key={f.label} className="flex items-center gap-2">
                    <i className={`fas fa-${f.done ? 'circle-check' : 'circle-xmark'} text-[10px] flex-shrink-0 ${f.done ? 'text-emerald-400' : 'text-red-400/60'}`}></i>
                    <span className={`text-[10px] flex-1 ${f.done ? 'text-dark-text-secondary line-through' : 'text-white/80'}`}>{f.label}</span>
                    {!f.done && (f.tab || f.route) && (
                        <button
                            onClick={() => f.tab ? setActiveTab(f.tab!) : (f.route && onNavigate) ? onNavigate(f.route!) : undefined}
                            className="text-[9px] px-2 py-0.5 rounded-md bg-brand-primary/20 text-brand-primary hover:bg-brand-primary hover:text-white transition-all whitespace-nowrap"
                        >
                            إصلاح
                        </button>
                    )}
                    <span className="text-[9px] text-dark-text-secondary flex-shrink-0 font-mono">+{f.pts}</span>
                </div>
            ))}
        </div>
    );

    const categories = [
        { label: 'الهوية والتأصيل', pts: identityPts,    max: 30, color: 'bg-blue-500',    fields: identityFields },
        { label: 'نبرة صوت البراند', pts: voicePts,       max: 20, color: 'bg-purple-500',  fields: voiceFields },
        { label: 'الجمهور المستهدف', pts: audiencePts,    max: 20, color: 'bg-pink-500',    fields: audienceFields },
        { label: 'قاعدة المعرفة والوثائق', pts: knowledgePts, max: 20, color: 'bg-emerald-500', fields: knowledgeFields },
        { label: 'الحسابات الاجتماعية القابلة للاتصال', pts: connectionsPts, max: 10, color: 'bg-amber-500', fields: connFields },
    ];

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <i className="fas fa-lightbulb text-brand-pink animate-pulse"></i>
                ذكاء البراند (Brand Readiness Index)
            </h2>

            {loading ? (
                <div className="text-center py-16 bg-slate-900/40 border border-white/5 rounded-2xl shadow-2xl backdrop-blur-md">
                    <i className="fas fa-spinner fa-spin text-2xl text-brand-pink mb-3"></i>
                    <p className="text-xs text-dark-text-secondary animate-pulse">جاري تحليل جاهزية البراند واستخلاص مقاييس ذكاء المخرجات...</p>
                </div>
            ) : (
                <>
                    {/* Ring and Category Breakdown Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Circular Progress Ring */}
                        <div className="bg-slate-900/40 border border-white/5 backdrop-blur-md rounded-2xl p-6 flex flex-col items-center justify-center shadow-2xl relative group overflow-hidden hover:border-white/10 transition-all duration-300">
                            <div className="absolute -right-16 -top-16 w-32 h-32 bg-brand-pink/10 rounded-full blur-2xl pointer-events-none group-hover:bg-brand-pink/15 transition-all duration-500" />
                            <p className="text-sm font-bold text-white mb-4 relative z-10">درجة اكتمال الهوية والجاهزية</p>
                            <div className="relative w-40 h-40 z-10 flex items-center justify-center">
                                <div className="absolute inset-0 bg-brand-primary/5 rounded-full blur-2xl pointer-events-none animate-pulse scale-90" />
                                <svg className="w-full h-full transform -rotate-90 relative z-10" viewBox="0 0 100 100">
                                    <circle className="text-slate-950/40" cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="10" />
                                    <circle
                                        cx="50" cy="50" r="40" fill="none"
                                        stroke={scoreColor}
                                        strokeWidth="10"
                                        strokeDasharray={`${circ} ${circ}`}
                                        strokeDashoffset={circ * (1 - totalScore / 100)}
                                        strokeLinecap="round"
                                        className="transition-all duration-1000 ease-out drop-shadow-[0_0_8px_rgba(37,99,235,0.2)]"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                                    <span className={`text-4xl font-black ${scoreTextColor} font-mono`}>{totalScore}</span>
                                    <span className="text-[10px] text-dark-text-secondary mt-0.5">من 100</span>
                                </div>
                            </div>
                            <p className="mt-5 text-xs text-center text-dark-text-secondary leading-relaxed max-w-xs relative z-10 font-medium">
                                {totalScore >= 80 ? 'الذكاء الاصطناعي مهيأ بالكامل لإنتاج مخرجات متسقة بنسبة 100%'
                                    : totalScore >= 50 ? 'الهوية مقبولة — يوصى بإكمال العناصر الناقصة لتجنب الهلوسة'
                                    : 'بيانات غير كافية للتحليل والاستهداف الذكي — قد تكون المخرجات عامة'}
                            </p>
                            <button
                                onClick={() => onNavigate && onNavigate('brand-analysis')}
                                className="mt-4 flex items-center gap-1.5 rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-4 py-2 text-xs font-bold text-brand-secondary transition-all hover:bg-brand-primary hover:text-white relative z-10 hover:-translate-y-0.5 duration-200"
                            >
                                <i className="fas fa-magnifying-glass-plus" /> 
                                تدقيق تدريجي شامل
                            </button>
                        </div>

                        {/* Interactive Categories Bar Breakdown */}
                        <div className="bg-slate-900/40 border border-white/5 backdrop-blur-md rounded-2xl p-6 space-y-5 shadow-2xl relative overflow-hidden group hover:border-white/10 transition-all duration-300">
                            <div>
                                <p className="text-sm font-bold text-white">توزيع نقاط جاهزية البراند</p>
                                <p className="text-[10px] text-dark-text-secondary mt-1 font-medium">اضغط على أي تصنيف لاستعراض العناصر المطلوبة</p>
                            </div>
                            <div className="space-y-4">
                                {categories.map(cat => {
                                    const isOpen = expandedCat === cat.label;
                                    const pct = Math.round((cat.pts / cat.max) * 100);
                                    const missing = cat.fields.filter(f => !f.done).length;
                                    return (
                                        <div key={cat.label} className="group">
                                            <button
                                                className="w-full text-right block focus:outline-none"
                                                onClick={() => setExpandedCat(isOpen ? null : cat.label)}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-white/95 font-semibold group-hover:text-brand-secondary transition-colors duration-200">{cat.label}</span>
                                                        {missing > 0 && (
                                                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-bold">{missing} ناقص</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 font-mono">
                                                        <span className="text-xs text-dark-text-secondary font-bold">{cat.pts}/{cat.max}</span>
                                                        <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} text-[9px] text-dark-text-secondary transition-transform duration-300`}></i>
                                                    </div>
                                                </div>
                                                <div className="h-2 bg-slate-950/40 rounded-full overflow-hidden border border-white/5 p-[1px]">
                                                    <div
                                                        className={`h-full ${cat.color} rounded-full transition-all duration-700`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </button>
                                            {isOpen && <CategoryBreakdown fields={cat.fields} />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* AI Confidence Cards */}
                    <div className="bg-slate-900/40 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-2xl relative overflow-hidden group hover:border-white/10 transition-all duration-300">
                        <div className="absolute -left-16 -bottom-16 w-36 h-36 bg-brand-purple/10 rounded-full blur-2xl pointer-events-none" />
                        <div className="mb-5">
                            <p className="text-sm font-bold text-white">تقدير ثقة مخرجات الذكاء الاصطناعي (AI Capabilities Confidence)</p>
                            <p className="text-[10px] text-dark-text-secondary mt-1 font-medium">مستويات الدقة والاستقرار المتوقعة بناءً على اكتمال مدخلات الهوية وصوت البراند والجمهور</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {([
                                {
                                    label: 'كتابة وتوليد المحتوى الإبداعي',   value: contentConf,   icon: 'fa-pen-nib',      color: 'bg-blue-500',
                                    missing: [...identityFields, ...voiceFields].filter(f => !f.done).map(f => f.label),
                                },
                                {
                                    label: 'الردود الذكية وتفاعل الجمهور',   value: repliesConf,   icon: 'fa-comment-dots', color: 'bg-purple-500',
                                    missing: [...audienceFields, ...knowledgeFields].filter(f => !f.done).map(f => f.label),
                                },
                                {
                                    label: 'صياغة العناوين والحملات الإعلانية', value: adsConf,        icon: 'fa-bullhorn',     color: 'bg-pink-500',
                                    missing: [...identityFields, ...voiceFields, ...audienceFields].filter(f => !f.done).map(f => f.label),
                                },
                                {
                                    label: 'التحليلات التسويقية ومؤشرات الأداء',  value: analyticsConf, icon: 'fa-chart-line',   color: 'bg-emerald-500',
                                    missing: connFields.filter(f => !f.done).map(f => f.label),
                                },
                             ] as const).map(item => (
                                <div key={item.label} className="bg-slate-950/45 border border-white/5 rounded-2xl p-4 transition-all hover:border-white/10 hover:bg-slate-950/60 duration-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center">
                                            <i className={`fas ${item.icon} text-xs text-brand-secondary`}></i>
                                        </div>
                                        <span className="text-xs text-white/90 font-bold">{item.label}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-2 bg-slate-950/60 border border-white/5 rounded-full overflow-hidden p-[1px]">
                                            <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${item.value}%` }} />
                                        </div>
                                        <span className={`text-xs font-bold font-mono ${item.value >= 70 ? 'text-emerald-400' : item.value >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                            {item.value}%
                                        </span>
                                    </div>
                                    {item.missing.length > 0 && (
                                        <p className="text-[9px] text-red-400/80 leading-relaxed mt-2.5 pl-1 bg-red-500/5 py-1.5 px-2.5 rounded border border-red-500/10 font-medium">
                                            ⚠️ يقلل الدقة غياب: {item.missing.slice(0, 2).join('، ')}{item.missing.length > 2 ? ` +${item.missing.length - 2}` : ''}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Priority Actions Checklist */}
                    {missingByTab.length > 0 && (
                        <div className="bg-slate-900/40 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-2xl relative overflow-hidden group hover:border-white/10 transition-all duration-300">
                            <p className="text-sm font-bold text-white mb-1">خطة العمل الفورية المقترحة لتحسين البراند</p>
                            <p className="text-[10px] text-dark-text-secondary mb-4 font-medium">أكمل هذه الإجراءات بالترتيب لرفع مؤشر الجاهزية وزيادة ذكاء الـ AI</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {missingByTab.slice(0, 6).map((f, i) => (
                                    <button
                                        key={i}
                                        onClick={() => f.tab ? setActiveTab(f.tab!) : (f.route && onNavigate) ? onNavigate(f.route!) : undefined}
                                        disabled={!f.tab && !f.route}
                                        className="text-right flex items-center gap-3 bg-slate-950/45 border border-white/5 rounded-2xl px-4 py-3 hover:bg-brand-primary/10 hover:border-brand-primary/30 transition-all duration-300 disabled:opacity-50 active:scale-[0.99]"
                                    >
                                        <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                                            <span className="text-[10px] font-black text-red-400 font-mono">+{f.pts}</span>
                                        </div>
                                        <span className="text-xs text-white/90 flex-1 font-semibold">{f.fix ?? f.label}</span>
                                        <i className="fas fa-arrow-left text-[10px] text-dark-text-secondary transition-transform duration-200"></i>
                                    </button>
                                ))}
                            </div>
                            {missingByTab.length > 6 && (
                                <p className="text-[10px] text-dark-text-secondary text-center pt-3.5 border-t border-white/5 mt-4">
                                    وهناك {missingByTab.length - 6} عناصر أخرى تتطلب اهتمامك.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Data Sources and Activity Indicators */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Data Sources */}
                        <div className="bg-slate-900/40 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-2xl space-y-4 hover:border-white/10 transition-all duration-300">
                            <p className="text-sm font-bold text-white">مصادر البيانات النشطة المغذية للذكاء الاصطناعي</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                {([
                                    { label: 'بيانات الهوية اليدوية',         active: true,                          desc: 'ملف البراند + الصوت + الجمهور' },
                                    { label: 'صفحات السوشيال ميديا المرتبطة', active: counts.socialCount > 0,    desc: `${counts.socialCount} حساب متصل ونشط` },
                                    { label: 'قاموس وقاعدة المعرفة',         active: counts.knowledgeCount > 0, desc: `${counts.knowledgeCount} عنصر — ${counts.knowledgeByType['product'] || 0} منتج، ${counts.knowledgeByType['faq'] || 0} أسئلة شائعة` },
                                    { label: 'وثائق ومستندات التعلم',          active: counts.docCount > 0,       desc: `${counts.docCount} وثيقة مرفوعة` },
                                ] as const).map(src => (
                                    <div key={src.label} className="flex items-start gap-3 bg-slate-950/45 border border-white/5 rounded-xl p-3 hover:border-white/10 transition-colors duration-250">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 shrink-0 ${src.active ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-950/30 border border-white/5'}`}>
                                            <i className={`fas fa-${src.active ? 'check' : 'xmark'} text-[9px] ${src.active ? 'text-emerald-400' : 'text-dark-text-secondary'}`}></i>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-bold text-white leading-tight">{src.label}</p>
                                            <p className="text-[9px] text-dark-text-secondary leading-normal mt-1">{src.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Last Learning Activity */}
                        <div className="bg-slate-900/40 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-2xl flex flex-col justify-between hover:border-white/10 transition-all duration-300">
                            <div className="space-y-2">
                                <p className="text-sm font-bold text-white">حالة الاتصال والتعلم الذاتي</p>
                                <p className="text-xs text-dark-text-secondary leading-relaxed font-medium">يتزامن الذكاء الاصطناعي تلقائياً مع تحديثات الهوية أو عند رفع مستندات جديدة في مكتبة التعلم أو تقييم المنشورات.</p>
                            </div>
                            
                            {profile.lastMemoryUpdate && (
                                <div className="mt-5 p-3.5 bg-slate-950/45 border border-white/5 rounded-xl flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-brand-pink/15 border border-brand-pink/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                                        <i className="fas fa-brain text-sm text-brand-pink"></i>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-white">آخر دورة تدريبية وتحديث للذاكرة</p>
                                        <p className="text-[10px] text-dark-text-secondary mt-1 font-mono">
                                            {new Date(profile.lastMemoryUpdate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
