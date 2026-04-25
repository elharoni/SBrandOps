import React, { useState, useEffect } from 'react';
import { useModalClose } from '../hooks/useModalClose';
import { PostPerformance, AIPostAnalysis, BrandHubProfile } from '../types';
import { analyzePostWithAI } from '../services/geminiService';

interface AIPostReviewModalProps {
  onClose: () => void;
  post: PostPerformance;
  brandProfile: BrandHubProfile;
  onApplyRecommendations?: (recommendations: string[]) => void;
}

const ScoreCircle: React.FC<{ score: number }> = ({ score }) => {
    const color = score > 75 ? 'text-green-400' : score > 50 ? 'text-yellow-400' : 'text-red-400';
    const circumference = 2 * Math.PI * 15.9155;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
        <div className="relative w-28 h-28">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle
                    className="text-dark-bg"
                    cx="18" cy="18" r="15.9155"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                />
                <circle
                    className={color}
                    cx="18" cy="18" r="15.9155"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-3xl font-bold ${color}`}>{score}</span>
            </div>
        </div>
    );
};

const AnalysisSection: React.FC<{ title: string, items: string[], icon: string, color: string }> = ({ title, items, icon, color }) => (
    <div>
        <h4 className={`font-bold text-white mb-2 flex items-center ${color}`}>
            <i className={`fas ${icon} me-2`}></i>
            {title}
        </h4>
        <ul className="list-disc list-inside space-y-1 text-sm text-dark-text-secondary">
            {items.map((item, index) => <li key={index}>{item}</li>)}
        </ul>
    </div>
);


export const AIPostReviewModal: React.FC<AIPostReviewModalProps> = ({ onClose, post, brandProfile, onApplyRecommendations }) => {
    const [analysis, setAnalysis] = useState<AIPostAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string|null>(null);
    useModalClose(onClose);

    useEffect(() => {
        const fetchAnalysis = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const result = await analyzePostWithAI(post, brandProfile);
                setAnalysis(result);
            } catch (err) {
                setError("فشل في تحليل المنشور. الرجاء المحاولة مرة أخرى.");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAnalysis();
    }, [post, brandProfile]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-dark-card rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-dark-border flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">مراجعة المنشور بالذكاء الاصطناعي</h2>
          <button onClick={onClose} className="text-dark-text-secondary hover:text-white">&times;</button>
        </div>
        <div className="p-6 overflow-y-auto space-y-5">
          <p className="bg-dark-bg p-3 rounded-md mt-2 whitespace-pre-wrap text-sm text-dark-text">"{post.content}"</p>
          {isLoading && <p className="text-center py-10">جاري التحليل...</p>}
          {error && <p className="text-center py-10 text-red-400">{error}</p>}
          {analysis && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col items-center justify-center bg-dark-bg/50 p-4 rounded-lg">
                      <h3 className="font-bold text-white mb-3">تقييم التوافق مع البراند</h3>
                      <ScoreCircle score={analysis.brandFitScore} />
                  </div>
                  <div className="space-y-4">
                      <AnalysisSection title="نقاط القوة" items={analysis.strengths} icon="fa-thumbs-up" color="text-green-400" />
                      <AnalysisSection title="نقاط الضعف" items={analysis.weaknesses} icon="fa-thumbs-down" color="text-yellow-400" />
                  </div>
                  <div className="md:col-span-2 bg-dark-bg/50 p-4 rounded-lg">
                      <AnalysisSection title="توصيات للتحسين" items={analysis.recommendations} icon="fa-lightbulb" color="text-brand-primary" />
                  </div>
              </div>
          )}
        </div>
        <div className="p-4 border-t border-dark-border flex items-center justify-between gap-3">
            {analysis && onApplyRecommendations && (
                <button
                    onClick={() => { onApplyRecommendations(analysis.recommendations); onClose(); }}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                >
                    <i className="fas fa-wand-magic-sparkles text-xs" />
                    تطبيق التوصيات على المحتوى
                </button>
            )}
            <button onClick={onClose} className="ms-auto bg-dark-bg hover:bg-dark-border text-dark-text font-bold py-2 px-4 rounded-lg text-sm transition-colors">
                إغلاق
            </button>
        </div>
      </div>
    </div>
  );
};