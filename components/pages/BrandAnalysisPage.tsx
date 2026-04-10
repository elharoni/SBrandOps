// components/pages/BrandAnalysisPage.tsx
import React, { useState } from 'react';
import { BrandHubProfile, NotificationType, BrandProfileAnalysis } from '../../types';
import { analyzeBrandProfile } from '../../services/geminiService';

interface BrandAnalysisPageProps {
    brandProfile: BrandHubProfile;
    addNotification: (type: NotificationType, message: string) => void;
}

const ScoreDonut: React.FC<{ score: number }> = ({ score }) => {
    const color = score >= 85 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    return (
        <div className="relative w-48 h-48 mx-auto">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle className="text-light-bg dark:text-dark-bg" cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="10" />
                <circle
                    className={color} cx="50" cy="50" r="45" fill="none"
                    stroke="currentColor" strokeWidth="10" strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset} strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">درجة الاتساق</span>
                <span className={`text-5xl font-bold ${color}`}>{score}</span>
            </div>
        </div>
    );
};

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

    const handleRunAnalysis = async () => {
        setIsLoading(true);
        setAnalysis(null);
        try {
            const result = await analyzeBrandProfile(brandProfile);
            setAnalysis(result);
            addNotification(NotificationType.Success, "تم اكتمال تحليل البراند بنجاح.");
        } catch (error) {
            addNotification(NotificationType.Error, "حدث خطأ أثناء تحليل هوية البراند.");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">تحليل هوية البراند</h1>
            </div>
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
                استخدم الذكاء الاصطناعي لتقييم مدى قوة واتساق هوية براندك. سيقوم Gemini بمراجعة هويتك، صوتك، وجمهورك لتقديم توصيات قابلة للتنفيذ.
            </p>
            
            <div className="bg-light-card dark:bg-dark-card p-6 rounded-lg border border-light-border dark:border-dark-border text-center">
                <h2 className="text-xl font-bold text-light-text dark:text-dark-text">هل هوية براندك جاهزة للنجاح؟</h2>
                <p className="text-light-text-secondary dark:text-dark-text-secondary mt-2 mb-4 max-w-2xl mx-auto">
                    اضغط على الزر أدناه لبدء تحليل شامل. سيقوم AI بتقييم ملفك وتقديم درجة شاملة ونقاط قوة وضعف وتوصيات.
                </p>
                <button
                    onClick={handleRunAnalysis}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-brand-pink to-brand-purple text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {isLoading ? (
                        <><i className="fas fa-spinner fa-spin me-2"></i>جاري التحليل...</>
                    ) : (
                        <><i className="fas fa-search-plus me-2"></i>ابدأ التحليل الآن</>
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
                        <h2 className="text-2xl font-bold text-light-text dark:text-dark-text mb-4">نتيجة تحليل البراند</h2>
                        <ScoreDonut score={analysis.overallScore} />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <AnalysisSection title="نقاط القوة" items={analysis.strengths} icon="fa-thumbs-up" color="text-green-400" />
                        <AnalysisSection title="نقاط الضعف" items={analysis.weaknesses} icon="fa-exclamation-triangle" color="text-yellow-400" />
                    </div>
                     <AnalysisSection title="توصيات للتحسين" items={analysis.recommendations} icon="fa-lightbulb" color="text-brand-primary" />
                </div>
            )}
        </div>
    );
};