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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-light-border dark:border-dark-border flex justify-between items-center">
                    <h2 className="text-xl font-bold text-light-text dark:text-dark-text flex items-center"><i className="fas fa-magic me-3 text-brand-purple"></i>مساعد المحتوى الذكي</h2>
                    <button onClick={onClose} className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text">&times;</button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    {/* Input Fields */}
                    <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">الموضوع</label>
                        <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                            placeholder="مثال: إطلاق مجموعة الربيع الجديدة"
                            className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md focus:ring-brand-purple focus:border-brand-purple" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">النبرة</label>
                        <select value={tone} onChange={(e) => setTone(e.target.value)}
                            className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md focus:ring-brand-purple focus:border-brand-purple">
                            {toneOptions.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <button onClick={handleGenerate} disabled={isLoading}
                        className="w-full bg-gradient-to-r from-brand-pink to-brand-purple text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">
                        {isLoading ? 'جاري التوليد...' : 'توليد كابشن'}
                    </button>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                </div>

                <div className="p-6 bg-light-bg/50 dark:bg-dark-bg/50 border-t border-light-border dark:border-dark-border flex-grow overflow-y-auto">
                    {selectedOriginal ? (
                        <div className="space-y-3">
                            <h3 className="font-semibold text-light-text-secondary dark:text-dark-text-secondary">عدّل الكابشن المختار وطبّقه:</h3>
                            <textarea
                                value={editedCaption}
                                onChange={(e) => setEditedCaption(e.target.value)}
                                rows={5}
                                className="w-full p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md"
                            />
                            <div className="flex justify-end gap-3">
                                <button onClick={() => { setSelectedOriginal(null); setEditedCaption(''); }} className="text-light-text-secondary dark:text-dark-text-secondary font-bold">العودة</button>
                                <button onClick={handleApplyAndLog} className="bg-brand-primary text-white font-bold py-2 px-4 rounded-lg">تطبيق</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h3 className="font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-3">الكابشن المقترح:</h3>
                            {isLoading && <p className="text-center text-light-text-secondary dark:text-dark-text-secondary">يقوم Gemini بالكتابة...</p>}
                            <div className="space-y-3">
                                {results.map((result, index) => (
                                    <div key={index} className="bg-light-card dark:bg-dark-card p-4 rounded-lg border border-light-border dark:border-dark-border">
                                        <p className="text-light-text dark:text-dark-text whitespace-pre-wrap">{result}</p>
                                        <div className="text-right mt-2">
                                            <button onClick={() => handleSelectForEdit(result)} className="text-xs font-bold text-brand-pink hover:underline">
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