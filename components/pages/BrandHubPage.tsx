

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrandHubProfile, NotificationType, BrandConsistencyEvaluation, BrandKnowledgeEntry, BrandKnowledgeType, BrandGoal, BrandLanguage, BusinessModel, SkillStats } from '../../types';
import { generateInitialBrandProfile, evaluateContentConsistency } from '../../services/geminiService';
import { getBrandKnowledge, addKnowledgeEntry, updateKnowledgeEntry, deleteKnowledgeEntry } from '../../services/brandKnowledgeService';
import { callAIProxy, Type } from '../../services/aiProxy';
import { extractTextFromPdf } from '../../services/pdfExtractor';
import { getBrandSkillsReport } from '../../services/evaluationService';
import { getBrandDocuments, deleteBrandDocument, BrandDocument, DOC_TYPE_LABELS } from '../../services/brandDocumentService';
import { BrandImportModal } from '../BrandImportModal';
import { ScoreDonut } from '../shared/ScoreDonut';
import { getMemoryEntries, deleteMemoryEntry, BrandMemoryEntry, MemoryType } from '../../services/brandMemoryService';
import { getSocialAccounts } from '../../services/socialAccountService';

interface BrandHubPageProps {
    brandId: string;
    initialProfile: BrandHubProfile;
    onUpdate: (profile: BrandHubProfile) => void;
    addNotification: (type: NotificationType, message: string) => void;
    onNavigate?: (page: string) => void;
}

type ActiveTab = 'identity' | 'voice' | 'audience' | 'ai-memory' | 'assets' | 'knowledge' | 'documents' | 'intelligence';

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

// Only PDF is natively supported by Gemini inline_data
const BINARY_EXTS: Record<string, string> = {
    pdf: 'application/pdf',
};
const INLINE_PDF_MAX_BYTES = 5 * 1024 * 1024;
const UNSUPPORTED_EXTS = new Set(['docx', 'doc', 'pptx', 'xlsx']);

