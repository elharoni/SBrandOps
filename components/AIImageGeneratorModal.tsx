import React, { useState } from 'react';
import { generateImageFromPrompt, AIImageProvider } from '../services/geminiService';
import { MediaItem } from '../types';

interface AIImageGeneratorModalProps {
    onClose: () => void;
    onAddImage: (mediaItem: MediaItem) => void;
}

export const AIImageGeneratorModal: React.FC<AIImageGeneratorModalProps> = ({ onClose, onAddImage }) => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');
    const [provider, setProvider] = useState<AIImageProvider>('pollinations');
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setError(null);
        setGeneratedImageUrl(null);
        try {
            const imageUrl = await generateImageFromPrompt(prompt, aspectRatio, provider);
            setGeneratedImageUrl(imageUrl);
        } catch (err: any) {
            let errorMsg = 'فشل في توليد الصورة. يرجى المحاولة مرة أخرى.';
            if (err?.message?.includes('503') || err?.message?.includes('high demand')) {
                errorMsg = 'نموذج جوجل يواجه ضغطاً عالياً حالياً. يرجى تجربة نموذج "المستقر (مجاني)".';
            } else if (err?.message?.includes('400') || err?.message?.includes('paid plans')) {
                errorMsg = 'نموذج Imagen متاح فقط للحسابات المدفوعة. يرجى اختيار نموذج "المستقر (مجاني)".';
            }
            setError(errorMsg);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!generatedImageUrl) return;
        
        try {
            // Convert data URL to File object for consistency with upload workflow
            const res = await fetch(generatedImageUrl);
            const blob = await res.blob();
            const file = new File([blob], "ai-generated-image.jpg", { type: "image/jpeg" });
            
            const mediaItem: MediaItem = {
                id: crypto.randomUUID(),
                type: 'image',
                url: generatedImageUrl,
                file: file
            };
            
            onAddImage(mediaItem);
            onClose();
        } catch (e) {
            console.error("Error converting blob", e);
            setError("Failed to process image.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-light-card dark:bg-dark-card rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-light-border dark:border-dark-border">
                <div className="p-5 border-b border-light-border dark:border-dark-border flex justify-between items-center">
                    <h2 className="text-xl font-bold text-light-text dark:text-dark-text flex items-center">
                        <i className="fas fa-paint-brush me-3 text-brand-purple"></i>
                        مولد الصور بالذكاء الاصطناعي
                    </h2>
                    <button onClick={onClose} className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text text-2xl">&times;</button>
                </div>

                <div className="p-6 overflow-y-auto flex-grow space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 space-y-2">
                            <label className="block text-sm font-bold text-light-text dark:text-dark-text">وصف الصورة (Prompt)</label>
                            <textarea 
                                value={prompt} 
                                onChange={(e) => setPrompt(e.target.value)} 
                                placeholder="صف الصورة التي تريد إنشاءها بدقة..." 
                                rows={3} 
                                className="w-full p-3 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg focus:ring-brand-primary focus:border-brand-primary text-light-text dark:text-dark-text resize-none"
                            />
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-light-text dark:text-dark-text">نموذج الذكاء الاصطناعي</label>
                                <select 
                                    value={provider} 
                                    onChange={(e) => setProvider(e.target.value as AIImageProvider)} 
                                    className="w-full p-3 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg focus:ring-brand-primary text-light-text dark:text-dark-text"
                                >
                                    <option value="pollinations">المستقر (مجاني - غير محدود)</option>
                                    <option value="google">Google Imagen (احترافي - مدفوع)</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-light-text dark:text-dark-text">الأبعاد</label>
                                <select 
                                    value={aspectRatio} 
                                    onChange={(e) => setAspectRatio(e.target.value as any)} 
                                    className="w-full p-3 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg focus:ring-brand-primary text-light-text dark:text-dark-text"
                                >
                                    <option value="1:1">مربع (1:1)</option>
                                    <option value="16:9">أفقي (16:9)</option>
                                    <option value="9:16">رأسي (9:16)</option>
                                    <option value="4:3">قياسي (4:3)</option>
                                    <option value="3:4">صورة شخصية (3:4)</option>
                                </select>
                            </div>
                             <button 
                                onClick={handleGenerate} 
                                disabled={isLoading || !prompt.trim()} 
                                className="w-full bg-gradient-to-r from-brand-pink to-brand-purple text-white font-bold py-2.5 px-4 rounded-lg shadow-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                            >
                                {isLoading ? <i className="fas fa-spinner fa-spin"></i> : 'توليد'}
                            </button>
                        </div>
                    </div>

                    {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm">{error}</div>}

                    <div className="bg-light-bg dark:bg-dark-bg border-2 border-dashed border-light-border dark:border-dark-border rounded-xl min-h-[300px] flex items-center justify-center overflow-hidden relative">
                        {isLoading ? (
                            <div className="text-center">
                                <i className="fas fa-spinner fa-spin text-4xl text-brand-primary mb-3"></i>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary font-medium">جاري رسم خيالك...</p>
                            </div>
                        ) : generatedImageUrl ? (
                            <img src={generatedImageUrl} alt="Generated" className="max-w-full max-h-[400px] object-contain shadow-lg rounded-lg" />
                        ) : (
                            <div className="text-center text-light-text-secondary dark:text-dark-text-secondary opacity-50">
                                <i className="fas fa-image text-5xl mb-2"></i>
                                <p>ستظهر الصورة هنا</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-5 bg-light-bg/50 dark:bg-dark-bg/50 border-t border-light-border dark:border-dark-border flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-lg font-bold text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-card dark:hover:bg-dark-card transition-colors">إلغاء</button>
                    <button 
                        onClick={handleAdd} 
                        disabled={!generatedImageUrl} 
                        className="bg-green-600 text-white font-bold py-2.5 px-6 rounded-lg shadow hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fas fa-check me-2"></i>إضافة للمنشور
                    </button>
                </div>
            </div>
        </div>
    );
};