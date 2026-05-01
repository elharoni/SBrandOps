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

const AnalysisSection: React.FC<{ title: string, items: string[], icon: string, color: string }> = ({ title, items, icon, color }) => (
    <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border">
        <h3 className={`font-bold text-light-text dark:text-dark-text mb-3 text-lg flex items-center ${color}`}>
            <i className={`fas ${icon} me-3`}></i>{title}
        </h3>
        <ul className="list-disc list-inside space-y-2 text-light-text-secondary dark:text-dark-text-secondary text-sm">
            {items.map((item, index) => <li key={index}>{item}</li>)}
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
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-3">
                <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">تدقيق البراند</h1>
                {analysis && (
                    <button
                        onClick={handleClearResults}
                        className="text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-red-400 transition-colors flex items-center gap-1"
                    >
                        <i className="fas fa-trash text-[10px]" />
                        مسح النتائج
                    </button>
                )}
            </div>
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
                استخدم الذكاء الاصطناعي لتقييم مدى قوة واتساق هوية براندك. النتائج تُحفظ تلقائياً وتبقى عند العودة لهذه الصفحة.
            </p>

            <div className="bg-light-card dark:bg-dark-card p-6 rounded-lg border border-light-border dark:border-dark-border text-center">
                <h2 className="text-xl font-bold text-light-text dark:text-dark-text">
                    {analysis ? 'تحديث تحليل البراند' : 'هل هوية براندك جاهزة للنجاح؟'}
                </h2>
                <p className="text-light-text-secondary dark:text-dark-text-secondary mt-2 mb-4 max-w-2xl mx-auto">
                    {analysis
                        ? `آخر تحليل — درجة ${analysis.overallScore}/100. اضغط لإعادة التحليل بالبيانات الحالية.`
                        : 'اضغط على الزر أدناه لبدء تحليل شامل. سيقوم AI بتقييم ملفك وتقديم درجة شاملة ونقاط قوة وضعف وتوصيات.'
                    }
                </p>
                <button
                    onClick={handleRunAnalysis}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-brand-pink to-brand-purple text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {isLoading ? (
                        <><i className="fas fa-spinner fa-spin me-2" />جاري التحليل...</>
                    ) : analysis ? (
                        <><i className="fas fa-refresh me-2" />إعادة التحليل</>
                    ) : (
                        <><i className="fas fa-search-plus me-2" />ابدأ التحليل الآن</>
                    )}
                </button>
            </div>

            {analysis && (
                <div className="space-y-6 animate-fade-in">
                    <style>{`
                        @keyframes fade-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
                        .animate-fade-in { animation: fade-in 0.5s ease-out; }
                    `}</style>
                    <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border flex flex-col items-center">
                        <h2 className="text-2xl font-bold text-light-text dark:text-dark-text mb-4">نتيجة تدقيق البراند</h2>
                        <ScoreDonut score={analysis.overallScore} labelAr="الدرجة الكلية" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <AnalysisSection title="نقاط القوة" items={analysis.strengths} icon="fa-thumbs-up" color="text-green-400" />
                        <AnalysisSection title="نقاط الضعف" items={analysis.weaknesses} icon="fa-exclamation-triangle" color="text-yellow-400" />
                    </div>
                    <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border">
                        <h3 className="font-bold text-light-text dark:text-dark-text mb-3 text-lg flex items-center text-brand-primary">
                            <i className="fas fa-lightbulb me-3" />توصيات للتحسين
                        </h3>
                        <ul className="space-y-2">
                            {analysis.recommendations.map((item, index) => (
                                <li key={index} className="flex items-start gap-3 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
                                        {index + 1}
                                    </span>
                                    {item}
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