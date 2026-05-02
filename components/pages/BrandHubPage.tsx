

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrandHubProfile, BrandVoice, NotificationType, BrandConsistencyEvaluation, BrandGoal, BrandLanguage, BusinessModel, SkillStats } from '../../types';
import { generateInitialBrandProfile, evaluateContentConsistency } from '../../services/geminiService';
import { analyzeBrandFiles, buildWizardPrefillFromAnalysis } from '../../services/brandFileAnalysisService';
import { getBrandFileExt, getBrandFileMimeType, isBrandFileBinaryExt, isSupportedBrandFileExt } from '../../services/brandFileAnalysisShared';
import { getBrandKnowledge } from '../../services/brandKnowledgeService';
import { callAIProxy, Type } from '../../services/aiProxy';
import { extractTextFromPdf } from '../../services/pdfExtractor';
import { getBrandSkillsReport } from '../../services/evaluationService';
import { getBrandDocuments, deleteBrandDocument, BrandDocument, DOC_TYPE_LABELS } from '../../services/brandDocumentService';
import { BrandImportModal } from '../BrandImportModal';
import { ScoreDonut } from '../shared/ScoreDonut';
import { getMemoryEntries, deleteMemoryEntry, BrandMemoryEntry, MemoryType } from '../../services/brandMemoryService';
import { getSocialAccounts } from '../../services/socialAccountService';
import { getBrandHubProfile, updateBrandProfile } from '../../services/brandHubService';

interface BrandHubPageProps {
    brandId: string;
    initialProfile: BrandHubProfile;
    onUpdate: (profile: BrandHubProfile) => void;
    addNotification: (type: NotificationType, message: string) => void;
    onNavigate?: (page: string) => void;
}

type ActiveTab = 'identity' | 'voice' | 'audience' | 'ai-memory' | 'assets' | 'documents' | 'intelligence';

// ONB-1: Multi-step AI First-Run Experience Wizard
const TONE_OPTIONS = [
    { value: 'professional',  label: 'رسمي ومهني',    icon: 'fa-briefcase',  color: 'border-blue-500 bg-blue-500/10' },
    { value: 'friendly',      label: 'ودود وقريب',     icon: 'fa-smile',      color: 'border-yellow-500 bg-yellow-500/10' },
    { value: 'bold',          label: 'جريء ومباشر',   icon: 'fa-bolt',       color: 'border-red-500 bg-red-500/10' },
    { value: 'creative',      label: 'إبداعي ومبتكر', icon: 'fa-paint-brush',color: 'border-purple-500 bg-purple-500/10' },
    { value: 'empathetic',    label: 'متفهم وعاطفي',  icon: 'fa-heart',      color: 'border-pink-500 bg-pink-500/10' },
    { value: 'authoritative', label: 'خبير وموثوق',   icon: 'fa-award',      color: 'border-green-500 bg-green-500/10' },
];

const INDUSTRY_OPTIONS = ['تجزئة وتسوق', 'عقارات', 'مطاعم وأغذية', 'صحة وجمال', 'تقنية وSaaS', 'تعليم', 'سياحة وضيافة', 'مالية وبنوك', 'رياضة ولياقة', 'أخرى'];

// Brand Hub uploaded file analysis is handled server-side via OpenAI Responses API.
const INLINE_PDF_MAX_BYTES = 5 * 1024 * 1024;

function getExt(name: string) { return getBrandFileExt(name); }

async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

