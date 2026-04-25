import React, { useState, useCallback } from 'react';
import { useModalClose } from '../hooks/useModalClose';
import { getOptimalPostingTimes, SchedulingParams } from '../services/schedulingService';
import { BrandHubProfile, SocialPlatform, ScheduleSuggestion } from '../types';

interface SmartSchedulerModalProps {
  onClose: () => void;
  onSelectTime: (suggestion: ScheduleSuggestion) => void;
  platforms: SocialPlatform[];
  postTopic: string;
  brandProfile?: BrandHubProfile | null;
}

const formatSuggestedTime = (date: string, time: string) => {
    const d = new Date(`${date}T${time}`);
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    const datePart = new Intl.DateTimeFormat('ar-EG', options).format(d);
    const timePart = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${datePart} الساعة ${timePart}`;
}

const DAYS_OF_WEEK = [
    { key: 'Sunday', label: 'الأحد' },
    { key: 'Monday', label: 'الاثنين' },
    { key: 'Tuesday', label: 'الثلاثاء' },
    { key: 'Wednesday', label: 'الأربعاء' },
    { key: 'Thursday', label: 'الخميس' },
    { key: 'Friday', label: 'الجمعة' },
    { key: 'Saturday', label: 'السبت' },
];

const TIME_SLOTS = [
    { key: 'any', label: 'أي وقت' },
    { key: 'morning', label: 'صباحًا (8ص - 12م)' },
    { key: 'afternoon', label: 'ظهراً (12م - 5م)' },
    { key: 'evening', label: 'مساءً (5م - 9م)' },
];

export const SmartSchedulerModal: React.FC<SmartSchedulerModalProps> = ({ onClose, onSelectTime, platforms, postTopic, brandProfile }) => {
    const defaultAudience = brandProfile?.brandAudiences?.length
        ? brandProfile.brandAudiences.map(a => a.personaName).join(' • ')
        : 'البالغون المهتمون بالصحة والراحة في السعودية';

    const [targetAudience, setTargetAudience] = useState(defaultAudience);
    const [goal, setGoal] = useState('زيادة التفاعل والمبيعات');
    const [preferredDays, setPreferredDays] = useState<string[]>([]);
    const [preferredTime, setPreferredTime] = useState('any');
    useModalClose(onClose);
    const [isLoading, setIsLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<ScheduleSuggestion[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleDayToggle = (dayKey: string) => {
        setPreferredDays(prev =>
            prev.includes(dayKey)
                ? prev.filter(d => d !== dayKey)
                : [...prev, dayKey]
        );
    };

    const handleGetSuggestions = useCallback(async () => {
        if (!targetAudience || !goal) {
            setError('الرجاء ملء جميع الحقول.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setSuggestions([]);

        try {
            const params: SchedulingParams = {
                platforms,
                topic: postTopic || 'منشور جديد',
                targetAudience,
                goal,
                preferredDays,
                preferredTime,
                brandName: brandProfile?.brandName,
                brandIndustry: brandProfile?.industry,
            };
            const result = await getOptimalPostingTimes(params);
            setSuggestions(result);
        } catch (err) {
            setError('فشل في الحصول على اقتراحات. الرجاء المحاولة مرة أخرى.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [platforms, postTopic, targetAudience, goal, preferredDays, preferredTime]);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-dark-card rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-dark-border flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center"><i className="fas fa-brain me-3 text-brand-secondary"></i>الجدولة الذكية</h2>
                    <button onClick={onClose} className="text-dark-text-secondary hover:text-white">&times;</button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <div>
                        <label className="block text-sm font-medium text-dark-text-secondary mb-1">الجمهور المستهدف</label>
                        <input type="text" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)}
                            className="w-full p-2 bg-dark-bg border border-dark-border rounded-md focus:ring-brand-primary focus:border-brand-primary" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-dark-text-secondary mb-1">الهدف من المنشور</label>
                        <input type="text" value={goal} onChange={(e) => setGoal(e.target.value)}
                            className="w-full p-2 bg-dark-bg border border-dark-border rounded-md focus:ring-brand-primary focus:border-brand-primary" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-dark-text-secondary mb-2">الأيام المفضلة (اختياري)</label>
                        <div className="flex flex-wrap gap-2">
                            {DAYS_OF_WEEK.map(day => (
                                <button
                                    key={day.key}
                                    onClick={() => handleDayToggle(day.key)}
                                    className={`px-3 py-1 text-sm font-semibold rounded-full border-2 transition-colors ${
                                        preferredDays.includes(day.key)
                                            ? 'bg-brand-primary/20 border-brand-primary text-brand-primary'
                                            : 'bg-dark-bg border-dark-border text-dark-text-secondary hover:border-gray-600'
                                    }`}
                                >
                                    {day.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-dark-text-secondary mb-1">الوقت المفضل (اختياري)</label>
                        <select
                            value={preferredTime}
                            onChange={(e) => setPreferredTime(e.target.value)}
                            className="w-full p-2 bg-dark-bg border border-dark-border rounded-md focus:ring-brand-primary focus:border-brand-primary"
                        >
                            {TIME_SLOTS.map(slot => <option key={slot.key} value={slot.key}>{slot.label}</option>)}
                        </select>
                    </div>
                    <button onClick={handleGetSuggestions} disabled={isLoading}
                        className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed">
                        {isLoading ? 'جاري التحليل...' : 'الحصول على اقتراحات'}
                    </button>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                </div>
                <div className="p-6 bg-dark-bg/50 border-t border-dark-border flex-grow overflow-y-auto">
                    <h3 className="font-semibold text-dark-text-secondary mb-3">الأوقات المقترحة:</h3>
                    {isLoading && <p className="text-center text-dark-text-secondary">يقوم Gemini بتحليل أفضل الأوقات...</p>}
                    <div className="space-y-3">
                        {suggestions.map((suggestion, index) => (
                            <div key={index} className="bg-dark-card p-4 rounded-lg border border-dark-border">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-white">{suggestion.platform} - {formatSuggestedTime(suggestion.date, suggestion.time)}</p>
                                        <p className="text-sm text-dark-text-secondary mt-1">{suggestion.reasoning}</p>
                                    </div>
                                    <button onClick={() => onSelectTime(suggestion)} className="text-xs font-bold text-brand-primary hover:underline whitespace-nowrap ms-4">
                                        اختيار هذا الوقت
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};