function getExt(name: string) { return name.split('.').pop()?.toLowerCase() ?? ''; }

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

        // DOCX / DOC / PPTX — Gemini doesn't support these as inline_data
        if (UNSUPPORTED_EXTS.has(ext)) {
            setUnsupportedExt(ext);
            setFileExtractMsg(null);
            return;
        }
        setUnsupportedExt(null);

        setIsExtractingFile(true);
        setFileExtractMsg(null);
        try {
            // Build contents array:
            // - PDF ≤ 5 MB → inline_data (preserves the original file for Gemini)
            // - PDF > 5 MB → extract text client-side via PDF.js (avoids base64 body overflow)
            // - TXT / MD     → send as plain text
            let contents: unknown[];
            const PROMPT = 'استخرج من هذه الوثيقة: الصناعة، وصف النشاط التجاري، الجمهور المستهدف، الفئة العمرية، نبرة الصوت، والمنصات المناسبة. أرجع JSON فقط.';

            if (ext === 'pdf') {
                if (file.size > INLINE_PDF_MAX_BYTES) {
                    // Large PDF → extract text client-side, send as text
                    const pdfText = await extractTextFromPdf(file);
                    contents = [{
                        role: 'user',
                        parts: [{ text: `${PROMPT}\n\n${pdfText.slice(0, 20000)}` }],
                    }];
                } else {
                    // Small PDF → inline_data
                    const base64 = await fileToBase64(file);
                    contents = [{
                        role: 'user',
                        parts: [
                            { inline_data: { mime_type: 'application/pdf', data: base64 } },
                            { text: PROMPT },
                        ],
                    }];
                }
            } else {
                const rawText = await file.text();
                contents = [{
                    role: 'user',
                    parts: [{ text: `${PROMPT}\n\n${rawText.slice(0, 20000)}` }],
                }];
            }

            const WIZARD_INDUSTRIES = ['تجزئة وتسوق', 'عقارات', 'مطاعم وأغذية', 'صحة وجمال', 'تقنية وSaaS', 'تعليم', 'سياحة وضيافة', 'مالية وبنوك', 'رياضة ولياقة', 'أخرى'];
            const WIZARD_TONES = ['professional', 'friendly', 'bold', 'creative', 'empathetic', 'authoritative'];
            const WIZARD_PLATFORMS = ['Instagram', 'TikTok', 'Facebook', 'X', 'LinkedIn', 'Snapchat'];

            const res = await callAIProxy({
                model: 'gemini-2.5-flash',
                contents,
                schema: {
                    type: Type.OBJECT,
                    properties: {
                        industry:       { type: Type.STRING,  description: `واحدة فقط من: ${WIZARD_INDUSTRIES.join(', ')}` },
                        description:    { type: Type.STRING,  description: 'وصف موجز للنشاط التجاري، 2-4 جمل' },
                        targetAudience: { type: Type.STRING,  description: 'وصف الجمهور المستهدف' },
                        ageRange:       { type: Type.STRING,  description: 'مثال: 25-34' },
                        tones:          { type: Type.ARRAY,   items: { type: Type.STRING, description: `واحدة من: ${WIZARD_TONES.join(', ')}` } },
                        platforms:      { type: Type.ARRAY,   items: { type: Type.STRING, description: `واحدة من: ${WIZARD_PLATFORMS.join(', ')}` } },
                    },
                },
                feature: 'wizard_file_extract',
            });

            const raw = typeof res.text === 'string' ? JSON.parse(res.text) : res.text as Record<string, unknown>;

            const matchedIndustry = WIZARD_INDUSTRIES.find(o => o === raw.industry) ?? '';
            const matchedTones = ((raw.tones as string[] | undefined) ?? []).filter(t => WIZARD_TONES.includes(t)).slice(0, 3);
            const matchedPlatforms = ((raw.platforms as string[] | undefined) ?? []).filter(p => WIZARD_PLATFORMS.includes(p));
            const matchedAge = ['18-24','25-34','35-44','45-54','55+'].find(r => r === raw.ageRange) ?? '';

            setForm(f => ({
                ...f,
                industry:       matchedIndustry        || f.industry,
                description:    (raw.description as string | undefined)    || f.description,
                targetAudience: (raw.targetAudience as string | undefined) || f.targetAudience,
                ageRange:       matchedAge             || f.ageRange,
                tones:          matchedTones.length    ? matchedTones    : f.tones,
                platforms:      matchedPlatforms.length ? matchedPlatforms : f.platforms,
            }));

            const filledCount = [matchedIndustry, raw.description, raw.targetAudience, matchedTones.length, matchedPlatforms.length].filter(Boolean).length;
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
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-dark-card border border-dark-border rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
                {/* Progress bar */}
                <div className="p-6 border-b border-dark-border space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <i className="fas fa-magic text-brand-pink" /> إعداد ذكي لهوية البراند
                        </h2>
                        <button onClick={onClose} aria-label="إغلاق" className="text-dark-text-secondary hover:text-white"><i className="fas fa-times" /></button>
                    </div>
                    <div className="flex items-center gap-2">
                        {STEPS.map((s, i) => (
                            <React.Fragment key={s.num}>
                                <div className={`flex items-center gap-1.5 text-xs font-semibold ${step >= s.num ? 'text-brand-pink' : 'text-dark-text-secondary'}`}>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step > s.num ? 'bg-green-500 text-white' : step === s.num ? 'bg-brand-pink text-white' : 'bg-dark-bg text-dark-text-secondary'}`}>
                                        {step > s.num ? <i className="fas fa-check text-[10px]" /> : s.num}
                                    </div>
                                    <span className="hidden sm:block">{s.label}</span>
                                </div>
                                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded-full ${step > s.num ? 'bg-green-500' : 'bg-dark-border'}`} />}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div className="p-6 min-h-[280px]">
                    {/* Step 1: Basics */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <p className="text-dark-text-secondary text-sm">أخبرنا عن نشاطك التجاري — سيبني الذكاء الاصطناعي هوية البراند من هذه المعلومات</p>

                            {/* File upload */}
                            <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf,.docx,.doc,.pptx,.xlsx" className="hidden" onChange={handleFileUpload} />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isExtractingFile}
                                className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed border-brand-pink/40 hover:border-brand-pink hover:bg-brand-pink/5 transition-all text-right group disabled:opacity-60"
                            >
                                <div className="w-9 h-9 rounded-xl bg-brand-pink/10 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-pink/20 transition-colors">
                                    {isExtractingFile
                                        ? <i className="fas fa-circle-notch fa-spin text-brand-pink text-sm" />
                                        : <i className="fas fa-file-import text-brand-pink text-sm" />
                                    }
                                </div>
                                <div className="flex-1 min-w-0 text-right">
                                    <p className="text-sm font-bold text-white">
                                        {isExtractingFile ? 'جارٍ قراءة الملف...' : 'استيراد من ملف'}
                                    </p>
                                    <p className="text-xs text-dark-text-secondary mt-0.5">
                                        PDF، TXT، MD — يملأ الـ AI الحقول تلقائياً
                                    </p>
                                </div>
                                <i className="fas fa-chevron-left text-brand-pink/50 group-hover:text-brand-pink transition-colors flex-shrink-0 text-xs" />
                            </button>

                            {fileExtractMsg && (
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${fileExtractMsg.startsWith('✓') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                    <i className={`fas ${fileExtractMsg.startsWith('✓') ? 'fa-check-circle' : 'fa-exclamation-circle'} text-[11px]`} />
                                    {fileExtractMsg}
                                </div>
                            )}

                            {unsupportedExt && (
                                <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-3 space-y-2">
                                    <div className="flex items-start gap-2">
                                        <i className="fas fa-circle-exclamation text-amber-400 mt-0.5 text-sm flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-amber-300">
                                                ملف {unsupportedExt.toUpperCase()} غير مدعوم مباشرةً
                                            </p>
                                            <p className="text-[11px] text-amber-300/70 mt-0.5">
                                                حوّله إلى PDF مجاناً عبر أحد الروابط أدناه، ثم ارفعه مرة أخرى
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        <a href="https://smallpdf.com/word-to-pdf" target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 text-[11px] font-semibold hover:bg-amber-500/25 transition-colors">
                                            <i className="fas fa-arrow-up-right-from-square text-[9px]" />
                                            Smallpdf
                                        </a>
                                        <a href="https://www.ilovepdf.com/word_to_pdf" target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 text-[11px] font-semibold hover:bg-amber-500/25 transition-colors">
                                            <i className="fas fa-arrow-up-right-from-square text-[9px]" />
                                            iLovePDF
                                        </a>
                                        <a href="https://pdf2go.com/word-to-pdf" target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 text-[11px] font-semibold hover:bg-amber-500/25 transition-colors">
                                            <i className="fas fa-arrow-up-right-from-square text-[9px]" />
                                            PDF2Go
                                        </a>
                                    </div>
                                    <p className="text-[10px] text-amber-300/50">
                                        بديل: احفظ الملف كـ .txt أو .pdf ثم ارفعه هنا مباشرة
                                    </p>
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <div className="flex-1 border-t border-dark-border" />
                                <span className="text-[10px] text-dark-text-secondary flex-shrink-0">أو أدخل يدوياً</span>
                                <div className="flex-1 border-t border-dark-border" />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-dark-text-secondary mb-1">الصناعة / القطاع</label>
                                <select value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-pink">
                                    <option value="">اختر الصناعة</option>
                                    {INDUSTRY_OPTIONS.map(o => <option key={o}>{o}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-dark-text-secondary mb-1">وصف النشاط التجاري *</label>
                                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4}
                                    placeholder="مثال: متجر متخصص في مستحضرات تجميل طبيعية 100%، يستهدف النساء العربيات المهتمات بالعناية بالبشرة..."
                                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-brand-pink" />
                            </div>
                        </div>
                    )}
                    {/* Step 2: Audience */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <p className="text-dark-text-secondary text-sm">من هم عملاؤك المثاليون؟</p>
                            <div>
                                <label className="block text-xs font-semibold text-dark-text-secondary mb-1">وصف الجمهور المستهدف</label>
                                <textarea value={form.targetAudience} onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))} rows={3}
                                    placeholder="مثال: نساء 25-40 في السعودية ودول الخليج، مهتمات بالصحة والجمال الطبيعي..."
                                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-brand-pink" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-dark-text-secondary mb-1">الفئة العمرية الرئيسية</label>
                                <div className="flex gap-2 flex-wrap">
                                    {['18-24', '25-34', '35-44', '45-54', '55+'].map(r => (
                                        <button key={r} onClick={() => setForm(f => ({ ...f, ageRange: r }))}
                                            className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors border ${form.ageRange === r ? 'border-brand-pink bg-brand-pink/20 text-brand-pink' : 'border-dark-border text-dark-text-secondary hover:border-brand-pink/50'}`}>
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-dark-text-secondary mb-2">منصات التواصل المستهدفة</label>
                                <div className="flex gap-2 flex-wrap">
                                    {['Instagram', 'TikTok', 'Facebook', 'X', 'LinkedIn', 'Snapchat'].map(p => (
                                        <button key={p} onClick={() => togglePlatform(p)}
                                            className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors border ${form.platforms.includes(p) ? 'border-brand-pink bg-brand-pink/20 text-brand-pink' : 'border-dark-border text-dark-text-secondary hover:border-brand-pink/50'}`}>
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Step 3: Voice */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <p className="text-dark-text-secondary text-sm">اختر حتى 3 أساليب تعبّر عن صوت براندك</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {TONE_OPTIONS.map(t => (
                                    <button key={t.value} onClick={() => toggleTone(t.value)}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${form.tones.includes(t.value) ? t.color + ' border-opacity-100' : 'border-dark-border bg-dark-bg hover:border-dark-text-secondary'}`}>
                                        <i className={`fas ${t.icon} text-xl ${form.tones.includes(t.value) ? '' : 'text-dark-text-secondary'}`} />
                                        <span className={`text-xs font-semibold text-center ${form.tones.includes(t.value) ? 'text-white' : 'text-dark-text-secondary'}`}>{t.label}</span>
                                        {form.tones.includes(t.value) && <i className="fas fa-check-circle text-xs text-white" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Step 4: Generate */}
                    {step === 4 && (
                        <div className="flex flex-col items-center justify-center h-48 space-y-4 text-center">
                            {isLoading ? (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-brand-pink/10 flex items-center justify-center">
                                        <i className="fas fa-robot text-3xl text-brand-pink animate-pulse" />
                                    </div>
                                    <p className="text-white font-semibold">الذكاء الاصطناعي يبني هوية براندك...</p>
                                    <p className="text-dark-text-secondary text-sm">هذا قد يستغرق 15-20 ثانية</p>
                                </>
                            ) : (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                                        <i className="fas fa-magic text-3xl text-brand-pink" />
                                    </div>
                                    <p className="text-white font-semibold">جاهز للإنشاء!</p>
                                    <p className="text-dark-text-secondary text-sm">بناءً على معلوماتك، سيُنشئ Gemini هوية براند متكاملة تشمل الصوت، القيم، الجمهور، والإرشادات</p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-dark-border flex justify-between gap-3">
                    <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
                        className="px-4 py-2.5 border border-dark-border rounded-xl text-sm text-dark-text-secondary hover:text-white transition-colors">
                        {step === 1 ? 'تخطي' : 'رجوع'}
                    </button>
                    {step < 4 ? (
                        <button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !form.description.trim()}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-pink to-brand-purple text-white rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50">
                            التالي <i className="fas fa-arrow-left" />
                        </button>
                    ) : (
                        <button onClick={handleGenerate} disabled={isLoading}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-pink to-brand-purple text-white rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50">
                            {isLoading ? <><i className="fas fa-spinner fa-spin" /> يُنشئ...</> : <><i className="fas fa-magic" /> إنشاء الهوية</>}
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
    const ar = profile.language === 'ar' || !profile.language;
    const [voicePreview, setVoicePreview] = useState<{ complaint: string; post: string; welcome: string } | null>(null);
    const [generatingPreview, setGeneratingPreview] = useState(false);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const generatePreview = async () => {
        setGeneratingPreview(true);
        setVoicePreview(null);
        try {
            const tone = profile.brandVoice.toneDescription.slice(0, 3).join('، ') || 'محايد';
            const keywords = profile.brandVoice.keywords.slice(0, 5).join('، ') || '';
            const dos = profile.brandVoice.voiceGuidelines?.dos.slice(0, 2).join(' | ') || '';
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
            addNotification(NotificationType.Error, ar ? 'فشل توليد المعاينة.' : 'Voice preview failed.');
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
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">صوت البراند</h2>
                <button
                    onClick={generatePreview}
                    disabled={generatingPreview}
                    className="flex items-center gap-1.5 rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-3 py-2 text-xs font-bold text-brand-secondary transition-colors hover:bg-brand-primary/20 disabled:opacity-50"
                >
                    <i className={`fas ${generatingPreview ? 'fa-spinner fa-spin' : 'fa-eye'} text-[10px]`} />
                    {generatingPreview ? (ar ? 'جاري التوليد...' : 'Generating...') : (ar ? 'معاينة الصوت' : 'Preview Voice')}
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="font-semibold text-white text-sm uppercase tracking-wide">نبرة الصوت</h3>
                    {[
                        { label: 'رسمي ← غير رسمي',    key: 'toneFormal',    icon: 'fa-user-tie' },
                        { label: 'جاد ← خفيف',          key: 'tonePlayful',   icon: 'fa-smile' },
                        { label: 'بارد ← دافئ',         key: 'toneWarm',      icon: 'fa-heart' },
                        { label: 'تقني ← بسيط',         key: 'toneSimple',    icon: 'fa-code' },
                    ].map(({ label, key, icon }) => {
                        const val = profile.brandVoice.toneStrength ?? 50;
                        return (
                            <div key={key} className="space-y-1">
                                <div className="flex items-center gap-2 text-xs text-dark-text-secondary">
                                    <i className={`fas ${icon}`} />
                                    <span>{label}</span>
                                    <span className="ms-auto font-mono">{val}%</span>
                                </div>
                                <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-brand-pink to-brand-purple rounded-full transition-all" style={{ width: `${val}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="space-y-4">
                    <h3 className="font-semibold text-white text-sm uppercase tracking-wide">الكلمات المفتاحية</h3>
                    <div className="flex flex-wrap gap-2">
                        {profile.brandVoice.keywords.map((kw, i) => (
                            <span key={i} className="px-3 py-1.5 bg-brand-pink/20 text-brand-pink rounded-full text-xs font-semibold border border-brand-pink/30">{kw}</span>
                        ))}
                    </div>
                    <h3 className="font-semibold text-white text-sm uppercase tracking-wide mt-4">نبرة الصوت</h3>
                    <div className="flex flex-wrap gap-2">
                        {profile.brandVoice.toneDescription.map((tone, i) => (
                            <span key={i} className="px-3 py-1.5 bg-brand-purple/20 text-brand-secondary rounded-full text-xs font-semibold border border-brand-purple/30">{tone}</span>
                        ))}
                    </div>
                </div>
            </div>
            {profile.brandVoice.voiceGuidelines && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-4">
                        <h4 className="font-semibold text-green-400 mb-3 flex items-center gap-2"><i className="fas fa-check-circle" /> نعم — استخدم</h4>
                        <ul className="space-y-1.5">
                            {profile.brandVoice.voiceGuidelines.dos.map((d, i) => (
                                <li key={i} className="text-sm text-dark-text-secondary flex items-start gap-2"><i className="fas fa-plus text-green-500 mt-0.5 text-xs shrink-0" />{d}</li>
                            ))}
                        </ul>
                    </div>
                    <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-4">
                        <h4 className="font-semibold text-red-400 mb-3 flex items-center gap-2"><i className="fas fa-times-circle" /> لا — تجنب</h4>
                        <ul className="space-y-1.5">
                            {profile.brandVoice.voiceGuidelines.donts.map((d, i) => (
                                <li key={i} className="text-sm text-dark-text-secondary flex items-start gap-2"><i className="fas fa-minus text-red-500 mt-0.5 text-xs shrink-0" />{d}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
            <div className="bg-dark-bg rounded-xl p-4 flex items-center gap-6">
                <div className="space-y-1 text-sm flex-1">
                    <p className="text-dark-text-secondary text-xs uppercase tracking-wide font-semibold">Sentiment Score</p>
                    <div className="text-4xl font-black text-white">{profile.brandVoice.toneSentiment ?? 72}</div>
                    <p className="text-xs text-dark-text-secondary">/ 100</p>
                </div>
                <div className="flex-1 space-y-2">
                    {[
                        { label: 'إيجابي', val: profile.brandVoice.toneSentiment ?? 72, color: 'bg-green-500' },
                        { label: 'محايد',  val: 20, color: 'bg-gray-400' },
                        { label: 'سلبي',   val: 8,  color: 'bg-red-500' },
                    ].map(s => (
                        <div key={s.label} className="space-y-0.5">
                            <div className="flex justify-between text-xs text-dark-text-secondary"><span>{s.label}</span><span>{s.val}%</span></div>
                            <div className="h-1.5 bg-dark-card rounded-full overflow-hidden">
                                <div className={`h-full ${s.color} rounded-full`} style={{ width: `${s.val}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {voicePreview && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-dark-border/50" />
                        <p className="text-[11px] font-black uppercase tracking-widest text-brand-secondary">
                            {ar ? 'معاينة الصوت' : 'Voice Preview'}
                        </p>
                        <div className="h-px flex-1 bg-dark-border/50" />
                    </div>
                    {[
                        { key: 'complaint', icon: 'fa-comment-exclamation', labelAr: 'رد على شكوى', labelEn: 'Complaint Reply',     text: voicePreview.complaint, color: 'border-rose-500/25 bg-rose-500/5'   },
                        { key: 'post',      icon: 'fa-bullhorn',            labelAr: 'منشور ترويجي',  labelEn: 'Promotional Post',    text: voicePreview.post,      color: 'border-blue-500/25 bg-blue-500/5'   },
                        { key: 'welcome',   icon: 'fa-hand-wave',           labelAr: 'رسالة ترحيب',  labelEn: 'Welcome Message',     text: voicePreview.welcome,   color: 'border-emerald-500/25 bg-emerald-500/5' },
                    ].map(card => (
                        <div key={card.key} className={`rounded-xl border p-4 ${card.color}`}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <i className={`fas ${card.icon} text-xs text-dark-text-secondary`} />
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-dark-text-secondary">
                                        {ar ? card.labelAr : card.labelEn}
                                    </p>
                                </div>
                                <button
                                    onClick={() => copyText(card.key, card.text)}
                                    className="flex items-center gap-1 rounded-lg bg-dark-bg/50 px-2 py-1 text-[10px] font-semibold text-dark-text-secondary transition-colors hover:text-white"
                                >
                                    <i className={`fas ${copiedKey === card.key ? 'fa-check text-emerald-400' : 'fa-copy'} text-[9px]`} />
                                    {copiedKey === card.key ? (ar ? 'تم النسخ' : 'Copied!') : (ar ? 'نسخ' : 'Copy')}
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
                        {ar ? 'توليد معاينة جديدة' : 'Regenerate Preview'}
                    </button>
                </div>
            )}
        </div>
    );
};

const AudienceTabContent: React.FC<{
    profile: BrandHubProfile;
}> = ({ profile }) => {
    const [personas, setPersonas] = useState(profile.brandAudiences);
    const [editing, setEditing] = useState<number | null>(null);
    const [form, setForm] = useState<{ personaName: string; description: string; keyEmotions: string; painPoints: string }>({ personaName: '', description: '', keyEmotions: '', painPoints: '' });

    const openNew = () => {
        setEditing(-1);
        setForm({ personaName: '', description: '', keyEmotions: '', painPoints: '' });
    };
    const openEdit = (i: number) => {
        const p = personas[i];
        setEditing(i);
        setForm({ personaName: p.personaName, description: p.description, keyEmotions: p.keyEmotions.join(', '), painPoints: p.painPoints.join(', ') });
    };
    const savePersona = () => {
        const newP = { personaName: form.personaName, description: form.description, keyEmotions: form.keyEmotions.split(',').map(s => s.trim()).filter(Boolean), painPoints: form.painPoints.split(',').map(s => s.trim()).filter(Boolean) };
        if (editing === -1) setPersonas(prev => [...prev, newP]);
        else setPersonas(prev => prev.map((p, i) => i === editing ? newP : p));
        setEditing(null);
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Buyer Personas</h2>
                <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-pink to-brand-purple text-white rounded-xl text-sm font-semibold hover:opacity-90 transition">
                    <i className="fas fa-plus text-xs" /> بيرسونا جديدة
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {personas.map((aud, i) => (
                    <div key={i} className="bg-dark-bg border border-dark-border rounded-2xl p-5 space-y-3 hover:border-brand-pink/40 transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-pink to-brand-purple flex items-center justify-center text-white font-black text-lg shrink-0">
                                {aud.personaName.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-white truncate">{aud.personaName}</p>
                            </div>
                            <button onClick={() => openEdit(i)} className="text-dark-text-secondary hover:text-white p-1 rounded">
                                <i className="fas fa-pen text-xs" />
                            </button>
                            <button onClick={() => setPersonas(prev => prev.filter((_, idx) => idx !== i))} className="text-dark-text-secondary hover:text-red-400 p-1 rounded">
                                <i className="fas fa-trash text-xs" />
                            </button>
                        </div>
                        <p className="text-sm text-dark-text-secondary leading-relaxed">{aud.description}</p>
                        {aud.keyEmotions.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-brand-pink uppercase mb-1">المشاعر</p>
                                <div className="flex flex-wrap gap-1">
                                    {aud.keyEmotions.map((e, j) => <span key={j} className="text-xs px-2 py-0.5 bg-brand-pink/10 text-brand-pink rounded-full border border-brand-pink/20">{e}</span>)}
                                </div>
                            </div>
                        )}
                        {aud.painPoints.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-brand-secondary uppercase mb-1">Pain Points</p>
                                <div className="flex flex-wrap gap-1">
                                    {aud.painPoints.map((p, j) => <span key={j} className="text-xs px-2 py-0.5 bg-brand-purple/10 text-brand-secondary rounded-full border border-brand-purple/20">{p}</span>)}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {personas.length === 0 && (
                    <div className="col-span-full text-center py-12 text-dark-text-secondary">
                        <i className="fas fa-users text-4xl mb-3 opacity-30" />
                        <p>لا توجد بيرسونات — أضف أولى عملاءك المثاليين</p>
                    </div>
                )}
            </div>
            {editing !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-dark-card border border-dark-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <h3 className="font-bold text-white">{editing === -1 ? 'بيرسونا جديدة' : 'تعديل البيرسونا'}</h3>
                        <input value={form.personaName} onChange={e => setForm(f => ({ ...f, personaName: e.target.value }))}
                            placeholder="اسم البيرسونا" className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-pink" />
                        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            rows={3} placeholder="الوصف" className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-pink resize-none" />
                        <input value={form.keyEmotions} onChange={e => setForm(f => ({ ...f, keyEmotions: e.target.value }))}
                            placeholder="المشاعر (مفصولة بفواصل)" className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-pink" />
                        <input value={form.painPoints} onChange={e => setForm(f => ({ ...f, painPoints: e.target.value }))}
                            placeholder="Pain Points (مفصولة بفواصل)" className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-pink" />
                        <div className="flex gap-3">
                            <button onClick={savePersona} disabled={!form.personaName} className="flex-1 py-2.5 bg-gradient-to-r from-brand-pink to-brand-purple text-white rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50">حفظ</button>
                            <button onClick={() => setEditing(null)} className="px-4 py-2.5 border border-dark-border rounded-xl text-sm text-dark-text-secondary hover:bg-dark-bg transition">إلغاء</button>
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

    // Knowledge Base State
    const [knowledgeEntries, setKnowledgeEntries] = useState<BrandKnowledgeEntry[]>([]);
    const [knowledgeTab, setKnowledgeTab] = useState<BrandKnowledgeType>('product');
    const [isLoadingKnowledge, setIsLoadingKnowledge] = useState(false);
    const [showKnowledgeForm, setShowKnowledgeForm] = useState(false);
    const [editingEntry, setEditingEntry] = useState<BrandKnowledgeEntry | null>(null);
    const [kForm, setKForm] = useState({ title: '', content: '' });
    const [kSaving, setKSaving] = useState(false);

    // AI Quick-Fill State (P2-01)
    type AISuggestion = { title: string; content: string; status: 'pending' | 'approved' | 'rejected'; editTitle: string; editContent: string; editing: boolean };
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
    const [showAiReview, setShowAiReview] = useState(false);

    // Learning Library State
    const [documents, setDocuments] = useState<BrandDocument[]>([]);
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    const loadKnowledge = useCallback(async () => {
        if (!brandId) return;
        setIsLoadingKnowledge(true);
        try {
            const entries = await getBrandKnowledge(brandId);
            setKnowledgeEntries(entries);
        } catch (err) {
            console.warn('[BrandHub] knowledge fetch error:', err);
        } finally {
            setIsLoadingKnowledge(false);
        }
    }, [brandId]);

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

    useEffect(() => {
        if (activeTab === 'knowledge') loadKnowledge();
        if (activeTab === 'documents') loadDocuments();
    }, [activeTab, loadKnowledge, loadDocuments]);

    const handleDeleteDocument = async (docId: string) => {
        try {
            await deleteBrandDocument(brandId, docId);
            setDocuments(prev => prev.filter(d => d.id !== docId));
            addNotification(NotificationType.Success, 'تم حذف الوثيقة');
        } catch {
            addNotification(NotificationType.Error, 'فشل الحذف');
        }
    };

    const openAddForm = () => {
        setEditingEntry(null);
        setKForm({ title: '', content: '' });
        setShowKnowledgeForm(true);
    };

    const openEditForm = (entry: BrandKnowledgeEntry) => {
        setEditingEntry(entry);
        setKForm({ title: entry.title, content: entry.content });
        setShowKnowledgeForm(true);
    };

    const handleKSave = async () => {
        if (!kForm.title.trim() || !kForm.content.trim()) return;
        setKSaving(true);
        try {
            if (editingEntry) {
                await updateKnowledgeEntry(brandId, editingEntry.id, { title: kForm.title, content: kForm.content });
                addNotification(NotificationType.Success, 'تم تحديث السجل.');
            } else {
                await addKnowledgeEntry(brandId, { type: knowledgeTab, title: kForm.title, content: kForm.content, metadata: {}, sortOrder: 0 });
                addNotification(NotificationType.Success, 'تم إضافة السجل.');
            }
            setShowKnowledgeForm(false);
            await loadKnowledge();
        } catch (err) {
            addNotification(NotificationType.Error, 'فشل الحفظ.');
        } finally {
            setKSaving(false);
        }
    };

    const handleKDelete = async (entry: BrandKnowledgeEntry) => {
        try {
            await deleteKnowledgeEntry(brandId, entry.id);
            setKnowledgeEntries(prev => prev.filter(e => e.id !== entry.id));
            addNotification(NotificationType.Success, 'تم الحذف.');
        } catch {
            addNotification(NotificationType.Error, 'فشل الحذف.');
        }
    };

    const handleAIQuickFill = async () => {
        setAiGenerating(true);
        setShowAiReview(false);
        setAiSuggestions([]);
        const typeLabels: Record<string, string> = {
            product: 'منتجات أو خدمات يقدمها البراند',
            faq: 'أسئلة شائعة مع إجاباتها',
            scenario_script: 'سيناريوهات رد على اعتراضات شائعة',
        };
        const typeLabel = typeLabels[knowledgeTab] || knowledgeTab;
        const brandContext = [
            `اسم البراند: ${profile.brandName}`,
            profile.industry ? `الصناعة: ${profile.industry}` : null,
            profile.description ? `الوصف: ${profile.description}` : null,
            profile.targetAudienceSummary ? `الجمهور: ${profile.targetAudienceSummary}` : null,
            profile.brandAudiences?.[0]?.description ? `وصف الجمهور: ${profile.brandAudiences[0].description}` : null,
        ].filter(Boolean).join('\n');
        try {
            const res = await callAIProxy({
                model: 'gemini-2.5-flash',
                contents: [{
                    role: 'user',
                    parts: [{ text: `بناءً على هذه المعلومات عن البراند:\n${brandContext}\n\nاقترح 6 سجلات عملية من نوع "${typeLabel}" لقاعدة المعرفة. كل سجل يجب أن يكون مناسباً لهذا البراند تحديداً. أرجع JSON فقط.` }],
                }],
                schema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING, description: 'عنوان مختصر واضح' },
                                    content: { type: Type.STRING, description: 'المحتوى التفصيلي' },
                                },
                                required: ['title', 'content'],
                            },
                        },
                    },
                    required: ['suggestions'],
                },
                feature: 'knowledge_quickfill',
            });
            const data = (typeof res.text === 'string' ? JSON.parse(res.text) : res.text) as { suggestions: { title: string; content: string }[] };
            const suggestions: AISuggestion[] = (data.suggestions ?? []).slice(0, 8).map(s => ({
                title: s.title,
                content: s.content,
                status: 'pending',
                editTitle: s.title,
                editContent: s.content,
                editing: false,
            }));
            setAiSuggestions(suggestions);
            setShowAiReview(true);
        } catch (err) {
            addNotification(NotificationType.Error, 'فشل التوليد — تحقق من اتصال الذكاء الاصطناعي');
            console.error('[AI QuickFill]', err);
        } finally {
            setAiGenerating(false);
        }
    };

    const handleSaveAISuggestions = async () => {
        const approved = aiSuggestions.filter(s => s.status === 'approved');
        if (approved.length === 0) return;
        setKSaving(true);
        try {
            for (const s of approved) {
                await addKnowledgeEntry(brandId, {
                    type: knowledgeTab,
                    title: s.editing ? s.editTitle : s.title,
                    content: s.editing ? s.editContent : s.content,
                    metadata: {},
                    sortOrder: 0,
                });
            }
            addNotification(NotificationType.Success, `تم حفظ ${approved.length} سجل جديد ✓`);
            setShowAiReview(false);
            setAiSuggestions([]);
            await loadKnowledge();
        } catch {
            addNotification(NotificationType.Error, 'فشل حفظ المقترحات');
        } finally {
            setKSaving(false);
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

    // Brand Assets State
    const [brandAssets, setBrandAssets] = useState({
        logoUrl: '',
        logoPreview: '',
        primaryColor: '#6366F1',
        secondaryColor: '#EC4899',
        accentColor: '#F59E0B',
        fontPrimary: 'Cairo',
        fontSecondary: 'Inter',
        extraColors: [] as string[],
    });

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
                    <button onClick={() => onUpdate(profile)} className="bg-brand-primary text-white font-bold py-2 px-5 rounded-lg hover:bg-brand-secondary">
                        حفظ التغييرات
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
                                    addNotification(NotificationType.Success, 'تم تحديث بيانات البراند من الوثيقة');
                                    window.location.reload();
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
                            onClick={() => addNotification(NotificationType.Success, '✅ تم حفظ أصول البراند — ستُطبَّق على المحتوى تلقائياً')}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-brand-pink to-brand-purple text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
                        >
                            <i className="fas fa-save"></i>
                            حفظ أصول البراند
                        </button>
                    </div>
                )}
                {/* BRD-2: Voice Profile Visualizer */}
                {activeTab === 'voice' && (
                    <VoiceTabContent profile={profile} brandId={brandId} addNotification={addNotification} />
                )}
                {/* BRD-1: Buyer Personas Builder */}
                {activeTab === 'audience' && (
                    <AudienceTabContent profile={profile} />
                )}
                {/* ── Knowledge Base Tab ──────────────────────────────────── */}
                {activeTab === 'knowledge' && (() => {
                    const KNOWLEDGE_TYPES: { id: BrandKnowledgeType; label: string; icon: string; placeholder: { title: string; content: string } }[] = [
                        { id: 'product',         label: 'المنتجات والخدمات', icon: 'fa-box-open',    placeholder: { title: 'اسم المنتج أو الخدمة', content: 'وصف المنتج، المميزات، السعر، إلخ...' } },
                        { id: 'faq',             label: 'الأسئلة الشائعة',  icon: 'fa-question-circle', placeholder: { title: 'السؤال', content: 'الإجابة الكاملة...' } },
                        { id: 'policy',          label: 'السياسات',          icon: 'fa-file-contract', placeholder: { title: 'نوع السياسة (شحن، إرجاع، دفع...)', content: 'تفاصيل السياسة...' } },
                        { id: 'competitor',      label: 'المنافسون',         icon: 'fa-chess',        placeholder: { title: 'اسم المنافس', content: 'نقاط القوة، الضعف، الفرق...' } },
                        { id: 'scenario_script', label: 'سيناريوهات الرد',   icon: 'fa-comments',     placeholder: { title: 'اسم السيناريو (مثل: رد على شكوى تأخير)', content: 'الرد المقترح بالكامل...' } },
                    ];
                    const currentTypeConfig = KNOWLEDGE_TYPES.find(t => t.id === knowledgeTab)!;
                    const visibleEntries = knowledgeEntries.filter(e => e.type === knowledgeTab);

                    return (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <i className="fas fa-database text-brand-pink" />
                                        قاعدة المعرفة الخاصة
                                    </h2>
                                    <p className="text-xs text-dark-text-secondary mt-1">
                                        هذه المعلومات تُغذّي الذكاء الاصطناعي في كل طلباتك — كلما كانت أدق كانت المخرجات أفضل.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {['product', 'faq', 'scenario_script'].includes(knowledgeTab) && (
                                        <button
                                            onClick={handleAIQuickFill}
                                            disabled={aiGenerating}
                                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-pink to-brand-purple text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
                                        >
                                            {aiGenerating
                                                ? <i className="fas fa-circle-notch fa-spin text-xs" />
                                                : <i className="fas fa-magic text-xs" />
                                            }
                                            {aiGenerating ? 'جاري التوليد...' : 'توليد بـ AI'}
                                        </button>
                                    )}
                                    <button
                                        onClick={openAddForm}
                                        className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-secondary transition-colors"
                                    >
                                        <i className="fas fa-plus text-xs" />
                                        إضافة سجل
                                    </button>
                                </div>
                            </div>

                            {/* Type sub-tabs */}
                            <div className="flex gap-1.5 flex-wrap">
                                {KNOWLEDGE_TYPES.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setKnowledgeTab(t.id)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                            knowledgeTab === t.id
                                                ? 'bg-brand-primary text-white'
                                                : 'bg-dark-bg text-dark-text-secondary hover:text-white border border-dark-border'
                                        }`}
                                    >
                                        <i className={`fas ${t.icon} text-[10px]`} />
                                        {t.label}
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                            knowledgeTab === t.id ? 'bg-white/20' : 'bg-dark-card'
                                        }`}>
                                            {knowledgeEntries.filter(e => e.type === t.id).length}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* AI Review Panel (P2-01) */}
                            {showAiReview && aiSuggestions.length > 0 && (
                                <div className="rounded-2xl border border-brand-pink/30 bg-brand-pink/5 p-5 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                                <i className="fas fa-magic text-brand-pink" />
                                                مقترحات الذكاء الاصطناعي
                                            </h3>
                                            <p className="text-[11px] text-dark-text-secondary mt-0.5">راجع كل مقترح — ✓ وافق / ✎ عدّل / ✗ ارفض</p>
                                        </div>
                                        <button onClick={() => { setShowAiReview(false); setAiSuggestions([]); }} className="text-dark-text-secondary hover:text-white">
                                            <i className="fas fa-times text-sm" />
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {aiSuggestions.map((s, i) => (
                                            <div key={i} className={`rounded-xl border p-4 transition-all ${
                                                s.status === 'approved' ? 'border-emerald-500/40 bg-emerald-500/5' :
                                                s.status === 'rejected' ? 'border-dark-border opacity-40' :
                                                'border-dark-border bg-dark-bg'
                                            }`}>
                                                {s.editing ? (
                                                    <div className="space-y-2">
                                                        <input
                                                            value={s.editTitle}
                                                            onChange={e => setAiSuggestions(prev => prev.map((x, j) => j === i ? { ...x, editTitle: e.target.value } : x))}
                                                            className="w-full bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary"
                                                        />
                                                        <textarea
                                                            value={s.editContent}
                                                            onChange={e => setAiSuggestions(prev => prev.map((x, j) => j === i ? { ...x, editContent: e.target.value } : x))}
                                                            rows={3}
                                                            className="w-full bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary resize-none"
                                                        />
                                                        <button
                                                            onClick={() => setAiSuggestions(prev => prev.map((x, j) => j === i ? { ...x, editing: false, status: 'approved' } : x))}
                                                            className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold"
                                                        >
                                                            <i className="fas fa-check me-1" />حفظ التعديل
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-white">{s.editTitle || s.title}</p>
                                                            <p className="text-xs text-dark-text-secondary mt-1 leading-relaxed">{s.editContent || s.content}</p>
                                                        </div>
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            <button
                                                                onClick={() => setAiSuggestions(prev => prev.map((x, j) => j === i ? { ...x, status: x.status === 'approved' ? 'pending' : 'approved' } : x))}
                                                                title="موافق"
                                                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${s.status === 'approved' ? 'bg-emerald-500 text-white' : 'text-emerald-400 hover:bg-emerald-500/20'}`}
                                                            ><i className="fas fa-check" /></button>
                                                            <button
                                                                onClick={() => setAiSuggestions(prev => prev.map((x, j) => j === i ? { ...x, editing: true, editTitle: x.editTitle || x.title, editContent: x.editContent || x.content } : x))}
                                                                title="تعديل"
                                                                className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-400 hover:bg-blue-500/20 transition-colors"
                                                            ><i className="fas fa-pen text-xs" /></button>
                                                            <button
                                                                onClick={() => setAiSuggestions(prev => prev.map((x, j) => j === i ? { ...x, status: x.status === 'rejected' ? 'pending' : 'rejected' } : x))}
                                                                title="رفض"
                                                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${s.status === 'rejected' ? 'bg-red-500/30 text-red-400' : 'text-red-400 hover:bg-red-500/20'}`}
                                                            ><i className="fas fa-times" /></button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {aiSuggestions.some(s => s.status === 'approved') && (
                                        <button
                                            onClick={handleSaveAISuggestions}
                                            disabled={kSaving}
                                            className="w-full py-2.5 bg-gradient-to-r from-brand-pink to-brand-purple text-white font-bold rounded-xl text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                        >
                                            {kSaving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-save" />}
                                            حفظ {aiSuggestions.filter(s => s.status === 'approved').length} مقترح موافق عليه
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Add/Edit Form */}
                            {showKnowledgeForm && (
                                <div className="rounded-2xl border border-brand-primary/30 bg-brand-primary/5 p-5 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                            <i className={`fas ${currentTypeConfig.icon} text-brand-pink`} />
                                            {editingEntry ? 'تعديل السجل' : `إضافة — ${currentTypeConfig.label}`}
                                        </h3>
                                        <button onClick={() => setShowKnowledgeForm(false)} className="text-dark-text-secondary hover:text-white text-xs">
                                            <i className="fas fa-times" />
                                        </button>
                                    </div>
                                    <input
                                        value={kForm.title}
                                        onChange={e => setKForm(f => ({ ...f, title: e.target.value }))}
                                        placeholder={currentTypeConfig.placeholder.title}
                                        className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-pink"
                                    />
                                    <textarea
                                        value={kForm.content}
                                        onChange={e => setKForm(f => ({ ...f, content: e.target.value }))}
                                        placeholder={currentTypeConfig.placeholder.content}
                                        rows={4}
                                        className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-pink resize-none"
                                    />
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleKSave}
                                            disabled={kSaving || !kForm.title.trim() || !kForm.content.trim()}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-secondary disabled:opacity-40 transition-colors"
                                        >
                                            {kSaving ? <i className="fas fa-spinner fa-spin text-xs" /> : <i className="fas fa-save text-xs" />}
                                            حفظ
                                        </button>
                                        <button onClick={() => setShowKnowledgeForm(false)} className="px-4 py-2 text-sm text-dark-text-secondary hover:text-white transition-colors">
                                            إلغاء
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Entries list */}
                            {isLoadingKnowledge ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => <div key={i} className="h-16 bg-dark-bg rounded-xl animate-pulse" />)}
                                </div>
                            ) : visibleEntries.length === 0 ? (
                                <div className="py-16 text-center rounded-2xl border border-dashed border-dark-border">
                                    <i className={`fas ${currentTypeConfig.icon} text-4xl text-dark-text-secondary mb-3 block opacity-30`} />
                                    <p className="text-sm text-dark-text-secondary mb-4">لا توجد سجلات في {currentTypeConfig.label} بعد</p>
                                    <button
                                        onClick={openAddForm}
                                        className="px-4 py-2 bg-brand-primary/10 text-brand-secondary rounded-xl text-sm font-semibold hover:bg-brand-primary hover:text-white transition-colors"
                                    >
                                        <i className="fas fa-plus me-2 text-xs" />
                                        أضف أول سجل
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {visibleEntries.map(entry => (
                                        <div key={entry.id} className="group rounded-xl border border-dark-border bg-dark-bg p-4 hover:border-brand-primary/30 transition-colors">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold text-white truncate">{entry.title}</p>
                                                    <p className="mt-1 text-xs text-dark-text-secondary leading-relaxed line-clamp-2">{entry.content}</p>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                    <button
                                                        onClick={() => openEditForm(entry)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-dark-text-secondary hover:text-white hover:bg-blue-500/20 transition-colors"
                                                        title="تعديل"
                                                    >
                                                        <i className="fas fa-pen text-xs" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleKDelete(entry)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-dark-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                        title="حذف"
                                                    >
                                                        <i className="fas fa-trash text-xs" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* ── Learning Library Tab ────────────────────────────────── */}
                {activeTab === 'documents' && (
                    <div className="space-y-5">
                        {showImportModal && activeTab === 'documents' && (
                            <BrandImportModal
                                onClose={() => setShowImportModal(false)}
                                existingBrandId={brandId}
                                onImported={async () => {
                                    setShowImportModal(false);
                                    await loadDocuments();
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

                                                <div className="flex items-center gap-4 mt-3 flex-wrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`text-sm font-bold ${completenessColor}`}>{doc.completenessScore}%</span>
                                                        <span className="text-[10px] text-dark-text-secondary">اكتمال</span>
                                                    </div>
                                                    {doc.knowledgeEntriesSaved > 0 && (
                                                        <div className="flex items-center gap-1 text-[10px] text-blue-400">
                                                            <i className="fas fa-database text-[8px]" />
                                                            {doc.knowledgeEntriesSaved} معرفة
                                                        </div>
                                                    )}
                                                    {doc.memoryEntriesSaved > 0 && (
                                                        <div className="flex items-center gap-1 text-[10px] text-purple-400">
                                                            <i className="fas fa-brain text-[8px]" />
                                                            {doc.memoryEntriesSaved} ذاكرة AI
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {documents.length > 0 && (
                            <div className="p-3 bg-dark-bg rounded-lg border border-dark-border text-xs text-dark-text-secondary text-center">
                                {documents.length} وثيقة •{' '}
                                {documents.reduce((s, d) => s + d.knowledgeEntriesSaved, 0)} إدخال معرفة •{' '}
                                {documents.reduce((s, d) => s + d.memoryEntriesSaved, 0)} مثال في الذاكرة
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'intelligence' && (() => {
                    // ── Completeness scoring ───────────────────────────────────
                    const identityPts = Math.round([
                        profile.brandName, profile.industry, profile.description,
                        (profile.values?.length ?? 0) > 0, profile.country, profile.website,
                        profile.valueProp, profile.brandPromise
                    ].filter(Boolean).length * 3.75);

                    const voicePts = [
                        (profile.brandVoice.toneDescription?.length ?? 0) > 0,
                        (profile.brandVoice.keywords?.length ?? 0) > 0,
                        (profile.brandVoice.negativeKeywords?.length ?? 0) > 0,
                        (profile.brandVoice.voiceGuidelines?.dos?.length ?? 0) > 0,
                    ].filter(Boolean).length * 5;

                    const audiencePts = Math.min(
                        ((profile.brandAudiences?.length ?? 0) >= 1 ? 10 : 0) +
                        ((profile.brandAudiences?.length ?? 0) >= 2 ? 5 : 0) +
                        ((profile.brandAudiences?.[0]?.painPoints?.length ?? 0) > 0 ? 5 : 0),
                        20,
                    );

                    const knowledgePts = Math.min(Math.floor(intellData.knowledgeCount / 3) * 5, 20);
                    const connectionsPts = intellData.socialCount > 0 ? 10 : 0;
                    const totalScore = identityPts + voicePts + audiencePts + knowledgePts + connectionsPts;

                    // ── AI confidence per unit ─────────────────────────────────
                    const contentConf  = Math.round(((identityPts / 30 + voicePts / 20) / 2) * 100);
                    const repliesConf  = Math.round(((audiencePts / 20 + knowledgePts / 20) / 2) * 100);
                    const adsConf      = Math.round(((identityPts / 30 + voicePts / 20 + audiencePts / 20) / 3) * 100);
                    const analyticsConf = connectionsPts > 0 ? Math.round(((connectionsPts / 10 + identityPts / 30) / 2) * 100) : 0;

                    const categories = [
                        { label: 'الهوية',    pts: identityPts,    max: 30, color: 'bg-blue-500' },
                        { label: 'الصوت',     pts: voicePts,       max: 20, color: 'bg-purple-500' },
                        { label: 'الجمهور',   pts: audiencePts,    max: 20, color: 'bg-pink-500' },
                        { label: 'المعرفة',   pts: knowledgePts,   max: 20, color: 'bg-emerald-500' },
                        { label: 'الاتصالات', pts: connectionsPts, max: 10, color: 'bg-amber-500' },
                    ];

                    // ── Recommended actions (based on what's missing) ──────────
                    type HubTab = 'identity' | 'voice' | 'audience' | 'knowledge';
                    const actions: { label: string; impact: string; hubTab: HubTab | null; route?: string; icon: string }[] = [];
                    if (!profile.description)
                        actions.push({ label: 'أضف وصفاً للبراند', impact: 'يُحسّن توليد المحتوى بـ 35%', hubTab: 'identity', icon: 'fa-building' });
                    if (!(profile.brandVoice.voiceGuidelines?.dos?.length))
                        actions.push({ label: 'أضف إرشادات الصوت', impact: 'يُقلّل أخطاء النبرة بـ 60%', hubTab: 'voice', icon: 'fa-microphone' });
                    if (!(profile.brandAudiences?.length))
                        actions.push({ label: 'أنشئ شخصية الجمهور', impact: 'يُحسّن الردود الذكية بـ 50%', hubTab: 'audience', icon: 'fa-users' });
                    if (intellData.knowledgeCount < 5)
                        actions.push({ label: 'أضف منتجاتك وخدماتك', impact: 'يُحسّن ردود المبيعات بـ 40%', hubTab: 'knowledge', icon: 'fa-database' });
                    if (intellData.socialCount === 0)
                        actions.push({ label: 'اربط حسابات التواصل', impact: 'يُفعّل التحليلات الحقيقية', hubTab: null, route: 'social-ops/accounts', icon: 'fa-plug' });

                    const scoreColor = totalScore >= 80 ? '#10B981' : totalScore >= 50 ? '#F59E0B' : '#EF4444';
                    const scoreTextColor = totalScore >= 80 ? 'text-emerald-400' : totalScore >= 50 ? 'text-yellow-400' : 'text-red-400';
                    const circ = 2 * Math.PI * 40;

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
                                    {/* ── Completeness: ring + category bars ── */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                                <i className="fas fa-magnifying-glass-plus" /> إجراء تدقيق شامل للبراند
                                            </button>
                                        </div>

                                        <div className="bg-dark-bg rounded-2xl p-6 space-y-4">
                                            <p className="text-sm font-bold text-dark-text-secondary">توزيع النقاط</p>
                                            {categories.map(cat => (
                                                <div key={cat.label}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs text-white font-medium">{cat.label}</span>
                                                        <span className="text-xs text-dark-text-secondary">{cat.pts}/{cat.max}</span>
                                                    </div>
                                                    <div className="h-2 bg-dark-card rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${cat.color} rounded-full transition-all duration-700`}
                                                            style={{ width: `${(cat.pts / cat.max) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ── AI Confidence bars ── */}
                                    <div className="bg-dark-bg rounded-2xl p-6">
                                        <p className="text-sm font-bold text-dark-text-secondary mb-4">مستوى ثقة الذكاء الاصطناعي</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            {([
                                                { label: 'توليد المحتوى',  value: contentConf,   icon: 'fa-pen-nib',       color: 'bg-blue-500' },
                                                { label: 'الردود الذكية',  value: repliesConf,   icon: 'fa-comment-dots',  color: 'bg-purple-500' },
                                                { label: 'كتابة الإعلانات', value: adsConf,       icon: 'fa-bullhorn',      color: 'bg-pink-500' },
                                                { label: 'تحليل البيانات', value: analyticsConf, icon: 'fa-chart-line',    color: 'bg-emerald-500' },
                                            ] as const).map(item => (
                                                <div key={item.label} className="bg-dark-card rounded-xl p-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <i className={`fas ${item.icon} text-xs text-dark-text-secondary`}></i>
                                                        <span className="text-xs text-white font-medium">{item.label}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-2 bg-dark-bg rounded-full overflow-hidden">
                                                            <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }} />
                                                        </div>
                                                        <span className={`text-xs font-bold ${item.value >= 70 ? 'text-emerald-400' : item.value >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                            {item.value}%
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ── Data Sources + Recommended Actions ── */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-dark-bg rounded-2xl p-6">
                                            <p className="text-sm font-bold text-dark-text-secondary mb-4">مصادر البيانات النشطة</p>
                                            <div className="space-y-3">
                                                {[
                                                    { label: 'بيانات يدوية',         active: true,                        desc: 'ملف البراند + الصوت + الجمهور' },
                                                    { label: 'صفحات مرتبطة',         active: intellData.socialCount > 0,  desc: `${intellData.socialCount} حساب متصل` },
                                                    { label: 'قاعدة المعرفة',         active: intellData.knowledgeCount > 0, desc: `${intellData.knowledgeCount} عنصر (${intellData.knowledgeByType['product'] || 0} منتج، ${intellData.knowledgeByType['faq'] || 0} أسئلة)` },
                                                    { label: 'وثائق مرفوعة',          active: intellData.docCount > 0,     desc: `${intellData.docCount} وثيقة` },
                                                    { label: 'CRM وبيانات المبيعات', active: false,                       desc: 'غير مفعّل بعد' },
                                                ].map(src => (
                                                    <div key={src.label} className="flex items-center gap-3">
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${src.active ? 'bg-emerald-500/20' : 'bg-dark-card'}`}>
                                                            <i className={`fas fa-${src.active ? 'check' : 'xmark'} text-[10px] ${src.active ? 'text-emerald-400' : 'text-dark-text-secondary'}`}></i>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold text-white">{src.label}</p>
                                                            <p className="text-[10px] text-dark-text-secondary">{src.desc}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-dark-bg rounded-2xl p-6">
                                            <p className="text-sm font-bold text-dark-text-secondary mb-4">إجراءات موصى بها</p>
                                            {actions.length === 0 ? (
                                                <div className="text-center py-6">
                                                    <i className="fas fa-check-circle text-emerald-400 text-3xl"></i>
                                                    <p className="text-sm text-emerald-400 mt-2 font-semibold">ممتاز! البراند مكتمل</p>
                                                    <p className="text-xs text-dark-text-secondary mt-1">الذكاء الاصطناعي يعمل بأعلى كفاءة</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {actions.map((action, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => {
                                                                if (action.hubTab) setActiveTab(action.hubTab);
                                                                else if (action.route && onNavigate) onNavigate(action.route);
                                                            }}
                                                            disabled={!action.hubTab && !action.route}
                                                            className="w-full text-right flex items-start gap-3 bg-dark-card rounded-xl p-3 hover:bg-brand-primary/10 transition-colors disabled:opacity-60 disabled:cursor-default"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-brand-primary/20 flex items-center justify-center flex-shrink-0">
                                                                <i className={`fas ${action.icon} text-xs text-brand-primary`}></i>
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-semibold text-white text-right">{action.label}</p>
                                                                <p className="text-[10px] text-brand-primary mt-0.5">{action.impact}</p>
                                                            </div>
                                                            {action.hubTab && <i className="fas fa-arrow-left text-[10px] text-dark-text-secondary flex-shrink-0 mt-1"></i>}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
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
                        <h2 className="text-xl font-bold text-white">ذاكرة AI ومقياس الاتساق</h2>

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
                            <div className="bg-dark-bg p-4 rounded-lg">
                                <h3 className="font-semibold text-white mb-2">مُقيِّم اتساق البراند</h3>
                                <p className="text-xs text-dark-text-secondary mb-3">الصق أي محتوى (منشور، إعلان، رد) لتقييم مدى توافقه مع هوية براندك.</p>
                                <textarea
                                    value={contentToEvaluate}
                                    onChange={e => setContentToEvaluate(e.target.value)}
                                    rows={5}
                                    placeholder="الصق المحتوى هنا..."
                                    className="w-full p-2 bg-dark-card border border-dark-border rounded-md"
                                />
                                <button onClick={handleEvaluateContent} disabled={isEvaluating} className="w-full mt-3 bg-brand-secondary text-white font-bold py-2 rounded-lg disabled:bg-gray-500">
                                    {isEvaluating ? 'جاري التقييم...' : 'تقييم الآن'}
                                </button>
                            </div>
                             <div className="flex flex-col items-center justify-center bg-dark-bg p-4 rounded-lg">
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
                            <div className="bg-dark-bg p-4 rounded-lg">
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