const AIOnboardingModal: React.FC<{ brandName: string; onClose: () => void; onGenerate: (profile: Partial<BrandHubProfile>) => void; }> = ({ brandName, onClose, onGenerate }) => {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        industry: '',
        description: '',
        targetAudience: '',
        ageRange: '25-40',
        tones: [] as string[],
        platforms: [] as string[],
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isExtractingFile, setIsExtractingFile] = useState(false);
    const [fileExtractMsg, setFileExtractMsg] = useState<string | null>(null);
    const [unsupportedExt, setUnsupportedExt] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        const ext = getExt(file.name);
        if (!isSupportedBrandFileExt(ext)) {
            setUnsupportedExt(ext);
            setFileExtractMsg('نوع الملف غير مدعوم في التحليل الذكي.');
            return;
        }
        if (file.size === 0) {
            setUnsupportedExt(null);
            setFileExtractMsg('الملف فارغ. ارفع ملفاً يحتوي على محتوى فعلي.');
            return;
        }
        if (isBrandFileBinaryExt(ext) && ext !== 'pdf' && file.size > INLINE_PDF_MAX_BYTES) {
            setUnsupportedExt(null);
            setFileExtractMsg('هذا الملف كبير جداً للتحليل المباشر. الحد الأقصى 5MB لملفات Word وPowerPoint وExcel.');
            return;
        }
        setUnsupportedExt(null);

        setIsExtractingFile(true);
        setFileExtractMsg(null);
        try {
            const document = isBrandFileBinaryExt(ext) && !(ext === 'pdf' && file.size > INLINE_PDF_MAX_BYTES)
                ? {
                    file_name: file.name,
                    file_type: getBrandFileMimeType(file.name, file.type || 'application/octet-stream'),
                    mime_type: getBrandFileMimeType(file.name, file.type || 'application/octet-stream'),
                    size_bytes: file.size,
                    base64_data: await fileToBase64(file),
                }
                : {
                    file_name: file.name,
                    file_type: getBrandFileMimeType(file.name, file.type || 'text/plain'),
                    mime_type: getBrandFileMimeType(file.name, file.type || 'text/plain'),
                    size_bytes: file.size,
                    text_content: ext === 'pdf'
                        ? await extractTextFromPdf(file)
                        : await file.text(),
                };

            const result = await analyzeBrandFiles([document]);
            const prefill = buildWizardPrefillFromAnalysis(result.data);

            setForm(f => ({
                ...f,
                industry: prefill.industry || f.industry,
                description: prefill.description || f.description,
                targetAudience: prefill.targetAudience || f.targetAudience,
                ageRange: prefill.ageRange || f.ageRange,
                tones: prefill.tones.length ? prefill.tones : f.tones,
                platforms: prefill.platforms.length ? prefill.platforms : f.platforms,
            }));

            const filledCount = [
                prefill.industry,
                prefill.description,
                prefill.targetAudience,
                prefill.tones.length,
                prefill.platforms.length,
            ].filter(Boolean).length;
            setFileExtractMsg(`✓ تم ملء ${filledCount} حقول تلقائياً من "${file.name}"`);

            // If enough fields were filled, skip all manual steps and go straight to generation
            if (filledCount >= 3) {
                setTimeout(() => setStep(4), 900);
            }
        } catch (err) {
            console.error('[wizard file upload]', err);
            const msg = err instanceof Error ? err.message : String(err);
            setFileExtractMsg(`تعذّر قراءة الملف: ${msg.slice(0, 80)}`);
        } finally {
            setIsExtractingFile(false);
        }
    };

    const toggleTone = (val: string) => setForm(f => ({
        ...f, tones: f.tones.includes(val) ? f.tones.filter(t => t !== val) : [...f.tones, val].slice(0, 3),
    }));

    const togglePlatform = (val: string) => setForm(f => ({
        ...f, platforms: f.platforms.includes(val) ? f.platforms.filter(p => p !== val) : [...f.platforms, val],
    }));

    const handleGenerate = async () => {
        setIsLoading(true);
        const fullDesc = `${form.description} | الصناعة: ${form.industry} | الجمهور: ${form.targetAudience} (${form.ageRange}) | النبرة: ${form.tones.join(', ')} | المنصات: ${form.platforms.join(', ')}`;
        try {
            const partialProfile = await generateInitialBrandProfile(fullDesc, brandName);
            onGenerate(partialProfile);
        } catch (error) {
            console.error('Failed to generate brand profile:', error);
            onGenerate({});
        } finally {
            setIsLoading(false);
            onClose();
        }
    };

    const STEPS = [
        { num: 1, label: 'الأساسيات' },
        { num: 2, label: 'الجمهور' },
        { num: 3, label: 'الصوت' },
        { num: 4, label: 'الإنشاء' },
    ];

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-md" dir="rtl">
            <div className="bg-dark-card w-full sm:max-w-xl sm:rounded-2xl rounded-t-3xl overflow-hidden shadow-2xl border border-white/5 flex flex-col max-h-[92vh]">

                {/* ── Gradient Header ── */}
                <div className="relative overflow-hidden px-5 pt-5 pb-4 flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
                    {/* Glow */}
                    <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-brand-pink/10 blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-brand-purple/10 blur-2xl pointer-events-none" />

                    <div className="relative">
                        {/* Title row */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0"
                                    style={{ background: 'linear-gradient(135deg, var(--brand-pink,#e91e8c) 0%, var(--brand-purple,#9c27b0) 100%)' }}>
                                    <i className="fas fa-wand-magic-sparkles text-white text-sm" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white leading-tight">إعداد ذكي لهوية البراند</h2>
                                    <p className="text-[11px] text-slate-400 mt-0.5">الذكاء الاصطناعي يبني الهوية كاملة في ثوانٍ</p>
                                </div>
                            </div>
                            <button onClick={onClose} aria-label="إغلاق"
                                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                                <i className="fas fa-times text-xs" />
                            </button>
                        </div>

                        {/* Step ribbon */}
                        <div className="flex items-center">
                            {STEPS.map((s, i) => (
                                <React.Fragment key={s.num}>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300 ${
                                            step > s.num
                                                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                                                : step === s.num
                                                ? 'text-white shadow-lg shadow-brand-pink/40'
                                                : 'bg-white/8 text-slate-500 border border-white/10'
                                        }`}
                                            style={step === s.num ? { background: 'linear-gradient(135deg, var(--brand-pink,#e91e8c), var(--brand-purple,#9c27b0))' } : undefined}>
                                            {step > s.num ? <i className="fas fa-check text-[9px]" /> : s.num}
                                        </div>
                                        <span className={`hidden sm:block text-xs font-medium transition-all ${
                                            step === s.num ? 'text-white' : step > s.num ? 'text-emerald-400' : 'text-slate-500'
                                        }`}>{s.label}</span>
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className={`flex-1 h-px mx-2 rounded-full transition-colors duration-500 ${step > s.num ? 'bg-emerald-500/50' : 'bg-white/10'}`} />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>

                        {/* Progress bar */}
                        <div className="mt-3 h-0.5 bg-white/8 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${((step - 1) / (STEPS.length - 1)) * 100}%`,
                                    background: 'linear-gradient(90deg, var(--brand-pink,#e91e8c), var(--brand-purple,#9c27b0))',
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* ── Content ── */}
                <div className="flex-1 overflow-y-auto p-5">

                    {/* Step 1: Basics */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <p className="text-slate-400 text-sm">أخبرنا عن نشاطك التجاري — سيبني الذكاء الاصطناعي الهوية الكاملة تلقائياً</p>

                            {/* File upload zone */}
                            <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf,.docx,.doc,.pptx,.xlsx,.csv" className="hidden" onChange={handleFileUpload} />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isExtractingFile}
                                className="w-full group relative overflow-hidden rounded-2xl border-2 border-dashed border-brand-pink/30 hover:border-brand-pink/70 bg-brand-pink/3 hover:bg-brand-pink/8 transition-all duration-200 p-4 text-right disabled:opacity-60"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-pink/20 to-brand-purple/20 border border-brand-pink/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                        {isExtractingFile
                                            ? <i className="fas fa-circle-notch fa-spin text-brand-pink text-lg" />
                                            : <i className="fas fa-file-arrow-up text-brand-pink text-lg" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white">
                                            {isExtractingFile ? 'جارٍ التحليل الذكي...' : 'استيراد من ملف'}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-0.5">PDF • DOCX • XLSX • CSV • TXT — يملأ الحقول تلقائياً</p>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <span className="text-[10px] font-bold bg-brand-pink/15 text-brand-pink px-2 py-1 rounded-lg border border-brand-pink/20">
                                            AI ✦
                                        </span>
                                    </div>
                                </div>
                            </button>

                            {fileExtractMsg && (
                                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border ${fileExtractMsg.startsWith('✓') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                    <i className={`fas ${fileExtractMsg.startsWith('✓') ? 'fa-circle-check' : 'fa-circle-exclamation'} text-sm`} />
                                    {fileExtractMsg}
                                </div>
                            )}

                            {unsupportedExt && (
                                <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 flex items-start gap-3">
                                    <i className="fas fa-triangle-exclamation text-amber-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs font-semibold text-amber-300">امتداد {unsupportedExt.toUpperCase()} غير مدعوم</p>
                                        <p className="text-[11px] text-amber-300/70 mt-0.5">استخدم PDF أو DOCX أو PPTX أو XLSX أو CSV أو TXT أو MD</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-white/8" />
                                <span className="text-[11px] text-slate-500 font-medium flex-shrink-0">أو أدخل يدوياً</span>
                                <div className="flex-1 h-px bg-white/8" />
                            </div>

                            {/* Industry chips */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-2">الصناعة / القطاع</label>
                                <div className="flex flex-wrap gap-2">
                                    {INDUSTRY_OPTIONS.map(o => (
                                        <button key={o} type="button" onClick={() => setForm(f => ({ ...f, industry: f.industry === o ? '' : o }))}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${form.industry === o ? 'bg-brand-pink/20 border-brand-pink text-brand-pink' : 'bg-dark-bg border-dark-border text-slate-400 hover:border-brand-pink/40 hover:text-slate-300'}`}>
                                            {o}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-semibold text-slate-400">وصف النشاط التجاري *</label>
                                    <span className={`text-[10px] ${form.description.length > 30 ? 'text-emerald-400' : 'text-slate-500'}`}>{form.description.length} حرف</span>
                                </div>
                                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                                    placeholder="مثال: متجر متخصص في مستحضرات تجميل طبيعية 100%، يستهدف النساء العربيات..."
                                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-brand-pink/40 focus:border-brand-pink/50 placeholder-slate-600 transition-all" />
                            </div>
                        </div>
                    )}

                    {/* Step 2: Audience */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <p className="text-slate-400 text-sm">من هم عملاؤك المثاليون؟</p>

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5">وصف الجمهور المستهدف</label>
                                <textarea value={form.targetAudience} onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))} rows={3}
                                    placeholder="مثال: نساء 25-40 في السعودية ودول الخليج، مهتمات بالصحة والجمال الطبيعي..."
                                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-brand-pink/40 focus:border-brand-pink/50 placeholder-slate-600 transition-all" />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-2">الفئة العمرية الرئيسية</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {['18-24', '25-34', '35-44', '45-54', '55+'].map(r => (
                                        <button key={r} onClick={() => setForm(f => ({ ...f, ageRange: r }))}
                                            className={`py-2.5 rounded-xl text-sm font-bold transition-all border ${form.ageRange === r ? 'border-brand-pink bg-brand-pink/20 text-brand-pink shadow-md shadow-brand-pink/20' : 'border-dark-border text-slate-500 hover:border-brand-pink/40 hover:text-slate-300'}`}>
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-2">منصات التواصل المستهدفة</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { name: 'Instagram', icon: 'fab fa-instagram',   color: 'from-pink-500 to-purple-500' },
                                        { name: 'TikTok',    icon: 'fab fa-tiktok',       color: 'from-slate-700 to-slate-900' },
                                        { name: 'Facebook',  icon: 'fab fa-facebook-f',   color: 'from-blue-600 to-blue-700'   },
                                        { name: 'X',         icon: 'fab fa-x-twitter',    color: 'from-gray-700 to-gray-900'   },
                                        { name: 'LinkedIn',  icon: 'fab fa-linkedin-in',  color: 'from-blue-700 to-blue-800'   },
                                        { name: 'Snapchat',  icon: 'fab fa-snapchat',      color: 'from-yellow-400 to-yellow-500'},
                                    ].map(p => (
                                        <button key={p.name} onClick={() => togglePlatform(p.name)}
                                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${form.platforms.includes(p.name) ? 'bg-white/10 border-white/30 text-white' : 'border-dark-border text-slate-500 hover:border-white/20 hover:text-slate-300'}`}>
                                            <i className={`${p.icon} text-sm`} />
                                            {p.name}
                                            {form.platforms.includes(p.name) && <i className="fas fa-check text-emerald-400 text-[10px] mr-auto" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Voice */}
                    {step === 3 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-slate-400 text-sm">اختر حتى 3 نبرات تعبّر عن صوت براندك</p>
                                {form.tones.length > 0 && (
                                    <span className="text-[11px] font-bold text-brand-pink bg-brand-pink/10 px-2 py-0.5 rounded-full">
                                        {form.tones.length}/3 محدد
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
                                {TONE_OPTIONS.map(t => {
                                    const selected = form.tones.includes(t.value);
                                    return (
                                        <button key={t.value} onClick={() => toggleTone(t.value)}
                                            className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 text-right transition-all duration-200 ${selected ? t.color + ' scale-[1.02] shadow-lg' : 'border-dark-border bg-dark-bg/50 hover:border-white/20 hover:bg-white/3'}`}>
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${selected ? 'bg-white/15' : 'bg-dark-card'}`}>
                                                <i className={`fas ${t.icon} text-lg ${selected ? 'text-white' : 'text-slate-500'}`} />
                                            </div>
                                            <div className="flex-1 min-w-0 text-right">
                                                <p className={`text-sm font-bold ${selected ? 'text-white' : 'text-slate-400'}`}>{t.label}</p>
                                                {selected && <p className="text-[10px] text-white/60 mt-0.5">محدد ✓</p>}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Generate */}
                    {step === 4 && (
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-5">
                            {isLoading ? (
                                <>
                                    <div className="relative w-20 h-20">
                                        <div className="absolute inset-0 rounded-full border-4 border-brand-pink/10" />
                                        <div className="absolute inset-0 rounded-full border-4 border-brand-pink border-t-transparent border-r-transparent animate-spin" />
                                        <div className="absolute inset-2 rounded-full border-2 border-brand-purple/30 border-b-brand-purple animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <i className="fas fa-brain text-xl text-brand-pink" />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-lg">الذكاء الاصطناعي يبني هويتك...</p>
                                        <p className="text-slate-400 text-sm mt-1">يستغرق 15–20 ثانية</p>
                                    </div>
                                    <div className="w-full max-w-xs bg-dark-bg rounded-full overflow-hidden h-1.5">
                                        <div className="h-full rounded-full animate-pulse" style={{ width: '60%', background: 'linear-gradient(90deg, var(--brand-pink,#e91e8c), var(--brand-purple,#9c27b0))' }} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="relative">
                                        <div className="w-20 h-20 rounded-full flex items-center justify-center border border-brand-pink/20"
                                            style={{ background: 'linear-gradient(135deg, rgba(233,30,140,0.15), rgba(156,39,176,0.15))' }}>
                                            <i className="fas fa-wand-magic-sparkles text-3xl text-brand-pink" />
                                        </div>
                                        <div className="absolute -top-1 -left-1 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                            <i className="fas fa-check text-white text-xs" />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-xl">جاهز للإنشاء!</p>
                                        <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto leading-relaxed">سيُنشئ الذكاء الاصطناعي هوية براند متكاملة من المعلومات التي أدخلتها</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                                        {['صوت البراند', 'القيم الجوهرية', 'وصف الجمهور', 'محاور المحتوى'].map((item) => (
                                            <div key={item} className="flex items-center gap-2 bg-dark-bg rounded-xl px-3 py-2.5 text-xs text-slate-400 border border-dark-border/50">
                                                <i className="fas fa-circle-check text-brand-pink text-[11px] flex-shrink-0" />
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="px-5 py-4 border-t border-white/5 bg-dark-bg/30 flex justify-between items-center gap-3 flex-shrink-0">
                    <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
                        className="px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 border border-white/8 hover:border-white/15 transition-all font-medium">
                        {step === 1 ? 'تخطي' : '← رجوع'}
                    </button>
                    {step < 4 ? (
                        <button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !form.description.trim()}
                            className="flex items-center gap-2 px-7 py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-40 shadow-lg shadow-brand-pink/20"
                            style={{ background: 'linear-gradient(135deg, var(--brand-pink,#e91e8c), var(--brand-purple,#9c27b0))' }}>
                            التالي <i className="fas fa-arrow-left text-xs" />
                        </button>
                    ) : (
                        <button onClick={handleGenerate} disabled={isLoading}
                            className="flex items-center gap-2 px-7 py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-40 shadow-lg shadow-brand-pink/20"
                            style={{ background: 'linear-gradient(135deg, var(--brand-pink,#e91e8c), var(--brand-purple,#9c27b0))' }}>
                            {isLoading
                                ? <><i className="fas fa-circle-notch fa-spin text-xs" /> جارٍ الإنشاء...</>
                                : <><i className="fas fa-wand-magic-sparkles text-xs" /> إنشاء الهوية</>
                            }
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};


const VoiceTabContent: React.FC<{
    profile: BrandHubProfile;
    brandId: string;
    addNotification: (type: NotificationType, message: string) => void;
}> = ({ profile, brandId, addNotification }) => {
    const [voice, setVoice] = useState<BrandVoice>(profile.brandVoice);
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

    const generatePreview = async () => {
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
            const res = await callAIProxy({ model: 'gemini-2.0-flash', prompt, feature: 'voice_preview', brand_id: brandId });
            const raw = res.text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(raw);
            setVoicePreview({ complaint: parsed.complaint ?? '', post: parsed.post ?? '', welcome: parsed.welcome ?? '' });
        } catch {
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold text-white">صوت البراند</h2>
                    <p className="text-xs text-dark-text-secondary mt-0.5">النبرة والكلمات التي يتحدث بها البراند — تؤثر مباشرة على جودة مخرجات AI</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={generatePreview}
                        disabled={generatingPreview}
                        className="flex items-center gap-1.5 rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-3 py-2 text-xs font-bold text-brand-secondary transition-colors hover:bg-brand-primary/20 disabled:opacity-50"
                    >
                        <i className={`fas ${generatingPreview ? 'fa-spinner fa-spin' : 'fa-eye'} text-[10px]`} />
                        {generatingPreview ? 'جاري التوليد...' : 'معاينة الصوت'}
                    </button>
                    <button
                        onClick={saveVoice}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-brand-pink to-brand-purple text-white rounded-xl text-xs font-bold hover:opacity-90 transition disabled:opacity-60"
                    >
                        {isSaving
                            ? <><i className="fas fa-spinner fa-spin text-[10px]" /> حفظ...</>
                            : <><i className="fas fa-save text-[10px]" /> حفظ الصوت</>
                        }
                    </button>
                </div>
            </div>

            {/* Tone descriptions */}
            <div className="bg-dark-bg rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-white">أوصاف النبرة</h3>
                <p className="text-[10px] text-dark-text-secondary">كلمات تصف طريقة تواصل البراند — يستخدمها AI لضبط أسلوب الكتابة</p>
                <div className="flex flex-wrap gap-2">
                    {voice.toneDescription.map((t, i) => (
                        <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-purple/20 text-brand-secondary rounded-full text-xs font-semibold border border-brand-purple/30">
                            {t}
                            <button onClick={() => removeTag('toneDescription', i)} className="opacity-60 hover:opacity-100 transition-opacity">
                                <i className="fas fa-times text-[8px]" />
                            </button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input
                        value={newTone}
                        onChange={e => setNewTone(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addTag('toneDescription', newTone, setNewTone)}
                        placeholder='مثال: "ودود"، "مهني"، "جريء"...'
                        className="flex-1 bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder-dark-text-secondary focus:border-brand-primary focus:outline-none"
                    />
                    <button onClick={() => addTag('toneDescription', newTone, setNewTone)} className="px-3 py-2 bg-brand-purple/10 text-brand-secondary rounded-xl text-xs hover:bg-brand-purple/20 transition-colors">
                        <i className="fas fa-plus text-[10px]" />
                    </button>
                </div>
            </div>

            {/* Keywords + Negative Keywords */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-dark-bg rounded-2xl p-4 space-y-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <i className="fas fa-tags text-brand-pink text-xs" /> الكلمات المفتاحية
                    </h3>
                    <p className="text-[10px] text-dark-text-secondary">كلمات يُفضّل البراند استخدامها دائماً</p>
                    <div className="flex flex-wrap gap-2">
                        {voice.keywords.map((kw, i) => (
                            <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-pink/20 text-brand-pink rounded-full text-xs font-semibold border border-brand-pink/30">
                                {kw}
                                <button onClick={() => removeTag('keywords', i)} className="opacity-60 hover:opacity-100 transition-opacity">
                                    <i className="fas fa-times text-[8px]" />
                                </button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            value={newKeyword}
                            onChange={e => setNewKeyword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addTag('keywords', newKeyword, setNewKeyword)}
                            placeholder="أضف كلمة..."
                            className="flex-1 bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder-dark-text-secondary focus:border-brand-primary focus:outline-none"
                        />
                        <button onClick={() => addTag('keywords', newKeyword, setNewKeyword)} className="px-3 py-2 bg-brand-pink/10 text-brand-pink rounded-xl text-xs hover:bg-brand-pink/20 transition-colors">
                            <i className="fas fa-plus text-[10px]" />
                        </button>
                    </div>
                </div>

                <div className="bg-dark-bg rounded-2xl p-4 space-y-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <i className="fas fa-ban text-red-400 text-xs" /> كلمات ممنوعة
                    </h3>
                    <p className="text-[10px] text-dark-text-secondary">كلمات لا يستخدمها البراند — AI سيتجنبها تلقائياً</p>
                    <div className="flex flex-wrap gap-2">
                        {(voice.negativeKeywords ?? []).map((kw, i) => (
                            <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-full text-xs font-semibold border border-red-500/20">
                                {kw}
                                <button onClick={() => removeTag('negativeKeywords', i)} className="opacity-60 hover:opacity-100 transition-opacity">
                                    <i className="fas fa-times text-[8px]" />
                                </button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            value={newNegKw}
                            onChange={e => setNewNegKw(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addTag('negativeKeywords', newNegKw, setNewNegKw)}
                            placeholder="أضف كلمة ممنوعة..."
                            className="flex-1 bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder-dark-text-secondary focus:border-brand-primary focus:outline-none"
                        />
                        <button onClick={() => addTag('negativeKeywords', newNegKw, setNewNegKw)} className="px-3 py-2 bg-red-500/10 text-red-400 rounded-xl text-xs hover:bg-red-500/20 transition-colors">
                            <i className="fas fa-plus text-[10px]" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Voice Guidelines — editable */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-900/20 border border-green-800/40 rounded-2xl p-4 space-y-3">
                    <h4 className="font-semibold text-green-400 flex items-center gap-2">
                        <i className="fas fa-check-circle" /> نعم — استخدم
                    </h4>
                    <div className="space-y-1.5">
                        {(voice.voiceGuidelines?.dos ?? []).map((d, i) => (
                            <div key={i} className="flex items-start gap-2 group">
                                <i className="fas fa-plus text-green-500 mt-0.5 text-xs shrink-0" />
                                <span className="text-sm text-dark-text-secondary flex-1">{d}</span>
                                <button onClick={() => removeGuideline('dos', i)} className="opacity-0 group-hover:opacity-100 text-dark-text-secondary hover:text-red-400 transition-all">
                                    <i className="fas fa-times text-[10px]" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            value={newDo}
                            onChange={e => setNewDo(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addGuideline('dos', newDo, setNewDo)}
                            placeholder='مثال: "كن ودياً ومتفاعلاً دائماً"'
                            className="flex-1 bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder-dark-text-secondary focus:border-green-500/50 focus:outline-none"
                        />
                        <button onClick={() => addGuideline('dos', newDo, setNewDo)} className="px-3 py-2 bg-green-500/10 text-green-400 rounded-xl text-xs hover:bg-green-500/20 transition-colors">
                            <i className="fas fa-plus text-[10px]" />
                        </button>
                    </div>
                </div>

                <div className="bg-red-900/20 border border-red-800/40 rounded-2xl p-4 space-y-3">
                    <h4 className="font-semibold text-red-400 flex items-center gap-2">
                        <i className="fas fa-times-circle" /> لا — تجنب
                    </h4>
                    <div className="space-y-1.5">
                        {(voice.voiceGuidelines?.donts ?? []).map((d, i) => (
                            <div key={i} className="flex items-start gap-2 group">
                                <i className="fas fa-minus text-red-500 mt-0.5 text-xs shrink-0" />
                                <span className="text-sm text-dark-text-secondary flex-1">{d}</span>
                                <button onClick={() => removeGuideline('donts', i)} className="opacity-0 group-hover:opacity-100 text-dark-text-secondary hover:text-red-400 transition-all">
                                    <i className="fas fa-times text-[10px]" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            value={newDont}
                            onChange={e => setNewDont(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addGuideline('donts', newDont, setNewDont)}
                            placeholder='مثال: "تجنب الكلمات التقنية المعقدة"'
                            className="flex-1 bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder-dark-text-secondary focus:border-red-500/50 focus:outline-none"
                        />
                        <button onClick={() => addGuideline('donts', newDont, setNewDont)} className="px-3 py-2 bg-red-500/10 text-red-400 rounded-xl text-xs hover:bg-red-500/20 transition-colors">
                            <i className="fas fa-plus text-[10px]" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Tone strength slider */}
            <div className="bg-dark-bg rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">قوة النبرة</h3>
                    <span className="text-sm font-mono text-brand-pink font-bold">{voice.toneStrength ?? 50}%</span>
                </div>
                <input
                    type="range" min="0" max="100"
                    value={voice.toneStrength ?? 50}
                    onChange={e => setVoice(prev => ({ ...prev, toneStrength: Number(e.target.value) }))}
                    className="w-full accent-brand-pink"
                />
                <div className="flex justify-between text-[10px] text-dark-text-secondary">
                    <span>هادئ ومحايد</span>
                    <span>قوي ومميز</span>
                </div>
            </div>

            {/* AI Voice Preview */}
            {voicePreview && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-dark-border/50" />
                        <p className="text-[11px] font-black uppercase tracking-widest text-brand-secondary">معاينة الصوت</p>
                        <div className="h-px flex-1 bg-dark-border/50" />
                    </div>
                    {[
                        { key: 'complaint', icon: 'fa-comment-exclamation', label: 'رد على شكوى',  text: voicePreview.complaint, color: 'border-rose-500/25 bg-rose-500/5'    },
                        { key: 'post',      icon: 'fa-bullhorn',            label: 'منشور ترويجي', text: voicePreview.post,      color: 'border-blue-500/25 bg-blue-500/5'    },
                        { key: 'welcome',   icon: 'fa-hand-wave',           label: 'رسالة ترحيب',  text: voicePreview.welcome,   color: 'border-emerald-500/25 bg-emerald-500/5' },
                    ].map(card => (
                        <div key={card.key} className={`rounded-xl border p-4 ${card.color}`}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <i className={`fas ${card.icon} text-xs text-dark-text-secondary`} />
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-dark-text-secondary">{card.label}</p>
                                </div>
                                <button
                                    onClick={() => copyText(card.key, card.text)}
                                    className="flex items-center gap-1 rounded-lg bg-dark-bg/50 px-2 py-1 text-[10px] font-semibold text-dark-text-secondary transition-colors hover:text-white"
                                >
                                    <i className={`fas ${copiedKey === card.key ? 'fa-check text-emerald-400' : 'fa-copy'} text-[9px]`} />
                                    {copiedKey === card.key ? 'تم النسخ' : 'نسخ'}
                                </button>
                            </div>
                            <p className="text-sm leading-relaxed text-white">{card.text}</p>
                        </div>
                    ))}
                    <button
                        onClick={generatePreview}
                        disabled={generatingPreview}
                        className="w-full rounded-xl border border-dark-border py-2 text-xs font-semibold text-dark-text-secondary transition-colors hover:text-brand-secondary hover:border-brand-primary/40 disabled:opacity-50"
                    >
                        <i className={`fas ${generatingPreview ? 'fa-spinner fa-spin' : 'fa-rotate-right'} me-1.5 text-[10px]`} />
                        توليد معاينة جديدة
                    </button>
                </div>
            )}
        </div>
    );
};

const AudienceTabContent: React.FC<{
    profile: BrandHubProfile;
    brandId: string;
    addNotification: (type: NotificationType, message: string) => void;
}> = ({ profile, brandId, addNotification }) => {
    const [personas, setPersonas] = useState(profile.brandAudiences);
    const [editing, setEditing] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState<{ personaName: string; description: string; keyEmotions: string; painPoints: string }>({
        personaName: '', description: '', keyEmotions: '', painPoints: '',
    });

    const persistAudiences = async (updated: BrandHubProfile['brandAudiences']) => {
        setIsSaving(true);
        try {
            await updateBrandProfile(brandId, { brandAudiences: updated });
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
        setForm({ personaName: p.personaName, description: p.description, keyEmotions: p.keyEmotions.join(', '), painPoints: p.painPoints.join(', ') });
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
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">الجمهور المستهدف</h2>
                    <p className="text-xs text-dark-text-secondary mt-0.5">شخصيات العملاء المثاليين — يستخدمها الـ AI لتخصيص الردود والمحتوى</p>
                </div>
                <div className="flex items-center gap-2">
                    {isSaving && <i className="fas fa-circle-notch fa-spin text-brand-pink text-xs" />}
                    <button onClick={openNew}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-pink to-brand-purple text-white rounded-xl text-sm font-semibold hover:opacity-90 transition">
                        <i className="fas fa-plus text-xs" /> شخصية جديدة
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {personas.map((aud, i) => (
                    <div key={i} className="bg-dark-bg border border-dark-border rounded-2xl p-5 space-y-3 hover:border-brand-pink/40 transition-all group">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-pink to-brand-purple flex items-center justify-center text-white font-black text-lg shrink-0">
                                {aud.personaName.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-white truncate">{aud.personaName}</p>
                                <p className="text-[10px] text-dark-text-secondary mt-0.5">
                                    {aud.keyEmotions.length} مشاعر • {aud.painPoints.length} نقاط ألم
                                </p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEdit(i)} className="w-7 h-7 rounded-lg bg-dark-card flex items-center justify-center text-dark-text-secondary hover:text-white transition">
                                    <i className="fas fa-pen text-[10px]" />
                                </button>
                                <button onClick={() => deletePersona(i)} className="w-7 h-7 rounded-lg bg-dark-card flex items-center justify-center text-dark-text-secondary hover:text-red-400 transition">
                                    <i className="fas fa-trash text-[10px]" />
                                </button>
                            </div>
                        </div>
                        <p className="text-sm text-dark-text-secondary leading-relaxed line-clamp-2">{aud.description}</p>
                        {aud.keyEmotions.length > 0 && (
                            <div>
                                <p className="text-[10px] font-bold text-brand-pink uppercase tracking-wide mb-1.5">المشاعر الرئيسية</p>
                                <div className="flex flex-wrap gap-1">
                                    {aud.keyEmotions.map((e, j) => (
                                        <span key={j} className="text-xs px-2 py-0.5 bg-brand-pink/10 text-brand-pink rounded-full border border-brand-pink/20">{e}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {aud.painPoints.length > 0 && (
                            <div>
                                <p className="text-[10px] font-bold text-brand-secondary uppercase tracking-wide mb-1.5">نقاط الألم</p>
                                <div className="flex flex-wrap gap-1">
                                    {aud.painPoints.map((p, j) => (
                                        <span key={j} className="text-xs px-2 py-0.5 bg-brand-purple/10 text-brand-secondary rounded-full border border-brand-purple/20">{p}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {personas.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-14 gap-3 text-dark-text-secondary">
                        <div className="w-16 h-16 rounded-2xl bg-dark-bg border border-dark-border flex items-center justify-center">
                            <i className="fas fa-users text-2xl opacity-30" />
                        </div>
                        <p className="text-sm font-medium">لا توجد شخصيات جمهور بعد</p>
                        <p className="text-xs opacity-60">أضف أولى شخصيات عملائك المثاليين</p>
                        <button onClick={openNew}
                            className="mt-1 flex items-center gap-2 px-4 py-2 bg-brand-pink/10 text-brand-pink border border-brand-pink/20 rounded-xl text-sm font-semibold hover:bg-brand-pink/20 transition">
                            <i className="fas fa-plus text-xs" /> إضافة شخصية
                        </button>
                    </div>
                )}
            </div>

            {editing !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-dark-card border border-dark-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-white text-lg">{editing === -1 ? 'شخصية جديدة' : 'تعديل الشخصية'}</h3>
                            <button onClick={() => setEditing(null)} className="text-dark-text-secondary hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-dark-bg">
                                <i className="fas fa-times text-sm" />
                            </button>
                        </div>
                        <input value={form.personaName} onChange={e => setForm(f => ({ ...f, personaName: e.target.value }))}
                            placeholder="اسم الشخصية — مثال: سارة رائدة الأعمال"
                            className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-pink/40 focus:border-brand-pink/50" />
                        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            rows={3} placeholder="وصف مختصر: من هم؟ ماذا يريدون؟ أين يعيشون؟"
                            className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-pink/40 focus:border-brand-pink/50 resize-none" />
                        <div>
                            <label className="text-xs font-semibold text-dark-text-secondary mb-1 block">المشاعر الرئيسية (مفصولة بفواصل)</label>
                            <input value={form.keyEmotions} onChange={e => setForm(f => ({ ...f, keyEmotions: e.target.value }))}
                                placeholder="مثال: طموح، قلق، متحمس"
                                className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-pink/40 focus:border-brand-pink/50" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-dark-text-secondary mb-1 block">نقاط الألم (مفصولة بفواصل)</label>
                            <input value={form.painPoints} onChange={e => setForm(f => ({ ...f, painPoints: e.target.value }))}
                                placeholder="مثال: ضيق الوقت، صعوبة التسويق، ارتفاع التكاليف"
                                className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-pink/40 focus:border-brand-pink/50" />
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button onClick={savePersona} disabled={!form.personaName || isSaving}
                                className="flex-1 py-2.5 bg-gradient-to-r from-brand-pink to-brand-purple text-white rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
                                {isSaving ? <><i className="fas fa-circle-notch fa-spin text-xs" /> يحفظ...</> : 'حفظ الشخصية'}
                            </button>
                            <button onClick={() => setEditing(null)} className="px-4 py-2.5 border border-dark-border rounded-xl text-sm text-dark-text-secondary hover:bg-dark-bg transition">
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const BrandHubPage: React.FC<BrandHubPageProps> = ({ brandId, initialProfile, onUpdate, addNotification, onNavigate }) => {
    const [profile, setProfile] = useState(initialProfile);
    const [activeTab, setActiveTab] = useState<ActiveTab>('identity');
    const [showOnboarding, setShowOnboarding] = useState(false);

    // Strategy field input state (identity tab tag inputs)
    const [newValueInput, setNewValueInput] = useState('');
    const [newPillarInput, setNewPillarInput] = useState('');

    // AI Memory State
    const [contentToEvaluate, setContentToEvaluate] = useState('');
    const [evaluationResult, setEvaluationResult] = useState<BrandConsistencyEvaluation | null>(null);
    const [isEvaluating, setIsEvaluating] = useState(false);

    // Learning Library State
    const [documents, setDocuments] = useState<BrandDocument[]>([]);
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    const loadDocuments = useCallback(async () => {
        if (!brandId) return;
        setIsLoadingDocs(true);
        try {
            const docs = await getBrandDocuments(brandId);
            setDocuments(docs);
        } catch {
            // silent
        } finally {
            setIsLoadingDocs(false);
        }
    }, [brandId]);

    const refreshBrandHubData = useCallback(async () => {
        if (!brandId) return;

        const refreshed = await getBrandHubProfile(
            brandId,
            profile.brandName || initialProfile.brandName || 'Brand',
        );
        setProfile(refreshed);
        onUpdate(refreshed);
        await loadDocuments();
    }, [brandId, initialProfile.brandName, loadDocuments, onUpdate, profile.brandName]);

    useEffect(() => {
        if (activeTab === 'documents') loadDocuments();
    }, [activeTab, loadDocuments]);

    const handleDeleteDocument = async (docId: string) => {
        try {
            await deleteBrandDocument(brandId, docId);
            setDocuments(prev => prev.filter(d => d.id !== docId));
            addNotification(NotificationType.Success, 'تم حذف الوثيقة');
        } catch {
            addNotification(NotificationType.Error, 'فشل الحذف');
        }
    };

    // Skills Performance State
    const [skillsReport, setSkillsReport] = useState<Record<string, SkillStats>>({});
    const [isLoadingStats, setIsLoadingStats] = useState(false);
    const [statsDays, setStatsDays] = useState(30);

    // Intelligence Tab State
    const [intellData, setIntellData] = useState({ loading: false, knowledgeCount: 0, knowledgeByType: {} as Record<string, number>, socialCount: 0, docCount: 0 });

    // AI Memory Review State (P1-05)
    const [memoryEntries, setMemoryEntries] = useState<BrandMemoryEntry[]>([]);
    const [isLoadingMemory, setIsLoadingMemory] = useState(false);
    const [memoryFilter, setMemoryFilter] = useState<MemoryType | 'all'>('all');

    const loadSkillStats = useCallback(async (days: number) => {
        if (!brandId) return;
        setIsLoadingStats(true);
        try {
            const report = await getBrandSkillsReport(brandId, days);
            setSkillsReport(report);
        } catch (err) {
            console.warn('[BrandHub] skills report error:', err);
        } finally {
            setIsLoadingStats(false);
        }
    }, [brandId]);

    useEffect(() => {
        if (activeTab === 'ai-memory') loadSkillStats(statsDays);
    }, [activeTab, statsDays, loadSkillStats]);

    useEffect(() => {
        if (activeTab !== 'intelligence') return;
        setIntellData(prev => ({ ...prev, loading: true }));
        Promise.all([
            getBrandKnowledge(brandId),
            getSocialAccounts(brandId),
            getBrandDocuments(brandId),
        ]).then(([knowledge, accounts, docs]) => {
            const kByType = knowledge.reduce((acc, k) => { acc[k.type] = (acc[k.type] || 0) + 1; return acc; }, {} as Record<string, number>);
            setIntellData({
                loading: false,
                knowledgeCount: knowledge.length,
                knowledgeByType: kByType,
                socialCount: accounts.length,
                docCount: docs.length,
            });
        }).catch(() => setIntellData(prev => ({ ...prev, loading: false })));
    }, [activeTab, brandId]);

    const loadMemoryEntries = useCallback(async () => {
        setIsLoadingMemory(true);
        try {
            const entries = await getMemoryEntries(brandId);
            setMemoryEntries(entries);
        } catch { /* silent */ }
        finally { setIsLoadingMemory(false); }
    }, [brandId]);

    useEffect(() => {
        if (activeTab === 'ai-memory') loadMemoryEntries();
    }, [activeTab, loadMemoryEntries]);

    // Brand Assets State — initialized from profile, synced on profile change
    const [brandAssets, setBrandAssets] = useState({
        logoUrl: '',
        logoPreview: '',
        primaryColor: initialProfile.brandAssets?.primaryColor ?? '#6366F1',
        secondaryColor: initialProfile.brandAssets?.secondaryColor ?? '#EC4899',
        accentColor: initialProfile.brandAssets?.accentColor ?? '#F59E0B',
        fontPrimary: initialProfile.brandAssets?.fontPrimary ?? 'Cairo',
        fontSecondary: initialProfile.brandAssets?.fontSecondary ?? 'Inter',
        extraColors: [] as string[],
    });
    const [isSavingAssets, setIsSavingAssets] = useState(false);
    const [isSavingIdentity, setIsSavingIdentity] = useState(false);
    const [expandedCat, setExpandedCat] = useState<string | null>(null);

    const handleSaveIdentity = async () => {
        setIsSavingIdentity(true);
        try {
            await updateBrandProfile(brandId, profile);
            onUpdate(profile);
            addNotification(NotificationType.Success, '✅ تم حفظ هوية البراند بنجاح');
        } catch {
            addNotification(NotificationType.Error, 'تعذّر الحفظ — حاول مرة أخرى');
        } finally {
            setIsSavingIdentity(false);
        }
    };

    const saveAssets = async () => {
        setIsSavingAssets(true);
        try {
            await updateBrandProfile(brandId, {
                brandAssets: {
                    primaryColor: brandAssets.primaryColor,
                    secondaryColor: brandAssets.secondaryColor,
                    accentColor: brandAssets.accentColor,
                    fontPrimary: brandAssets.fontPrimary,
                    fontSecondary: brandAssets.fontSecondary,
                },
            });
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
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
            setBrandAssets(prev => ({ ...prev, logoPreview: result, logoUrl: result }));
            addNotification(NotificationType.Success, '✅ تم رفع الشعار بنجاح');
        };
        reader.readAsDataURL(file);
    };

    useEffect(() => {
        setProfile(initialProfile);
        // Sync brand assets from profile on load / brand switch
        if (initialProfile.brandAssets) {
            setBrandAssets(prev => ({
                ...prev,
                primaryColor: initialProfile.brandAssets!.primaryColor,
                secondaryColor: initialProfile.brandAssets!.secondaryColor,
                accentColor: initialProfile.brandAssets!.accentColor,
                fontPrimary: initialProfile.brandAssets!.fontPrimary,
                fontSecondary: initialProfile.brandAssets!.fontSecondary,
            }));
        }
        // Check if the profile is "empty" to trigger onboarding
        if (!initialProfile.industry && initialProfile.brandAudiences.length === 0) {
            setShowOnboarding(true);
        }
    }, [initialProfile]);
    
    const handleAIOnboarding = (partialProfile: Partial<BrandHubProfile>) => {
        // Deep merge the partial profile into the existing empty one
        const newProfile: BrandHubProfile = {
            ...profile,
            ...partialProfile,
            brandVoice: {
                ...profile.brandVoice,
                ...partialProfile.brandVoice,
            },
            brandAudiences: partialProfile.brandAudiences || profile.brandAudiences,
        };
        setProfile(newProfile);
        onUpdate(newProfile);
        addNotification(NotificationType.Success, "تم إنشاء هوية البراند الأولية بنجاح!");
    };
    
    const handleEvaluateContent = async () => {
        if (!contentToEvaluate.trim()) return;
        setIsEvaluating(true);
        setEvaluationResult(null);
        try {
            const result = await evaluateContentConsistency(contentToEvaluate, profile);
            setEvaluationResult(result);
        } catch (error) {
            addNotification(NotificationType.Error, "فشل في تقييم المحتوى.");
        } finally {
            setIsEvaluating(false);
        }
    };


    return (
        <div className="space-y-6">
             {showOnboarding && <AIOnboardingModal brandName={profile.brandName} onClose={() => setShowOnboarding(false)} onGenerate={handleAIOnboarding} />}

            <div className="flex justify-between items-center flex-wrap gap-3">
                <h1 className="text-3xl font-bold text-white">مركز البراند</h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            const data = {
                                brand: profile.brandName,
                                exportedAt: new Date().toISOString(),
                                identity: {
                                    industry: profile.industry,
                                    description: (profile as any).description,
                                    values: profile.values,
                                    keySellingPoints: profile.keySellingPoints,
                                },
                                voice: {
                                    tone: profile.brandVoice.toneDescription,
                                    keywords: profile.brandVoice.keywords,
                                    negativeKeywords: profile.brandVoice.negativeKeywords,
                                    guidelines: profile.brandVoice.voiceGuidelines,
                                },
                                audiences: profile.brandAudiences,
                                consistencyScore: profile.consistencyScore,
                            };
                            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${profile.brandName.replace(/\s+/g, '_')}_brand_profile.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                            addNotification(NotificationType.Success, 'تم تصدير ملف البراند.');
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-dark-border px-3 py-2 text-xs font-semibold text-dark-text-secondary transition-colors hover:text-white hover:border-dark-border/80"
                    >
                        <i className="fas fa-download text-[10px]" />
                        تصدير
                    </button>
                    <button
                        onClick={handleSaveIdentity}
                        disabled={isSavingIdentity}
                        className="flex items-center gap-2 bg-brand-primary text-white font-bold py-2 px-5 rounded-lg hover:bg-brand-secondary disabled:opacity-60 transition-opacity"
                    >
                        {isSavingIdentity
                            ? <><i className="fas fa-spinner fa-spin text-xs" /> جارٍ الحفظ...</>
                            : 'حفظ التغييرات'
                        }
                    </button>
                </div>
            </div>
            <p className="text-dark-text-secondary">
                هذا هو مصدر الحقيقة للذكاء الاصطناعي. حافظ على تحديثه لضمان أفضل النتائج.
            </p>

            {/* ── Brand Readiness Bar ─────────────────────────────── */}
            {(() => {
                const checks = [
                    !!profile.brandName,
                    !!profile.industry,
                    !!profile.description,
                    (profile.values?.length ?? 0) > 0,
                    (profile.brandVoice.toneDescription?.length ?? 0) > 0,
                    (profile.brandVoice.voiceGuidelines?.dos?.length ?? 0) > 0,
                    (profile.brandAudiences?.length ?? 0) > 0,
                    !!profile.valueProp,
                    !!profile.brandPromise,
                    !!profile.businessModel,
                ];
                const filled = checks.filter(Boolean).length;
                const pct = Math.round((filled / checks.length) * 100);
                const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400';
                const label = pct >= 80 ? 'جاهز للنشر' : pct >= 50 ? 'يحتاج إكمال' : 'ابدأ بملء البيانات';
                return (
                    <div className="flex items-center gap-3 rounded-xl bg-dark-bg border border-dark-border px-4 py-3">
                        <i className="fas fa-gauge-high text-xs text-dark-text-secondary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-semibold text-dark-text-secondary">جاهزية البراند</span>
                                <span className={`text-[10px] font-bold ${pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                                    {pct}% — {label}
                                </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-dark-card overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
                            </div>
                        </div>
                        <button
                            onClick={() => setActiveTab('intelligence')}
                            className="text-[10px] text-brand-primary hover:underline flex-shrink-0"
                        >
                            التفاصيل
                        </button>
                    </div>
                );
            })()}

            <div className="bg-dark-bg p-1 rounded-lg flex items-center gap-1 flex-wrap">
                {([
                    { id: 'identity',     label: 'الهوية',        icon: 'fa-building' },
                    { id: 'assets',       label: 'الأصول',        icon: 'fa-palette' },
                    { id: 'voice',        label: 'الصوت',         icon: 'fa-microphone' },
                    { id: 'audience',     label: 'الجمهور',       icon: 'fa-users' },
                    { id: 'documents',    label: 'مكتبة التعلم',  icon: 'fa-book-open' },
                    { id: 'intelligence', label: 'الذكاء',        icon: 'fa-lightbulb' },
                    { id: 'ai-memory',    label: 'ذاكرة AI',      icon: 'fa-brain' },
                ] as const).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 text-center py-2 px-3 rounded-md text-xs font-semibold transition-all
                            ${activeTab === tab.id
                                ? 'bg-gradient-to-r from-brand-pink to-brand-purple text-white shadow-md'
                                : 'text-dark-text-secondary hover:bg-dark-card hover:text-white'
                            }`}
                    >
                        <i className={`fas ${tab.icon} text-[10px]`}></i>
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                {activeTab === 'identity' && (
                    <div className="space-y-5">
                        {/* Header */}
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <h2 className="text-xl font-bold text-white">الهوية الأساسية</h2>
                            <div className="flex items-center gap-3 flex-wrap">
                                <button onClick={() => setShowOnboarding(true)}
                                    className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1">
                                    <i className="fas fa-magic text-xs" /> تحديث بالذكاء الاصطناعي
                                </button>
                                <span className="text-dark-border text-[10px]">|</span>
                                <button onClick={() => setShowImportModal(true)}
                                    className="text-xs font-semibold text-brand-pink hover:underline flex items-center gap-1">
                                    <i className="fas fa-file-import text-xs" /> استيراد من وثيقة
                                </button>
                            </div>
                        </div>

                        {showImportModal && (
                            <BrandImportModal
                                onClose={() => setShowImportModal(false)}
                                existingBrandId={brandId}
                                onImported={async () => {
                                    setShowImportModal(false);
                                    await refreshBrandHubData();
                                    addNotification(NotificationType.Success, 'تم تحديث بيانات البراند من الوثيقة');
                                }}
                            />
                        )}

                        {/* Name + Industry */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-dark-text-secondary mb-1.5 block">اسم البراند</label>
                                <p className="text-white font-semibold bg-dark-bg rounded-xl px-4 py-3 text-sm">{profile.brandName || '—'}</p>
                                <p className="text-[10px] text-dark-text-secondary mt-1">لتغيير الاسم، افتح إعدادات البراند</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-dark-text-secondary mb-1.5 block">الصناعة</label>
                                <select
                                    value={profile.industry}
                                    onChange={e => setProfile(prev => ({ ...prev, industry: e.target.value }))}
                                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-sm text-white focus:border-brand-primary focus:outline-none"
                                >
                                    <option value="">اختر الصناعة...</option>
                                    {INDUSTRY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="text-xs font-bold text-dark-text-secondary mb-1.5 block">وصف النشاط التجاري</label>
                            <textarea
                                value={profile.description ?? ''}
                                onChange={e => setProfile(prev => ({ ...prev, description: e.target.value }))}
                                rows={3}
                                placeholder="وصف موجز للنشاط التجاري ومميزاته..."
                                className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-sm text-white placeholder-dark-text-secondary focus:border-brand-primary focus:outline-none resize-none"
                            />
                        </div>

                        {/* Business Model + Language */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-dark-text-secondary mb-1.5 block">نموذج العمل</label>
                                <select
                                    value={profile.businessModel ?? ''}
                                    onChange={e => setProfile(prev => ({ ...prev, businessModel: (e.target.value || undefined) as typeof prev.businessModel }))}
                                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-sm text-white focus:border-brand-primary focus:outline-none"
                                >
                                    <option value="">اختر النموذج...</option>
                                    <option value="b2c">B2C — عملاء أفراد</option>
                                    <option value="b2b">B2B — شركات</option>
                                    <option value="ecommerce">تجارة إلكترونية</option>
                                    <option value="service">خدمات</option>
                                    <option value="local">محلي / فيزيائي</option>
                                    <option value="saas">SaaS / برمجيات</option>
                                    <option value="mixed">مختلط</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-dark-text-secondary mb-1.5 block">لغة التواصل</label>
                                <div className="flex gap-2 h-[46px]">
                                    {([
                                        { v: 'ar', label: 'العربية' },
                                        { v: 'en', label: 'الإنجليزية' },
                                        { v: 'both', label: 'الاثنتان' },
                                    ] as { v: BrandLanguage; label: string }[]).map(({ v, label }) => (
                                        <button
                                            key={v}
                                            onClick={() => setProfile(prev => ({ ...prev, language: v }))}
                                            className={`flex-1 rounded-xl text-xs font-semibold border transition-colors ${
                                                profile.language === v
                                                    ? 'bg-brand-primary border-brand-primary text-white'
                                                    : 'border-dark-border text-dark-text-secondary hover:border-brand-primary/50 hover:text-white'
                                            }`}
                                        >{label}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Goals */}
                        <div>
                            <label className="text-xs font-bold text-dark-text-secondary mb-2 block">أهداف البراند</label>
                            <div className="flex flex-wrap gap-2">
                                {([
                                    { v: 'awareness', label: 'توعية بالعلامة', icon: 'fa-bullhorn' },
                                    { v: 'leads',     label: 'عملاء محتملون', icon: 'fa-user-plus' },
                                    { v: 'sales',     label: 'زيادة المبيعات', icon: 'fa-shopping-bag' },
                                    { v: 'bookings',  label: 'حجوزات',          icon: 'fa-calendar-check' },
                                    { v: 'engagement',label: 'تفاعل المتابعين', icon: 'fa-heart' },
                                    { v: 'support',   label: 'دعم العملاء',    icon: 'fa-headset' },
                                    { v: 'recruitment',label: 'توظيف',          icon: 'fa-users' },
                                ] as { v: BrandGoal; label: string; icon: string }[]).map(({ v, label, icon }) => {
                                    const active = (profile.goals ?? []).includes(v);
                                    return (
                                        <button
                                            key={v}
                                            onClick={() => {
                                                const cur = profile.goals ?? [];
                                                setProfile(prev => ({
                                                    ...prev,
                                                    goals: active ? cur.filter(g => g !== v) : [...cur, v],
                                                }));
                                            }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                                active
                                                    ? 'bg-brand-primary border-brand-primary text-white'
                                                    : 'border-dark-border text-dark-text-secondary hover:border-brand-primary/50 hover:text-white'
                                            }`}
                                        >
                                            <i className={`fas ${icon} text-[10px]`} />
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Age Range + Audience Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs font-bold text-dark-text-secondary mb-1.5 block">الفئة العمرية</label>
                                <select
                                    value={profile.ageRange ?? ''}
                                    onChange={e => setProfile(prev => ({ ...prev, ageRange: e.target.value || undefined }))}
                                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-sm text-white focus:border-brand-primary focus:outline-none"
                                >
                                    <option value="">غير محدد</option>
                                    <option value="18-24">18–24</option>
                                    <option value="25-34">25–34</option>
                                    <option value="35-44">35–44</option>
                                    <option value="45-54">45–54</option>
                                    <option value="55+">55+</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-dark-text-secondary mb-1.5 block">ملخص الجمهور المستهدف</label>
                                <textarea
                                    value={profile.targetAudienceSummary ?? ''}
                                    onChange={e => setProfile(prev => ({ ...prev, targetAudienceSummary: e.target.value }))}
                                    rows={2}
                                    placeholder="مثال: أصحاب الأعمال الصغيرة في السعودية، 25-40 سنة..."
                                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-sm text-white placeholder-dark-text-secondary focus:border-brand-primary focus:outline-none resize-none"
                                />
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-dark-text-secondary mb-1.5 block">رقم الهاتف</label>
                                <input
                                    type="tel"
                                    value={profile.contactInfo?.phone ?? ''}
                                    onChange={e => setProfile(prev => ({ ...prev, contactInfo: { ...prev.contactInfo, phone: e.target.value } }))}
                                    placeholder="+966 5X XXX XXXX"
                                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-sm text-white placeholder-dark-text-secondary focus:border-brand-primary focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-dark-text-secondary mb-1.5 block">البريد الإلكتروني</label>
                                <input
                                    type="email"
                                    value={profile.contactInfo?.email ?? ''}
                                    onChange={e => setProfile(prev => ({ ...prev, contactInfo: { ...prev.contactInfo, email: e.target.value } }))}
                                    placeholder="contact@brand.com"
                                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-sm text-white placeholder-dark-text-secondary focus:border-brand-primary focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Values — now editable */}
                        <div>
                            <label className="text-xs font-bold text-dark-text-secondary mb-1.5 block">قيم البراند</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {(profile.values ?? []).map((v, i) => (
                                    <span key={i} className="flex items-center gap-1.5 text-xs bg-brand-primary/10 text-brand-primary px-3 py-1 rounded-full border border-brand-primary/20">
                                        {v}
                                        <button
                                            onClick={() => setProfile(prev => ({ ...prev, values: prev.values.filter((_, idx) => idx !== i) }))}
                                            className="opacity-50 hover:opacity-100 transition-opacity"
                                        >
                                            <i className="fas fa-times text-[8px]" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    value={newValueInput}
                                    onChange={e => setNewValueInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && newValueInput.trim()) {
                                            setProfile(prev => ({ ...prev, values: [...(prev.values ?? []), newValueInput.trim()] }));
                                            setNewValueInput('');
                                        }
                                    }}
                                    placeholder="اكتب قيمة واضغط Enter..."
                                    className="flex-1 bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder-dark-text-secondary focus:border-brand-primary focus:outline-none"
                                />
                                <button
                                    onClick={() => { if (newValueInput.trim()) { setProfile(prev => ({ ...prev, values: [...(prev.values ?? []), newValueInput.trim()] })); setNewValueInput(''); } }}
                                    className="px-3 py-2 bg-brand-primary/10 text-brand-primary rounded-xl text-xs hover:bg-brand-primary hover:text-white transition-colors"
                                >
                                    <i className="fas fa-plus text-[10px]" />
                                </button>
                            </div>
                        </div>

                        {/* ── Strategy Fields ──────────────────────────────────── */}
                        <div className="pt-4 border-t border-dark-border space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <i className="fas fa-chess text-brand-pink text-xs" />
                                <h3 className="text-sm font-bold text-white">الاستراتيجية التسويقية</h3>
                                <span className="text-[10px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full">يُحسّن جودة AI بشكل كبير</span>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-dark-text-secondary mb-1.5 block">
                                    عرض القيمة الفريدة (Value Proposition)
                                </label>
                                <textarea
                                    value={profile.valueProp ?? ''}
                                    onChange={e => setProfile(prev => ({ ...prev, valueProp: e.target.value }))}
                                    rows={2}
                                    placeholder='مثال: "نساعد أصحاب المطاعم الصغيرة على ملء طاولاتهم كل يوم بنظام حجز ذكي وتسويق آلي — بعكس المنافسين الذين يقدمون أدوات تقنية معقدة"'
                                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-sm text-white placeholder-dark-text-secondary focus:border-brand-primary focus:outline-none resize-none"
                                />
                                <p className="text-[10px] text-dark-text-secondary mt-1">يُستخدم في: عناوين الإعلانات، أول سطر في المحتوى، ردود المبيعات</p>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-dark-text-secondary mb-1.5 block">
                                    وعد البراند (Brand Promise)
                                </label>
                                <input
                                    type="text"
                                    value={profile.brandPromise ?? ''}
                                    onChange={e => setProfile(prev => ({ ...prev, brandPromise: e.target.value }))}
                                    placeholder='مثال: "نضمن لك نتيجة قابلة للقياس خلال 30 يوماً أو نُعيد لك المال"'
                                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-sm text-white placeholder-dark-text-secondary focus:border-brand-primary focus:outline-none"
                                />
                                <p className="text-[10px] text-dark-text-secondary mt-1">يُستخدم في: ردود الصندوق، كلوز الإعلانات، صفحات الهبوط</p>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-dark-text-secondary mb-1.5 block">
                                    ركائز الرسائل (Messaging Pillars)
                                </label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {(profile.messagingPillars ?? []).map((p, i) => (
                                        <span key={i} className="flex items-center gap-1.5 text-xs bg-violet-500/10 text-violet-400 px-3 py-1 rounded-full border border-violet-500/20">
                                            {p}
                                            <button
                                                onClick={() => setProfile(prev => ({ ...prev, messagingPillars: (prev.messagingPillars ?? []).filter((_, idx) => idx !== i) }))}
                                                className="opacity-50 hover:opacity-100"
                                            >
                                                <i className="fas fa-times text-[8px]" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        value={newPillarInput}
                                        onChange={e => setNewPillarInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && newPillarInput.trim()) {
                                                setProfile(prev => ({ ...prev, messagingPillars: [...(prev.messagingPillars ?? []), newPillarInput.trim()] }));
                                                setNewPillarInput('');
                                            }
                                        }}
                                        placeholder='مثال: "نتائج قابلة للقياس" أو "دعم 24/7" أو "بلا تعقيدات تقنية"'
                                        className="flex-1 bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder-dark-text-secondary focus:border-brand-primary focus:outline-none"
                                    />
                                    <button
                                        onClick={() => { if (newPillarInput.trim()) { setProfile(prev => ({ ...prev, messagingPillars: [...(prev.messagingPillars ?? []), newPillarInput.trim()] })); setNewPillarInput(''); } }}
                                        className="px-3 py-2 bg-violet-500/10 text-violet-400 rounded-xl text-xs hover:bg-violet-500 hover:text-white transition-colors"
                                    >
                                        <i className="fas fa-plus text-[10px]" />
                                    </button>
                                </div>
                                <p className="text-[10px] text-dark-text-secondary mt-1">أضف 3–5 ركائز — تُستخدم في خطط المحتوى وحملات الإعلانات</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── BRD-NEW: Brand Assets Tab ── */}
                {activeTab === 'assets' && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <i className="fas fa-palette text-brand-pink"></i>
                            أصول البراند البصرية
                        </h2>

                        {/* Logo Upload */}
                        <div>
                            <label className="text-sm font-bold text-dark-text-secondary mb-3 block">الشعار (Logo)</label>
                            <div className="flex items-center gap-4">
                                <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-dark-border bg-dark-bg flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {brandAssets.logoPreview ? (
                                        <img src={brandAssets.logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                                    ) : (
                                        <div className="text-center text-dark-text-secondary">
                                            <i className="fas fa-image text-2xl mb-1 block opacity-40"></i>
                                            <span className="text-[10px]">لا يوجد شعار</span>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold cursor-pointer hover:bg-brand-primary/90 transition-colors">
                                        <i className="fas fa-upload text-xs"></i>
                                        رفع الشعار
                                        <input type="file" accept="image/*,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
                                    </label>
                                    <p className="text-xs text-dark-text-secondary">PNG, SVG, JPG — حتى 5MB</p>
                                    {brandAssets.logoPreview && (
                                        <button onClick={() => setBrandAssets(prev => ({ ...prev, logoPreview: '', logoUrl: '' }))}
                                            className="text-xs text-red-400 hover:text-red-300">
                                            <i className="fas fa-trash me-1"></i>حذف الشعار
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Brand Colors */}
                        <div>
                            <label className="text-sm font-bold text-dark-text-secondary mb-3 block">ألوان البراند</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {[
                                    { key: 'primaryColor' as const,   label: 'اللون الأساسي' },
                                    { key: 'secondaryColor' as const, label: 'اللون الثانوي' },
                                    { key: 'accentColor' as const,    label: 'لون التمييز' },
                                ].map(({ key, label }) => (
                                    <div key={key} className="space-y-2">
                                        <p className="text-xs text-dark-text-secondary font-medium">{label}</p>
                                        <div className="flex items-center gap-2 bg-dark-bg border border-dark-border rounded-xl p-2">
                                            <div className="w-8 h-8 rounded-lg border border-dark-border overflow-hidden flex-shrink-0">
                                                <input
                                                    type="color"
                                                    value={brandAssets[key]}
                                                    onChange={e => setBrandAssets(prev => ({ ...prev, [key]: e.target.value }))}
                                                    className="w-10 h-10 -m-1 cursor-pointer border-0 bg-transparent"
                                                />
                                            </div>
                                            <span className="text-xs font-mono text-dark-text-secondary">{brandAssets[key]}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Color Preview */}
                            <div className="mt-3 flex items-center gap-2">
                                {[brandAssets.primaryColor, brandAssets.secondaryColor, brandAssets.accentColor].map((color, i) => (
                                    <div key={i} className="w-8 h-8 rounded-full border-2 border-dark-border shadow-lg transition-all"
                                        style={{ backgroundColor: color }}></div>
                                ))}
                                <span className="text-xs text-dark-text-secondary ms-2">معاينة الألوان</span>
                            </div>
                        </div>

                        {/* Fonts */}
                        <div>
                            <label className="text-sm font-bold text-dark-text-secondary mb-3 block">الخطوط (Typography)</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {[
                                    { key: 'fontPrimary' as const, label: 'الخط الأساسي', options: ['Cairo', 'Tajawal', 'Noto Kufi Arabic', 'Inter', 'Poppins', 'Roboto'] },
                                    { key: 'fontSecondary' as const, label: 'الخط الثانوي', options: ['Inter', 'Roboto', 'Cairo', 'Open Sans', 'Montserrat'] },
                                ].map(({ key, label, options }) => (
                                    <div key={key}>
                                        <p className="text-xs text-dark-text-secondary font-medium mb-1.5">{label}</p>
                                        <select
                                            value={brandAssets[key]}
                                            onChange={e => setBrandAssets(prev => ({ ...prev, [key]: e.target.value }))}
                                            className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                                        >
                                            {options.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                        <p className="mt-1.5 text-sm text-dark-text-secondary" style={{ fontFamily: brandAssets[key] }}>
                                            مثال: مرحباً بك في {profile.brandName}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={saveAssets}
                            disabled={isSavingAssets}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-brand-pink to-brand-purple text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
                        >
                            {isSavingAssets ? (
                                <><i className="fas fa-spinner fa-spin"></i> جارٍ الحفظ...</>
                            ) : (
                                <><i className="fas fa-save"></i> حفظ أصول البراند</>
                            )}
                        </button>
                    </div>
                )}
                {/* BRD-2: Voice Profile Visualizer */}
                {activeTab === 'voice' && (
                    <VoiceTabContent profile={profile} brandId={brandId} addNotification={addNotification} />
                )}
                {/* BRD-1: Buyer Personas Builder */}
                {activeTab === 'audience' && (
                    <AudienceTabContent profile={profile} brandId={brandId} addNotification={addNotification} />
                )}
                {/* ── Learning Library Tab ────────────────────────────────── */}
                {activeTab === 'documents' && (
                    <div className="space-y-5">
                        {showImportModal && activeTab === 'documents' && (
                            <BrandImportModal
                                onClose={() => setShowImportModal(false)}
                                existingBrandId={brandId}
                                onImported={async () => {
                                    setShowImportModal(false);
                                    await refreshBrandHubData();
                                    addNotification(NotificationType.Success, 'تم إضافة الوثائق إلى مكتبة التعلم');
                                }}
                            />
                        )}

                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <i className="fas fa-book-open text-brand-pink" />
                                    مكتبة التعلم
                                </h2>
                                <p className="text-dark-text-secondary text-sm mt-0.5">
                                    الوثائق التي تُغذّي ذكاء البراند — كلما أضفت أكثر، تعلّم أكثر
                                </p>
                            </div>
                            <button
                                onClick={() => setShowImportModal(true)}
                                className="flex items-center gap-2 bg-gradient-to-r from-brand-pink to-brand-purple text-white font-bold py-2 px-5 rounded-lg hover:opacity-90 text-sm"
                            >
                                <i className="fas fa-plus text-xs" />
                                إضافة وثائق جديدة
                            </button>
                        </div>

                        {isLoadingDocs ? (
                            <div className="flex justify-center py-12">
                                <div className="w-8 h-8 border-4 border-brand-pink border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : documents.length === 0 ? (
                            <div className="text-center py-14 space-y-4">
                                <div className="text-5xl">📚</div>
                                <p className="text-white font-semibold text-lg">لا توجد وثائق بعد</p>
                                <p className="text-dark-text-secondary text-sm max-w-sm mx-auto">
                                    ارفع كتاب البراند، وثائق المنتجات، أمثلة المحتوى — الـ AI سيتعلم منها كلها
                                </p>
                                <button
                                    onClick={() => setShowImportModal(true)}
                                    className="mx-auto flex items-center gap-2 bg-dark-bg border border-dashed border-brand-pink/40 text-brand-pink hover:border-brand-pink font-medium py-2.5 px-6 rounded-lg text-sm transition-colors"
                                >
                                    <i className="fas fa-file-import text-xs" />
                                    استيراد أول وثيقة
                                </button>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {documents.map(doc => {
                                    const completenessColor = doc.completenessScore >= 75 ? 'text-green-400' : doc.completenessScore >= 50 ? 'text-yellow-400' : 'text-orange-400';
                                    const typeLabel = DOC_TYPE_LABELS[doc.docType] ?? doc.docType;
                                    const date = new Date(doc.createdAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
                                    return (
                                        <div key={doc.id} className="bg-dark-bg rounded-xl border border-dark-border p-4 flex gap-4 items-start">
                                            <div className="text-3xl flex-shrink-0 mt-0.5">📄</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                                    <div>
                                                        <p className="font-semibold text-white text-sm">{doc.title}</p>
                                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                            <span className="text-[10px] bg-brand-pink/15 text-brand-pink px-2 py-0.5 rounded-full">{typeLabel}</span>
                                                            <span className="text-[10px] text-dark-text-secondary">{(doc.charCount / 1000).toFixed(1)}K حرف</span>
                                                            <span className="text-[10px] text-dark-text-secondary">{date}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteDocument(doc.id)}
                                                        className="text-dark-text-secondary hover:text-red-400 text-xs transition-colors flex-shrink-0"
                                                        title="حذف الوثيقة"
                                                    >
                                                        <i className="fas fa-trash-alt" />
                                                    </button>
                                                </div>

                                                {doc.extractedSummary && (
                                                    <p className="text-xs text-dark-text-secondary mt-2 leading-relaxed line-clamp-2">{doc.extractedSummary}</p>
                                                )}

                                                {(doc.fileName || doc.fileType || doc.analysisProvider || doc.analysisModel || doc.detectedLanguage) && (
                                                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                                                        {doc.fileName && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-dark-text-secondary border border-dark-border">
                                                                {doc.fileName}
                                                            </span>
                                                        )}
                                                        {doc.fileType && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-dark-text-secondary border border-dark-border">
                                                                {doc.fileType}
                                                            </span>
                                                        )}
                                                        {doc.analysisProvider && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-pink/10 text-brand-pink border border-brand-pink/20">
                                                                {doc.analysisProvider}
                                                            </span>
                                                        )}
                                                        {doc.analysisModel && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-secondary border border-brand-primary/20">
                                                                {doc.analysisModel}
                                                            </span>
                                                        )}
                                                        {doc.detectedLanguage && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                {doc.detectedLanguage}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-4 mt-3 flex-wrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`text-sm font-bold ${completenessColor}`}>{doc.completenessScore}%</span>
                                                        <span className="text-[10px] text-dark-text-secondary">اكتمال</span>
                                                    </div>
                                                    {doc.knowledgeEntriesSaved > 0 && (
                                                        <button onClick={() => onNavigate?.('brand-knowledge')} className="flex items-center gap-1 text-[10px] text-blue-400 hover:underline">
                                                            <i className="fas fa-database text-[8px]" />
                                                            {doc.knowledgeEntriesSaved} معرفة
                                                        </button>
                                                    )}
                                                    {doc.memoryEntriesSaved > 0 && (
                                                        <button onClick={() => setActiveTab('ai-memory')} className="flex items-center gap-1 text-[10px] text-purple-400 hover:underline">
                                                            <i className="fas fa-brain text-[8px]" />
                                                            {doc.memoryEntriesSaved} ذاكرة AI
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {documents.length > 0 && (
                            <div className="p-3 bg-dark-bg rounded-xl border border-dark-border text-xs text-dark-text-secondary text-center">
                                {documents.length} وثيقة •{' '}
                                {documents.reduce((s, d) => s + d.knowledgeEntriesSaved, 0)} إدخال معرفة •{' '}
                                {documents.reduce((s, d) => s + d.memoryEntriesSaved, 0)} مثال في الذاكرة
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'intelligence' && (() => {
                    // ── Field-level checks ─────────────────────────────────────
                    type HubTab = 'identity' | 'voice' | 'audience';
                    type FieldItem = { label: string; done: boolean; pts: number; fix?: string; tab?: HubTab; route?: string };

                    const identityFields: FieldItem[] = [
                        { label: 'اسم البراند',        done: !!profile.brandName,                                       pts: 4, fix: 'أضف اسم البراند',    tab: 'identity' },
                        { label: 'المجال / القطاع',     done: !!profile.industry,                                        pts: 4, fix: 'حدّد المجال',         tab: 'identity' },
                        { label: 'وصف البراند',         done: !!profile.description,                                     pts: 4, fix: 'اكتب وصف البراند',   tab: 'identity' },
                        { label: 'القيم الجوهرية',      done: (profile.values?.length ?? 0) > 0,                        pts: 4, fix: 'أضف قيم البراند',    tab: 'identity' },
                        { label: 'الدولة / السوق',      done: !!profile.country,                                         pts: 4, fix: 'حدّد الدولة',         tab: 'identity' },
                        { label: 'الموقع الإلكتروني',   done: !!profile.website,                                         pts: 4, fix: 'أضف رابط الموقع',   tab: 'identity' },
                        { label: 'عرض القيمة',          done: !!profile.valueProp,                                       pts: 3, fix: 'اكتب عرض القيمة',   tab: 'identity' },
                        { label: 'وعد البراند',         done: !!profile.brandPromise,                                    pts: 3, fix: 'اكتب وعد البراند',   tab: 'identity' },
                    ];
                    const identityPts = identityFields.filter(f => f.done).reduce((s, f) => s + f.pts, 0);

                    const voiceFields: FieldItem[] = [
                        { label: 'وصف النبرة',     done: (profile.brandVoice.toneDescription?.length ?? 0) > 0, pts: 5, fix: 'أضف وصف النبرة',       tab: 'voice' },
                        { label: 'الكلمات المفتاحية', done: (profile.brandVoice.keywords?.length ?? 0) > 0,          pts: 5, fix: 'أضف كلمات مفتاحية',   tab: 'voice' },
                        { label: 'كلمات يُتجنّب',  done: (profile.brandVoice.negativeKeywords?.length ?? 0) > 0,   pts: 5, fix: 'أضف كلمات محظورة',    tab: 'voice' },
                        { label: 'إرشادات الصوت',   done: (profile.brandVoice.voiceGuidelines?.dos?.length ?? 0) > 0, pts: 5, fix: 'أضف إرشادات الصوت', tab: 'voice' },
                    ];
                    const voicePts = voiceFields.filter(f => f.done).reduce((s, f) => s + f.pts, 0);

                    const aud = profile.brandAudiences ?? [];
                    const audienceFields: FieldItem[] = [
                        { label: 'شخصية جمهور واحدة على الأقل', done: aud.length >= 1,                             pts: 10, fix: 'أنشئ شخصية الجمهور',    tab: 'audience' },
                        { label: 'شخصيتان مختلفتان',            done: aud.length >= 2,                             pts: 5,  fix: 'أضف شخصية ثانية',       tab: 'audience' },
                        { label: 'نقاط الألم محدّدة',            done: (aud[0]?.painPoints?.length ?? 0) > 0,      pts: 5,  fix: 'أضف نقاط الألم للجمهور', tab: 'audience' },
                    ];
                    const audiencePts = Math.min(audienceFields.filter(f => f.done).reduce((s, f) => s + f.pts, 0), 20);

                    const kc = intellData.knowledgeCount;
                    const knowledgeFields: FieldItem[] = [
                        { label: '3 عناصر معرفة على الأقل',   done: kc >= 3,  pts: 5,  fix: 'أضف منتجات أو خدمات', route: 'brand-knowledge' },
                        { label: '6 عناصر معرفة على الأقل',   done: kc >= 6,  pts: 5,  fix: 'أضف المزيد من المحتوى', route: 'brand-knowledge' },
                        { label: '9 عناصر معرفة على الأقل',   done: kc >= 9,  pts: 5,  fix: 'أضف وثائق وسيناريوهات', route: 'brand-knowledge' },
                        { label: '12 عنصر معرفة على الأقل',   done: kc >= 12, pts: 5,  fix: 'أكمل قاعدة المعرفة',    route: 'brand-knowledge' },
                    ];
                    const knowledgePts = Math.min(knowledgeFields.filter(f => f.done).reduce((s, f) => s + f.pts, 0), 20);

                    const connFields: FieldItem[] = [
                        { label: 'حساب تواصل اجتماعي واحد على الأقل', done: intellData.socialCount > 0, pts: 10, fix: 'اربط حسابات التواصل', route: 'social-ops/accounts' },
                    ];
                    const connectionsPts = connFields.filter(f => f.done).reduce((s, f) => s + f.pts, 0);

                    const totalScore = identityPts + voicePts + audiencePts + knowledgePts + connectionsPts;

                    // ── AI confidence per capability ───────────────────────────
                    const contentConf   = Math.round(((identityPts / 30 + voicePts / 20) / 2) * 100);
                    const repliesConf   = Math.round(((audiencePts / 20 + knowledgePts / 20) / 2) * 100);
                    const adsConf       = Math.round(((identityPts / 30 + voicePts / 20 + audiencePts / 20) / 3) * 100);
                    const analyticsConf = connectionsPts > 0 ? Math.round(((connectionsPts / 10 + identityPts / 30) / 2) * 100) : 0;

                    // ── Missing fields that need fixing (top priority first) ───
                    const missingByTab: FieldItem[] = [
                        ...identityFields, ...voiceFields, ...audienceFields,
                        ...knowledgeFields, ...connFields,
                    ].filter(f => !f.done && f.fix);

                    const scoreColor     = totalScore >= 80 ? '#10B981' : totalScore >= 50 ? '#F59E0B' : '#EF4444';
                    const scoreTextColor = totalScore >= 80 ? 'text-emerald-400' : totalScore >= 50 ? 'text-yellow-400' : 'text-red-400';
                    const circ = 2 * Math.PI * 40;

                    const CategoryBreakdown = ({ fields, color }: { fields: FieldItem[]; color: string }) => (
                        <div className="mt-2 space-y-1 pl-1">
                            {fields.map(f => (
                                <div key={f.label} className="flex items-center gap-2">
                                    <i className={`fas fa-${f.done ? 'circle-check' : 'circle-xmark'} text-[11px] flex-shrink-0 ${f.done ? 'text-emerald-400' : 'text-red-400/70'}`}></i>
                                    <span className={`text-[10px] flex-1 ${f.done ? 'text-dark-text-secondary line-through' : 'text-white/80'}`}>{f.label}</span>
                                    {!f.done && (f.tab || f.route) && (
                                        <button
                                            onClick={() => f.tab ? setActiveTab(f.tab!) : (f.route && onNavigate) ? onNavigate(f.route!) : undefined}
                                            className="text-[9px] px-1.5 py-0.5 rounded-md bg-brand-primary/20 text-brand-primary hover:bg-brand-primary hover:text-white transition-colors whitespace-nowrap"
                                        >
                                            إصلاح
                                        </button>
                                    )}
                                    <span className="text-[9px] text-dark-text-secondary flex-shrink-0">+{f.pts}</span>
                                </div>
                            ))}
                        </div>
                    );

                    const categories = [
                        { label: 'الهوية',    pts: identityPts,    max: 30, color: 'bg-blue-500',    fields: identityFields },
                        { label: 'الصوت',     pts: voicePts,       max: 20, color: 'bg-purple-500',  fields: voiceFields },
                        { label: 'الجمهور',   pts: audiencePts,    max: 20, color: 'bg-pink-500',    fields: audienceFields },
                        { label: 'المعرفة',   pts: knowledgePts,   max: 20, color: 'bg-emerald-500', fields: knowledgeFields },
                        { label: 'الاتصالات', pts: connectionsPts, max: 10, color: 'bg-amber-500',   fields: connFields },
                    ];

                    return (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <i className="fas fa-lightbulb text-brand-pink"></i>
                                ذكاء البراند
                            </h2>

                            {intellData.loading ? (
                                <div className="text-center py-12 text-dark-text-secondary">
                                    <i className="fas fa-spinner fa-spin text-2xl"></i>
                                    <p className="mt-2 text-sm">جاري تحليل بيانات البراند...</p>
                                </div>
                            ) : (
                                <>
                                    {/* ── Score ring + expandable category bars ── */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Ring */}
                                        <div className="bg-dark-bg rounded-2xl p-6 flex flex-col items-center">
                                            <p className="text-sm font-bold text-dark-text-secondary mb-4">درجة الاكتمال الإجمالية</p>
                                            <div className="relative w-40 h-40">
                                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                                    <circle className="text-dark-card" cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="12" />
                                                    <circle
                                                        cx="50" cy="50" r="40" fill="none"
                                                        stroke={scoreColor}
                                                        strokeWidth="12"
                                                        strokeDasharray={`${circ} ${circ}`}
                                                        strokeDashoffset={circ * (1 - totalScore / 100)}
                                                        strokeLinecap="round"
                                                        style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                                                    />
                                                </svg>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                    <span className={`text-4xl font-black ${scoreTextColor}`}>{totalScore}</span>
                                                    <span className="text-xs text-dark-text-secondary">من 100</span>
                                                </div>
                                            </div>
                                            <p className="mt-3 text-xs text-center text-dark-text-secondary">
                                                {totalScore >= 80 ? 'الذكاء الاصطناعي يعمل بكفاءة عالية'
                                                    : totalScore >= 50 ? 'بيانات كافية — يمكن تحسينها'
                                                    : 'البيانات غير كاملة — النتائج محدودة'}
                                            </p>
                                            <button
                                                onClick={() => onNavigate && onNavigate('brand-analysis')}
                                                className="mt-4 flex items-center gap-2 rounded-xl bg-brand-primary/10 px-4 py-2 text-xs font-bold text-brand-primary transition-colors hover:bg-brand-primary hover:text-white"
                                            >
                                                <i className="fas fa-magnifying-glass-plus" /> تدقيق شامل للبراند
                                            </button>
                                        </div>

                                        {/* Expandable category bars */}
                                        <div className="bg-dark-bg rounded-2xl p-6 space-y-3">
                                            <p className="text-sm font-bold text-dark-text-secondary mb-1">توزيع النقاط — اضغط للتفاصيل</p>
                                            {categories.map(cat => {
                                                const isOpen = expandedCat === cat.label;
                                                const pct = Math.round((cat.pts / cat.max) * 100);
                                                const missing = cat.fields.filter(f => !f.done).length;
                                                return (
                                                    <div key={cat.label}>
                                                        <button
                                                            className="w-full text-right"
                                                            onClick={() => setExpandedCat(isOpen ? null : cat.label)}
                                                        >
                                                            <div className="flex items-center justify-between mb-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-xs text-white font-medium">{cat.label}</span>
                                                                    {missing > 0 && (
                                                                        <span className="text-[9px] px-1 py-0.5 rounded-full bg-red-500/20 text-red-400">{missing} ناقص</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-xs text-dark-text-secondary">{cat.pts}/{cat.max}</span>
                                                                    <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} text-[9px] text-dark-text-secondary`}></i>
                                                                </div>
                                                            </div>
                                                            <div className="h-2 bg-dark-card rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full ${cat.color} rounded-full transition-all duration-700`}
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                        </button>
                                                        {isOpen && <CategoryBreakdown fields={cat.fields} color={cat.color} />}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* ── AI Confidence cards with causality ── */}
                                    <div className="bg-dark-bg rounded-2xl p-6">
                                        <p className="text-sm font-bold text-dark-text-secondary mb-4">مستوى ثقة الذكاء الاصطناعي</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            {([
                                                {
                                                    label: 'توليد المحتوى',   value: contentConf,   icon: 'fa-pen-nib',      color: 'bg-blue-500',
                                                    missing: [...identityFields, ...voiceFields].filter(f => !f.done).map(f => f.label),
                                                },
                                                {
                                                    label: 'الردود الذكية',   value: repliesConf,   icon: 'fa-comment-dots', color: 'bg-purple-500',
                                                    missing: [...audienceFields, ...knowledgeFields].filter(f => !f.done).map(f => f.label),
                                                },
                                                {
                                                    label: 'كتابة الإعلانات', value: adsConf,        icon: 'fa-bullhorn',     color: 'bg-pink-500',
                                                    missing: [...identityFields, ...voiceFields, ...audienceFields].filter(f => !f.done).map(f => f.label),
                                                },
                                                {
                                                    label: 'تحليل البيانات',  value: analyticsConf, icon: 'fa-chart-line',   color: 'bg-emerald-500',
                                                    missing: connFields.filter(f => !f.done).map(f => f.label),
                                                },
                                            ] as const).map(item => (
                                                <div key={item.label} className="bg-dark-card rounded-xl p-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <i className={`fas ${item.icon} text-xs text-dark-text-secondary`}></i>
                                                        <span className="text-xs text-white font-medium">{item.label}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="flex-1 h-2 bg-dark-bg rounded-full overflow-hidden">
                                                            <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }} />
                                                        </div>
                                                        <span className={`text-xs font-bold ${item.value >= 70 ? 'text-emerald-400' : item.value >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                            {item.value}%
                                                        </span>
                                                    </div>
                                                    {item.missing.length > 0 && (
                                                        <p className="text-[9px] text-red-400/80 leading-relaxed">
                                                            ينقصه: {item.missing.slice(0, 2).join('، ')}{item.missing.length > 2 ? ` +${item.missing.length - 2}` : ''}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ── Priority fix list ── */}
                                    {missingByTab.length > 0 && (
                                        <div className="bg-dark-bg rounded-2xl p-6">
                                            <p className="text-sm font-bold text-dark-text-secondary mb-4">
                                                خطة التحسين — {missingByTab.length} عنصر ناقص
                                            </p>
                                            <div className="space-y-2">
                                                {missingByTab.slice(0, 6).map((f, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => f.tab ? setActiveTab(f.tab!) : (f.route && onNavigate) ? onNavigate(f.route!) : undefined}
                                                        disabled={!f.tab && !f.route}
                                                        className="w-full text-right flex items-center gap-3 bg-dark-card rounded-xl px-3 py-2.5 hover:bg-brand-primary/10 transition-colors disabled:opacity-50"
                                                    >
                                                        <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                                            <span className="text-[10px] font-black text-red-400">+{f.pts}</span>
                                                        </div>
                                                        <span className="text-xs text-white flex-1">{f.fix ?? f.label}</span>
                                                        <i className="fas fa-arrow-left text-[10px] text-dark-text-secondary"></i>
                                                    </button>
                                                ))}
                                                {missingByTab.length > 6 && (
                                                    <p className="text-[10px] text-dark-text-secondary text-center pt-1">
                                                        و {missingByTab.length - 6} عنصر آخر...
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Data Sources ── */}
                                    <div className="bg-dark-bg rounded-2xl p-6">
                                        <p className="text-sm font-bold text-dark-text-secondary mb-4">مصادر البيانات النشطة</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { label: 'بيانات يدوية',         active: true,                          desc: 'ملف البراند + الصوت + الجمهور' },
                                                { label: 'صفحات مرتبطة',         active: intellData.socialCount > 0,    desc: `${intellData.socialCount} حساب متصل` },
                                                { label: 'قاعدة المعرفة',         active: intellData.knowledgeCount > 0, desc: `${intellData.knowledgeCount} عنصر — ${intellData.knowledgeByType['product'] || 0} منتج، ${intellData.knowledgeByType['faq'] || 0} أسئلة` },
                                                { label: 'وثائق مرفوعة',          active: intellData.docCount > 0,       desc: `${intellData.docCount} وثيقة` },
                                                { label: 'CRM وبيانات المبيعات', active: false,                         desc: 'غير مفعّل بعد' },
                                            ].map(src => (
                                                <div key={src.label} className="flex items-center gap-2 bg-dark-card rounded-xl p-3">
                                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${src.active ? 'bg-emerald-500/20' : 'bg-dark-bg'}`}>
                                                        <i className={`fas fa-${src.active ? 'check' : 'xmark'} text-[9px] ${src.active ? 'text-emerald-400' : 'text-dark-text-secondary'}`}></i>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[11px] font-semibold text-white leading-tight">{src.label}</p>
                                                        <p className="text-[9px] text-dark-text-secondary leading-tight">{src.desc}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ── Last learning activity ── */}
                                    {profile.lastMemoryUpdate && (
                                        <div className="bg-dark-bg rounded-2xl p-4 flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-brand-pink/20 flex items-center justify-center flex-shrink-0">
                                                <i className="fas fa-brain text-sm text-brand-pink"></i>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-white">آخر نشاط تعلّم</p>
                                                <p className="text-[11px] text-dark-text-secondary">
                                                    {new Date(profile.lastMemoryUpdate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })()}

                {activeTab === 'ai-memory' && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <i className="fas fa-brain text-brand-pink"></i>
                            ذاكرة AI ومقياس الاتساق
                        </h2>

                        {/* ── Memory Entries Review (P1-05) ── */}
                        <div className="bg-dark-bg rounded-2xl p-5 space-y-4">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div>
                                    <p className="text-sm font-bold text-white">سجل التعلّم</p>
                                    <p className="text-xs text-dark-text-secondary">كل ما تعلّمه النظام من تفاعلاتك</p>
                                </div>
                                <button onClick={loadMemoryEntries} className="text-xs text-brand-primary hover:underline flex items-center gap-1">
                                    <i className="fas fa-rotate-right text-[10px]"></i>
                                    تحديث
                                </button>
                            </div>

                            {/* Filter buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {([
                                    { key: 'all',               label: 'الكل' },
                                    { key: 'approved_caption',  label: 'موافق عليه' },
                                    { key: 'tone_correction',   label: 'تصحيح نبرة' },
                                    { key: 'rejected_caption',  label: 'مرفوض' },
                                    { key: 'high_performing_post', label: 'أداء عالٍ' },
                                ] as const).map(f => (
                                    <button
                                        key={f.key}
                                        onClick={() => setMemoryFilter(f.key as MemoryType | 'all')}
                                        className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                                            memoryFilter === f.key
                                                ? 'bg-brand-primary text-white'
                                                : 'bg-dark-card text-dark-text-secondary hover:text-white'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            {/* Summary card */}
                            {memoryEntries.length > 0 && (
                                <div className="bg-dark-card rounded-xl px-4 py-2.5 text-xs text-dark-text-secondary flex items-center gap-2">
                                    <i className="fas fa-brain text-brand-pink text-[10px]"></i>
                                    <span>
                                        تعلّم <strong className="text-white">{memoryEntries.length}</strong> عنصراً —{' '}
                                        {memoryEntries.filter(e => e.memoryType === 'approved_caption').length} موافق،{' '}
                                        {memoryEntries.filter(e => e.memoryType === 'tone_correction').length} تصحيح،{' '}
                                        {memoryEntries.filter(e => e.memoryType === 'high_performing_post').length} أداء عالٍ
                                    </span>
                                </div>
                            )}

                            {/* Entries list */}
                            {isLoadingMemory ? (
                                <div className="space-y-2">
                                    {[1, 2, 3].map(i => <div key={i} className="h-16 bg-dark-card rounded-xl animate-pulse" />)}
                                </div>
                            ) : (() => {
                                const MEMORY_TYPE_CONFIG: Record<MemoryType, { label: string; icon: string; color: string }> = {
                                    approved_caption:     { label: 'موافق عليه',    icon: 'fa-check-circle',  color: 'text-emerald-400 bg-emerald-500/10' },
                                    tone_correction:      { label: 'تصحيح نبرة',   icon: 'fa-pen',           color: 'text-blue-400 bg-blue-500/10' },
                                    rejected_caption:     { label: 'مرفوض',        icon: 'fa-times-circle',  color: 'text-red-400 bg-red-500/10' },
                                    high_performing_post: { label: 'أداء عالٍ',    icon: 'fa-fire',          color: 'text-amber-400 bg-amber-500/10' },
                                    audience_insight:     { label: 'رؤية جمهور',   icon: 'fa-users',         color: 'text-purple-400 bg-purple-500/10' },
                                    avoided_topic:        { label: 'موضوع محظور',  icon: 'fa-ban',           color: 'text-orange-400 bg-orange-500/10' },
                                };
                                const filtered = memoryFilter === 'all' ? memoryEntries : memoryEntries.filter(e => e.memoryType === memoryFilter);
                                if (filtered.length === 0) return (
                                    <div className="text-center py-8 text-dark-text-secondary">
                                        <i className="fas fa-brain text-2xl opacity-30 block mb-2"></i>
                                        <p className="text-sm">لا توجد ذكريات بعد</p>
                                        <p className="text-xs mt-1 opacity-70">استخدم استوديو المحتوى وقيّم المخرجات لتبدأ الذاكرة بالتراكم</p>
                                    </div>
                                );
                                return (
                                    <div className="space-y-2 max-h-80 overflow-y-auto">
                                        {filtered.map(entry => {
                                            const cfg = MEMORY_TYPE_CONFIG[entry.memoryType] ?? { label: entry.memoryType, icon: 'fa-circle', color: 'text-gray-400 bg-gray-500/10' };
                                            return (
                                                <div key={entry.id} className="flex items-start gap-3 bg-dark-card rounded-xl p-3">
                                                    <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>
                                                        <i className={`fas ${cfg.icon} me-1`}></i>{cfg.label}
                                                    </span>
                                                    <p className="text-xs text-dark-text-secondary flex-1 leading-5 line-clamp-2">{entry.content}</p>
                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                                        <span className="text-[10px] text-dark-text-secondary">
                                                            {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('ar-EG') : '—'}
                                                        </span>
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    await deleteMemoryEntry(brandId, entry.id);
                                                                    setMemoryEntries(prev => prev.filter(e => e.id !== entry.id));
                                                                } catch { addNotification(NotificationType.Error, 'فشل الحذف'); }
                                                            }}
                                                            className="w-6 h-6 rounded-lg bg-dark-bg flex items-center justify-center text-dark-text-secondary hover:text-red-400 transition-colors"
                                                            title="حذف"
                                                        >
                                                            <i className="fas fa-trash text-[9px]"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* ── Brand Consistency Evaluator (existing) ── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-dark-bg p-5 rounded-2xl">
                                <h3 className="font-semibold text-white mb-2">مُقيِّم اتساق البراند</h3>
                                <p className="text-xs text-dark-text-secondary mb-3">الصق أي محتوى (منشور، إعلان، رد) لتقييم مدى توافقه مع هوية براندك.</p>
                                <textarea
                                    value={contentToEvaluate}
                                    onChange={e => setContentToEvaluate(e.target.value)}
                                    rows={5}
                                    placeholder="الصق المحتوى هنا..."
                                    className="w-full p-3 bg-dark-card border border-dark-border rounded-xl text-sm text-white placeholder:text-dark-text-secondary focus:border-brand-primary focus:outline-none resize-none"
                                />
                                <button onClick={handleEvaluateContent} disabled={isEvaluating} className="w-full mt-3 bg-gradient-to-r from-brand-pink to-brand-purple text-white font-bold py-2.5 rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity">
                                    {isEvaluating ? 'جاري التقييم...' : 'تقييم الآن'}
                                </button>
                            </div>
                            <div className="flex flex-col items-center justify-center bg-dark-bg p-5 rounded-2xl min-h-[200px]">
                                {isEvaluating && <i className="fas fa-spinner fa-spin text-3xl"></i>}
                                {evaluationResult && (
                                    <>
                                        <ScoreDonut score={evaluationResult.score} />
                                        <p className="text-sm text-center text-dark-text-secondary mt-3">{evaluationResult.feedback}</p>
                                    </>
                                )}
                                {!isEvaluating && !evaluationResult && <p className="text-center text-dark-text-secondary">ستظهر نتيجة التقييم هنا.</p>}
                            </div>
                        </div>
                        {evaluationResult && (
                            <div className="bg-dark-bg p-5 rounded-2xl">
                                <h4 className="font-semibold text-white mb-2">توصيات للتحسين</h4>
                                <ul className="list-disc list-inside space-y-1 text-sm text-dark-text-secondary">
                                    {evaluationResult.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                                </ul>
                            </div>
                        )}

                        {/* ── Skills Performance Section ─────────────────── */}
                        {(() => {
                            const SKILL_NAMES: Record<string, string> = {
                                ContentGeneration:       'توليد محتوى',
                                OccasionOpportunity:     'تحويل مناسبة لفرصة',
                                ConversationReply:       'محرك محادثات البراند',
                                CampaignBrief:           'بريف حملة تسويقية',
                                MarketingPlanSuggestion: 'اقتراح خطة تسويق',
                                HashtagResearch:         'بحث هاشتاقات',
                                CompetitorAnalysis:      'تحليل منافس',
                                ContentCalendar:         'تقويم المحتوى',
                                AdCopywriting:           'كتابة نص إعلاني',
                                SEOContentBrief:         'بريف محتوى SEO',
                                AudienceInsight:         'تحليل الجمهور',
                                BrandVoiceCheck:         'فحص صوت البراند',
                                LeadQualification:       'تأهيل عميل محتمل',
                                FollowUpSequence:        'سلسلة رسائل متابعة',
                            };

                            const skillEntries = Object.entries(skillsReport);
                            const totalAll = skillEntries.reduce((s, [, v]) => s + v.totalExecutions, 0);
                            const bestSkill = skillEntries.sort((a, b) => b[1].usedRate - a[1].usedRate)[0];

                            return (
                                <div className="space-y-4 pt-2 border-t border-dark-border">
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <div>
                                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                <i className="fas fa-chart-bar text-brand-pink" />
                                                أداء مهارات الذكاء الاصطناعي
                                            </h3>
                                            <p className="text-xs text-dark-text-secondary mt-0.5">كيف يتفاعل فريقك مع مخرجات AI</p>
                                        </div>
                                        <div className="flex items-center gap-1 bg-dark-bg rounded-xl p-1">
                                            {([7, 30, 90] as const).map(d => (
                                                <button
                                                    key={d}
                                                    onClick={() => setStatsDays(d)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                        statsDays === d ? 'bg-brand-primary text-white' : 'text-dark-text-secondary hover:text-white'
                                                    }`}
                                                >
                                                    {d} يوم
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {isLoadingStats ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-dark-bg rounded-xl animate-pulse" />)}
                                        </div>
                                    ) : skillEntries.length === 0 ? (
                                        <div className="py-10 text-center rounded-2xl border border-dashed border-dark-border">
                                            <i className="fas fa-chart-bar text-3xl text-dark-text-secondary mb-3 block opacity-30" />
                                            <p className="text-sm text-dark-text-secondary">لا توجد بيانات بعد.</p>
                                            <p className="text-xs text-dark-text-secondary/60 mt-1">استخدم استوديو المحتوى أو الصندوق الوارد وقيّم المخرجات لتبدأ البيانات بالظهور.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Summary row */}
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="bg-dark-bg rounded-xl p-3 text-center">
                                                    <p className="text-2xl font-black text-white">{totalAll}</p>
                                                    <p className="text-[11px] text-dark-text-secondary mt-0.5">إجمالي التقييمات</p>
                                                </div>
                                                <div className="bg-dark-bg rounded-xl p-3 text-center">
                                                    <p className="text-2xl font-black text-emerald-400">
                                                        {totalAll > 0
                                                            ? Math.round(skillEntries.reduce((s,[,v]) => s + v.usedRate * v.totalExecutions, 0) / totalAll * 100)
                                                            : 0}%
                                                    </p>
                                                    <p className="text-[11px] text-dark-text-secondary mt-0.5">معدل الاستخدام</p>
                                                </div>
                                                <div className="bg-dark-bg rounded-xl p-3 text-center">
                                                    <p className="text-2xl font-black text-yellow-400">
                                                        {bestSkill ? (SKILL_NAMES[bestSkill[0]] ?? bestSkill[0]).split(' ')[0] : '—'}
                                                    </p>
                                                    <p className="text-[11px] text-dark-text-secondary mt-0.5">أفضل مهارة</p>
                                                </div>
                                            </div>

                                            {/* Per-skill cards */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {skillEntries
                                                    .sort((a, b) => b[1].totalExecutions - a[1].totalExecutions)
                                                    .map(([skillType, stats]) => {
                                                        const nameAr = SKILL_NAMES[skillType] ?? skillType;
                                                        const usedPct   = Math.round(stats.usedRate * 100);
                                                        const editedPct = Math.round(stats.editedRate * 100);
                                                        const rejPct    = Math.round(stats.rejectedRate * 100);
                                                        const scoreColor = usedPct >= 60 ? 'text-emerald-400' : usedPct >= 30 ? 'text-yellow-400' : 'text-rose-400';
                                                        return (
                                                            <div key={skillType} className="bg-dark-bg rounded-xl p-4 space-y-3">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <p className="text-sm font-bold text-white leading-snug">{nameAr}</p>
                                                                    <span className="text-[11px] font-bold text-dark-text-secondary bg-dark-card px-2 py-0.5 rounded-full flex-shrink-0">
                                                                        {stats.totalExecutions} تقييم
                                                                    </span>
                                                                </div>

                                                                {/* Bar: used / edited / rejected */}
                                                                <div className="h-2 w-full rounded-full overflow-hidden flex gap-px">
                                                                    {usedPct > 0   && <div className="bg-emerald-500 rounded-full" style={{ width: `${usedPct}%` }} title={`استُخدم ${usedPct}%`} />}
                                                                    {editedPct > 0 && <div className="bg-blue-400 rounded-full"   style={{ width: `${editedPct}%` }} title={`عُدِّل ${editedPct}%`} />}
                                                                    {rejPct > 0    && <div className="bg-rose-500 rounded-full"   style={{ width: `${rejPct}%` }} title={`رُفض ${rejPct}%`} />}
                                                                    {(100 - usedPct - editedPct - rejPct) > 0 && <div className="bg-dark-border flex-1 rounded-full" />}
                                                                </div>

                                                                <div className="flex items-center justify-between text-[11px]">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{usedPct}% استُخدم</span>
                                                                        <span className="flex items-center gap-1 text-blue-400"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />{editedPct}% عُدِّل</span>
                                                                        <span className="flex items-center gap-1 text-rose-400"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />{rejPct}% رُفض</span>
                                                                    </div>
                                                                    {stats.averageRating > 0 && (
                                                                        <span className="text-yellow-400 font-bold">★ {stats.averageRating.toFixed(1)}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
};

