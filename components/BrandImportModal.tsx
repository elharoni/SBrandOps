import React, { useState, useRef, useCallback } from 'react';
import { addBrand } from '../services/brandService';
import { updateBrandProfile } from '../services/brandHubService';
import { addKnowledgeEntry } from '../services/brandKnowledgeService';
import { addBrandDocument, BrandDocType, DOC_TYPE_LABELS } from '../services/brandDocumentService';
import { extractBrandFromDocument, extractBrandFromFileData, calcBrandImportCompleteness, BrandImportData } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { useModalClose } from '../hooks/useModalClose';

interface Props {
    onClose: () => void;
    onImported: (brandId: string, brandName: string) => void;
    /** If provided, updates the existing brand instead of creating a new one */
    existingBrandId?: string;
    currentBrandCount?: number;
}

type Step = 'input' | 'analyzing' | 'preview' | 'saving' | 'done';

// MIME types Gemini can read natively as inline_data.
// Only PDF is confirmed supported — DOCX/DOC/PPTX must be converted or pasted as text.
const BINARY_MIME_TYPES: Record<string, string> = {
    'pdf': 'application/pdf',
};

// Formats that need conversion before Gemini can read them
const UNSUPPORTED_BINARY_EXTS = new Set(['docx', 'doc', 'pptx', 'xlsx']);

const FORMAT_ICONS: Record<string, string> = {
    pdf: '📕', docx: '📘', doc: '📘', pptx: '📙',
    xlsx: '📗', txt: '📄', md: '📄',
};

function getFileExt(name: string): string {
    return name.split('.').pop()?.toLowerCase() ?? '';
}

function isBinaryFormat(name: string): boolean {
    return getFileExt(name) in BINARY_MIME_TYPES;
}

function isUnsupportedBinary(name: string): boolean {
    return UNSUPPORTED_BINARY_EXTS.has(getFileExt(name));
}

interface FileEntry {
    id: string;
    name: string;
    docType: BrandDocType;
    // For text files (txt, md):
    text: string;
    // For binary files (pdf, docx, doc, pptx):
    binaryData?: { base64: string; mimeType: string; sizeBytes: number };
}

const KNOWLEDGE_TYPE_LABELS: Record<string, string> = {
    product: 'منتج / خدمة',
    faq: 'سؤال شائع',
    policy: 'سياسة',
    competitor: 'منافس',
    scenario_script: 'سكريبت',
};

const CONTENT_TYPE_ICONS: Record<string, string> = {
    post: '📱', caption: '✏️', slogan: '⚡', tagline: '💬',
    ad_copy: '📢', bio: '👤', story: '📖',
};

// ── Completeness ring ─────────────────────────────────────────────────────────
const CompletenessRing: React.FC<{ score: number }> = ({ score }) => {
    const color = score >= 75 ? '#22c55e' : score >= 50 ? '#eab308' : '#f97316';
    const r = 28, circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    return (
        <div className="flex flex-col items-center gap-1">
            <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r={r} fill="none" stroke="#374151" strokeWidth="7" />
                <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7"
                    strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset}
                    strokeLinecap="round" transform="rotate(-90 36 36)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease-out' }} />
                <text x="36" y="40" textAnchor="middle" fill={color} fontSize="14" fontWeight="bold">{score}%</text>
            </svg>
            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">اكتمال البراند</span>
        </div>
    );
};

