import React, { useState, useRef } from 'react';
import { BrandHubProfile, NotificationType } from '../../types';
import { generateInitialBrandProfile } from '../../services/geminiService';
import { analyzeBrandFiles, buildWizardPrefillFromAnalysis, BrandFileAnalysisResult } from '../../services/brandFileAnalysisService';
import { getBrandFileExt, getBrandFileMimeType, isBrandFileBinaryExt, isSupportedBrandFileExt } from '../../services/brandFileAnalysisShared';
import { extractTextFromPdf } from '../../services/pdfExtractor';
import { addBrandDocument, BrandDocType } from '../../services/brandDocumentService';

interface AIOnboardingModalProps {
    brandId: string;
    brandName: string;
    onClose: () => void;
    onGenerate: (profile: Partial<BrandHubProfile>) => void;
}

const TONE_OPTIONS = [
    { value: 'professional',  label: 'رسمي ومهني',    icon: 'fa-briefcase',  color: 'border-blue-500/30 bg-blue-500/5 hover:border-blue-500/60' },
    { value: 'friendly',      label: 'ودود وقريب',     icon: 'fa-smile',      color: 'border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/60' },
    { value: 'bold',          label: 'جريء ومباشر',   icon: 'fa-bolt',       color: 'border-red-500/30 bg-red-500/5 hover:border-red-500/60' },
    { value: 'creative',      label: 'إبداعي ومبتكر', icon: 'fa-paint-brush',color: 'border-purple-500/30 bg-purple-500/5 hover:border-purple-500/60' },
    { value: 'empathetic',    label: 'متفهم وعاطفي',  icon: 'fa-heart',      color: 'border-pink-500/30 bg-pink-500/5 hover:border-pink-500/60' },
    { value: 'authoritative', label: 'خبير وموثوق',   icon: 'fa-award',      color: 'border-green-500/30 bg-green-500/5 hover:border-green-500/60' },
];

const INDUSTRY_OPTIONS = [
    'تجزئة وتسوق', 'عقارات وتطوير عقاري', 'مطاعم وأغذية ومشروبات', 'صحة وجمال وعناية',
    'تقنية وSaaS وبرمجيات', 'تعليم وتدريب وتطوير', 'سياحة وفنادق وضيافة', 'مالية وبنوك وتأمين',
    'رياضة ولياقة بدنية', 'أثاث وديكور ومنزل', 'ملابس وأزياء وإكسسوار', 'سيارات وخدمات مركبات',
    'طبي وصحة عامة وصيدلة', 'قانوني واستشاري ومحاسبة', 'وكالة تسويق وإعلانات وإبداع',
    'لوجستيات وشحن وتوصيل', 'مقاولات وبناء وتشييد', 'زراعة وصناعات غذائية',
    'ترفيه وإعلام ومحتوى رقمي', 'تصميم جرافيك وفنون بصرية', 'خدمات منزلية ومهنية',
    'أعمال خيرية وغير ربحية', 'طاقة وبيئة واستدامة', 'تجميل ومكياج وعطور', 'أخرى',
];

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

