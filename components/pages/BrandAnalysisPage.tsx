// components/pages/BrandAnalysisPage.tsx
import React, { useState, useEffect } from 'react';
import { BrandHubProfile, NotificationType, BrandProfileAnalysis } from '../../types';
import { analyzeBrandProfile } from '../../services/geminiService';
import { CompetitorAnalysisWidget } from '../shared/CompetitorAnalysisWidget';
import { ScoreDonut } from '../shared/ScoreDonut';

interface BrandAnalysisPageProps {
    brandProfile: BrandHubProfile;
    addNotification: (type: NotificationType, message: string) => void;
}

function storageKey(brandId: string) {
    return `brand_analysis_${brandId}`;
}

const AnalysisSection: React.FC<{ title: string, items: string[], icon: string, color: string, iconColor: string }> = ({ title, items, icon, color, iconColor }) => (
    <div className="bg-slate-900/35 border border-white/5 backdrop-blur-md p-6 rounded-2xl shadow-xl relative overflow-hidden group hover:border-white/10 hover:shadow-[0_0_25px_rgba(255,255,255,0.01)] hover:-translate-y-0.5 transition-all duration-300 transform">
        <h3 className={`font-bold text-white mb-4 text-base flex items-center gap-2 ${color}`}>
            <i className={`fas ${icon}`}></i>{title}
        </h3>
        <ul className="space-y-3 text-dark-text-secondary text-xs">
            {items.map((item, index) => (
                <li key={index} className="flex items-start gap-2.5 bg-slate-950/40 p-3 rounded-xl border border-white/5 leading-relaxed hover:bg-slate-950/50 hover:border-white/10 transition-colors duration-250">
                    <i className={`fas fa-circle text-[6px] mt-1.5 shrink-0 ${iconColor}`} />
                    <span>{item}</span>
                </li>
            ))}
        </ul>
    </div>
);

