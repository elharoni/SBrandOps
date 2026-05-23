// components/AIAssistant.tsx
import React, { useState, useCallback } from 'react';
import { generatePostCaption } from '../services/geminiService';
import { BrandHubProfile } from '../types';
import { logUserFeedback } from '../services/brandMemoryService';

interface AIAssistantProps {
  onClose: () => void;
  onApply: (caption: string) => void;
  brandProfile: BrandHubProfile;
  brandId?: string;
}

const toneOptions = ["Professional", "Friendly", "Witty", "Inspirational", "Sales-focused"];

export const AIAssistant: React.FC<AIAssistantProps> = ({ onClose, onApply, brandProfile, brandId = '' }) => {
    const [topic, setTopic] = useState('');
    const [tone, setTone] = useState('Friendly');
    const [results, setResults] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // State for feedback loop
    const [selectedOriginal, setSelectedOriginal] = useState<string | null>(null);
    const [editedCaption, setEditedCaption] = useState<string>('');

    const handleGenerate = useCallback(async () => {
        if (!topic) {
            setError('Please provide a topic for the post.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setResults([]);
        setSelectedOriginal(null);
        setEditedCaption('');
        try {
            const captions = await generatePostCaption(topic, tone, brandProfile);
            setResults(captions);
        } catch (err) {
            setError('Failed to generate captions. Please try again.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [topic, tone, brandProfile]);

    const handleSelectForEdit = (caption: string) => {
        setSelectedOriginal(caption);
        setEditedCaption(caption);
    };

    const handleApplyAndLog = () => {
        if (selectedOriginal && editedCaption !== selectedOriginal) {
            logUserFeedback(brandId, {
                type: 'EDIT',
                originalText: selectedOriginal,
                editedText: editedCaption,
            });
        } else if (selectedOriginal) {
            logUserFeedback(brandId, { type: 'APPROVAL', originalText: selectedOriginal });
        }
        onApply(editedCaption);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-[#070b19]/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="glass-modal rounded-[2rem] w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-scale-in">
                <div className="px-6 py-5 border-b border-light-border/60 dark:border-dark-border/30 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-light-text dark:text-dark-text flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20">
                            <i className="fas fa-magic text-sm"></i>
                        </div>
                        <span>مساعد المحتوى الذكي</span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="flex h-[36px] w-[36px] items-center justify-center rounded-xl text-light-text-secondary hover:bg-light-card hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-dark-card dark:hover:text-dark-text transition-all duration-150 active:scale-90"
                        aria-label="Close"
                    >
                        <i className="fas fa-times text-sm" />
                    </button>
                </div>
                <div className="p-6 space-y-5 overflow-y-auto">
                    {/* Input Fields */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-2">الموضوع</label>
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="مثال: إطلاق مجموعة الربيع الجديدة"
                            className="w-full px-4 py-3 bg-light-bg/50 dark:bg-dark-bg/50 border border-light-border/60 dark:border-dark-border/30 rounded-2xl text-light-text dark:text-dark-text placeholder:text-light-text-secondary/50 dark:placeholder:text-dark-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all duration-200"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-2">النبرة</label>
                        <select
                            value={tone}
                            onChange={(e) => setTone(e.target.value)}
                            className="w-full px-4 py-3 bg-light-bg/50 dark:bg-dark-bg/50 border border-light-border/60 dark:border-dark-border/30 rounded-2xl text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all duration-200"
                        >
                            {toneOptions.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading}
                        className="w-full bg-brand-primary text-white font-bold py-3.5 px-4 rounded-2xl shadow-primary-glow hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 transition-all duration-200"
                    >
                        {isLoading ? 'جاري التوليد...' : 'توليد كابشن'}
                    </button>
                    {error && <p className="text-red-500 dark:text-red-400 text-xs font-medium">{error}</p>}
                </div>

                <div className="p-6 bg-light-bg/30 dark:bg-dark-bg/30 border-t border-light-border/60 dark:border-dark-border/30 flex-grow overflow-y-auto">
                    {selectedOriginal ? (
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">عدّل الكابشن المختار وطبّقه:</h3>
                            <textarea
                                value={editedCaption}
                                onChange={(e) => setEditedCaption(e.target.value)}
                                rows={5}
                                className="w-full p-4 bg-light-card dark:bg-dark-card border border-light-border/60 dark:border-dark-border/30 rounded-2xl text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all duration-200"
                            />
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => { setSelectedOriginal(null); setEditedCaption(''); }}
                                    className="px-5 py-2.5 rounded-xl text-light-text-secondary hover:text-light-text dark:text-dark-text-secondary dark:hover:text-dark-text transition-all duration-150 active:scale-95 font-semibold text-sm"
                                >
                                    العودة
                                </button>
                                <button
                                    onClick={handleApplyAndLog}
                                    className="px-5 py-2.5 rounded-xl bg-brand-primary text-white font-bold transition-all duration-150 active:scale-95 text-sm shadow-primary-glow"
                                >
                                    تطبيق
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h3 className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-3">الكابشن المقترح:</h3>
                            {isLoading && (
                                <div className="flex flex-col items-center justify-center py-8 gap-3">
                                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">يقوم Gemini بالكتابة...</p>
                                </div>
                            )}
                            <div className="space-y-3.5">
                                {results.map((result, index) => (
                                    <div key={index} className="bg-light-card dark:bg-dark-card p-4 rounded-2xl border border-light-border/60 dark:border-dark-border/30 hover:shadow-md transition-shadow duration-200">
                                        <p className="text-sm text-light-text dark:text-dark-text leading-relaxed whitespace-pre-wrap">{result}</p>
                                        <div className="text-right mt-3 border-t border-light-border/40 dark:border-dark-border/10 pt-2.5">
                                            <button
                                                onClick={() => handleSelectForEdit(result)}
                                                className="text-xs font-bold text-brand-primary hover:underline transition-colors active:scale-95"
                                            >
                                                استخدام وتعديل
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};