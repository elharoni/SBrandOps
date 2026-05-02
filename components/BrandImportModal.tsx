import React, { useState, useRef } from 'react';
import { addBrand } from '../services/brandService';
import { updateBrandProfile } from '../services/brandHubService';
import { addKnowledgeEntry } from '../services/brandKnowledgeService';
import { addBrandDocument, BrandDocType, DOC_TYPE_LABELS } from '../services/brandDocumentService';
import { analyzeBrandFiles } from '../services/brandFileAnalysisService';
import { extractTextFromPdf } from '../services/pdfExtractor';
import { supabase } from '../services/supabaseClient';
import { useModalClose } from '../hooks/useModalClose';
import {
    BrandAnalysisDocumentPayload,
    BrandImportData,
    calcBrandImportCompleteness,
    getBrandFileExt,
    getBrandFileMimeType,
    isBrandFileBinaryExt,
    isSupportedBrandFileExt,
} from '../services/brandFileAnalysisShared';

interface Props {
    onClose: () => void;
    onImported: (brandId: string, brandName: string) => void;
    /** If provided, updates the existing brand instead of creating a new one */
    existingBrandId?: string;
    currentBrandCount?: number;
}

type Step = 'input' | 'analyzing' | 'preview' | 'saving' | 'done';

// Binary formats sent server-side to OpenAI Responses as in-memory file inputs.
const BINARY_MIME_TYPES: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// 5 MB raw PDF ~= 6.7 MB base64 payload, leaving headroom under the 8 MB ai-proxy limit.
const DIRECT_FILE_MAX_BYTES = 5 * 1024 * 1024;
const TOTAL_ANALYSIS_BYTES_LIMIT = 7 * 1024 * 1024;

const FORMAT_ICONS: Record<string, string> = {
    pdf: '📕', docx: '📘', doc: '📘', pptx: '📙',
    xlsx: '📗', csv: '📗', txt: '📄', md: '📄',
};

function getFileExt(name: string): string {
    return getBrandFileExt(name);
}

function isBinaryFormat(name: string): boolean {
    return isBrandFileBinaryExt(getFileExt(name));
}

