import React, { useState, useEffect, useRef } from 'react';
import { BrandHubProfile, BrandVoice, NotificationType } from '../../types';
import { updateBrandProfile } from '../../services/brandHubService';
import { callAIProxy } from '../../services/aiProxy';

interface VoiceTabContentProps {
    profile: BrandHubProfile;
    brandId: string;
    addNotification: (type: NotificationType, message: string) => void;
    onUpdate?: (profile: BrandHubProfile) => void;
}

export const VoiceTabContent: React.FC<VoiceTabContentProps> = ({ profile, brandId, addNotification, onUpdate }) => {
    const [voice, setVoice] = useState<BrandVoice>(profile.brandVoice);
    const prevVoiceRef = useRef(profile.brandVoice);
    
    useEffect(() => {
        if (profile.brandVoice !== prevVoiceRef.current) {
            prevVoiceRef.current = profile.brandVoice;
            setVoice(profile.brandVoice);
        }
    }, [profile.brandVoice]);

    const [isSaving, setIsSaving] = useState(false);
    const [newKeyword, setNewKeyword] = useState('');
    const [newNegKw, setNewNegKw] = useState('');
    const [newTone, setNewTone] = useState('');
    const [newDo, setNewDo] = useState('');
    const [newDont, setNewDont] = useState('');
    const [voicePreview, setVoicePreview] = useState<{ complaint: string; post: string; welcome: string } | null>(null);
    const [generatingPreview, setGeneratingPreview] = useState(false);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const saveVoice = async () => {
        setIsSaving(true);
        try {
            await updateBrandProfile(brandId, { brandVoice: voice });
            addNotification(NotificationType.Success, '✅ تم حفظ صوت البراند بنجاح');
            if (onUpdate) {
                onUpdate({ ...profile, brandVoice: voice });
            }
        } catch {
            addNotification(NotificationType.Error, 'تعذّر حفظ صوت البراند — حاول مرة أخرى');
        } finally {
            setIsSaving(false);
        }
    };

    const addTag = (field: 'keywords' | 'negativeKeywords' | 'toneDescription', val: string, setInput: (v: string) => void) => {
        if (!val.trim()) return;
        setVoice(prev => ({ ...prev, [field]: [...(prev[field] ?? []), val.trim()] }));
        setInput('');
    };

    const removeTag = (field: 'keywords' | 'negativeKeywords' | 'toneDescription', idx: number) =>
        setVoice(prev => ({ ...prev, [field]: (prev[field] ?? []).filter((_, i) => i !== idx) }));

    const addGuideline = (type: 'dos' | 'donts', val: string, setInput: (v: string) => void) => {
        if (!val.trim()) return;
        setVoice(prev => ({
            ...prev,
            voiceGuidelines: {
                dos: prev.voiceGuidelines?.dos ?? [],
                donts: prev.voiceGuidelines?.donts ?? [],
                [type]: [...(prev.voiceGuidelines?.[type] ?? []), val.trim()],
            },
        }));
        setInput('');
    };

    const removeGuideline = (type: 'dos' | 'donts', idx: number) =>
        setVoice(prev => ({
            ...prev,
            voiceGuidelines: {
                dos: prev.voiceGuidelines?.dos ?? [],
                donts: prev.voiceGuidelines?.donts ?? [],
                [type]: (prev.voiceGuidelines?.[type] ?? []).filter((_, i) => i !== idx),
            },
        }));

    const handleGeneratePreview = async () => {
        setGeneratingPreview(true);
        setVoicePreview(null);
        try {
            const tone = voice.toneDescription.slice(0, 3).join('، ') || 'محايد';
            const keywords = voice.keywords.slice(0, 5).join('، ') || '';
            const dos = voice.voiceGuidelines?.dos.slice(0, 2).join(' | ') || '';
            const prompt = `أنت مساعد تسويق لبراند "${profile.brandName}" في مجال "${profile.industry || 'عام'}".
نبرة الصوت: ${tone}
الكلمات المفتاحية: ${keywords}
${dos ? `إرشادات الصوت: ${dos}` : ''}

أنشئ 3 نماذج نصية قصيرة تعكس صوت هذا البراند بدقة. أعد JSON فقط بهذا التنسيق:
{"complaint":"رد على شكوى عميل (2-3 جمل)","post":"منشور ترويجي (2-3 جمل)","welcome":"رسالة ترحيب بعميل جديد (2-3 جمل)"}`;
            // Upgraded model parameter to gemini-2.5-flash
            const res = await callAIProxy({ model: 'gemini-2.5-flash', prompt, feature: 'voice_preview', brand_id: brandId });
            const raw = res.text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(raw);
            setVoicePreview({ complaint: parsed.complaint ?? '', post: parsed.post ?? '', welcome: parsed.welcome ?? '' });
        } catch (err) {
            console.error('Failed voice preview generation:', err);
            addNotification(NotificationType.Error, 'فشل توليد المعاينة.');
        } finally {
            setGeneratingPreview(false);
        }
    };

    const copyText = (key: string, text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 2000);
        });
    };

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <i className="fas fa-microphone text-brand-pink animate-pulse" />
                        صوت البراند
                    </h2>
                    <p className="text-xs text-dark-text-secondary mt-0.5">النبرة والكلمات التي يتحدث بها البراند — تؤثر مباشرة على جودة مخرجات AI</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleGeneratePreview}
                        disabled={generatingPreview}
                        className="flex items-center gap-1.5 rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-3.5 py-2 text-xs font-bold text-brand-secondary transition-all hover:bg-brand-primary/20 disabled:opacity-50"
                    >
                        <i className={`fas ${generatingPreview ? 'fa-spinner fa-spin' : 'fa-eye'} text-[10px]`} />
                        {generatingPreview ? 'جاري التوليد...' : 'معاينة الصوت'}
                    </button>
                    <button
                        onClick={saveVoice}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-brand-pink to-brand-purple text-white rounded-xl text-xs font-bold hover:opacity-90 hover:shadow-lg transition disabled:opacity-60"
                    >
                        <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'} text-[10px]`} />
                        {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                    </button>
                </div>
            </div>

            {/* Tone descriptions */}
            <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 space-y-4 shadow-xl relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                <div className="absolute -right-24 -top-24 w-48 h-48 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />
                <div>
                    <h3 className="text-sm font-extrabold text-white">أوصاف النبرة الصوتية</h3>
                    <p className="text-[10px] text-dark-text-secondary mt-1">كلمات تصف طريقة تواصل البراند مع العملاء — يستخدمها الذكاء الاصطناعي لضبط أسلوب الكتابة</p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                    {voice.toneDescription.map((t, i) => (
                        <span key={i} className="flex items-center gap-2 px-3.5 py-1.5 bg-brand-primary/10 text-brand-secondary rounded-full text-xs font-extrabold border border-brand-primary/20 transition-transform hover:scale-105 shadow-sm">
                            {t}
                            <button onClick={() => removeTag('toneDescription', i)} className="opacity-50 hover:opacity-100 hover:text-red-400 transition-all">
                                <i className="fas fa-times text-[9px]" />
                            </button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-2.5">
                    <input
                        value={newTone}
                        onChange={e => setNewTone(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addTag('toneDescription', newTone, setNewTone)}
                        placeholder='مثال: "ودود ومتعاطف"، "مهني ورسمي"، "حماسي وملهم"...'
                        className="flex-1 bg-slate-955/50 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-650 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all duration-200"
                    />
                    <button onClick={() => addTag('toneDescription', newTone, setNewTone)} className="px-4 py-3 bg-brand-primary/10 text-brand-secondary border border-brand-primary/20 rounded-xl text-xs hover:bg-brand-primary hover:text-white transition-all duration-200">
                        <i className="fas fa-plus text-[10px]" />
                    </button>
                </div>
            </div>

            {/* Keywords + Negative Keywords */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 space-y-4 shadow-xl relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                    <div className="absolute -right-24 -top-24 w-48 h-48 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                        <i className="fas fa-tags text-brand-secondary text-xs" /> الكلمات المفتاحية المفضلة
                    </h3>
                    <p className="text-[10px] text-dark-text-secondary">الكلمات والعبارات التي يفضل البراند استخدامها في المنشورات والردود</p>
                    <div className="flex flex-wrap gap-2.5">
                        {voice.keywords.map((kw, i) => (
                            <span key={i} className="flex items-center gap-2 px-3.5 py-1.5 bg-brand-pink/15 text-brand-pink rounded-full text-xs font-extrabold border border-brand-pink/20 transition-transform hover:scale-105 shadow-sm">
                                {kw}
                                <button onClick={() => removeTag('keywords', i)} className="opacity-50 hover:opacity-100 hover:text-red-400 transition-all">
                                    <i className="fas fa-times text-[9px]" />
                                </button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2.5">
                        <input
                            value={newKeyword}
                            onChange={e => setNewKeyword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addTag('keywords', newKeyword, setNewKeyword)}
                            placeholder="أضف كلمة مفضلة..."
                            className="flex-1 bg-slate-955/50 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-650 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all duration-200"
                        />
                        <button onClick={() => addTag('keywords', newKeyword, setNewKeyword)} className="px-4 py-3 bg-brand-pink/15 text-brand-pink border border-brand-pink/20 rounded-xl text-xs hover:bg-brand-pink hover:text-white transition-all duration-200">
                            <i className="fas fa-plus text-[10px]" />
                        </button>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 space-y-4 shadow-xl relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                    <div className="absolute -right-24 -top-24 w-48 h-48 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                        <i className="fas fa-ban text-rose-400 text-xs" /> كلمات وعبارات ممنوعة
                    </h3>
                    <p className="text-[10px] text-dark-text-secondary">الكلمات والمصطلحات التي يجب تجنبها تماماً في جميع المخرجات</p>
                    <div className="flex flex-wrap gap-2.5">
                        {(voice.negativeKeywords ?? []).map((kw, i) => (
                            <span key={i} className="flex items-center gap-2 px-3.5 py-1.5 bg-rose-500/10 text-rose-400 rounded-full text-xs font-extrabold border border-rose-500/20 transition-transform hover:scale-105 shadow-sm">
                                {kw}
                                <button onClick={() => removeTag('negativeKeywords', i)} className="opacity-50 hover:opacity-100 hover:text-red-400 transition-all">
                                    <i className="fas fa-times text-[9px]" />
                                </button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2.5">
                        <input
                            value={newNegKw}
                            onChange={e => setNewNegKw(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addTag('negativeKeywords', newNegKw, setNewNegKw)}
                            placeholder="أضف كلمة ممنوعة..."
                            className="flex-1 bg-slate-955/50 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-650 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all duration-200"
                        />
                        <button onClick={() => addTag('negativeKeywords', newNegKw, setNewNegKw)} className="px-4 py-3 bg-rose-500/15 text-rose-400 border border-rose-500/20 rounded-xl text-xs hover:bg-rose-500 hover:text-white transition-all duration-200">
                            <i className="fas fa-plus text-[10px]" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Voice Guidelines — editable */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-gradient-to-br from-emerald-950/20 via-slate-900/10 to-slate-950/30 border border-emerald-500/10 backdrop-blur-md rounded-2xl p-6 space-y-4 shadow-xl">
                    <h4 className="font-extrabold text-emerald-400 flex items-center gap-2 text-sm">
                        <i className="fas fa-check-circle" /> نعم — يجب القيام به (Dos)
                    </h4>
                    <div className="space-y-2.5 max-h-[140px] overflow-y-auto pr-1">
                        {(voice.voiceGuidelines?.dos ?? []).map((d, i) => (
                            <div key={i} className="flex items-start gap-2.5 bg-slate-950/35 border border-white/5 p-3 rounded-xl group transition-all">
                                <i className="fas fa-check text-emerald-500 mt-1 text-[9px] shrink-0" />
                                <span className="text-xs text-white/95 flex-1 leading-relaxed">{d}</span>
                                <button onClick={() => removeGuideline('dos', i)} className="opacity-0 group-hover:opacity-100 text-dark-text-secondary hover:text-red-400 transition-all">
                                    <i className="fas fa-trash-can text-[10px]" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2.5">
                        <input
                            value={newDo}
                            onChange={e => setNewDo(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addGuideline('dos', newDo, setNewDo)}
                            placeholder='مثال: "خاطب العميل بصيغة الاحترام والترحيب"'
                            className="flex-1 bg-slate-955/50 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-650 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 focus:outline-none transition-all duration-200"
                        />
                        <button onClick={() => addGuideline('dos', newDo, setNewDo)} className="px-4 py-3 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs hover:bg-emerald-500 hover:text-white transition-all duration-200">
                            <i className="fas fa-plus text-[10px]" />
                        </button>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-rose-950/20 via-slate-900/10 to-slate-950/30 border border-rose-500/10 backdrop-blur-md rounded-2xl p-6 space-y-4 shadow-xl">
                    <h4 className="font-extrabold text-rose-400 flex items-center gap-2 text-sm">
                        <i className="fas fa-times-circle" /> لا — تجنب القيام به (Donts)
                    </h4>
                    <div className="space-y-2.5 max-h-[140px] overflow-y-auto pr-1">
                        {(voice.voiceGuidelines?.donts ?? []).map((d, i) => (
                            <div key={i} className="flex items-start gap-2.5 bg-slate-950/35 border border-white/5 p-3 rounded-xl group transition-all">
                                <i className="fas fa-xmark text-rose-500 mt-1 text-[9px] shrink-0" />
                                <span className="text-xs text-white/95 flex-1 leading-relaxed">{d}</span>
                                <button onClick={() => removeGuideline('donts', i)} className="opacity-0 group-hover:opacity-100 text-dark-text-secondary hover:text-red-400 transition-all">
                                    <i className="fas fa-trash-can text-[10px]" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2.5">
                        <input
                            value={newDont}
                            onChange={e => setNewDont(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addGuideline('donts', newDont, setNewDont)}
                            placeholder='مثال: "تجنب المبالغة في إبراز مميزات لم تُختبر بعد"'
                            className="flex-1 bg-slate-955/50 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-650 focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/15 focus:outline-none transition-all duration-200"
                        />
                        <button onClick={() => addGuideline('donts', newDont, setNewDont)} className="px-4 py-3 bg-rose-500/15 text-rose-400 border border-rose-500/20 rounded-xl text-xs hover:bg-rose-500 hover:text-white transition-all duration-200">
                            <i className="fas fa-plus text-[10px]" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Tone strength slider */}
            <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 space-y-4 shadow-xl relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-white">قوة ونسبة حضور النبرة</h3>
                    <span className="text-xs font-black text-brand-secondary bg-brand-primary/10 border border-brand-primary/20 px-3 py-1 rounded-lg">{voice.toneStrength ?? 50}%</span>
                </div>
                <input
                    type="range" min="0" max="100"
                    value={voice.toneStrength ?? 50}
                    onChange={e => setVoice(prev => ({ ...prev, toneStrength: Number(e.target.value) }))}
                    className="w-full accent-brand-primary cursor-pointer h-2 bg-slate-950 rounded-lg appearance-none"
                />
                <div className="flex justify-between text-[10px] text-dark-text-secondary">
                    <span className="font-bold">هادئ ومحايد</span>
                    <span className="font-bold">قوي وجريء ومميز</span>
                </div>
            </div>

            {/* AI Voice Preview */}
            {voicePreview && (
                <div className="space-y-5 animate-fade-in">
                    <div className="flex items-center gap-3">
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/10" />
                        <p className="text-[11px] font-black uppercase tracking-widest text-brand-secondary flex items-center gap-1.5">
                            <i className="fas fa-wand-magic-sparkles text-[10px] text-brand-pink" /> نماذج محاكاة نبرة الصوت
                        </p>
                        <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/10" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {[
                            { 
                                key: 'complaint', 
                                label: 'رد ذكي على شكوى عميل',  
                                text: voicePreview.complaint, 
                                layout: (text: string) => (
                                    <div className="bg-slate-950/65 rounded-2xl p-5 border border-white/5 space-y-4 shadow-inner relative">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                                            <span className="text-[9px] font-bold text-dark-text-secondary">رد خدمة العملاء المحاكي</span>
                                        </div>
                                        <div className="flex gap-2.5 items-start">
                                            <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex-shrink-0 flex items-center justify-center text-xs text-brand-secondary border border-brand-primary/20">
                                                <i className="fas fa-headset text-[11px]" />
                                            </div>
                                            <div className="bg-brand-primary/10 border border-brand-primary/15 rounded-2xl rounded-tr-none px-4 py-3 text-xs leading-relaxed text-white">
                                                {text}
                                            </div>
                                        </div>
                                    </div>
                                )
                            },
                            { 
                                key: 'post', 
                                label: 'منشور تسويقي تفاعلي', 
                                text: voicePreview.post,      
                                layout: (text: string) => (
                                    <div className="bg-slate-955/65 rounded-2xl p-5 border border-white/5 space-y-4 shadow-inner">
                                        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-[10px] text-white font-extrabold shadow-md">
                                                    S
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-white">{profile.brandName}</p>
                                                    <p className="text-[8px] text-slate-500">منشور مقترح</p>
                                                </div>
                                            </div>
                                            <i className="fas fa-ellipsis text-xs text-slate-500" />
                                        </div>
                                        <p className="text-xs leading-relaxed text-white/95 whitespace-pre-wrap">{text}</p>
                                    </div>
                                )
                            },
                            { 
                                key: 'welcome', 
                                label: 'بريد ترحيب بالعملاء الجدد',  
                                text: voicePreview.welcome,   
                                layout: (text: string) => (
                                    <div className="bg-slate-950/65 rounded-2xl p-5 border border-white/5 space-y-4 shadow-inner text-right">
                                        <div className="border-b border-white/5 pb-2">
                                            <p className="text-[8px] text-slate-500">الموضوع: أهلاً بك في عائلة {profile.brandName} 🌟</p>
                                        </div>
                                        <div className="text-xs leading-relaxed text-slate-200 space-y-2">
                                            {text}
                                        </div>
                                    </div>
                                )
                            },
                        ].map(card => (
                            <div key={card.key} className="bg-slate-900/40 border border-white/5 backdrop-blur-md rounded-2xl p-5 flex flex-col justify-between shadow-xl space-y-4 hover:border-brand-primary/10 transition-all duration-300">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10.5px] font-black text-brand-secondary">{card.label}</p>
                                    <button
                                        onClick={() => copyText(card.key, card.text)}
                                        className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/5 px-2.5 py-1 text-[9px] font-bold text-dark-text-secondary transition-all hover:text-white hover:bg-white/10 hover:border-white/10 active:scale-95"
                                    >
                                        <i className={`fas ${copiedKey === card.key ? 'fa-check text-emerald-400' : 'fa-copy'} text-[9px]`} />
                                        {copiedKey === card.key ? 'تم نسخ النص' : 'نسخ النص'}
                                    </button>
                                </div>
                                {card.layout(card.text)}
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={handleGeneratePreview}
                        disabled={generatingPreview}
                        className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-dark-text-secondary transition-all hover:text-brand-secondary hover:border-brand-primary/30 active:scale-[0.99]"
                    >
                        <i className={`fas ${generatingPreview ? 'fa-spinner fa-spin' : 'fa-rotate-right'} me-2 text-[10px]`} />
                        إعادة توليد النماذج السابقة
                    </button>
                </div>
            )}
        </div>
    );
};
