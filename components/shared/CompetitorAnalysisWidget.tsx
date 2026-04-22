import React, { useState } from 'react';
import { callAIProxy, Type } from '../../services/aiProxy';

interface CompetitorData {
    name: string;
    score: number;
    strengths: string[];
    weaknesses: string[];
    opportunity: string;
}

interface Props {
    brandName: string;
    industry?: string;
}

export const CompetitorAnalysisWidget: React.FC<Props> = ({ brandName, industry }) => {
    const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
    const [competitors, setCompetitors] = useState<CompetitorData[]>([]);
    const [selected, setSelected] = useState<number>(0);

    const run = async () => {
        setStatus('loading');
        try {
            const res = await callAIProxy({
                model: 'gemini-2.5-flash',
                feature: 'competitor-analysis',
                prompt: `You are a brand strategist. Analyze the top 3 competitors for a brand called "${brandName}"${industry ? ` in the ${industry} industry` : ''}. For each competitor provide: name, competitive score (0-100 vs this brand), 2 strengths, 2 weaknesses, and one key opportunity for "${brandName}" to exploit. Write everything in Arabic. Be specific and realistic.`,
                schema: {
                    type: Type.OBJECT,
                    properties: {
                        competitors: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    score: { type: Type.NUMBER },
                                    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    opportunity: { type: Type.STRING },
                                },
                            },
                        },
                    },
                },
            });
            const parsed = typeof res.text === 'string' ? JSON.parse(res.text) : res.text as any;
            setCompetitors(parsed.competitors ?? []);
            setSelected(0);
            setStatus('done');
        } catch {
            setStatus('error');
        }
    };

    const comp = competitors[selected];
    const scoreColor = (s: number) => s >= 70 ? 'text-rose-400' : s >= 40 ? 'text-amber-400' : 'text-emerald-400';
    const scoreBarColor = (s: number) => s >= 70 ? 'bg-rose-500' : s >= 40 ? 'bg-amber-500' : 'bg-emerald-500';

    return (
        <div className="rounded-2xl border border-dark-border bg-dark-card overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-500/20 to-orange-500/20 border-b border-dark-border px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-chess text-white text-sm" />
                    </div>
                    <div>
                        <h3 className="font-bold text-dark-text text-sm">تحليل المنافسين</h3>
                        <p className="text-xs text-dark-text-secondary">مقارنة ذكية بأقرب منافسيك</p>
                    </div>
                </div>
                {status === 'idle' || status === 'error' ? (
                    <button
                        onClick={run}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-rose-500 to-orange-500 text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity"
                    >
                        <i className="fas fa-bolt text-[10px]" />
                        {status === 'error' ? 'إعادة المحاولة' : 'ابدأ التحليل'}
                    </button>
                ) : status === 'loading' ? (
                    <div className="flex items-center gap-2 text-xs text-dark-text-secondary">
                        <i className="fas fa-circle-notch fa-spin text-orange-400" />
                        <span>جارٍ التحليل...</span>
                    </div>
                ) : (
                    <button
                        onClick={run}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-dark-border text-dark-text-secondary text-xs rounded-xl hover:border-orange-500/50 hover:text-orange-400 transition-colors"
                    >
                        <i className="fas fa-sync text-[10px]" />
                        تحديث
                    </button>
                )}
            </div>

            {status === 'idle' && (
                <div className="flex flex-col items-center justify-center py-10 gap-3 px-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center">
                        <i className="fas fa-chess-knight text-rose-400 text-xl" />
                    </div>
                    <p className="text-dark-text font-semibold text-sm">اعرف منافسيك جيداً</p>
                    <p className="text-dark-text-secondary text-xs leading-relaxed max-w-xs">
                        الذكاء الاصطناعي سيحلل أقرب 3 منافسين لبراندك ويكشف الفرص الذهبية
                    </p>
                </div>
            )}

            {status === 'loading' && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <div className="relative w-12 h-12">
                        <div className="absolute inset-0 rounded-full border-4 border-orange-500/20" />
                        <div className="absolute inset-0 rounded-full border-4 border-t-orange-500 animate-spin" />
                    </div>
                    <p className="text-dark-text-secondary text-xs">يحلل الذكاء الاصطناعي السوق...</p>
                </div>
            )}

            {status === 'error' && (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-6">
                    <i className="fas fa-exclamation-triangle text-amber-400 text-2xl" />
                    <p className="text-dark-text text-sm font-semibold">فشل التحليل</p>
                    <p className="text-dark-text-secondary text-xs">تحقق من إعدادات مفتاح AI</p>
                </div>
            )}

            {status === 'done' && comp && (
                <div className="p-5">
                    {/* Competitor tabs */}
                    <div className="flex gap-2 mb-5">
                        {competitors.map((c, i) => (
                            <button
                                key={i}
                                onClick={() => setSelected(i)}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                                    selected === i
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                        : 'bg-dark-bg border border-dark-border text-dark-text-secondary hover:border-rose-500/30'
                                }`}
                            >
                                {c.name}
                            </button>
                        ))}
                    </div>

                    {/* Score */}
                    <div className="bg-dark-bg rounded-xl p-4 mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-dark-text-secondary">قوة المنافس مقارنةً بك</span>
                            <span className={`text-lg font-black ${scoreColor(comp.score)}`}>{comp.score}%</span>
                        </div>
                        <div className="h-2 bg-dark-card rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${scoreBarColor(comp.score)}`}
                                style={{ width: `${comp.score}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-dark-text-secondary mt-1.5">
                            {comp.score >= 70 ? 'منافس قوي — يتطلب استراتيجية تمييز واضحة'
                                : comp.score >= 40 ? 'منافس متوسط — هناك فرص للتفوق'
                                : 'منافس ضعيف — يمكنك التقدم بسرعة'}
                        </p>
                    </div>

                    {/* Strengths & Weaknesses */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-rose-400 mb-2 flex items-center gap-1">
                                <i className="fas fa-shield-alt" /> نقاط قوته
                            </p>
                            {comp.strengths.map((s, i) => (
                                <p key={i} className="text-[11px] text-dark-text-secondary leading-relaxed mb-1">• {s}</p>
                            ))}
                        </div>
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-emerald-400 mb-2 flex items-center gap-1">
                                <i className="fas fa-arrow-down" /> نقاط ضعفه
                            </p>
                            {comp.weaknesses.map((w, i) => (
                                <p key={i} className="text-[11px] text-dark-text-secondary leading-relaxed mb-1">• {w}</p>
                            ))}
                        </div>
                    </div>

                    {/* Opportunity */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-2.5">
                        <i className="fas fa-lightbulb text-amber-400 mt-0.5 text-sm flex-shrink-0" />
                        <div>
                            <p className="text-[10px] font-bold text-amber-400 mb-0.5">الفرصة الذهبية لك</p>
                            <p className="text-xs text-dark-text leading-relaxed">{comp.opportunity}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
