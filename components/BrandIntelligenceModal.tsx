import React, { useState, useEffect } from 'react';
import { Brand, BrandHubProfile } from '../types';
import { callAIProxy, Type } from '../services/aiProxy';
import { useModalClose } from '../hooks/useModalClose';

interface Props {
    brand: Brand;
    brandProfile?: BrandHubProfile | null;
    onClose: () => void;
    onUseIdea?: (idea: { title: string; hook: string; platform: string }) => void;
}

interface Report {
    contentIdeas: Array<{ title: string; hook: string; platform: string }>;
    postingTimes: string[];
    hashtags: string[];
}

export const BrandIntelligenceModal: React.FC<Props> = ({ brand, brandProfile, onClose, onUseIdea }) => {
    const [visible, setVisible] = useState(false);
    const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
    const [report, setReport] = useState<Report | null>(null);
    const [copiedIdx, setCopiedIdx] = useState<string | null>(null);
    useModalClose(onClose);

    useEffect(() => {
        setTimeout(() => setVisible(true), 60);
        generate();
    }, []);

    const generate = async () => {
        try {
            const profileContext = brandProfile ? `
معلومات البراند التفصيلية:
- المجال: ${brandProfile.industry || 'غير محدد'}
- القيم: ${brandProfile.values.join('، ') || 'غير محدد'}
- نقاط التميز: ${brandProfile.keySellingPoints.join('، ') || 'غير محدد'}
- نبرة الصوت: ${brandProfile.brandVoice.toneDescription.join('، ') || 'غير محدد'}
- الكلمات المفتاحية: ${brandProfile.brandVoice.keywords.join('، ') || 'غير محدد'}
- الجمهور المستهدف: ${brandProfile.brandAudiences.map(a => `${a.personaName}: ${a.description}`).join(' | ') || 'غير محدد'}
- الكلمات المحظورة: ${brandProfile.brandVoice.negativeKeywords.join('، ') || 'لا يوجد'}
` : '';

            const res = await callAIProxy({
                model: 'gemini-2.5-flash',
                feature: 'brand-intelligence-report',
                brand_id: brand.id,
                prompt: `أنت خبير استراتيجية سوشيال ميديا متخصص. استناداً إلى المعلومات الكاملة للبراند أدناه، أنشئ تقرير ذكاء تسويقي دقيق ومخصص لهذا البراند تحديداً — ليس توصيات عامة.

البراند: "${brand.name}"
${profileContext}

المطلوب: تقرير JSON يشمل أفكار محتوى مبنية على نبرة البراند وجمهوره الفعلي، أفضل أوقات نشر مناسبة للجمهور المذكور، وهاشتاقات مرتبطة بمجاله وكلماته المفتاحية. كل شيء بالعربية.`,
                schema: {
                    type: Type.OBJECT,
                    properties: {
                        contentIdeas: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    hook: { type: Type.STRING },
                                    platform: { type: Type.STRING },
                                },
                            },
                        },
                        postingTimes: { type: Type.ARRAY, items: { type: Type.STRING } },
                        hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                },
            });
            const parsed: Report = typeof res.text === 'string' ? JSON.parse(res.text) : res.text as unknown as Report;
            setReport(parsed);
            setStatus('done');
        } catch {
            setStatus('error');
        }
    };

    const copy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedIdx(key);
        setTimeout(() => setCopiedIdx(null), 2000);
    };

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 350);
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-400 ${visible ? 'opacity-100' : 'opacity-0'}`}
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}>

            <div className={`w-full max-w-md transition-all duration-400 ${visible ? 'scale-100 translate-y-0' : 'scale-90 translate-y-6'}`}>
                <div className="rounded-3xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">

                    {/* Header */}
                    <div className="bg-gradient-to-br from-violet-600 to-indigo-700 p-5 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                <i className="fas fa-brain text-white" />
                            </div>
                            <div>
                                <p className="text-white/70 text-xs">تقرير ذكاء البراند</p>
                                <h2 className="text-white font-bold">{brand.name}</h2>
                            </div>
                        </div>
                        <button onClick={handleClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                            <i className="fas fa-times text-white text-xs" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="bg-dark-card overflow-y-auto flex-1">
                        {status === 'loading' && (
                            <div className="flex flex-col items-center justify-center py-16 gap-4">
                                <div className="relative w-16 h-16">
                                    <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
                                    <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 animate-spin" />
                                    <div className="absolute inset-2 rounded-full bg-indigo-500/10 flex items-center justify-center">
                                        <i className="fas fa-robot text-indigo-400 text-lg" />
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-dark-text font-semibold text-sm">يحلّل الذكاء الاصطناعي براندك...</p>
                                    <p className="text-dark-text-secondary text-xs mt-1">يستغرق 10-15 ثانية</p>
                                </div>
                                <div className="flex gap-1.5">
                                    {[0,1,2].map(i => (
                                        <div key={i} className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="flex flex-col items-center justify-center py-16 gap-4 px-6 text-center">
                                <i className="fas fa-exclamation-triangle text-amber-400 text-3xl" />
                                <p className="text-dark-text font-semibold">لم يتمكن الذكاء الاصطناعي من إنشاء التقرير</p>
                                <p className="text-dark-text-secondary text-xs">تحقق من إعدادات مفتاح AI أو حاول لاحقاً</p>
                                <button onClick={generate} className="px-5 py-2 bg-brand-primary text-white rounded-xl text-sm font-semibold">
                                    إعادة المحاولة
                                </button>
                            </div>
                        )}

                        {status === 'done' && report && (
                            <div className="p-5 space-y-5">

                                {/* Content ideas */}
                                <section>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-6 h-6 rounded-lg bg-pink-500/20 flex items-center justify-center">
                                            <i className="fas fa-lightbulb text-pink-400 text-xs" />
                                        </div>
                                        <h3 className="text-sm font-bold text-dark-text">أفكار محتوى مقترحة</h3>
                                    </div>
                                    <div className="space-y-2.5">
                                        {(report.contentIdeas ?? []).slice(0, 5).map((idea, i) => (
                                            <div key={i} className="bg-dark-bg border border-dark-border rounded-xl p-3 flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <span className="text-[10px] font-bold text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded-full">
                                                            {idea.platform}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs font-semibold text-dark-text mb-0.5">{idea.title}</p>
                                                    <p className="text-[11px] text-dark-text-secondary leading-relaxed">{idea.hook}</p>
                                                </div>
                                                <div className="flex flex-col gap-1 flex-shrink-0">
                                                    <button onClick={() => copy(`${idea.title}\n${idea.hook}`, `idea-${i}`)}
                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${copiedIdx === `idea-${i}` ? 'bg-emerald-500' : 'bg-dark-card hover:bg-dark-border'}`}>
                                                        <i className={`fas ${copiedIdx === `idea-${i}` ? 'fa-check' : 'fa-copy'} text-xs text-white`} />
                                                    </button>
                                                    {onUseIdea && (
                                                        <button
                                                            onClick={() => { onUseIdea(idea); handleClose(); }}
                                                            title="استخدام في الناشر"
                                                            className="w-7 h-7 rounded-lg bg-brand-primary/20 hover:bg-brand-primary/40 flex items-center justify-center transition-colors"
                                                        >
                                                            <i className="fas fa-arrow-up-right-from-square text-brand-primary text-[10px]" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* Posting times */}
                                <section>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                                            <i className="fas fa-clock text-cyan-400 text-xs" />
                                        </div>
                                        <h3 className="text-sm font-bold text-dark-text">أفضل أوقات النشر</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {(report.postingTimes ?? []).map((t, i) => (
                                            <span key={i} className="text-xs font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-full">
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </section>

                                {/* Hashtags */}
                                <section>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                                <i className="fas fa-hashtag text-emerald-400 text-xs" />
                                            </div>
                                            <h3 className="text-sm font-bold text-dark-text">هاشتاقات مقترحة</h3>
                                        </div>
                                        <button onClick={() => copy((report.hashtags ?? []).join(' '), 'hashtags')}
                                            className={`text-xs px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${copiedIdx === 'hashtags' ? 'bg-emerald-500 text-white' : 'bg-dark-bg text-dark-text-secondary hover:text-dark-text border border-dark-border'}`}>
                                            <i className={`fas ${copiedIdx === 'hashtags' ? 'fa-check' : 'fa-copy'} text-[10px]`} />
                                            {copiedIdx === 'hashtags' ? 'تم النسخ' : 'نسخ الكل'}
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(report.hashtags ?? []).map((tag, i) => (
                                            <span key={i} className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg font-mono">
                                                {tag.startsWith('#') ? tag : `#${tag}`}
                                            </span>
                                        ))}
                                    </div>
                                </section>

                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {status === 'done' && (
                        <div className="bg-dark-card border-t border-dark-border p-4 flex-shrink-0">
                            <button onClick={handleClose}
                                className="w-full py-2.5 bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-semibold rounded-xl text-sm">
                                <i className="fas fa-arrow-right mr-2 text-xs" />
                                ابدأ النشر الآن
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
