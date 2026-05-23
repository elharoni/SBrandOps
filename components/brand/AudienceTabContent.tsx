import React, { useState, useEffect, useRef } from 'react';
import { BrandHubProfile, NotificationType } from '../../types';
import { updateBrandProfile } from '../../services/brandHubService';

interface AudienceTabContentProps {
    profile: BrandHubProfile;
    brandId: string;
    addNotification: (type: NotificationType, message: string) => void;
    onUpdate?: (profile: BrandHubProfile) => void;
}

export const AudienceTabContent: React.FC<AudienceTabContentProps> = ({ profile, brandId, addNotification, onUpdate }) => {
    const [personas, setPersonas] = useState(profile.brandAudiences);
    const prevAudiencesRef = useRef(profile.brandAudiences);

    useEffect(() => {
        if (profile.brandAudiences !== prevAudiencesRef.current) {
            prevAudiencesRef.current = profile.brandAudiences;
            setPersonas(profile.brandAudiences);
        }
    }, [profile.brandAudiences]);

    const [editing, setEditing] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState<{ personaName: string; description: string; keyEmotions: string; painPoints: string }>({
        personaName: '', description: '', keyEmotions: '', painPoints: '',
    });

    const persistAudiences = async (updated: BrandHubProfile['brandAudiences']) => {
        setIsSaving(true);
        try {
            await updateBrandProfile(brandId, { brandAudiences: updated });
            if (onUpdate) {
                onUpdate({ ...profile, brandAudiences: updated });
            }
        } catch {
            addNotification(NotificationType.Error, 'تعذّر حفظ الجمهور — حاول مرة أخرى');
        } finally {
            setIsSaving(false);
        }
    };

    const openNew = () => {
        setEditing(-1);
        setForm({ personaName: '', description: '', keyEmotions: '', painPoints: '' });
    };

    const openEdit = (i: number) => {
        const p = personas[i];
        setEditing(i);
        setForm({
            personaName: p.personaName,
            description: p.description,
            keyEmotions: p.keyEmotions.join(', '),
            painPoints: p.painPoints.join(', '),
        });
    };

    const savePersona = async () => {
        const newP = {
            personaName: form.personaName,
            description: form.description,
            keyEmotions: form.keyEmotions.split(',').map(s => s.trim()).filter(Boolean),
            painPoints: form.painPoints.split(',').map(s => s.trim()).filter(Boolean),
        };
        const updated = editing === -1
            ? [...personas, newP]
            : personas.map((p, i) => i === editing ? newP : p);
        
        setPersonas(updated);
        setEditing(null);
        await persistAudiences(updated);
        addNotification(NotificationType.Success, editing === -1 ? `✅ تم إضافة "${newP.personaName}"` : `✅ تم تحديث "${newP.personaName}"`);
    };

    const deletePersona = async (i: number) => {
        const updated = personas.filter((_, idx) => idx !== i);
        setPersonas(updated);
        await persistAudiences(updated);
        addNotification(NotificationType.Success, '✅ تم حذف الشخصية بنجاح');
    };

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <i className="fas fa-users text-brand-pink animate-pulse" />
                        الجمهور المستهدف
                    </h2>
                    <p className="text-xs text-dark-text-secondary mt-0.5">شخصيات العملاء المثاليين — يستخدمها الـ AI لتخصيص الردود والمحتوى</p>
                </div>
                <div className="flex items-center gap-3">
                    {isSaving && <i className="fas fa-circle-notch fa-spin text-brand-pink text-xs" />}
                    <button onClick={openNew}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-pink to-brand-purple text-white rounded-xl text-xs font-semibold hover:opacity-90 hover:shadow-lg transition-all duration-200">
                        <i className="fas fa-plus text-xs" /> شخصية جديدة
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {personas.map((aud, i) => (
                    <div key={i} className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 space-y-4 hover:border-brand-primary/20 hover:shadow-[0_0_25px_rgba(37,99,235,0.12)] hover:-translate-y-0.5 transition-all duration-300 group shadow-xl relative overflow-hidden">
                        <div className="absolute -right-24 -top-24 w-48 h-48 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-primary/10 to-brand-secondary/10 border border-brand-primary/20 flex items-center justify-center text-brand-secondary font-black text-base shrink-0 shadow-inner">
                                {aud.personaName.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-extrabold text-white truncate text-sm">{aud.personaName}</p>
                                <p className="text-[9px] text-dark-text-secondary mt-0.5 font-bold">
                                    {aud.keyEmotions.length} مشاعر • {aud.painPoints.length} نقاط ألم
                                </p>
                            </div>
                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <button onClick={() => openEdit(i)} className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-dark-text-secondary hover:text-white hover:bg-white/10 hover:border-white/10 transition-colors">
                                    <i className="fas fa-pen text-[10px]" />
                                </button>
                                <button onClick={() => deletePersona(i)} className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-dark-text-secondary hover:text-red-400 hover:bg-white/10 hover:border-white/10 transition-colors">
                                    <i className="fas fa-trash text-[10px]" />
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed line-clamp-3 relative z-10">{aud.description}</p>
                        
                        {aud.keyEmotions.length > 0 && (
                            <div className="relative z-10 pt-1">
                                <p className="text-[9px] font-black text-brand-pink uppercase tracking-widest mb-2">المشاعر الرئيسية للعميل</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {aud.keyEmotions.map((e, j) => (
                                        <span key={j} className="text-[10px] px-2.5 py-0.5 bg-brand-pink/10 text-brand-pink rounded-full border border-brand-pink/20 font-bold">{e}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {aud.painPoints.length > 0 && (
                            <div className="relative z-10 pt-1">
                                <p className="text-[9px] font-black text-brand-secondary uppercase tracking-widest mb-2">نقاط الألم والتحديات</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {aud.painPoints.map((p, j) => (
                                        <span key={j} className="text-[10px] px-2.5 py-0.5 bg-brand-primary/10 text-brand-secondary rounded-full border border-brand-primary/20 font-bold">{p}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                
                {personas.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 gap-3 text-dark-text-secondary bg-slate-900/20 border border-dashed border-white/10 rounded-2xl">
                        <div className="w-16 h-16 rounded-2xl bg-slate-950/40 border border-white/5 flex items-center justify-center shadow-inner">
                            <i className="fas fa-users text-2xl opacity-30 text-brand-secondary" />
                        </div>
                        <p className="text-sm font-bold text-white">لا توجد شخصيات جمهور بعد</p>
                        <p className="text-xs opacity-60">أضف أولى شخصيات عملائك المثاليين لتوجيه محتوى الذكاء الاصطناعي</p>
                        <button onClick={openNew}
                            className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-brand-pink/15 text-brand-pink border border-brand-pink/25 rounded-xl text-xs font-bold hover:bg-brand-pink/25 transition-all duration-200">
                            <i className="fas fa-plus text-xs" /> إضافة أول شخصية
                        </button>
                    </div>
                )}
            </div>

            {editing !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-slate-900/90 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-7 space-y-5 relative overflow-hidden">
                        <div className="absolute -right-24 -top-24 w-48 h-48 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                            <h3 className="font-extrabold text-white text-base">{editing === -1 ? 'إضافة شخصية مستهدفة جديدة' : 'تعديل بيانات الشخصية'}</h3>
                            <button onClick={() => setEditing(null)} className="text-dark-text-secondary hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                <i className="fas fa-times text-sm" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 mb-1.5 block">اسم شخصية العميل المثالي</label>
                                <input value={form.personaName} onChange={e => setForm(f => ({ ...f, personaName: e.target.value }))}
                                    placeholder="مثال: سارة - مالكة مشروع كافيه"
                                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-650 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all duration-200" />
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 mb-1.5 block">وصف شخصية العميل واحتياجاته</label>
                                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    rows={3} placeholder="مثال: من هي؟ ما هي اهتماماتها اليومية؟ أين تقضي وقتها؟ وما هي متطلباتها الأساسية في هذا السوق؟"
                                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-650 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none transition-all duration-200" />
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 mb-1.5 block">المشاعر الجوهرية للجمهور (مفصولة بفواصل)</label>
                                <input value={form.keyEmotions} onChange={e => setForm(f => ({ ...f, keyEmotions: e.target.value }))}
                                    placeholder="مثال: قلق، طموح، يبحث عن الأمان، مهتم بالتوفير"
                                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-650 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all duration-200" />
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 mb-1.5 block">أبرز التحديات ونقاط الألم (مفصولة بفواصل)</label>
                                <input value={form.painPoints} onChange={e => setForm(f => ({ ...f, painPoints: e.target.value }))}
                                    placeholder="مثال: ضيق وقت التشغيل، ضعف خدمة ما بعد البيع، قلة الشفافية"
                                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-650 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all duration-200" />
                            </div>
                        </div>
                        
                        <div className="flex gap-3 pt-3 border-t border-white/5">
                            <button onClick={savePersona} disabled={!form.personaName || isSaving}
                                className="flex-1 py-3 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-xl font-black text-xs hover:scale-[1.01] hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2">
                                {isSaving ? <><i className="fas fa-circle-notch fa-spin text-xs" /> جاري الحفظ...</> : <><i className="fas fa-save text-xs" /> حفظ شخصية الجمهور</>}
                            </button>
                            <button onClick={() => setEditing(null)} className="px-5 py-3 border border-white/10 rounded-xl text-xs text-dark-text-secondary hover:bg-white/5 transition-colors font-bold">
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
