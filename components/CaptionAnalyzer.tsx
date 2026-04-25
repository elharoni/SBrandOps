import React, { useState, useEffect, useCallback } from 'react';
import { analyzeCaptionForBrandVoice, generateImprovedCaption, suggestHashtags } from '../services/geminiService';
import { BrandHubProfile, BrandVoiceAnalysis, HashtagSuggestion, SocialPlatform } from '../types';

interface CaptionAnalyzerProps {
  caption: string;
  platforms: SocialPlatform[];
  onClose: () => void;
  onApplyCaption?: (newCaption: string) => void;
  brandProfile: BrandHubProfile;
}

const ScoreCircle: React.FC<{ score: number }> = ({ score }) => {
    const color = score > 75 ? 'text-green-400' : score > 50 ? 'text-yellow-400' : 'text-red-400';
    return (
        <div className="relative w-24 h-24">
            <svg className="w-full h-full" viewBox="0 0 36 36">
                <path
                    className="text-dark-bg"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                />
                <path
                    className={color}
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${score}, 100`}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-bold ${color}`}>{score}</span>
            </div>
        </div>
    );
};

export const CaptionAnalyzer: React.FC<CaptionAnalyzerProps> = ({ caption, platforms, onClose, onApplyCaption, brandProfile }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [brandAnalysis, setBrandAnalysis] = useState<BrandVoiceAnalysis | null>(null);
    const [hashtagSuggestions, setHashtagSuggestions] = useState<HashtagSuggestion[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [improvedCaption, setImprovedCaption] = useState<string | null>(null);
    const [isImproving, setIsImproving] = useState(false);
    const [applied, setApplied] = useState(false);

    const runAnalysis = useCallback(async () => {
        if (!caption) {
            setError('لا يوجد كابشن لتحليله.');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            suggestHashtags(caption, platforms).then(setHashtagSuggestions);

            const analysis = await analyzeCaptionForBrandVoice(caption, brandProfile);
            setBrandAnalysis(analysis);
        } catch (err) {
            setError('حدث خطأ أثناء تحليل الكابشن.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [caption, platforms, brandProfile]);

    useEffect(() => {
        runAnalysis();
    }, [runAnalysis]);

    const handleImprove = async () => {
        if (!brandAnalysis) return;
        setIsImproving(true);
        setImprovedCaption(null);
        try {
            const improved = await generateImprovedCaption(caption, brandAnalysis.suggestions, brandProfile);
            setImprovedCaption(improved);
        } catch (err) {
            console.error(err);
        } finally {
            setIsImproving(false);
        }
    };

    const handleApply = () => {
        if (!improvedCaption || !onApplyCaption) return;
        onApplyCaption(improvedCaption);
        setApplied(true);
        setTimeout(onClose, 800);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-dark-card rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-dark-border flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center"><i className="fas fa-search-plus me-3 text-brand-secondary"></i>تحليل الكابشن</h2>
                    <button onClick={onClose} className="text-dark-text-secondary hover:text-white">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6">
                    <div>
                        <h3 className="font-semibold text-dark-text-secondary mb-2">الكابشن الحالي:</h3>
                        <p className="bg-dark-bg p-3 rounded-md text-dark-text whitespace-pre-wrap">{caption}</p>
                    </div>

                    {isLoading && <p className="text-center text-dark-text-secondary py-8">يقوم Gemini بالتحليل...</p>}
                    {error && <p className="text-red-400 text-sm">{error}</p>}

                    {!isLoading && brandAnalysis && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-1 flex flex-col items-center justify-center bg-dark-bg/50 p-4 rounded-lg">
                                <h4 className="font-bold text-white mb-3">توافق البراند</h4>
                                <ScoreCircle score={brandAnalysis.score} />
                                <p className="text-sm text-dark-text-secondary text-center mt-3">{brandAnalysis.feedback}</p>
                            </div>
                            <div className="md:col-span-2 bg-dark-bg/50 p-4 rounded-lg flex flex-col gap-4">
                                <div>
                                    <h4 className="font-bold text-white mb-3">اقتراحات للتحسين</h4>
                                    <ul className="list-disc list-inside space-y-2 text-dark-text">
                                        {brandAnalysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                                {onApplyCaption && !improvedCaption && (
                                    <button
                                        onClick={handleImprove}
                                        disabled={isImproving}
                                        className="self-start flex items-center gap-2 bg-brand-primary/20 hover:bg-brand-primary/30 text-brand-primary font-semibold text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {isImproving
                                            ? <><i className="fas fa-spinner fa-spin" />جارٍ التحسين...</>
                                            : <><i className="fas fa-wand-magic-sparkles" />تطبيق التحسينات تلقائياً</>
                                        }
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {improvedCaption && (
                        <div className="border border-brand-primary/40 rounded-lg p-4 space-y-3">
                            <h4 className="font-bold text-white flex items-center gap-2">
                                <i className="fas fa-sparkles text-brand-secondary" />
                                الكابشن المحسّن
                            </h4>
                            <p className="bg-dark-bg p-3 rounded-md text-dark-text whitespace-pre-wrap">{improvedCaption}</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleApply}
                                    disabled={applied}
                                    className="flex items-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                                >
                                    {applied
                                        ? <><i className="fas fa-check" />تم التطبيق!</>
                                        : <><i className="fas fa-pen-to-square" />استخدم هذا الكابشن</>
                                    }
                                </button>
                                <button
                                    onClick={handleImprove}
                                    disabled={isImproving}
                                    className="flex items-center gap-2 text-dark-text-secondary hover:text-white text-sm px-3 py-2 rounded-lg border border-dark-border hover:border-dark-text-secondary transition-colors"
                                >
                                    <i className="fas fa-rotate" />إعادة التوليد
                                </button>
                            </div>
                        </div>
                    )}

                    {!isLoading && hashtagSuggestions.length > 0 && (
                        <div>
                             <h4 className="font-bold text-white mb-3">اقتراحات الهاشتاج</h4>
                             <div className="flex flex-wrap gap-2">
                                {hashtagSuggestions.flatMap(group => group.hashtags).map((tag, i) => (
                                    <span key={i} className="bg-brand-primary/20 text-brand-primary text-sm font-semibold px-3 py-1 rounded-full">{tag}</span>
                                ))}
                             </div>
                        </div>
                    )}
                </div>
                 <div className="p-4 border-t border-dark-border text-end">
                    <button onClick={onClose} className="bg-dark-bg hover:bg-dark-border text-dark-text font-bold py-2 px-4 rounded-lg">
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    );
};