export const BrandAnalysisPage: React.FC<BrandAnalysisPageProps> = ({ brandProfile, addNotification }) => {
    const [analysis, setAnalysis] = useState<BrandProfileAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Restore last analysis from localStorage on mount
    useEffect(() => {
        const key = storageKey(brandProfile.brandName);
        const raw = localStorage.getItem(key);
        if (raw) {
            try { setAnalysis(JSON.parse(raw) as BrandProfileAnalysis); } catch { /* ignore */ }
        }
    }, [brandProfile.brandName]);

    const handleRunAnalysis = async () => {
        setIsLoading(true);
        setAnalysis(null);
        try {
            const result = await analyzeBrandProfile(brandProfile);
            setAnalysis(result);
            // Persist to localStorage so results survive navigation
            localStorage.setItem(storageKey(brandProfile.brandName), JSON.stringify(result));
            addNotification(NotificationType.Success, "تم اكتمال تحليل البراند بنجاح.");
        } catch (error) {
            addNotification(NotificationType.Error, "حدث خطأ أثناء تحليل هوية البراند.");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearResults = () => {
        localStorage.removeItem(storageKey(brandProfile.brandName));
        setAnalysis(null);
    };

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            <div className="flex justify-between items-center flex-wrap gap-3">
                <h1 className="text-3xl font-bold text-white">تدقيق البراند</h1>
                {analysis && (
                    <button
                        onClick={handleClearResults}
                        className="text-xs text-dark-text-secondary hover:text-red-400 transition-colors flex items-center gap-1"
                    >
                        <i className="fas fa-trash text-[10px]" />
                        مسح النتائج
                    </button>
                )}
            </div>
            <p className="text-dark-text-secondary">
                استخدم الذكاء الاصطناعي لتقييم مدى قوة واتساق هوية براندك. النتائج تُحفظ تلقائياً وتبقى عند العودة لهذه الصفحة.
            </p>

            <div className="bg-slate-900/40 border border-white/5 backdrop-blur-md rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden group transition-all hover:border-white/10 hover:shadow-[0_0_30px_rgba(37,99,235,0.1)]">
                <div className="absolute -left-20 -top-20 w-44 h-44 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none group-hover:bg-brand-primary/15 transition-all duration-500" />
                <div className="absolute -right-20 -bottom-20 w-44 h-44 bg-brand-secondary/5 rounded-full blur-3xl pointer-events-none" />
                <h2 className="text-xl font-bold text-white">
                    {analysis ? 'تحديث تحليل البراند' : 'هل هوية براندك جاهزة للنجاح؟'}
                </h2>
                <p className="text-dark-text-secondary text-xs mt-2 mb-6 max-w-2xl mx-auto leading-relaxed">
                    {analysis
                        ? `آخر تحليل — درجة ${analysis.overallScore}/100. اضغط لإعادة التحليل بالبيانات الحالية.`
                        : 'اضغط على الزر أدناه لبدء تحليل شامل. سيقوم AI بتقييم ملفك وتقديم درجة شاملة ونقاط قوة وضعف وتوصيات.'
                    }
                </p>
                <button
                    onClick={handleRunAnalysis}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-bold py-3.5 px-8 rounded-xl shadow-lg shadow-brand-primary/20 hover:scale-[1.03] transition-all transform duration-250 disabled:opacity-50 text-xs font-black"
                >
                    {isLoading ? (
                        <><i className="fas fa-spinner fa-spin me-2" />جاري التحليل...</>
                    ) : analysis ? (
                        <><i className="fas fa-rotate me-2" />إعادة التحليل</>
                    ) : (
                        <><i className="fas fa-magnifying-glass-plus me-2" />ابدأ التحليل الآن</>
                    )}
                </button>
            </div>

            {analysis && (
                <div className="space-y-6">
                    <div className="bg-slate-900/40 border border-white/5 backdrop-blur-md p-8 rounded-2xl shadow-xl flex flex-col items-center relative overflow-hidden group hover:border-white/10 transition-all duration-300">
                        {/* Glowing radial background orb */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-tr from-brand-primary/20 via-brand-secondary/10 to-transparent rounded-full blur-3xl pointer-events-none animate-pulse" />
                        <h2 className="text-base font-bold text-white mb-6 relative z-10">نتيجة تدقيق البراند</h2>
                        <div className="relative z-10">
                            <ScoreDonut score={analysis.overallScore} labelAr="الدرجة الكلية" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <AnalysisSection title="نقاط القوة" items={analysis.strengths} icon="fa-thumbs-up" color="text-emerald-400" iconColor="text-emerald-450/60" />
                        <AnalysisSection title="نقاط الضعف" items={analysis.weaknesses} icon="fa-triangle-exclamation" color="text-amber-400" iconColor="text-amber-450/60" />
                    </div>
                    <div className="bg-slate-900/35 border border-white/5 backdrop-blur-md p-6 rounded-2xl shadow-xl relative overflow-hidden group hover:border-white/10 transition-all duration-300">
                        <div className="absolute -top-12 -left-12 w-32 h-32 bg-brand-secondary/5 rounded-full blur-2xl pointer-events-none" />
                        <h3 className="font-bold text-white mb-4 text-base flex items-center gap-2 text-brand-secondary">
                            <i className="fas fa-lightbulb animate-bounce" />توصيات للتحسين
                        </h3>
                        <ul className="space-y-3 relative z-10">
                            {analysis.recommendations.map((item, index) => (
                                <li key={index} className="flex items-start gap-3 text-xs text-dark-text-secondary bg-slate-950/40 p-3 rounded-xl border border-white/5 leading-relaxed hover:bg-slate-950/60 hover:border-white/10 hover:-translate-y-0.5 transform transition-all duration-200 animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                                    <span className="flex-shrink-0 w-5 h-5 rounded-lg bg-brand-primary/15 text-brand-secondary text-[10px] font-black flex items-center justify-center border border-brand-primary/25 shadow-[0_0_10px_rgba(37,99,235,0.1)]">
                                        {index + 1}
                                    </span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            <CompetitorAnalysisWidget
                brandName={brandProfile.brandName}
                industry={brandProfile.industry}
            />
        </div>
    );
};