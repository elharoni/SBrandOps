import React, { useState, useEffect } from 'react';
import { BrandHubProfile, NotificationType } from '../../types';
import { updateBrandProfile } from '../../services/brandHubService';

interface AssetsTabContentProps {
    profile: BrandHubProfile;
    brandId: string;
    addNotification: (type: NotificationType, message: string) => void;
    onUpdate: (profile: BrandHubProfile) => void;
}

const _loadedFonts = new Set<string>();
function loadGoogleFont(family: string) {
    if (_loadedFonts.has(family)) return;
    _loadedFonts.add(family);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`;
    document.head.appendChild(link);
}

export const AssetsTabContent: React.FC<AssetsTabContentProps> = ({ profile, brandId, addNotification, onUpdate }) => {
    const [brandAssets, setBrandAssets] = useState({
        logoUrl: profile.brandAssets?.logoUrl ?? '',
        logoPreview: profile.brandAssets?.logoUrl ?? '',
        primaryColor: profile.brandAssets?.primaryColor ?? '#6366F1',
        secondaryColor: profile.brandAssets?.secondaryColor ?? '#EC4899',
        accentColor: profile.brandAssets?.accentColor ?? '#F59E0B',
        fontPrimary: profile.brandAssets?.fontPrimary ?? 'Cairo',
        fontSecondary: profile.brandAssets?.fontSecondary ?? 'Inter',
        extraColors: [] as string[],
    });

    useEffect(() => {
        if (profile.brandAssets) {
            setBrandAssets({
                logoUrl: profile.brandAssets.logoUrl ?? '',
                logoPreview: profile.brandAssets.logoUrl ?? '',
                primaryColor: profile.brandAssets.primaryColor ?? '#6366F1',
                secondaryColor: profile.brandAssets.secondaryColor ?? '#EC4899',
                accentColor: profile.brandAssets.accentColor ?? '#F59E0B',
                fontPrimary: profile.brandAssets.fontPrimary ?? 'Cairo',
                fontSecondary: profile.brandAssets.fontSecondary ?? 'Inter',
                extraColors: [],
            });
        }
    }, [profile.brandAssets]);

    useEffect(() => {
        loadGoogleFont(brandAssets.fontPrimary);
        loadGoogleFont(brandAssets.fontSecondary);
    }, [brandAssets.fontPrimary, brandAssets.fontSecondary]);

    const [isSavingAssets, setIsSavingAssets] = useState(false);

    const saveAssets = async () => {
        setIsSavingAssets(true);
        try {
            const updatedProfile = {
                ...profile,
                brandAssets: {
                    primaryColor: brandAssets.primaryColor,
                    secondaryColor: brandAssets.secondaryColor,
                    accentColor: brandAssets.accentColor,
                    fontPrimary: brandAssets.fontPrimary,
                    fontSecondary: brandAssets.fontSecondary,
                    logoUrl: brandAssets.logoUrl,
                }
            };
            await updateBrandProfile(brandId, {
                brandAssets: updatedProfile.brandAssets
            });
            onUpdate(updatedProfile);
            addNotification(NotificationType.Success, '✅ تم حفظ أصول البراند — ستُطبَّق على المحتوى تلقائياً');
        } catch {
            addNotification(NotificationType.Error, 'تعذّر حفظ الأصول — حاول مرة أخرى');
        } finally {
            setIsSavingAssets(false);
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        if (file.size > 5 * 1024 * 1024) {
            addNotification(NotificationType.Error, 'حجم الشعار يجب أن يكون أقل من 5 ميجابايت');
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
            setBrandAssets(prev => ({ ...prev, logoPreview: result, logoUrl: result }));
            addNotification(NotificationType.Success, '✅ تم رفع الشعار بنجاح');
        };
        reader.readAsDataURL(file);
    };

    const handleDeleteLogo = async () => {
        const cleared = { ...brandAssets, logoPreview: '', logoUrl: '' };
        setBrandAssets(cleared);
        try {
            const updatedProfile = {
                ...profile,
                brandAssets: {
                    primaryColor: cleared.primaryColor,
                    secondaryColor: cleared.secondaryColor,
                    accentColor: cleared.accentColor,
                    fontPrimary: cleared.fontPrimary,
                    fontSecondary: cleared.fontSecondary,
                    logoUrl: '',
                }
            };
            await updateBrandProfile(brandId, {
                brandAssets: updatedProfile.brandAssets,
            });
            onUpdate(updatedProfile);
            addNotification(NotificationType.Success, '🗑️ تم حذف الشعار بنجاح');
        } catch {
            addNotification(NotificationType.Error, 'فشل حذف الشعار من الخادم');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <i className="fas fa-palette text-brand-secondary animate-pulse"></i>
                أصول البراند البصرية
            </h2>

            {/* Logo Upload */}
            <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 space-y-4 shadow-xl relative overflow-hidden group">
                <div className="absolute -right-24 -top-24 w-48 h-48 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />
                <label className="text-xs font-bold text-dark-text-secondary block">الشعار الرسمي (Logo)</label>
                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/10 bg-slate-950/50 flex items-center justify-center overflow-hidden flex-shrink-0 relative group transition-all duration-300 hover:border-brand-primary/50">
                        {brandAssets.logoPreview ? (
                            <img src={brandAssets.logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                        ) : (
                            <div className="text-center text-dark-text-secondary">
                                <i className="fas fa-image text-2xl mb-1 block opacity-30"></i>
                                <span className="text-[9px] font-bold">لا يوجد شعار</span>
                            </div>
                        )}
                    </div>
                    <div className="space-y-2.5">
                        <label className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-xl text-xs font-black cursor-pointer hover:shadow-lg active:scale-[0.98] transform transition-all duration-200">
                            <i className="fas fa-upload"></i>
                            رفع ملف الشعار
                            <input type="file" accept="image/*,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
                        </label>
                        <p className="text-[9px] text-dark-text-secondary">PNG, SVG, JPG — حجم أقصى 5 ميجابايت</p>
                        {brandAssets.logoPreview && (
                            <button onClick={handleDeleteLogo} className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5 font-bold">
                                <i className="fas fa-trash-can"></i>
                                إزالة الشعار
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Brand Colors */}
            <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 space-y-4 shadow-xl relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                <div className="absolute -right-24 -top-24 w-48 h-48 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />
                <label className="text-xs font-bold text-dark-text-secondary block">منظومة الألوان للبراند</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { key: 'primaryColor' as const,   label: 'اللون الأساسي' },
                        { key: 'secondaryColor' as const, label: 'اللون الثانوي' },
                        { key: 'accentColor' as const,    label: 'لون التمييز واللكنة' },
                    ].map(({ key, label }) => (
                        <div key={key} className="space-y-2">
                            <p className="text-xs text-dark-text-secondary font-bold">{label}</p>
                            <div className="flex items-center gap-3 bg-slate-955/50 border border-white/10 rounded-xl p-3 transition-all focus-within:border-brand-primary/60 focus-within:ring-2 focus-within:ring-brand-primary/20">
                                <div className="w-8 h-8 rounded-lg border border-white/10 overflow-hidden flex-shrink-0 relative">
                                    <input
                                        type="color"
                                        value={brandAssets[key]}
                                        onChange={e => setBrandAssets(prev => ({ ...prev, [key]: e.target.value }))}
                                        className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer border-0 bg-transparent"
                                    />
                                </div>
                                <span className="text-xs font-mono text-white/95 uppercase font-extrabold">{brandAssets[key]}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Color Preview Bar */}
                <div className="mt-4 p-4.5 rounded-xl bg-slate-950/30 border border-white/5 flex items-center gap-4 shadow-inner">
                    <div className="flex items-center gap-2.5">
                        {[brandAssets.primaryColor, brandAssets.secondaryColor, brandAssets.accentColor].map((color, i) => (
                            <div 
                                key={i} 
                                className="w-8 h-8 rounded-full border border-white/15 shadow-lg transition-transform duration-300 hover:scale-110"
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                    <span className="text-xs text-dark-text-secondary font-bold">معاينة متناغمة لهوية الألوان البصرية</span>
                </div>
            </div>

            {/* Typography */}
            <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/20 to-slate-950/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 space-y-4 shadow-xl relative overflow-hidden group hover:border-brand-primary/10 transition-all duration-300">
                <div className="absolute -right-24 -top-24 w-48 h-48 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />
                <label className="text-xs font-bold text-dark-text-secondary block">الخطوط المعتمدة (Typography)</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {[
                        { key: 'fontPrimary' as const, label: 'الخط الأساسي للمشاريع والعناوين الرئيسية', options: ['Cairo', 'Tajawal', 'Noto Kufi Arabic', 'Inter', 'Poppins', 'Roboto'] },
                        { key: 'fontSecondary' as const, label: 'الخط الثانوي للنصوص والفقرات العامة', options: ['Inter', 'Roboto', 'Cairo', 'Open Sans', 'Montserrat'] },
                    ].map(({ key, label, options }) => (
                        <div key={key} className="space-y-2.5">
                            <p className="text-xs text-dark-text-secondary font-bold">{label}</p>
                            <select
                                value={brandAssets[key]}
                                onChange={e => setBrandAssets(prev => ({ ...prev, [key]: e.target.value }))}
                                className="w-full bg-slate-955/50 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all"
                            >
                                {options.map(f => <option key={f} value={f} className="bg-slate-950 text-white">{f}</option>)}
                            </select>
                            <div className="mt-2.5 p-4 bg-slate-950/35 rounded-xl border border-white/5 shadow-inner">
                                <p className="text-[9px] text-dark-text-secondary mb-1.5 opacity-60 font-bold">معاينة عينة الخط:</p>
                                <p className="text-xs text-white leading-relaxed" style={{ fontFamily: brandAssets[key] }}>
                                    أهلاً بك في {profile.brandName || 'براندك'} — هكذا ستظهر نصوص وعناوين المحتوى والردود المنشأة.
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Save Button */}
            <button
                onClick={saveAssets}
                disabled={isSavingAssets}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-extrabold rounded-xl hover:scale-[1.01] hover:shadow-lg shadow-brand-primary/20 active:scale-[0.99] transition-all transform duration-200 disabled:opacity-60"
            >
                {isSavingAssets ? (
                    <><i className="fas fa-spinner fa-spin"></i> جاري حفظ الأصول...</>
                ) : (
                    <><i className="fas fa-floppy-disk"></i> حفظ أصول البراند البصرية</>
                )}
            </button>
        </div>
    );
};