// Read a File as base64 string
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Strip "data:...;base64," prefix
            resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function guessDocType(fileName: string): BrandDocType {
    const n = fileName.toLowerCase();
    if (n.includes('competitor') || n.includes('منافس')) return 'competitor_analysis';
    if (n.includes('style') || n.includes('أسلوب')) return 'style_guide';
    if (n.includes('sample') || n.includes('content') || n.includes('محتوى')) return 'sample_content';
    if (n.includes('market') || n.includes('سوق')) return 'market_research';
    return 'brand_book';
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const BrandImportModal: React.FC<Props> = ({ onClose, onImported, existingBrandId }) => {
    const [step, setStep] = useState<Step>('input');
    const [files, setFiles] = useState<FileEntry[]>([{ id: '1', name: 'وثيقة رئيسية', text: '', docType: 'brand_book' }]);
    const [extracted, setExtracted] = useState<BrandImportData | null>(null);
    const [completeness, setCompleteness] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [saveProgress, setSaveProgress] = useState('');
    const [saveDetails, setSaveDetails] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeFileId, setActiveFileId] = useState('1');
    useModalClose(onClose);

    const activeFile = files.find(f => f.id === activeFileId) ?? files[0];

    const updateFile = (id: string, patch: Partial<FileEntry>) =>
        setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));

    const addFile = () => {
        const id = Date.now().toString();
        setFiles(prev => [...prev, { id, name: `وثيقة ${prev.length + 1}`, text: '', docType: 'other' }]);
        setActiveFileId(id);
    };

    const removeFile = (id: string) => {
        if (files.length === 1) return;
        const remaining = files.filter(f => f.id !== id);
        setFiles(remaining);
        setActiveFileId(remaining[0].id);
    };

    const loadFileEntry = async (file: File): Promise<Partial<FileEntry>> => {
        const ext = getFileExt(file.name);
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const docType = guessDocType(file.name);

        if (isUnsupportedBinary(file.name)) {
            // DOCX/DOC/PPTX: Gemini inline_data doesn't support these.
            // Store as unsupported so we can show a conversion message.
            return {
                name: baseName, docType, text: '',
                binaryData: { base64: '', mimeType: 'unsupported', sizeBytes: file.size },
            };
        } else if (isBinaryFormat(file.name)) {
            const base64 = await fileToBase64(file);
            const mimeType = BINARY_MIME_TYPES[ext] ?? file.type;
            return {
                name: baseName, docType, text: '',
                binaryData: { base64, mimeType, sizeBytes: file.size },
            };
        } else {
            const text = await file.text();
            return { name: baseName, docType, text, binaryData: undefined };
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const patch = await loadFileEntry(file);
        updateFile(activeFileId, patch);
        e.target.value = '';
    };

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        const supported = Array.from(e.dataTransfer.files).filter(f => {
            const ext = getFileExt(f.name);
            return ['txt', 'md', 'pdf', 'docx', 'doc', 'pptx', 'xlsx'].includes(ext);
        });
        if (!supported.length) return;

        const newEntries: FileEntry[] = await Promise.all(
            supported.map(async (f, i) => {
                const patch = await loadFileEntry(f);
                return { id: `${Date.now()}_${i}`, ...patch } as FileEntry;
            })
        );

        setFiles(prev => {
            const merged = [...prev];
            // If the first file is empty, replace it
            if (merged.length === 1 && !merged[0].text) {
                merged[0] = { ...merged[0], ...newEntries[0] };
                return [...merged, ...newEntries.slice(1)];
            }
            return [...merged, ...newEntries];
        });
        setActiveFileId(newEntries[0].id);
    }, []);

    const handleAnalyze = async () => {
        const readyFiles = files.filter(f =>
            (f.text.trim() || f.binaryData) &&
            f.binaryData?.mimeType !== 'unsupported'
        );
        if (!readyFiles.length) {
            setError('يرجى رفع ملف PDF أو TXT/MD، أو لصق المحتوى في مربع النص.');
            return;
        }
        const oversized = readyFiles.find(f => f.binaryData && f.binaryData.sizeBytes > 170 * 1024);
        if (oversized) {
            setError(`الملف "${oversized.name}" كبير جداً (${formatBytes(oversized.binaryData!.sizeBytes)}). يرجى تشغيل "supabase functions deploy ai-proxy" أو نسخ المحتوى كنص.`);
            return;
        }
        setError(null);
        setStep('analyzing');
        try {
            let data: BrandImportData;

            if (readyFiles.length === 1 && readyFiles[0].binaryData) {
                // Single binary file (PDF) → send directly to Gemini as inline_data
                const { base64, mimeType } = readyFiles[0].binaryData;
                data = await extractBrandFromFileData(base64, mimeType);
            } else if (readyFiles.length === 1 && readyFiles[0].text) {
                // Single text file
                data = await extractBrandFromDocument(readyFiles[0].text);
            } else {
                // Multiple files → merge text files, prepend binary file names as context
                const textParts = readyFiles
                    .filter(f => f.text.trim())
                    .map(f => `=== ${f.name} (${DOC_TYPE_LABELS[f.docType]}) ===\n\n${f.text}`);
                const binaryNote = readyFiles
                    .filter(f => f.binaryData)
                    .map(f => `[ملف ثنائي مرفق: ${f.name}]`);
                const merged = [...binaryNote, ...textParts].join('\n\n---\n\n');
                // If there are binary files mixed in, use the first one as the primary
                const firstBinary = readyFiles.find(f => f.binaryData);
                if (firstBinary?.binaryData && textParts.length === 0) {
                    data = await extractBrandFromFileData(firstBinary.binaryData.base64, firstBinary.binaryData.mimeType);
                } else {
                    data = await extractBrandFromDocument(merged);
                }
            }

            const score = calcBrandImportCompleteness(data);
            setExtracted(data);
            setCompleteness(score);
            setStep('preview');
        } catch (err: any) {
            setError(err.message ?? 'فشل التحليل، حاول مرة أخرى');
            setStep('input');
        }
    };

    const handleSave = async () => {
        if (!extracted) return;
        setStep('saving');
        const details: string[] = [];

        const addDetail = (msg: string) => {
            details.push(msg);
            setSaveDetails([...details]);
        };

        try {
            let brandId: string;
            let brandName: string;

            if (existingBrandId) {
                // ── Update mode: brand already exists ─────────────────────────
                brandId = existingBrandId;
                brandName = extracted.name;
                setSaveProgress('جاري تحديث بيانات البراند...');
                addDetail(`📥 إضافة بيانات جديدة إلى البراند الحالي`);
            } else {
                // ── Create mode: new brand ────────────────────────────────────
                setSaveProgress('جاري إنشاء البراند...');
                const brand = await addBrand(extracted.name, extracted.industry);
                brandId = brand.id;
                brandName = brand.name;
                addDetail(`✅ البراند "${brandName}" أُنشئ`);
            }

            // ── 1. Brand profile ──────────────────────────────────────────────
            setSaveProgress('جاري حفظ الملف الأساسي...');
            await updateBrandProfile(brandId, {
                brandName: extracted.name,
                industry: extracted.industry,
                values: extracted.values,
                keySellingPoints: extracted.keySellingPoints,
                styleGuidelines: extracted.styleGuidelines,
                brandVoice: extracted.brandVoice,
                brandAudiences: extracted.brandAudiences,
            });
            addDetail('✅ الملف الأساسي (قيم، صوت، جمهور) حُفظ');

            // ── 2. Brands table (website, country) ────────────────────────────
            if (extracted.website || extracted.country) {
                await supabase.from('brands').update({
                    ...(extracted.website  ? { website_url: extracted.website  } : {}),
                    ...(extracted.country  ? { country:     extracted.country  } : {}),
                }).eq('id', brandId);
                addDetail('✅ الموقع والدولة حُفظا');
            }

            // ── 3. Mission / Vision / Archetype / Story as policy entries ─────
            setSaveProgress('جاري حفظ الهوية العميقة...');
            const strategyEntries: { title: string; content: string }[] = [];
            if (extracted.missionStatement) strategyEntries.push({ title: 'رسالة البراند', content: extracted.missionStatement });
            if (extracted.visionStatement)  strategyEntries.push({ title: 'رؤية البراند',  content: extracted.visionStatement });
            if (extracted.brandArchetype)   strategyEntries.push({ title: 'شخصية البراند (Archetype)', content: `${extracted.brandArchetype}${extracted.brandStory ? '\n\nقصة البراند: ' + extracted.brandStory : ''}` });
            if (extracted.contentPillars.length) strategyEntries.push({ title: 'محاور المحتوى', content: extracted.contentPillars.map((p, i) => `${i + 1}. ${p}`).join('\n') });
            if (extracted.postingStrategy) strategyEntries.push({ title: 'استراتيجية النشر', content: extracted.postingStrategy });
            if (extracted.brandColors.length)  strategyEntries.push({ title: 'ألوان البراند',   content: extracted.brandColors.join('، ') });
            if (extracted.brandHashtags.length) strategyEntries.push({ title: 'هاشتاقات البراند', content: extracted.brandHashtags.join(' ') });

            for (let i = 0; i < strategyEntries.length; i++) {
                await addKnowledgeEntry(brandId, {
                    type: 'policy',
                    title: strategyEntries[i].title,
                    content: strategyEntries[i].content,
                    metadata: { source: 'brand_import', category: 'strategy' },
                    sortOrder: i,
                });
            }
            if (strategyEntries.length) addDetail(`✅ ${strategyEntries.length} عناصر هوية واستراتيجية حُفظت`);

            // ── 4. Knowledge entries (products, FAQ, policies, competitors) ───
            setSaveProgress(`جاري حفظ قاعدة المعرفة (${extracted.knowledgeEntries.length} إدخال)...`);
            const validTypes = ['product', 'faq', 'policy', 'competitor', 'scenario_script'];
            for (let i = 0; i < extracted.knowledgeEntries.length; i++) {
                const e = extracted.knowledgeEntries[i];
                await addKnowledgeEntry(brandId, {
                    type: validTypes.includes(e.type) ? (e.type as any) : 'product',
                    title: e.title,
                    content: e.content,
                    metadata: { source: 'brand_import' },
                    sortOrder: i,
                });
            }
            if (extracted.knowledgeEntries.length) addDetail(`✅ ${extracted.knowledgeEntries.length} إدخالات معرفة (منتجات/FAQ/سياسات/منافسين)`);

            // ── 5. Sample content → brand_memory ──────────────────────────────
            if (extracted.sampleContent.length > 0) {
                setSaveProgress(`جاري تدريب الذاكرة بـ ${extracted.sampleContent.length} مثال...`);
                for (const sample of extracted.sampleContent) {
                    const memType = sample.contentType === 'post' ? 'high_performing_post' : 'approved_caption';
                    const label = sample.platform ? `[${sample.platform}] ` : '';
                    await supabase.from('brand_memory').insert({
                        brand_id: brandId,
                        memory_type: memType,
                        content: `${label}${sample.text}`,
                        context: {
                            platform:    sample.platform ?? null,
                            contentType: sample.contentType,
                            source:      'brand_import',
                        },
                        importance: sample.contentType === 'slogan' || sample.contentType === 'tagline' ? 9 : 8,
                    });
                }
                addDetail(`🧠 ${extracted.sampleContent.length} مثال محتوى حُفظ في ذاكرة الـ AI`);
            }

            // ── 6. Save document to learning library ──────────────────────────
            setSaveProgress('جاري حفظ الوثائق في المكتبة...');
            const fieldsFound: Record<string, boolean | number> = {
                name: !!extracted.name, industry: !!extracted.industry,
                country: !!extracted.country, website: !!extracted.website,
                mission: !!extracted.missionStatement, vision: !!extracted.visionStatement,
                archetype: !!extracted.brandArchetype,
                values: extracted.values.length,
                audiences: extracted.brandAudiences.length,
                knowledgeEntries: extracted.knowledgeEntries.length,
                sampleContent: extracted.sampleContent.length,
                contentPillars: extracted.contentPillars.length,
            };

            for (const file of files.filter(f => f.text.trim() || f.binaryData)) {
                await addBrandDocument(brandId, {
                    title: file.name,
                    docType: file.docType,
                    content: file.text,
                    extractedSummary: extracted.documentSummary,
                    fieldsFound,
                    completenessScore: completeness,
                    memoryEntriesSaved: extracted.sampleContent.length,
                    knowledgeEntriesSaved: extracted.knowledgeEntries.length,
                });
            }
            addDetail(`📚 ${files.filter(f => f.text.trim() || f.binaryData).length} وثيقة حُفظت في مكتبة التعلم`);

            setSaveProgress('');
            setStep('done');
            setTimeout(() => onImported(brandId, brandName), 1400);
        } catch (err: any) {
            setError(err.message ?? 'فشل الحفظ');
            setStep('preview');
        }
    };

    const filledFiles = files.filter(f => f.text.trim() || f.binaryData).length;

    return (
        <div
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={onClose}
            onDragOver={e => e.preventDefault()}
            onDrop={step === 'input' ? handleDrop : undefined}
        >
            <div
                className="bg-light-card dark:bg-dark-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ─────────────────────────────────────────────────── */}
                <div className="p-5 border-b border-light-border dark:border-dark-border flex justify-between items-start flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">
                            {existingBrandId ? 'إضافة وثائق إلى البراند' : 'استيراد بيانات براند جديد'}
                        </h2>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                            {existingBrandId
                                ? 'ارفع وثائق جديدة لتعميق معرفة البراند وتدريب الذاكرة'
                                : 'يدعم ملفات متعددة — يستخرج كل شيء ويبني مكتبة تعلم كاملة'}
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text text-2xl leading-none mt-1">
                        &times;
                    </button>
                </div>

                {/* ── Body ───────────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-5">

                    {/* ══ INPUT ══════════════════════════════════════════════════ */}
                    {step === 'input' && (
                        <div className="space-y-4">
                            {/* File tabs */}
                            <div className="flex items-center gap-1 flex-wrap">
                                {files.map(f => (
                                    <button key={f.id} type="button"
                                        onClick={() => setActiveFileId(f.id)}
                                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                                            f.id === activeFileId
                                                ? 'bg-brand-primary text-white border-brand-primary'
                                                : 'border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-brand-primary/50'
                                        }`}>
                                        <span>{f.text ? '📄' : '📋'}</span>
                                        <span className="max-w-[100px] truncate">{f.name}</span>
                                        {files.length > 1 && (
                                            <span onClick={e => { e.stopPropagation(); removeFile(f.id); }}
                                                className="opacity-60 hover:opacity-100 ml-0.5">×</span>
                                        )}
                                    </button>
                                ))}
                                <button type="button" onClick={addFile}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-light-border dark:border-dark-border text-brand-primary hover:border-brand-primary transition-colors">
                                    + وثيقة
                                </button>
                            </div>

                            {/* Active file: type selector + upload + textarea */}
                            <div className="space-y-2">
                                <div className="flex gap-2 items-center">
                                    <select
                                        value={activeFile.docType}
                                        onChange={e => updateFile(activeFileId, { docType: e.target.value as BrandDocType })}
                                        className="text-xs px-2 py-1.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg text-light-text dark:text-dark-text"
                                    >
                                        {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        value={activeFile.name}
                                        onChange={e => updateFile(activeFileId, { name: e.target.value })}
                                        className="flex-1 text-xs px-2 py-1.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg text-light-text dark:text-dark-text"
                                        placeholder="اسم الوثيقة..."
                                    />
                                    <button type="button" onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-light-border dark:border-dark-border rounded-lg text-light-text dark:text-dark-text hover:border-brand-primary hover:text-brand-primary transition-colors flex-shrink-0">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        رفع ملف
                                    </button>
                                    <input ref={fileInputRef} type="file" accept=".txt,.md,.text,.pdf,.docx,.doc,.pptx,.xlsx" className="hidden" onChange={handleFileUpload} multiple />
                                </div>

                                {/* Binary file: show card preview instead of textarea */}
                                {activeFile.binaryData ? (
                                    activeFile.binaryData.mimeType === 'unsupported' ? (
                                        /* DOCX / DOC / PPTX — not supported via inline_data */
                                        <div className="p-4 bg-amber-500/5 border-2 border-amber-500/30 rounded-xl space-y-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-3xl flex-shrink-0">
                                                    {FORMAT_ICONS[getFileExt(activeFile.name)] ?? '📄'}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-light-text dark:text-dark-text truncate text-sm">{activeFile.name}</p>
                                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                                        {getFileExt(activeFile.name).toUpperCase()} • {formatBytes(activeFile.binaryData.sizeBytes)}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => updateFile(activeFileId, { binaryData: undefined, text: '' })}
                                                    className="text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 text-sm flex-shrink-0"
                                                >×</button>
                                            </div>
                                            <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                                                <i className="fas fa-triangle-exclamation text-xs mt-0.5 flex-shrink-0" />
                                                <p className="text-xs leading-relaxed">
                                                    <span className="font-bold">Word / PowerPoint غير مدعوم مباشرة.</span>{' '}
                                                    يدعم Gemini قراءة <span className="font-bold">PDF</span> فقط من الملفات الثنائية.
                                                    يرجى:
                                                </p>
                                            </div>
                                            <ul className="text-xs text-light-text-secondary dark:text-dark-text-secondary space-y-1 pr-4 list-disc">
                                                <li>حفظ الملف كـ <span className="font-bold text-light-text dark:text-dark-text">PDF</span> ثم رفعه من جديد</li>
                                                <li>أو نسخ المحتوى ولصقه في مربع النص أدناه</li>
                                            </ul>
                                            <button
                                                type="button"
                                                onClick={() => updateFile(activeFileId, { binaryData: undefined, text: '' })}
                                                className="text-xs text-brand-primary hover:underline font-medium"
                                            >
                                                إزالة الملف والتبديل إلى النص
                                            </button>
                                        </div>
                                    ) : activeFile.binaryData!.sizeBytes > 170 * 1024 ? (
                                        /* PDF — too large for current Edge Function deployment */
                                        <div className="p-4 rounded-xl border-2 border-red-500/40 bg-red-500/5 space-y-2">
                                            <div className="flex items-center gap-3">
                                                <span className="text-3xl flex-shrink-0">📕</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-light-text dark:text-dark-text truncate text-sm">{activeFile.name}</p>
                                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                                        PDF • {formatBytes(activeFile.binaryData!.sizeBytes)}
                                                    </p>
                                                </div>
                                                <button type="button" onClick={() => updateFile(activeFileId, { binaryData: undefined, text: '' })}
                                                    className="text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 text-sm flex-shrink-0">×</button>
                                            </div>
                                            <div className="flex items-center gap-2 text-red-500">
                                                <i className="fas fa-circle-xmark text-xs flex-shrink-0" />
                                                <p className="text-xs font-semibold">
                                                    الملف كبير ({formatBytes(activeFile.binaryData!.sizeBytes)}) — يتجاوز الحد الحالي ~170 KB
                                                </p>
                                            </div>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                لدعم ملفات أكبر، شغّل هذا الأمر مرة واحدة في terminal المشروع:
                                            </p>
                                            <div className="bg-black/40 rounded-lg px-3 py-2 font-mono text-xs text-green-400 select-all">
                                                supabase functions deploy ai-proxy
                                            </div>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                أو انسخ نص الـ PDF ولصقه في مربع النص.
                                            </p>
                                            <button type="button" onClick={() => updateFile(activeFileId, { binaryData: undefined, text: '' })}
                                                className="text-xs text-brand-primary hover:underline font-medium">
                                                إزالة الملف والتبديل إلى النص
                                            </button>
                                        </div>
                                    ) : (
                                        /* PDF — small enough, ready */
                                        <div className="flex items-center gap-4 p-4 bg-light-bg dark:bg-dark-bg border-2 border-brand-primary/30 rounded-xl">
                                            <span className="text-3xl flex-shrink-0">📕</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-light-text dark:text-dark-text truncate text-sm">{activeFile.name}</p>
                                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                                    PDF • {formatBytes(activeFile.binaryData!.sizeBytes)}
                                                </p>
                                                <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                                                    ✓ جاهز — Gemini سيقرأه مباشرة
                                                </p>
                                            </div>
                                            <button type="button" onClick={() => updateFile(activeFileId, { binaryData: undefined, text: '' })}
                                                className="text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 text-sm flex-shrink-0"
                                                title="إزالة الملف">×</button>
                                        </div>
                                    )
                                ) : (
                                    <textarea
                                        value={activeFile.text}
                                        onChange={e => updateFile(activeFileId, { text: e.target.value })}
                                        placeholder={`الصق محتوى الوثيقة هنا أو ارفع ملف...\n\nملفات مدعومة: PDF (مباشر) • TXT • MD\nWord/PowerPoint: انسخ المحتوى والصقه هنا\n\nمثال على ما يمكن إدخاله:\n• كتاب البراند الكامل\n• وصف المنتجات والخدمات\n• أمثلة على منشورات سوشيال ميديا\n• تحليل المنافسين\n• قصة البراند والرسالة والرؤية\n• الأسئلة الشائعة والسياسات`}
                                        rows={10}
                                        dir="auto"
                                        className="w-full p-3 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg text-sm text-light-text dark:text-dark-text focus:ring-brand-primary focus:border-brand-primary resize-none font-mono leading-relaxed"
                                    />
                                )}
                            </div>

                            {/* Stats */}
                            <div className="flex items-center justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                <span>{filledFiles} وثيقة جاهزة للتحليل</span>
                                <span>
                                    {activeFile.binaryData
                                        ? formatBytes(activeFile.binaryData.sizeBytes)
                                        : `${activeFile.text.length.toLocaleString()} حرف`}
                                </span>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">{error}</div>
                            )}

                            <div className="p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-lg text-sm text-brand-primary/90 space-y-1">
                                <p className="font-semibold">💡 كلما أضفت أكثر، تعلّم البراند أكثر:</p>
                                <p className="text-xs opacity-80">يستخرج الـ AI: الهوية، الرسالة والرؤية، الشخصية، محاور المحتوى، المنشورات النموذجية، قاعدة المعرفة — ويحفظها كلها في ذاكرة الـ AI</p>
                            </div>
                        </div>
                    )}

                    {/* ══ ANALYZING ══════════════════════════════════════════════ */}
                    {step === 'analyzing' && (
                        <div className="flex flex-col items-center justify-center py-14 gap-6">
                            <div className="relative w-24 h-24">
                                <div className="absolute inset-0 rounded-full border-4 border-brand-primary/20"></div>
                                <div className="absolute inset-0 rounded-full border-4 border-brand-primary border-t-transparent animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center text-3xl">🧠</div>
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-lg font-bold text-light-text dark:text-dark-text">الذكاء الاصطناعي يدرس الوثائق...</p>
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">يستخرج الهوية، الصوت، المحتوى النموذجي، قاعدة المعرفة</p>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-70 mt-1">قد يستغرق 30–90 ثانية حسب حجم الوثائق</p>
                            </div>
                        </div>
                    )}

                    {/* ══ PREVIEW ════════════════════════════════════════════════ */}
                    {step === 'preview' && extracted && (
                        <div className="space-y-4" dir="rtl">
                            {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">{error}</div>}

                            {/* Completeness header */}
                            <div className="flex items-center gap-4 p-4 bg-light-bg dark:bg-dark-bg rounded-xl border border-light-border dark:border-dark-border">
                                <CompletenessRing score={completeness} />
                                <div className="flex-1">
                                    <p className="font-bold text-light-text dark:text-dark-text text-base">
                                        {extracted.documentTitle || extracted.name}
                                    </p>
                                    {extracted.documentSummary && (
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 leading-relaxed">
                                            {extracted.documentSummary}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <Pill color="blue"  label={`${extracted.knowledgeEntries.length} إدخال معرفة`} />
                                        <Pill color="green" label={`${extracted.sampleContent.length} مثال محتوى`} />
                                        <Pill color="purple" label={`${extracted.brandAudiences.length} جمهور`} />
                                    </div>
                                </div>
                            </div>

                            {/* Identity */}
                            <Section title="🏷️ الهوية الأساسية">
                                <Row label="الاسم"     value={extracted.name} />
                                <Row label="المجال"    value={extracted.industry} />
                                {extracted.country  && <Row label="الدولة"  value={extracted.country} />}
                                {extracted.website  && <Row label="الموقع"  value={extracted.website} />}
                                {extracted.brandArchetype && <Row label="الشخصية" value={extracted.brandArchetype} />}
                            </Section>

                            {/* Mission / Vision / Story */}
                            {(extracted.missionStatement || extracted.visionStatement || extracted.brandStory) && (
                                <Section title="🎯 الرسالة والرؤية">
                                    {extracted.missionStatement && <LongRow label="الرسالة" value={extracted.missionStatement} />}
                                    {extracted.visionStatement  && <LongRow label="الرؤية"  value={extracted.visionStatement} />}
                                    {extracted.brandStory       && <LongRow label="القصة"   value={extracted.brandStory} />}
                                </Section>
                            )}

                            {/* Values & Strategy */}
                            <Section title="💎 القيم والاستراتيجية">
                                <TagRow label="القيم الجوهرية"  tags={extracted.values}          color="blue" />
                                <TagRow label="نقاط التميز"     tags={extracted.keySellingPoints} color="green" />
                                <TagRow label="محاور المحتوى"   tags={extracted.contentPillars}   color="purple" />
                                {extracted.styleGuidelines.length > 0 && <TagRow label="إرشادات الأسلوب" tags={extracted.styleGuidelines} color="yellow" />}
                                {extracted.brandColors.length   > 0 && <TagRow label="ألوان البراند"    tags={extracted.brandColors}    color="red" />}
                                {extracted.brandHashtags.length > 0 && <TagRow label="الهاشتاقات"       tags={extracted.brandHashtags}  color="blue" />}
                                {extracted.postingStrategy && <LongRow label="استراتيجية النشر" value={extracted.postingStrategy} />}
                            </Section>

                            {/* Brand Voice */}
                            <Section title="🎙️ صوت البراند">
                                <TagRow label="نبرة الصوت"       tags={extracted.brandVoice.toneDescription} color="yellow" />
                                <TagRow label="الكلمات المفتاحية" tags={extracted.brandVoice.keywords}       color="green" />
                                {extracted.brandVoice.negativeKeywords.length > 0 &&
                                    <TagRow label="كلمات تُتجنب" tags={extracted.brandVoice.negativeKeywords} color="red" />}
                                {extracted.brandVoice.voiceGuidelines.dos.length > 0 &&
                                    <ListRow label="✅ افعل"  items={extracted.brandVoice.voiceGuidelines.dos} />}
                                {extracted.brandVoice.voiceGuidelines.donts.length > 0 &&
                                    <ListRow label="❌ تجنب" items={extracted.brandVoice.voiceGuidelines.donts} />}
                            </Section>

                            {/* Audiences */}
                            {extracted.brandAudiences.length > 0 && (
                                <Section title={`👥 الجمهور المستهدف (${extracted.brandAudiences.length})`}>
                                    {extracted.brandAudiences.map((a, i) => (
                                        <div key={i} className="bg-light-bg dark:bg-dark-bg rounded-lg p-3 space-y-1.5">
                                            <p className="font-semibold text-sm text-light-text dark:text-dark-text">{a.personaName}</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{a.description}</p>
                                            <div className="flex flex-wrap gap-1">
                                                {a.keyEmotions.map((e, j) => (
                                                    <span key={j} className="text-xs bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full">{e}</span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </Section>
                            )}

                            {/* Sample content → memory */}
                            {extracted.sampleContent.length > 0 && (
                                <Section title={`🧠 محتوى نموذجي → ذاكرة AI (${extracted.sampleContent.length})`}>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">هذه الأمثلة تُعلّم الـ AI أسلوب كتابة هذا البراند تحديداً</p>
                                    <div className="space-y-2">
                                        {extracted.sampleContent.slice(0, 5).map((s, i) => (
                                            <div key={i} className="flex gap-2 items-start bg-light-bg dark:bg-dark-bg rounded-lg p-2.5 border border-light-border/50 dark:border-dark-border/50">
                                                <span className="text-base flex-shrink-0">{CONTENT_TYPE_ICONS[s.contentType] ?? '📝'}</span>
                                                <div className="min-w-0">
                                                    <div className="flex gap-1.5 items-center mb-0.5">
                                                        <span className="text-[10px] bg-brand-primary/15 text-brand-primary px-1.5 py-0.5 rounded-full">{s.contentType}</span>
                                                        {s.platform && <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{s.platform}</span>}
                                                    </div>
                                                    <p className="text-xs text-light-text dark:text-dark-text line-clamp-2">{s.text}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {extracted.sampleContent.length > 5 && (
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary text-center">
                                                + {extracted.sampleContent.length - 5} أمثلة إضافية
                                            </p>
                                        )}
                                    </div>
                                </Section>
                            )}

                            {/* Knowledge entries */}
                            {extracted.knowledgeEntries.length > 0 && (
                                <Section title={`📚 قاعدة المعرفة (${extracted.knowledgeEntries.length})`}>
                                    <div className="space-y-1.5">
                                        {extracted.knowledgeEntries.map((e, i) => (
                                            <div key={i} className="flex gap-2.5 items-start bg-light-bg dark:bg-dark-bg rounded-lg p-2.5">
                                                <span className="text-[10px] bg-brand-primary/15 text-brand-primary px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5">
                                                    {KNOWLEDGE_TYPE_LABELS[e.type] ?? e.type}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-light-text dark:text-dark-text truncate">{e.title}</p>
                                                    <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary line-clamp-1 mt-0.5">{e.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Section>
                            )}
                        </div>
                    )}

                    {/* ══ SAVING ═════════════════════════════════════════════════ */}
                    {step === 'saving' && (
                        <div className="flex flex-col items-center py-10 gap-5">
                            <div className="relative w-20 h-20 flex-shrink-0">
                                <div className="absolute inset-0 rounded-full border-4 border-green-500/20"></div>
                                <div className="absolute inset-0 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center text-2xl">💾</div>
                            </div>
                            {saveProgress && (
                                <p className="text-sm font-medium text-light-text dark:text-dark-text text-center">{saveProgress}</p>
                            )}
                            <div className="w-full space-y-1.5 max-w-sm">
                                {saveDetails.map((d, i) => (
                                    <p key={i} className="text-xs text-light-text-secondary dark:text-dark-text-secondary text-center">{d}</p>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ══ DONE ═══════════════════════════════════════════════════ */}
                    {step === 'done' && (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center text-4xl">✅</div>
                            <p className="text-xl font-bold text-light-text dark:text-dark-text">تم البناء الكامل!</p>
                            <div className="text-center space-y-1 max-w-xs">
                                {saveDetails.map((d, i) => (
                                    <p key={i} className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{d}</p>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ─────────────────────────────────────────────────── */}
                {(step === 'input' || step === 'preview') && (
                    <div className="p-4 border-t border-light-border dark:border-dark-border flex justify-between items-center flex-shrink-0">
                        {step === 'preview' ? (
                            <>
                                <button type="button" onClick={() => { setStep('input'); setError(null); }}
                                    className="text-light-text-secondary dark:text-dark-text-secondary font-medium py-2 px-4 rounded-lg hover:bg-light-bg dark:hover:bg-dark-bg">
                                    ← تعديل الوثائق
                                </button>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                        {completeness}% اكتمال
                                    </span>
                                    <button type="button" onClick={handleSave}
                                        className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg hover:bg-brand-secondary">
                                        بناء البراند الكامل ✓
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <button type="button" onClick={onClose}
                                    className="text-light-text-secondary dark:text-dark-text-secondary font-medium py-2 px-4 rounded-lg hover:bg-light-bg dark:hover:bg-dark-bg">
                                    إلغاء
                                </button>
                                <button type="button" onClick={handleAnalyze} disabled={filledFiles === 0}
                                    className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-500 hover:bg-brand-secondary flex items-center gap-2">
                                    <span>🧠</span>
                                    تحليل {filledFiles > 1 ? `${filledFiles} وثائق` : 'الوثيقة'}
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Helper components ─────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="space-y-2">
        <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">{title}</h3>
        <div className="bg-light-bg/50 dark:bg-dark-bg/50 rounded-xl p-3 space-y-2 border border-light-border dark:border-dark-border">
            {children}
        </div>
    </div>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) =>
    value ? (
        <div className="flex gap-2 text-sm">
            <span className="text-light-text-secondary dark:text-dark-text-secondary w-20 flex-shrink-0">{label}:</span>
            <span className="text-light-text dark:text-dark-text font-medium">{value}</span>
        </div>
    ) : null;

const LongRow: React.FC<{ label: string; value: string }> = ({ label, value }) =>
    value ? (
        <div className="space-y-0.5">
            <span className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">{label}:</span>
            <p className="text-xs text-light-text dark:text-dark-text leading-relaxed">{value}</p>
        </div>
    ) : null;

const TAG_COLORS: Record<string, string> = {
    blue:   'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    green:  'bg-green-500/15 text-green-700 dark:text-green-300',
    yellow: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
    purple: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
    red:    'bg-red-500/15 text-red-600 dark:text-red-400',
};

const TagRow: React.FC<{ label: string; tags: string[]; color: string }> = ({ label, tags, color }) =>
    tags.length > 0 ? (
        <div className="space-y-1">
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{label}:</p>
            <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, i) => (
                    <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${TAG_COLORS[color] ?? TAG_COLORS.blue}`}>{tag}</span>
                ))}
            </div>
        </div>
    ) : null;

const ListRow: React.FC<{ label: string; items: string[] }> = ({ label, items }) =>
    items.length > 0 ? (
        <div className="space-y-1">
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{label}:</p>
            <ul className="space-y-0.5">
                {items.map((item, i) => (
                    <li key={i} className="text-xs text-light-text dark:text-dark-text flex gap-1.5 items-start">
                        <span className="mt-0.5">•</span><span>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    ) : null;

const Pill: React.FC<{ color: string; label: string }> = ({ color, label }) => (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[color] ?? TAG_COLORS.blue}`}>{label}</span>
);