export const AIOnboardingModal: React.FC<AIOnboardingModalProps> = ({ brandId, brandName, onClose, onGenerate }) => {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        industry: '',
        description: '',
        targetAudience: '',
        ageRange: [] as string[],
        tones: [] as string[],
        platforms: [] as string[],
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isExtractingFile, setIsExtractingFile] = useState(false);
    const [fileExtractMsg, setFileExtractMsg] = useState<string | null>(null);
    const [unsupportedExt, setUnsupportedExt] = useState<string | null>(null);
    const [fileEntry, setFileEntry] = useState<{ fileName: string; content: string; result: BrandFileAnalysisResult } | null>(null);
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

            setFileEntry({
                fileName: file.name,
                content: 'text_content' in document
                    ? (document as { text_content: string }).text_content
                    : (result.data.documentSummary ?? ''),
                result,
            });

            setForm(f => ({
                ...f,
                industry: prefill.industry || f.industry,
                description: prefill.description || f.description,
                targetAudience: prefill.targetAudience || f.targetAudience,
                ageRange: prefill.ageRange ? [prefill.ageRange] : f.ageRange,
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
        const fullDesc = `${form.description} | الصناعة: ${form.industry} | الجمهور: ${form.targetAudience} (${form.ageRange.join(', ')}) | النبرة: ${form.tones.join(', ')} | المنصات: ${form.platforms.join(', ')}`;

        if (fileEntry) {
            addBrandDocument(brandId, {
                title: fileEntry.fileName,
                docType: 'brand_book' as BrandDocType,
                content: fileEntry.content,
                extractedSummary: fileEntry.result.data.documentSummary,
                fieldsFound: {},
                completenessScore: fileEntry.result.score,
                memoryEntriesSaved: 0,
                knowledgeEntriesSaved: 0,
                fileName: fileEntry.fileName,
                analysisProvider: fileEntry.result.provider,
                analysisModel: fileEntry.result.model,
                analysisJson: fileEntry.result.data.rawAnalysis as unknown as Record<string, unknown>,
                detectedLanguage: fileEntry.result.data.detectedLanguage,
            }).catch(e => console.warn('[wizard doc save]', e));
        }

        const formExtracted: Partial<BrandHubProfile> = {
            ...(form.industry       && { industry:              form.industry }),
            ...(form.description    && { description:           form.description }),
            ...(form.targetAudience && { targetAudienceSummary: form.targetAudience }),
            ...(form.ageRange.length > 0  && { ageRange: form.ageRange }),
            ...(form.tones.length > 0 && {
                brandVoice: { toneDescription: form.tones, keywords: [], negativeKeywords: [], toneStrength: 50, toneSentiment: 0.5, voiceGuidelines: { dos: [], donts: [] } },
            }),
        };

        try {
            const partialProfile = await generateInitialBrandProfile(fullDesc, brandName);
            const merged: Partial<BrandHubProfile> = {
                ...partialProfile,
                ...formExtracted,
                brandVoice: formExtracted.brandVoice ? {
                    ...partialProfile.brandVoice,
                    ...formExtracted.brandVoice,
                    toneDescription: formExtracted.brandVoice.toneDescription?.length
                        ? formExtracted.brandVoice.toneDescription
                        : partialProfile.brandVoice?.toneDescription ?? [],
                } : partialProfile.brandVoice,
            };
            onGenerate(merged);
        } catch (error) {
            console.error('Failed to generate brand profile:', error);
            onGenerate(formExtracted);
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
            <div className="bg-dark-card/90 backdrop-blur-md w-full sm:max-w-xl sm:rounded-2xl rounded-t-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[92vh] transition-all duration-300">

                {/* ── Gradient Header ── */}
                <div className="relative overflow-hidden px-5 pt-5 pb-4 flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #121225 0%, #161630 50%, #0c2040 100%)' }}>
                    {/* Glows */}
                    <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-brand-pink/20 blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-brand-purple/20 blur-2xl pointer-events-none" />

                    <div className="relative">
                        {/* Title row */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0"
                                    style={{ background: 'linear-gradient(135deg, var(--brand-pink,#e91e8c) 0%, var(--brand-purple,#9c27b0) 100%)' }}>
                                    <i className="fas fa-wand-magic-sparkles text-white text-sm animate-pulse" />
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
                                                ? 'text-white shadow-lg shadow-brand-pink/40 border border-white/20'
                                                : 'bg-white/5 text-slate-500 border border-white/5'
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
                        <div className="mt-3 h-0.5 bg-white/5 rounded-full overflow-hidden">
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
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Step 1: Basics */}
                    {step === 1 && (
                        <div className="space-y-4 animate-fade-in">
                            <p className="text-slate-400 text-sm">أخبرنا عن نشاطك التجاري — سيبني الذكاء الاصطناعي الهوية الكاملة تلقائياً</p>

                            {/* File upload zone */}
                            <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf,.docx,.doc,.pptx,.xlsx,.csv" className="hidden" onChange={handleFileUpload} />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isExtractingFile}
                                className="w-full group relative overflow-hidden rounded-2xl border border-dashed border-brand-pink/30 hover:border-brand-pink/70 bg-brand-pink/5 hover:bg-brand-pink/10 transition-all duration-300 p-4 text-right disabled:opacity-60 shadow-lg"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-pink/20 to-brand-purple/20 border border-brand-pink/25 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
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
                                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all duration-300 ${fileExtractMsg.startsWith('✓') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
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
                                <div className="flex-1 h-px bg-white/10" />
                                <span className="text-[11px] text-slate-500 font-medium flex-shrink-0">أو أدخل يدوياً</span>
                                <div className="flex-1 h-px bg-white/10" />
                            </div>

                            {/* Industry chips */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-2">الصناعة / القطاع</label>
                                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                                    {INDUSTRY_OPTIONS.map(o => (
                                        <button key={o} type="button" onClick={() => setForm(f => ({ ...f, industry: f.industry === o ? '' : o }))}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${form.industry === o ? 'bg-brand-pink/20 border-brand-pink text-brand-pink' : 'bg-dark-bg/60 border-white/5 text-slate-400 hover:border-brand-pink/40 hover:text-slate-300'}`}>
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
                                    className="w-full bg-dark-bg/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-brand-pink/40 focus:border-brand-pink/50 placeholder-slate-600 transition-all duration-250" />
                            </div>
                        </div>
                    )}

                    {/* Step 2: Audience */}
                    {step === 2 && (
                        <div className="space-y-4 animate-fade-in">
                            <p className="text-slate-400 text-sm">من هم عملاؤك المثاليون؟</p>

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5">وصف الجمهور المستهدف</label>
                                <textarea value={form.targetAudience} onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))} rows={3}
                                    placeholder="مثال: نساء 25-40 في السعودية ودول الخليج، مهتمات بالصحة والجمال الطبيعي..."
                                    className="w-full bg-dark-bg/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-brand-pink/40 focus:border-brand-pink/50 placeholder-slate-600 transition-all duration-250" />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-2">الفئة العمرية <span className="text-slate-500 font-normal">(اختر واحدة أو أكثر)</span></label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['13-17', '18-24', '25-34', '35-44', '45-54', '55+'].map(r => {
                                        const active = form.ageRange.includes(r);
                                        return (
                                            <button key={r} type="button"
                                                onClick={() => setForm(f => ({ ...f, ageRange: active ? f.ageRange.filter(a => a !== r) : [...f.ageRange, r] }))}
                                                className={`py-2 rounded-xl text-sm font-bold transition-all duration-200 border ${active ? 'border-brand-pink bg-brand-pink/20 text-brand-pink shadow-md' : 'border-white/10 text-slate-400 hover:border-brand-pink/45 hover:text-slate-300'}`}>
                                                {r}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-2">منصات التواصل المستهدفة</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { name: 'Instagram', icon: 'fab fa-instagram' },
                                        { name: 'TikTok',    icon: 'fab fa-tiktok' },
                                        { name: 'Facebook',  icon: 'fab fa-facebook-f' },
                                        { name: 'X',         icon: 'fab fa-x-twitter' },
                                        { name: 'LinkedIn',  icon: 'fab fa-linkedin-in' },
                                        { name: 'Snapchat',  icon: 'fab fa-snapchat' },
                                    ].map(p => (
                                        <button key={p.name} onClick={() => togglePlatform(p.name)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 ${form.platforms.includes(p.name) ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-slate-500 hover:border-white/20 hover:text-slate-300'}`}>
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
                        <div className="space-y-3 animate-fade-in">
                            <div className="flex items-center justify-between">
                                <p className="text-slate-400 text-sm">اختر حتى 3 نبرات تعبّر عن صوت براندك</p>
                                {form.tones.length > 0 && (
                                    <span className="text-[11px] font-bold text-brand-pink bg-brand-pink/15 px-2.5 py-0.5 rounded-full">
                                        {form.tones.length}/3 محدد
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
                                {TONE_OPTIONS.map(t => {
                                    const selected = form.tones.includes(t.value);
                                    return (
                                        <button key={t.value} onClick={() => toggleTone(t.value)}
                                            className={`flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 text-right ${selected ? 'border-brand-pink bg-brand-pink/15 scale-[1.02] shadow-lg' : 'border-white/5 bg-dark-bg/40 hover:border-white/10 hover:bg-white/5'}`}>
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${selected ? 'bg-white/10' : 'bg-dark-card'}`}>
                                                <i className={`fas ${t.icon} text-base ${selected ? 'text-white' : 'text-slate-500'}`} />
                                            </div>
                                            <div className="flex-1 min-w-0 text-right">
                                                <p className={`text-xs font-bold ${selected ? 'text-white' : 'text-slate-400'}`}>{t.label}</p>
                                                {selected && <p className="text-[9px] text-white/60 mt-0.5">محدد ✓</p>}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Generate */}
                    {step === 4 && (
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-5 animate-fade-in">
                            {isLoading ? (
                                <>
                                    <div className="relative w-20 h-20">
                                        <div className="absolute inset-0 rounded-full border-4 border-brand-pink/10" />
                                        <div className="absolute inset-0 rounded-full border-4 border-brand-pink border-t-transparent border-r-transparent animate-spin" />
                                        <div className="absolute inset-2 rounded-full border-2 border-brand-purple/30 border-b-brand-purple animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <i className="fas fa-brain text-xl text-brand-pink animate-pulse" />
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
                                            <i className="fas fa-wand-magic-sparkles text-3xl text-brand-pink animate-bounce" />
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
                                        {['صوت البراند', 'القيم الجوهرية', 'وصف الجمهور', 'ركائز المحتوى'].map((item) => (
                                            <div key={item} className="flex items-center gap-2 bg-dark-bg/60 rounded-xl px-3 py-2 text-xs text-slate-400 border border-white/5">
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
                <div className="px-5 py-4 border-t border-white/10 bg-dark-bg/40 flex justify-between items-center gap-3 flex-shrink-0">
                    <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
                        className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 border border-white/10 hover:border-white/20 transition-all font-medium">
                        {step === 1 ? 'تخطي' : '← رجوع'}
                    </button>
                    {step < 4 ? (
                        <button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !form.description.trim()}
                            className="flex items-center gap-2 px-6 py-2 text-white rounded-xl font-bold text-sm hover:opacity-95 transition-all disabled:opacity-40 shadow-lg shadow-brand-pink/20"
                            style={{ background: 'linear-gradient(135deg, var(--brand-pink,#e91e8c), var(--brand-purple,#9c27b0))' }}>
                            التالي <i className="fas fa-arrow-left text-xs" />
                        </button>
                    ) : (
                        <button onClick={handleGenerate} disabled={isLoading}
                            className="flex items-center gap-2 px-6 py-2 text-white rounded-xl font-bold text-sm hover:opacity-95 transition-all disabled:opacity-45 shadow-lg shadow-brand-pink/20"
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