interface FileEntry {
    id: string;
    name: string;
    originalFileName?: string;
    fileType: string;
    sizeBytes: number;
    docType: BrandDocType;
    // For text files (txt, md):
    text: string;
    // For binary files (pdf, docx, doc, pptx):
    binaryData?: { base64: string; mimeType: string; sizeBytes: number };
    // Set when a large PDF was extracted client-side via PDF.js
    extractedFromPdf?: { sizeBytes: number };
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
    const [files, setFiles] = useState<FileEntry[]>([{
        id: '1',
        name: 'وثيقة رئيسية',
        originalFileName: undefined,
        fileType: 'text/plain',
        sizeBytes: 0,
        text: '',
        docType: 'brand_book',
    }]);
    const [extracted, setExtracted] = useState<BrandImportData | null>(null);
    const [completeness, setCompleteness] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [saveProgress, setSaveProgress] = useState('');
    const [saveDetails, setSaveDetails] = useState<string[]>([]);
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    const [analysisState, setAnalysisState] = useState<'idle' | 'uploading' | 'analyzing' | 'completed' | 'failed'>('idle');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeFileId, setActiveFileId] = useState('1');
    useModalClose(onClose);

    const activeFile = files.find(f => f.id === activeFileId) ?? files[0];

    const updateFile = (id: string, patch: Partial<FileEntry>) =>
        setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));

    const addFile = () => {
        const id = Date.now().toString();
        setFiles(prev => [...prev, {
            id,
            name: `وثيقة ${prev.length + 1}`,
            originalFileName: undefined,
            fileType: 'text/plain',
            sizeBytes: 0,
            text: '',
            docType: 'other',
        }]);
        setActiveFileId(id);
    };

    const removeFile = (id: string) => {
        if (files.length === 1) return;
        const remaining = files.filter(f => f.id !== id);
        setFiles(remaining);
        setActiveFileId(remaining[0].id);
    };

    const validateSelectedFile = (file: File): string | null => {
        const ext = getFileExt(file.name);
        if (!isSupportedBrandFileExt(ext)) {
            return 'نوع الملف غير مدعوم. استخدم PDF أو DOCX أو PPTX أو XLSX أو CSV أو TXT أو MD.';
        }
        if (file.size === 0) {
            return 'الملف فارغ. ارفع ملفاً يحتوي على محتوى فعلي.';
        }
        if (isBinaryFormat(file.name) && ext !== 'pdf' && file.size > DIRECT_FILE_MAX_BYTES) {
            return 'هذا الملف كبير جداً للتحليل المباشر. الحد الأقصى 5MB لملفات Word وPowerPoint وExcel.';
        }
        return null;
    };

    const loadFileEntry = async (file: File): Promise<Partial<FileEntry>> => {
        const ext = getFileExt(file.name);
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const docType = guessDocType(file.name);
        const fileType = getBrandFileMimeType(file.name, file.type || 'text/plain');

        if (isBinaryFormat(file.name)) {
            // Large PDFs are converted to text locally; other supported binary files go to OpenAI as file inputs.
            if (ext === 'pdf' && file.size > DIRECT_FILE_MAX_BYTES) {
                const text = await extractTextFromPdf(file);
                return {
                    name: baseName,
                    originalFileName: file.name,
                    fileType,
                    sizeBytes: file.size,
                    docType,
                    text,
                    binaryData: undefined,
                    extractedFromPdf: { sizeBytes: file.size },
                };
            }
            const base64 = await fileToBase64(file);
            return {
                name: baseName,
                originalFileName: file.name,
                fileType,
                sizeBytes: file.size,
                docType,
                text: '',
                binaryData: { base64, mimeType: BINARY_MIME_TYPES[ext] ?? fileType, sizeBytes: file.size },
            };
        }

        const text = await file.text();
        return {
            name: baseName,
            originalFileName: file.name,
            fileType,
            sizeBytes: file.size,
            docType,
            text,
            binaryData: undefined,
        };
    };

    const loadMultipleFiles = async (incomingFiles: File[]): Promise<FileEntry[]> => {
        const supported = incomingFiles.filter(f => {
            const ext = getFileExt(f.name);
            return isSupportedBrandFileExt(ext);
        });
        if (!supported.length) return [];

        return Promise.all(
            supported.map(async (file, index) => {
                const patch = await loadFileEntry(file);
                return {
                    id: `${Date.now()}_${index}`,
                    name: file.name.replace(/\.[^.]+$/, ''),
                    originalFileName: file.name,
                    fileType: getBrandFileMimeType(file.name, file.type || 'text/plain'),
                    sizeBytes: file.size,
                    docType: guessDocType(file.name),
                    text: '',
                    ...patch,
                } as FileEntry;
            })
        );
    };

    const appendLoadedFiles = (newEntries: FileEntry[]) => {
        if (!newEntries.length) return;

        setFiles(prev => {
            const merged = [...prev];
            if (merged.length === 1 && !merged[0].text && !merged[0].binaryData) {
                merged[0] = { ...merged[0], ...newEntries[0] };
                return [...merged, ...newEntries.slice(1)];
            }
            return [...merged, ...newEntries];
        });
        setActiveFileId(newEntries[0].id);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files ?? []);
        if (!selectedFiles.length) return;
        e.target.value = '';
        setIsLoadingFile(true);
        setAnalysisState('uploading');
        setError(null);
        try {
            const invalid = selectedFiles.map(validateSelectedFile).find(Boolean);
            if (invalid) throw new Error(invalid);

            if (selectedFiles.length === 1) {
                const patch = await loadFileEntry(selectedFiles[0]);
                updateFile(activeFileId, patch);
                setAnalysisState('idle');
                return;
            }

            const newEntries = await loadMultipleFiles(selectedFiles);
            appendLoadedFiles(newEntries);
            setAnalysisState('idle');
        } catch (err) {
            setAnalysisState('failed');
            setError(err instanceof Error ? err.message : 'فشل تجهيز الملف للتحليل.');
        } finally {
            setIsLoadingFile(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsLoadingFile(true);
        setAnalysisState('uploading');
        setError(null);
        try {
            const dropped = Array.from(e.dataTransfer.files);
            const invalid = dropped.map(validateSelectedFile).find(Boolean);
            if (invalid) throw new Error(invalid);
            const newEntries = await loadMultipleFiles(dropped);
            appendLoadedFiles(newEntries);
            setAnalysisState('idle');
        } catch (err) {
            setAnalysisState('failed');
            setError(err instanceof Error ? err.message : 'فشل تجهيز الملف للتحليل.');
        } finally {
            setIsLoadingFile(false);
        }
    };

    const handleAnalyze = async () => {
        const readyFiles = files.filter((file) => file.text.trim() || file.binaryData);
        if (!readyFiles.length) {
            setError('يرجى رفع ملف مدعوم أو لصق المحتوى في مربع النص قبل بدء التحليل.');
            setAnalysisState('failed');
            return;
        }

        const estimatedBytes = readyFiles.reduce((sum, file) => (
            sum +
            (file.binaryData?.sizeBytes ?? 0) +
            (file.text ? new Blob([file.text]).size : 0)
        ), 0);

        if (estimatedBytes > TOTAL_ANALYSIS_BYTES_LIMIT) {
            setError('الملفات المحددة كبيرة جداً للتحليل دفعة واحدة. قلّل العدد أو استخدم ملفات أصغر.');
            setAnalysisState('failed');
            return;
        }

        const documents: BrandAnalysisDocumentPayload[] = readyFiles.map((file) => ({
            file_name: file.originalFileName || `${file.name}.${file.fileType.split('/').pop() || 'txt'}`,
            file_type: file.fileType,
            mime_type: file.binaryData?.mimeType || file.fileType,
            size_bytes: file.binaryData?.sizeBytes ?? file.sizeBytes ?? new Blob([file.text]).size,
            ...(file.binaryData?.base64 ? { base64_data: file.binaryData.base64 } : {}),
            ...(file.text.trim() ? { text_content: file.text.trim() } : {}),
        }));

        setError(null);
        setAnalysisState('analyzing');
        setStep('analyzing');

        try {
            const result = await analyzeBrandFiles(documents, existingBrandId);
            setExtracted(result.data);
            setCompleteness(result.score || calcBrandImportCompleteness(result.data));
            setAnalysisState('completed');
            setStep('preview');
        } catch (err) {
            setAnalysisState('failed');
            setError(err instanceof Error ? err.message : 'فشل التحليل، حاول مرة أخرى.');
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

        // Prevent the 3000-char validation limit from aborting the entire save
        const trunc = (text: string, max = 2800) =>
            text.length > max ? text.slice(0, max) + '…' : text;

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
                description: extracted.documentSummary || extracted.positioning,
                targetAudienceSummary: extracted.targetAudienceSummary,
                valueProp: extracted.valueProp,
                brandPromise: extracted.coreOffer,
                messagingPillars: extracted.contentPillars,
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
            if (extracted.positioning) strategyEntries.push({ title: 'التموضع السوقي', content: extracted.positioning });
            if (extracted.coreOffer) strategyEntries.push({ title: 'العرض الأساسي', content: extracted.coreOffer });
            if (extracted.valueProp) strategyEntries.push({ title: 'القيمة المقترحة', content: extracted.valueProp });
            if (extracted.contentPillars.length) strategyEntries.push({ title: 'محاور المحتوى', content: extracted.contentPillars.map((p, i) => `${i + 1}. ${p}`).join('\n') });
            if (extracted.postingStrategy) strategyEntries.push({ title: 'استراتيجية النشر', content: extracted.postingStrategy });
            if (extracted.brandColors.length)  strategyEntries.push({ title: 'ألوان البراند',   content: extracted.brandColors.join('، ') });
            if (extracted.brandHashtags.length) strategyEntries.push({ title: 'هاشتاقات البراند', content: extracted.brandHashtags.join(' ') });
            if (extracted.marketingIntelligence.content_angles.length) {
                strategyEntries.push({ title: 'زوايا المحتوى المقترحة', content: extracted.marketingIntelligence.content_angles.map((item, index) => `${index + 1}. ${item}`).join('\n') });
            }
            if (extracted.marketingIntelligence.ad_angles.length) {
                strategyEntries.push({ title: 'زوايا الإعلانات المقترحة', content: extracted.marketingIntelligence.ad_angles.map((item, index) => `${index + 1}. ${item}`).join('\n') });
            }
            if (extracted.contentSystem.suggested_hooks.length) {
                strategyEntries.push({ title: 'الهوكات المقترحة', content: extracted.contentSystem.suggested_hooks.map((item, index) => `${index + 1}. ${item}`).join('\n') });
            }
            if (extracted.contentSystem.cta_suggestions.length) {
                strategyEntries.push({ title: 'دعوات الإجراء المقترحة', content: extracted.contentSystem.cta_suggestions.map((item, index) => `${index + 1}. ${item}`).join('\n') });
            }
            if (extracted.businessNotes.recommended_next_questions.length) {
                strategyEntries.push({ title: 'أسئلة المتابعة الموصى بها', content: extracted.businessNotes.recommended_next_questions.map((item, index) => `${index + 1}. ${item}`).join('\n') });
            }

            // Resilient: skip individual entries that fail instead of aborting all
            let savedStrategy = 0;
            for (let i = 0; i < strategyEntries.length; i++) {
                try {
                    await addKnowledgeEntry(brandId, {
                        type: 'policy',
                        title: strategyEntries[i].title,
                        content: trunc(strategyEntries[i].content),
                        metadata: { source: 'brand_import', category: 'strategy' },
                        sortOrder: i,
                    });
                    savedStrategy++;
                } catch { /* skip oversized/invalid entry, continue with rest */ }
            }
            if (savedStrategy) addDetail(`✅ ${savedStrategy} عناصر هوية واستراتيجية حُفظت`);

            // ── 4. Knowledge entries (products, FAQ, policies, competitors) ───
            setSaveProgress(`جاري حفظ قاعدة المعرفة (${extracted.knowledgeEntries.length} إدخال)...`);
            const validTypes = ['product', 'faq', 'policy', 'competitor', 'scenario_script'];
            let savedKnowledge = 0;
            for (let i = 0; i < extracted.knowledgeEntries.length; i++) {
                const e = extracted.knowledgeEntries[i];
                try {
                    await addKnowledgeEntry(brandId, {
                        type: validTypes.includes(e.type) ? (e.type as any) : 'product',
                        title: e.title,
                        content: trunc(e.content),
                        metadata: { source: 'brand_import' },
                        sortOrder: i,
                    });
                    savedKnowledge++;
                } catch { /* skip entry, continue */ }
            }
            if (savedKnowledge) addDetail(`✅ ${savedKnowledge} إدخالات معرفة (منتجات/FAQ/سياسات/منافسين)`);

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
                contentAngles: extracted.marketingIntelligence.content_angles.length,
                adAngles: extracted.marketingIntelligence.ad_angles.length,
                hooks: extracted.contentSystem.suggested_hooks.length,
                ctas: extracted.contentSystem.cta_suggestions.length,
                confidenceScore: extracted.businessNotes.confidence_score,
            };

            const savableFiles = files.filter(f => f.text.trim() || f.binaryData);
            for (const file of savableFiles) {
                await addBrandDocument(brandId, {
                    title: file.name,
                    docType: file.docType,
                    content: file.text,
                    extractedSummary: extracted.documentSummary,
                    fieldsFound,
                    completenessScore: completeness,
                    memoryEntriesSaved: extracted.sampleContent.length,
                    knowledgeEntriesSaved: extracted.knowledgeEntries.length,
                    fileName: file.originalFileName || `${file.name}.${file.fileType.split('/').pop() || 'txt'}`,
                    fileType: file.fileType,
                    analysisProvider: extracted.analysisProvider,
                    analysisModel: extracted.analysisModel,
                    analysisJson: extracted.rawAnalysis as unknown as Record<string, unknown>,
                    detectedLanguage: extracted.detectedLanguage,
                });
            }
            addDetail(`📚 ${savableFiles.length} وثيقة حُفظت في مكتبة التعلم`);

            setSaveProgress('');
            setStep('done');
            setTimeout(() => onImported(brandId, brandName), 1400);
        } catch (err: any) {
            setError(err.message ?? 'فشل الحفظ');
            setStep('preview');
        }
    };

    const filledFiles = files.filter(f => f.text.trim() || f.binaryData).length;

    const isCreating = !existingBrandId;

    // Step labels for the creation wizard indicator
    const STEPS: { key: Step; label: string }[] = [
        { key: 'input',     label: 'رفع الوثائق' },
        { key: 'analyzing', label: 'التحليل بالـ AI' },
        { key: 'preview',   label: 'مراجعة البيانات' },
        { key: 'saving',    label: 'بناء البراند' },
    ];
    const currentStepIdx = STEPS.findIndex(s => s.key === step || (step === 'done' && s.key === 'saving'));

    return (
        <div
            className={isCreating
                ? 'fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-light-bg via-light-card to-brand-primary/5 dark:from-dark-bg dark:via-dark-card dark:to-brand-primary/10'
                : 'fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4'
            }
            onClick={isCreating ? undefined : onClose}
            onDragOver={e => e.preventDefault()}
            onDrop={step === 'input' ? handleDrop : undefined}
        >
            {/* ── Full-screen top bar (create mode only) ─────────────────────── */}
            {isCreating && (
                <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🏗️</span>
                        <div>
                            <h1 className="font-bold text-light-text dark:text-dark-text text-base">بناء براند من مستند</h1>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">يستخرج OpenAI الهوية، الاستراتيجية، والمحتوى في ثوانٍ</p>
                        </div>
                    </div>

                    {/* Step indicator */}
                    <div className="hidden sm:flex items-center gap-0">
                        {STEPS.map((s, idx) => (
                            <React.Fragment key={s.key}>
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                    idx < currentStepIdx
                                        ? 'text-green-600 dark:text-green-400'
                                        : idx === currentStepIdx
                                        ? 'bg-brand-primary/15 text-brand-primary font-semibold'
                                        : 'text-light-text-secondary/50 dark:text-dark-text-secondary/50'
                                }`}>
                                    <span>{idx < currentStepIdx ? '✓' : `${idx + 1}`}</span>
                                    <span>{s.label}</span>
                                </div>
                                {idx < STEPS.length - 1 && (
                                    <span className={`text-xs mx-1 ${idx < currentStepIdx ? 'text-green-500' : 'text-light-border dark:text-dark-border'}`}>›</span>
                                )}
                            </React.Fragment>
                        ))}
                    </div>

                    <button type="button" onClick={onClose}
                        className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-light-bg dark:hover:bg-dark-bg">
                        &times;
                    </button>
                </div>
            )}

            <div
                className={isCreating
                    ? 'flex-1 overflow-hidden flex flex-col w-full max-w-3xl mx-auto'
                    : 'bg-light-card dark:bg-dark-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col'
                }
                onClick={isCreating ? undefined : e => e.stopPropagation()}
            >
                {/* ── Header (modal/update mode only) ────────────────────────── */}
                {!isCreating && (
                <div className="p-5 border-b border-light-border dark:border-dark-border flex justify-between items-start flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">
                            إضافة وثائق إلى البراند
                        </h2>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                            ارفع وثائق جديدة لتعميق معرفة البراند وتدريب الذاكرة
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text text-2xl leading-none mt-1">
                        &times;
                    </button>
                </div>
                )}

                {/* ── Body ───────────────────────────────────────────────────── */}
                <div className={`flex-1 overflow-y-auto ${isCreating ? 'p-6' : 'p-5'}`}>

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
                                        <span>{(f.text || f.binaryData) ? '📄' : '📋'}</span>
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
                                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoadingFile}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-light-border dark:border-dark-border rounded-lg text-light-text dark:text-dark-text hover:border-brand-primary hover:text-brand-primary transition-colors flex-shrink-0 disabled:opacity-60">
                                        {isLoadingFile
                                            ? <i className="fas fa-circle-notch fa-spin w-3.5 text-brand-primary" />
                                            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                              </svg>
                                        }
                                        {isLoadingFile ? 'جارٍ القراءة...' : 'رفع ملف'}
                                    </button>
                                    <input ref={fileInputRef} type="file" accept=".txt,.md,.text,.csv,.pdf,.docx,.doc,.pptx,.xlsx" className="hidden" onChange={handleFileUpload} multiple />
                                </div>

                                {/* Binary file: show card preview instead of textarea */}
                                {activeFile.extractedFromPdf ? (
                                    /* Large PDF — text extracted client-side via PDF.js */
                                    <div className="flex items-center gap-4 p-4 bg-light-bg dark:bg-dark-bg border-2 border-brand-primary/30 rounded-xl">
                                        <span className="text-3xl flex-shrink-0">📕</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-light-text dark:text-dark-text truncate text-sm">{activeFile.name}</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                                PDF • {formatBytes(activeFile.extractedFromPdf.sizeBytes)}
                                            </p>
                                            <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                                                ✓ جاهز — تم استخراج النص ({activeFile.text.length.toLocaleString()} حرف)
                                            </p>
                                        </div>
                                        <button type="button" onClick={() => updateFile(activeFileId, { text: '', extractedFromPdf: undefined })}
                                            className="text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 text-sm flex-shrink-0"
                                            title="إزالة الملف">×</button>
                                    </div>
                                ) : activeFile.binaryData ? (
                                    <div className="flex items-center gap-4 p-4 bg-light-bg dark:bg-dark-bg border-2 border-brand-primary/30 rounded-xl">
                                        <span className="text-3xl flex-shrink-0">
                                            {FORMAT_ICONS[getFileExt(activeFile.originalFileName || activeFile.name)] ?? '📄'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-light-text dark:text-dark-text truncate text-sm">{activeFile.name}</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                                {getFileExt(activeFile.originalFileName || activeFile.name).toUpperCase()} • {formatBytes(activeFile.binaryData.sizeBytes)}
                                            </p>
                                            <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                                                ✓ جاهز — سيُرسل الملف إلى OpenAI / ChatGPT للتحليل
                                            </p>
                                        </div>
                                        <button type="button" onClick={() => updateFile(activeFileId, { binaryData: undefined, text: '' })}
                                            className="text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 text-sm flex-shrink-0"
                                            title="إزالة الملف">×</button>
                                    </div>
                                ) : (
                                    <textarea
                                        value={activeFile.text}
                                        onChange={e => updateFile(activeFileId, { text: e.target.value })}
                                        placeholder={`الصق محتوى الوثيقة هنا أو ارفع ملف...\n\nملفات مدعومة: PDF • DOCX • PPTX • XLSX • CSV • TXT • MD\nالتحليل يتم عبر OpenAI / ChatGPT من السيرفر فقط\n\nمثال على ما يمكن إدخاله:\n• كتاب البراند الكامل\n• وصف المنتجات والخدمات\n• أمثلة على منشورات سوشيال ميديا\n• تحليل المنافسين\n• قصة البراند والرسالة والرؤية\n• الأسئلة الشائعة والسياسات`}
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
                                        : activeFile.extractedFromPdf
                                        ? formatBytes(activeFile.extractedFromPdf.sizeBytes)
                                        : `${activeFile.text.length.toLocaleString()} حرف`}
                                </span>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">{error}</div>
                            )}

                            <div className="p-3 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                {analysisState === 'uploading' && 'الحالة: تجهيز الملف للرفع والتحليل'}
                                {analysisState === 'analyzing' && 'الحالة: جاري التحليل عبر OpenAI / ChatGPT'}
                                {analysisState === 'completed' && 'الحالة: اكتمل التحليل بنجاح'}
                                {analysisState === 'failed' && 'الحالة: فشل التحليل — يمكنك تعديل الملفات ثم إعادة المحاولة'}
                                {analysisState === 'idle' && 'الحالة: جاهز للتحليل'}
                            </div>

                            <div className="p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-lg text-sm text-brand-primary/90 space-y-1">
                                <p className="font-semibold">💡 كلما أضفت أكثر، تعلّم البراند أكثر:</p>
                                <p className="text-xs opacity-80">يستخرج OpenAI: الهوية، الرسالة والرؤية، التمركز، الجمهور، محاور المحتوى، قاعدة المعرفة، وملاحظات العمل — ثم يحفظها داخل Brand Hub</p>
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
                                <p className="text-lg font-bold text-light-text dark:text-dark-text">ChatGPT / OpenAI يحلل الوثائق...</p>
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">يستخرج الهوية، الصوت، الجمهور، الذكاء التسويقي، ونظام المحتوى</p>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-70 mt-1">قد يستغرق 20–60 ثانية حسب حجم الوثائق</p>
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
                                        <Pill color="yellow" label={`OpenAI • ${extracted.analysisModel || 'model'}`} />
                                        {extracted.detectedLanguage && <Pill color="red" label={`اللغة: ${extracted.detectedLanguage}`} />}
                                    </div>
                                </div>
                            </div>

                            {/* Identity */}
                            <Section title="🏷️ الهوية الأساسية">
                                <Row label="الاسم"     value={extracted.name} />
                                {extracted.businessType && <Row label="نوع النشاط" value={extracted.businessType} />}
                                <Row label="المجال"    value={extracted.industry} />
                                {extracted.market && <Row label="السوق" value={extracted.market} />}
                                {extracted.country  && <Row label="الدولة"  value={extracted.country} />}
                                {extracted.website  && <Row label="الموقع"  value={extracted.website} />}
                                {extracted.brandArchetype && <Row label="الشخصية" value={extracted.brandArchetype} />}
                                {extracted.positioning && <LongRow label="التموضع" value={extracted.positioning} />}
                                {extracted.coreOffer && <LongRow label="العرض الأساسي" value={extracted.coreOffer} />}
                                {extracted.valueProp && <LongRow label="القيمة المقترحة" value={extracted.valueProp} />}
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

                            <Section title="📈 الذكاء التسويقي">
                                <TagRow label="المنتجات / الخدمات" tags={extracted.marketingIntelligence.main_products_or_services} color="blue" />
                                <TagRow label="نقاط الألم" tags={extracted.marketingIntelligence.customer_pain_points} color="red" />
                                <TagRow label="الرغبات" tags={extracted.marketingIntelligence.customer_desires} color="green" />
                                <TagRow label="المزايا التنافسية" tags={extracted.marketingIntelligence.competitive_advantages} color="purple" />
                                <TagRow label="عناصر الإثبات" tags={extracted.marketingIntelligence.proof_points} color="yellow" />
                                <TagRow label="الاعتراضات" tags={extracted.marketingIntelligence.objections} color="red" />
                                <TagRow label="زوايا المحتوى" tags={extracted.marketingIntelligence.content_angles} color="blue" />
                                <TagRow label="زوايا الإعلانات" tags={extracted.marketingIntelligence.ad_angles} color="green" />
                            </Section>

                            <Section title="🪄 نظام المحتوى">
                                <TagRow label="محاور المحتوى الموصى بها" tags={extracted.contentSystem.recommended_content_pillars} color="purple" />
                                <TagRow label="Hooks مقترحة" tags={extracted.contentSystem.suggested_hooks} color="yellow" />
                                <TagRow label="CTA مقترحة" tags={extracted.contentSystem.cta_suggestions} color="green" />
                                {extracted.contentSystem.caption_style && <LongRow label="أسلوب الكابشن" value={extracted.contentSystem.caption_style} />}
                                {extracted.contentSystem.do.length > 0 && <ListRow label="✅ افعل" items={extracted.contentSystem.do} />}
                                {extracted.contentSystem.dont.length > 0 && <ListRow label="❌ لا تفعل" items={extracted.contentSystem.dont} />}
                            </Section>

                            <Section title="🧭 ملاحظات العمل">
                                <Row label="الثقة" value={`${Math.max(0, Math.min(100, extracted.businessNotes.confidence_score))}%`} />
                                {extracted.businessNotes.missing_information.length > 0 && (
                                    <ListRow label="معلومات ناقصة" items={extracted.businessNotes.missing_information} />
                                )}
                                {extracted.businessNotes.risks_or_inconsistencies.length > 0 && (
                                    <ListRow label="مخاطر أو تناقضات" items={extracted.businessNotes.risks_or_inconsistencies} />
                                )}
                                {extracted.businessNotes.recommended_next_questions.length > 0 && (
                                    <ListRow label="الأسئلة التالية" items={extracted.businessNotes.recommended_next_questions} />
                                )}
                            </Section>
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
                        <div className={`flex flex-col items-center justify-center gap-6 ${isCreating ? 'py-20' : 'py-12'}`}>
                            <div className={`rounded-full bg-green-500/15 flex items-center justify-center ${isCreating ? 'w-28 h-28 text-6xl' : 'w-20 h-20 text-4xl'}`}>✅</div>
                            <div className="text-center space-y-2">
                                <p className={`font-bold text-light-text dark:text-dark-text ${isCreating ? 'text-3xl' : 'text-xl'}`}>
                                    {isCreating ? '🎉 البراند جاهز!' : 'تم البناء الكامل!'}
                                </p>
                                {isCreating && (
                                    <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">
                                        تم بناء هوية البراند الكاملة، ذاكرة الـ AI، وقاعدة المعرفة تلقائياً
                                    </p>
                                )}
                            </div>
                            <div className={`grid gap-2 w-full ${isCreating ? 'max-w-md grid-cols-1' : 'max-w-xs'}`}>
                                {saveDetails.map((d, i) => (
                                    <p key={i} className={`text-center ${isCreating ? 'text-sm bg-light-bg dark:bg-dark-bg rounded-lg px-4 py-2 text-light-text dark:text-dark-text' : 'text-sm text-light-text-secondary dark:text-dark-text-secondary'}`}>{d}</p>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ─────────────────────────────────────────────────── */}
                {(step === 'input' || step === 'preview') && (
                    <div className={`border-t border-light-border dark:border-dark-border flex justify-between items-center flex-shrink-0 ${isCreating ? 'px-6 py-5 bg-light-card/60 dark:bg-dark-card/60 backdrop-blur-sm' : 'p-4'}`}>
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
                                        className={`bg-brand-primary text-white font-bold rounded-xl hover:bg-brand-secondary shadow-lg shadow-brand-primary/20 transition-all ${isCreating ? 'py-3 px-10 text-base' : 'py-2 px-6'}`}>
                                        {isCreating ? '🚀 إنشاء البراند الآن' : 'بناء البراند الكامل ✓'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <button type="button" onClick={onClose}
                                    className="text-light-text-secondary dark:text-dark-text-secondary font-medium py-2 px-4 rounded-lg hover:bg-light-bg dark:hover:bg-dark-bg">
                                    إلغاء
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAnalyze}
                                    disabled={filledFiles === 0 || isLoadingFile || analysisState === 'analyzing'}
                                    className={`bg-brand-primary text-white font-bold rounded-xl disabled:bg-gray-500 hover:bg-brand-secondary flex items-center gap-2 shadow-lg shadow-brand-primary/20 transition-all ${isCreating ? 'py-3 px-10 text-base' : 'py-2 px-6'}`}>
                                    <span>{analysisState === 'failed' ? '↻' : '🧠'}</span>
                                    {analysisState === 'failed'
                                        ? 'إعادة التحليل'
                                        : `تحليل ${filledFiles > 1 ? `${filledFiles} وثائق` : 'الوثيقة'} بالـ AI`}
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
