/**
 * Content Variations Modal
 * واجهة توليد نسخ متعددة من المحتوى
 */

import React, { useState } from 'react';
import { generateContentVariations, ContentVariation } from '../services/aiVariationsService';
import { SocialPlatform } from '../types';
import { Button, Spinner, Badge } from './shared/UIComponents';

interface ContentVariationsModalProps {
    content: string;
    platforms: SocialPlatform[];
    onClose: () => void;
    onSelectVariation: (content: string) => void;
}

export const ContentVariationsModal: React.FC<ContentVariationsModalProps> = ({
    content,
    platforms,
    onClose,
    onSelectVariation
}) => {
    const [variations, setVariations] = useState<ContentVariation[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTones, setSelectedTones] = useState<string[]>(['professional', 'casual', 'friendly']);
    const [count, setCount] = useState(5);

    const toneOptions = [
        { value: 'professional', label: 'احترافي', icon: '💼' },
        { value: 'casual', label: 'غير رسمي', icon: '😊' },
        { value: 'friendly', label: 'ودود', icon: '🤝' },
        { value: 'humorous', label: 'مرح', icon: '😄' },
        { value: 'urgent', label: 'عاجل', icon: '⚡' },
        { value: 'formal', label: 'رسمي', icon: '🎩' }
    ];

    const handleGenerate = async () => {
        setIsLoading(true);
        try {
            const results = await generateContentVariations(content, {
                platforms,
                tones: selectedTones,
                count
            });
            setVariations(results);
        } catch (error) {
            console.error('Error generating variations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleTone = (tone: string) => {
        setSelectedTones(prev =>
            prev.includes(tone)
                ? prev.filter(t => t !== tone)
                : [...prev, tone]
        );
    };

    const getPlatformColor = (platform: SocialPlatform): string => {
        const colors: Record<SocialPlatform, string> = {
            [SocialPlatform.Facebook]: 'bg-blue-500',
            [SocialPlatform.Instagram]: 'bg-pink-500',
            [SocialPlatform.X]: 'bg-black',
            [SocialPlatform.LinkedIn]: 'bg-blue-700',
            [SocialPlatform.TikTok]: 'bg-black',
            [SocialPlatform.Pinterest]: 'bg-red-600'
        };
        return colors[platform] || 'bg-gray-500';
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-dark-card rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
                {/* Header */}
                <div className="p-6 border-b border-dark-border">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-dark-text flex items-center gap-2">
                                <i className="fas fa-magic text-brand-secondary" />
                                توليد نسخ متعددة
                            </h2>
                            <p className="text-sm text-dark-text-secondary mt-1">
                                استخدم الذكاء الاصطناعي لتوليد نسخ مختلفة من محتواك
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 rounded-full hover:bg-dark-bg transition-colors flex items-center justify-center"
                        >
                            <i className="fas fa-times text-dark-text-secondary" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Original Content */}
                    <div className="bg-dark-bg p-4 rounded-lg border border-dark-border">
                        <h3 className="text-sm font-bold text-dark-text-secondary mb-2">المحتوى الأصلي:</h3>
                        <p className="text-dark-text">{content}</p>
                    </div>

                    {/* Settings */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-dark-text-secondary mb-2">
                                النبرات المطلوبة:
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {toneOptions.map(tone => (
                                    <button
                                        key={tone.value}
                                        onClick={() => toggleTone(tone.value)}
                                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${selectedTones.includes(tone.value)
                                                ? 'bg-brand-primary text-white'
                                                : 'bg-dark-bg text-dark-text-secondary hover:bg-dark-card'
                                            }`}
                                    >
                                        <span className="me-2">{tone.icon}</span>
                                        {tone.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-dark-text-secondary mb-2">
                                عدد النسخ: {count}
                            </label>
                            <input
                                type="range"
                                min="3"
                                max="10"
                                value={count}
                                onChange={(e) => setCount(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <Button
                            onClick={handleGenerate}
                            variant="primary"
                            fullWidth
                            loading={isLoading}
                            disabled={selectedTones.length === 0}
                            icon="fas fa-sparkles"
                        >
                            {isLoading ? 'جاري التوليد...' : 'توليد النسخ'}
                        </Button>
                    </div>

                    {/* Variations */}
                    {variations.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-lg font-bold text-dark-text flex items-center gap-2">
                                <i className="fas fa-list text-brand-secondary" />
                                النسخ المُولّدة ({variations.length})
                            </h3>

                            {variations.map((variation, index) => (
                                <div
                                    key={variation.id}
                                    className="bg-dark-bg p-4 rounded-lg border border-dark-border hover:border-brand-primary transition-all group"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="w-8 h-8 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-sm">
                                                {index + 1}
                                            </span>
                                            <Badge variant="info" size="sm">
                                                {variation.platform}
                                            </Badge>
                                            <Badge variant="default" size="sm">
                                                {variation.tone}
                                            </Badge>
                                            <div className="flex items-center gap-1">
                                                {[...Array(5)].map((_, i) => (
                                                    <i
                                                        key={i}
                                                        className={`fas fa-star text-xs ${i < Math.round(variation.score / 2)
                                                                ? 'text-yellow-500'
                                                                : 'text-dark-border'
                                                            }`}
                                                    />
                                                ))}
                                                <span className="text-xs text-dark-text-secondary ms-1">
                                                    {variation.score}/10
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-dark-text mb-3 leading-relaxed">
                                        {variation.content}
                                    </p>

                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-dark-text-secondary">
                                            {variation.content.length} حرف • {variation.length}
                                        </span>
                                        <Button
                                            onClick={() => {
                                                onSelectVariation(variation.content);
                                                onClose();
                                            }}
                                            variant="secondary"
                                            size="sm"
                                            icon="fas fa-check"
                                        >
                                            استخدام هذه النسخة
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty State */}
                    {!isLoading && variations.length === 0 && (
                        <div className="text-center py-12">
                            <div className="w-20 h-20 bg-dark-bg rounded-full flex items-center justify-center mx-auto mb-4">
                                <i className="fas fa-magic text-4xl text-dark-text-secondary" />
                            </div>
                            <p className="text-dark-text-secondary">
                                اضغط "توليد النسخ" للبدء
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
