import React, { useState, useRef, useCallback } from 'react';
import { NotificationType, BusinessModel, BrandGoal, BrandLanguage } from '../types';
import { addBrand } from '../services/brandService';
import { updateBrandProfile } from '../services/brandHubService';
import { seedBrandKnowledge } from '../services/brandKnowledgeService';
import { callAIProxy, Type, AIQuotaError } from '../services/aiProxy';
import { useLanguage } from '../context/LanguageContext';
import { BrandImportModal } from './BrandImportModal';

// ─── Props ────────────────────────────────────────────────────────────────────

interface BrandOnboardingWizardProps {
    onComplete: (brandId: string) => void;
    onCancel: () => void;
    addNotification: (type: NotificationType, message: string) => void;
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const WIZARD_STEPS = [
    { key: 'basics',      iconAr: 'بيانات البراند',  iconEn: 'Brand Basics',   icon: 'fa-building-2'    },
    { key: 'business',    iconAr: 'نموذج العمل',      iconEn: 'Business',       icon: 'fa-briefcase'     },
    { key: 'audience',    iconAr: 'الجمهور',          iconEn: 'Audience',       icon: 'fa-users'         },
    { key: 'voice',       iconAr: 'صوت البراند',      iconEn: 'Brand Voice',    icon: 'fa-waveform-lines'},
    { key: 'ai-analysis', iconAr: 'ذكاء البراند',     iconEn: 'AI Intelligence',icon: 'fa-brain'         },
    { key: 'connect',     iconAr: 'ربط الحسابات',    iconEn: 'Connect',        icon: 'fa-plug'          },
    { key: 'done',        iconAr: 'اكتمل!',          iconEn: 'Complete',       icon: 'fa-circle-check'  },
] as const;

type WizardStep = (typeof WIZARD_STEPS)[number]['key'];

// ─── Static data ──────────────────────────────────────────────────────────────

const INDUSTRY_OPTIONS = [
    { en: 'E-commerce',         ar: 'تجارة إلكترونية',     icon: 'fa-bag-shopping'    },
    { en: 'Food & Beverage',    ar: 'مطاعم وأغذية',        icon: 'fa-utensils'        },
    { en: 'Fashion & Apparel',  ar: 'أزياء وملابس',        icon: 'fa-shirt'           },
    { en: 'Health & Wellness',  ar: 'صحة ولياقة',          icon: 'fa-heart-pulse'     },
    { en: 'Technology',         ar: 'تقنية',               icon: 'fa-microchip'       },
    { en: 'Real Estate',        ar: 'عقارات',              icon: 'fa-building'        },
    { en: 'Education',          ar: 'تعليم',               icon: 'fa-graduation-cap'  },
    { en: 'Beauty & Cosmetics', ar: 'جمال وتجميل',        icon: 'fa-spa'             },
    { en: 'Travel & Tourism',   ar: 'سياحة وسفر',         icon: 'fa-plane'           },
    { en: 'Finance & Banking',  ar: 'مالية ومصرفية',      icon: 'fa-landmark'        },
    { en: 'Healthcare',         ar: 'رعاية صحية',          icon: 'fa-stethoscope'     },
    { en: 'Automotive',         ar: 'سيارات',              icon: 'fa-car'             },
    { en: 'Entertainment',      ar: 'ترفيه',               icon: 'fa-film'            },
    { en: 'Sports & Fitness',   ar: 'رياضة وتمارين',      icon: 'fa-dumbbell'        },
    { en: 'Non-Profit',         ar: 'منظمة غير ربحية',    icon: 'fa-handshake'       },
    { en: 'Other',              ar: 'أخرى',                icon: 'fa-grid-2'          },
];

const COUNTRY_OPTIONS = [
    { code: 'SA', ar: 'السعودية',         en: 'Saudi Arabia'    },
    { code: 'AE', ar: 'الإمارات',         en: 'UAE'             },
    { code: 'EG', ar: 'مصر',             en: 'Egypt'           },
    { code: 'KW', ar: 'الكويت',          en: 'Kuwait'          },
    { code: 'QA', ar: 'قطر',             en: 'Qatar'           },
    { code: 'BH', ar: 'البحرين',         en: 'Bahrain'         },
    { code: 'OM', ar: 'عُمان',           en: 'Oman'            },
    { code: 'JO', ar: 'الأردن',          en: 'Jordan'          },
    { code: 'LB', ar: 'لبنان',           en: 'Lebanon'         },
    { code: 'MA', ar: 'المغرب',          en: 'Morocco'         },
    { code: 'GB', ar: 'بريطانيا',        en: 'United Kingdom'  },
    { code: 'US', ar: 'الولايات المتحدة',en: 'United States'   },
    { code: 'OTHER', ar: 'دولة أخرى',   en: 'Other'           },
];

const BUSINESS_MODEL_OPTIONS: { value: BusinessModel; ar: string; en: string; icon: string; desc_ar: string; desc_en: string }[] = [
    { value: 'b2c',      ar: 'B2C',         en: 'B2C',          icon: 'fa-user',          desc_ar: 'بيع مباشر للمستهلك',      desc_en: 'Direct to consumer'       },
    { value: 'b2b',      ar: 'B2B',         en: 'B2B',          icon: 'fa-building',      desc_ar: 'بيع لشركات وأعمال',       desc_en: 'Business to business'     },
    { value: 'ecommerce',ar: 'تجارة إلكترونية',en: 'E-commerce', icon: 'fa-cart-shopping', desc_ar: 'متجر أونلاين',            desc_en: 'Online store'             },
    { value: 'service',  ar: 'خدمات',       en: 'Services',     icon: 'fa-hands-helping', desc_ar: 'تقديم خدمات',             desc_en: 'Service provider'         },
    { value: 'local',    ar: 'محلي',        en: 'Local Biz',    icon: 'fa-location-dot',  desc_ar: 'نشاط تجاري محلي',        desc_en: 'Physical location'        },
    { value: 'saas',     ar: 'SaaS',        en: 'SaaS',         icon: 'fa-code',          desc_ar: 'برمجيات كخدمة',          desc_en: 'Software as a service'    },
    { value: 'mixed',    ar: 'مختلط',       en: 'Mixed',        icon: 'fa-layer-group',   desc_ar: 'نماذج متعددة',           desc_en: 'Multiple models'          },
];

const GOAL_OPTIONS: { value: BrandGoal; ar: string; en: string; icon: string }[] = [
    { value: 'awareness',   ar: 'الوعي بالبراند',   en: 'Brand Awareness',  icon: 'fa-bullhorn'       },
    { value: 'leads',       ar: 'جذب عملاء جدد',    en: 'Lead Generation',  icon: 'fa-user-plus'      },
    { value: 'sales',       ar: 'زيادة المبيعات',   en: 'Boost Sales',      icon: 'fa-chart-line'     },
    { value: 'bookings',    ar: 'حجوزات ومواعيد',   en: 'Bookings',         icon: 'fa-calendar-check' },
    { value: 'engagement',  ar: 'التفاعل',          en: 'Engagement',       icon: 'fa-heart'          },
    { value: 'support',     ar: 'دعم العملاء',      en: 'Customer Support', icon: 'fa-headset'        },
    { value: 'recruitment', ar: 'توظيف',            en: 'Recruitment',      icon: 'fa-user-tie'       },
];

const AGE_RANGES = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'];

const BRAND_VALUE_OPTIONS = [
    { en: 'Quality',        ar: 'الجودة'          },
    { en: 'Innovation',     ar: 'الابتكار'        },
    { en: 'Integrity',      ar: 'النزاهة'         },
    { en: 'Customer Focus', ar: 'التركيز على العميل'},
    { en: 'Sustainability', ar: 'الاستدامة'       },
    { en: 'Transparency',   ar: 'الشفافية'        },
    { en: 'Excellence',     ar: 'التميز'          },
    { en: 'Creativity',     ar: 'الإبداع'         },
    { en: 'Trust',          ar: 'الثقة'           },
    { en: 'Community',      ar: 'المجتمع'         },
    { en: 'Diversity',      ar: 'التنوع'          },
    { en: 'Passion',        ar: 'الشغف'           },
];

const TONE_OPTIONS = [
    { en: 'Friendly',       ar: 'ودود'      },
    { en: 'Professional',   ar: 'احترافي'   },
    { en: 'Casual',         ar: 'غير رسمي'  },
    { en: 'Authoritative',  ar: 'موثوق'     },
    { en: 'Inspiring',      ar: 'ملهم'      },
    { en: 'Humorous',       ar: 'فكاهي'     },
    { en: 'Empathetic',     ar: 'متعاطف'    },
    { en: 'Bold',           ar: 'جريء'      },
    { en: 'Elegant',        ar: 'راقي'      },
    { en: 'Educational',    ar: 'تعليمي'    },
    { en: 'Energetic',      ar: 'نشيط'      },
    { en: 'Minimalist',     ar: 'بسيط'      },
];

const PLATFORM_DISPLAY = [
    { id: 'facebook',  name: 'Facebook',  icon: 'fab fa-facebook-f',  grad: 'from-blue-600 to-blue-700',    desc_ar: 'صفحات وإعلانات',    desc_en: 'Pages & ads'     },
    { id: 'instagram', name: 'Instagram', icon: 'fab fa-instagram',   grad: 'from-pink-500 to-purple-600',  desc_ar: 'بزنس وريلز',        desc_en: 'Business & reels'},
    { id: 'linkedin',  name: 'LinkedIn',  icon: 'fab fa-linkedin-in', grad: 'from-blue-700 to-blue-800',    desc_ar: 'صفحة الشركة',       desc_en: 'Company page'    },
    { id: 'tiktok',    name: 'TikTok',    icon: 'fab fa-tiktok',      grad: 'from-slate-700 to-slate-900',  desc_ar: 'فيديوهات قصيرة',    desc_en: 'Short videos'    },
    { id: 'x',         name: 'X',         icon: 'fab fa-x-twitter',   grad: 'from-gray-800 to-gray-900',    desc_ar: 'تغريدات وخيوط',     desc_en: 'Tweets & threads'},
    { id: 'youtube',   name: 'YouTube',   icon: 'fab fa-youtube',     grad: 'from-red-600 to-red-700',      desc_ar: 'مقاطع وقوائم',      desc_en: 'Videos & playlists'},
];

// ─── AI Analysis types ────────────────────────────────────────────────────────

interface AIBrandAnalysis {
    brandSummary: string;
    contentPillars: string[];
    keywords: string[];
    faqSuggestions: { question: string; answer: string; approved: boolean }[];
    platformPriorities: string[];
    salesObjections: string[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SelectableChip: React.FC<{
    label: string; icon?: string; selected: boolean; onClick: () => void; size?: 'sm' | 'md';
}> = ({ label, icon, selected, onClick, size = 'md' }) => (
    <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 rounded-lg font-medium border transition-all duration-150 ${
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
        } ${
            selected
                ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                : 'bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text border-light-border dark:border-dark-border hover:border-brand-primary/60 hover:bg-brand-primary/5'
        }`}
    >
        {icon && <i className={`fas ${icon} text-[10px] opacity-80`} />}
        {label}
        {selected && <i className="fas fa-check text-[10px] opacity-90 ml-0.5" />}
    </button>
);

const TagBadge: React.FC<{ label: string; colorClass?: string; onRemove: () => void }> = ({
    label, colorClass = 'bg-brand-primary/10 text-brand-primary', onRemove,
}) => (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${colorClass}`}>
        {label}
        <button type="button" onClick={onRemove} className="hover:opacity-60 transition-opacity">
            <i className="fas fa-xmark text-[10px]" />
        </button>
    </span>
);

const TagsInput: React.FC<{
    tags: string[]; onAdd: (v: string) => void; onRemove: (v: string) => void;
    placeholder?: string; colorClass?: string; maxTags?: number;
}> = ({ tags, onAdd, onRemove, placeholder, colorClass, maxTags }) => {
    const [val, setVal] = useState('');
    const handleAdd = () => {
        const v = val.trim();
        if (v && !tags.includes(v) && (!maxTags || tags.length < maxTags)) {
            onAdd(v); setVal('');
        }
    };
    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={val}
                    onChange={e => setVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
                    placeholder={placeholder}
                    disabled={!!maxTags && tags.length >= maxTags}
                    className="flex-1 px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none disabled:opacity-50"
                />
                <button
                    type="button"
                    onClick={handleAdd}
                    disabled={!val.trim() || (!!maxTags && tags.length >= maxTags)}
                    className="px-3 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 disabled:opacity-40 transition-colors"
                >
                    <i className="fas fa-plus text-sm" />
                </button>
            </div>
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {tags.map(t => <TagBadge key={t} label={t} colorClass={colorClass} onRemove={() => onRemove(t)} />)}
                </div>
            )}
        </div>
    );
};

// ─── Intelligence Score Calculator ───────────────────────────────────────────

function calcIntelligenceScore(data: {
    brandName: string; industry: string; country: string; website: string;
    businessModel: BusinessModel | ''; goals: BrandGoal[]; description: string; language: BrandLanguage | '';
    targetAudienceSummary: string; ageRange: string;
    toneDescription: string[]; brandValues: string[]; keySellingPoints: string[];
    aiAnalysis: AIBrandAnalysis | null;
}): { total: number; sections: { label: string; score: number; max: number; complete: boolean }[] } {
    const sections = [
        {
            label: 'Brand Identity',
            score: [data.brandName, data.industry, data.country, data.website].filter(Boolean).length * 5 +
                   (data.businessModel ? 5 : 0) + (data.goals.length > 0 ? 5 : 0),
            max: 30,
            complete: !!(data.brandName && data.industry && data.businessModel && data.goals.length > 0),
        },
        {
            label: 'Brand Story',
            score: (data.description.length > 50 ? 15 : data.description.length > 10 ? 8 : 0) + (data.language ? 5 : 0),
            max: 20,
            complete: data.description.length > 50 && !!data.language,
        },
        {
            label: 'Audience',
            score: (data.targetAudienceSummary.length > 30 ? 15 : data.targetAudienceSummary.length > 10 ? 8 : 0) + (data.ageRange ? 5 : 0),
            max: 20,
            complete: data.targetAudienceSummary.length > 30 && !!data.ageRange,
        },
        {
            label: 'Voice & Values',
            score: (data.toneDescription.length > 0 ? 8 : 0) + (data.brandValues.length > 0 ? 8 : 0) + (data.keySellingPoints.length > 0 ? 4 : 0),
            max: 20,
            complete: data.toneDescription.length > 0 && data.brandValues.length > 0,
        },
        {
            label: 'AI Knowledge',
            score: data.aiAnalysis ? 10 : 0,
            max: 10,
            complete: !!data.aiAnalysis,
        },
    ];
    const total = Math.min(100, sections.reduce((a, s) => a + s.score, 0));
    return { total, sections };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const BrandOnboardingWizard: React.FC<BrandOnboardingWizardProps> = ({
    onComplete, onCancel, addNotification,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const [showImport, setShowImport] = useState(false);
    const [currentStep, setCurrentStep] = useState<WizardStep>('basics');
    const [isSaving, setIsSaving] = useState(false);
    const [createdBrandId, setCreatedBrandId] = useState<string | null>(null);

    // ── Step 1: Basics ──
    const [brandName, setBrandName]   = useState('');
    const [industry, setIndustry]     = useState('');
    const [logoUrl, setLogoUrl]       = useState('');
    const [country, setCountry]       = useState('');

    // ── Step 2: Business ──
    const [businessModel, setBusinessModel] = useState<BusinessModel | ''>('');
    const [goals, setGoals]                  = useState<BrandGoal[]>([]);
    const [description, setDescription]     = useState('');
    const [website, setWebsite]             = useState('');
    const [language2, setLanguage2]         = useState<BrandLanguage | ''>('');

    // ── Step 3: Audience ──
    const [targetAudienceSummary, setTargetAudienceSummary] = useState('');
    const [ageRange, setAgeRange]                            = useState('');
    const [audiencePainPoints, setAudiencePainPoints]       = useState<string[]>([]);

    // ── Step 4: Voice ──
    const [toneDescription, setToneDescription] = useState<string[]>([]);
    const [brandValues, setBrandValues]          = useState<string[]>([]);
    const [keySellingPoints, setKeySellingPoints] = useState<string[]>([]);
    const [keywords, setKeywords]                = useState<string[]>([]);

    // ── Step 5: AI Analysis ──
    const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
    const [aiLoadingStep, setAiLoadingStep] = useState(0);
    const [aiAnalysis, setAiAnalysis] = useState<AIBrandAnalysis | null>(null);
    const aiAbortRef = useRef(false);

    const AI_LOADING_STEPS = ar
        ? ['تحليل بيانات البراند...', 'بناء ملف الجمهور...', 'صياغة محاور المحتوى...', 'استخراج الكلمات المفتاحية...', 'بناء قاعدة المعرفة...']
        : ['Analyzing brand data...', 'Building audience profile...', 'Crafting content pillars...', 'Extracting keywords...', 'Building knowledge base...'];

    // ─── Helpers ────────────────────────────────────────────────────────────

    const stepIndex = WIZARD_STEPS.findIndex(s => s.key === currentStep);

    const goTo = (step: WizardStep) => setCurrentStep(step);
    const goNext = () => {
        const next = WIZARD_STEPS[stepIndex + 1];
        if (next) setCurrentStep(next.key);
    };

    const toggleGoal = (g: BrandGoal) =>
        setGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

    const toggleTone  = (t: string) =>
        setToneDescription(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

    const toggleValue = (v: string) =>
        setBrandValues(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

    // ─── AI Analysis ────────────────────────────────────────────────────────

    const runAIAnalysis = useCallback(async () => {
        setAiStatus('loading');
        setAiLoadingStep(0);
        aiAbortRef.current = false;

        const interval = setInterval(() => {
            setAiLoadingStep(prev => {
                if (prev < AI_LOADING_STEPS.length - 1) return prev + 1;
                return prev;
            });
        }, 900);

        const prompt = ar
            ? `أنت محلل استراتيجي متخصص في البراندز. بناءً على المعلومات التالية، قدّم تحليلاً شاملاً واستراتيجية براند احترافية.

معلومات البراند:
- الاسم: ${brandName}
- الصناعة: ${industry || 'غير محدد'}
- النموذج التجاري: ${businessModel || 'غير محدد'}
- الأهداف الرئيسية: ${goals.join('، ') || 'غير محدد'}
- وصف البراند: ${description || 'غير محدد'}
- الجمهور المستهدف: ${targetAudienceSummary || 'غير محدد'}
- الفئة العمرية: ${ageRange || 'غير محدد'}
- نبرة الصوت: ${toneDescription.join('، ') || 'غير محدد'}
- قيم البراند: ${brandValues.join('، ') || 'غير محدد'}
- البلد: ${country || 'غير محدد'}
- اللغة: ${language2 || 'غير محدد'}

أرجع JSON فقط بدون أي نص إضافي.`
            : `You are a brand strategist. Based on this brand information, provide a comprehensive brand analysis.

Brand Details:
- Name: ${brandName}
- Industry: ${industry || 'not specified'}
- Business Model: ${businessModel || 'not specified'}
- Main Goals: ${goals.join(', ') || 'not specified'}
- Brand Description: ${description || 'not specified'}
- Target Audience: ${targetAudienceSummary || 'not specified'}
- Age Range: ${ageRange || 'not specified'}
- Tone of Voice: ${toneDescription.join(', ') || 'not specified'}
- Brand Values: ${brandValues.join(', ') || 'not specified'}
- Country: ${country || 'not specified'}
- Language: ${language2 || 'not specified'}

Return JSON only.`;

        try {
            const res = await callAIProxy({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                schema: {
                    type: Type.OBJECT,
                    properties: {
                        brandSummary:      { type: Type.STRING },
                        contentPillars:    { type: Type.ARRAY,  items: { type: Type.STRING } },
                        keywords:          { type: Type.ARRAY,  items: { type: Type.STRING } },
                        faqSuggestions:    {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    question: { type: Type.STRING },
                                    answer:   { type: Type.STRING },
                                },
                            },
                        },
                        platformPriorities: { type: Type.ARRAY, items: { type: Type.STRING } },
                        salesObjections:    { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                },
                feature: 'brand_wizard_analysis',
                brand_id: null,
            });

            clearInterval(interval);
            if (aiAbortRef.current) return;

            const raw = typeof res.text === 'string' ? JSON.parse(res.text) : res.text as any;
            setAiAnalysis({
                brandSummary:      raw.brandSummary   || '',
                contentPillars:    raw.contentPillars || [],
                keywords:          raw.keywords       || [],
                faqSuggestions:    (raw.faqSuggestions || []).map((f: any) => ({ ...f, approved: true })),
                platformPriorities: raw.platformPriorities || [],
                salesObjections:   raw.salesObjections || [],
            });
            setAiStatus('done');

            // Merge AI-suggested keywords into the voice keywords
            if (raw.keywords?.length) {
                setKeywords(prev => {
                    const merged = [...new Set([...prev, ...(raw.keywords as string[])])];
                    return merged.slice(0, 15);
                });
            }
        } catch (err) {
            clearInterval(interval);
            if (aiAbortRef.current) return;
            const isQuota = err instanceof AIQuotaError;
            setAiStatus('error');
            addNotification(
                NotificationType.Warning,
                isQuota
                    ? (ar ? 'وصلت للحد اليومي للذكاء الاصطناعي' : 'Daily AI quota reached')
                    : (ar ? 'تعذّر تحليل البراند — يمكن المتابعة يدوياً' : 'AI analysis failed — you can continue manually'),
            );
        }
    }, [ar, brandName, industry, businessModel, goals, description, targetAudienceSummary, ageRange, toneDescription, brandValues, country, language2, addNotification]);

    // ─── Save brand to DB ────────────────────────────────────────────────────

    const saveBrand = useCallback(async (): Promise<string | null> => {
        if (createdBrandId) return createdBrandId;
        try {
            const newBrand = await addBrand(brandName, industry, logoUrl, country, website);
            setCreatedBrandId(newBrand.id);
            return newBrand.id;
        } catch (err: any) {
            addNotification(NotificationType.Error, err.message || (ar ? 'فشل إنشاء البراند' : 'Failed to create brand'));
            return null;
        }
    }, [createdBrandId, brandName, industry, logoUrl, country, website, ar, addNotification]);

    // ─── Final complete ──────────────────────────────────────────────────────

    const handleComplete = useCallback(async () => {
        setIsSaving(true);
        try {
            // Save brand row first (creates brand in DB if not already)
            const brandId = await saveBrand();
            if (!brandId) { setIsSaving(false); return; }

            // Save brand profile with all wizard data
            await updateBrandProfile(brandId, {
                brandName,
                industry,
                values: brandValues,
                keySellingPoints,
                styleGuidelines: aiAnalysis?.contentPillars ?? [],
                brandVoice: {
                    toneDescription,
                    keywords,
                    negativeKeywords: [],
                    toneStrength: 0.5,
                    toneSentiment: 0.5,
                },
                brandAudiences: targetAudienceSummary
                    ? [{
                        personaName:   ar ? 'الجمهور الرئيسي' : 'Primary Audience',
                        description:   targetAudienceSummary,
                        keyEmotions:   [],
                        painPoints:    audiencePainPoints,
                    }]
                    : [],
                description,
                businessModel: businessModel || undefined,
                goals,
                language:      language2 || undefined,
                ageRange:      ageRange   || undefined,
                targetAudienceSummary,
            });

            // Seed knowledge base with approved AI FAQs
            if (aiAnalysis) {
                const approvedFaqs = aiAnalysis.faqSuggestions.filter(f => f.approved);
                if (approvedFaqs.length > 0) {
                    await seedBrandKnowledge(brandId, approvedFaqs.map(f => ({
                        type: 'faq' as const,
                        title: f.question,
                        content: f.answer,
                        metadata: { source: 'ai_wizard', approved: true },
                    })));
                }
            }

            addNotification(
                NotificationType.Success,
                ar ? `تم إنشاء "${brandName}" بنجاح!` : `Brand "${brandName}" created successfully!`,
            );
            goTo('done');
        } catch (err: any) {
            addNotification(NotificationType.Error, err.message || (ar ? 'حدث خطأ أثناء الحفظ' : 'Save failed'));
        } finally {
            setIsSaving(false);
        }
    }, [ar, brandName, industry, logoUrl, country, website, brandValues, keySellingPoints, toneDescription, keywords, targetAudienceSummary, audiencePainPoints, description, businessModel, goals, language2, ageRange, aiAnalysis, saveBrand, addNotification]);

    // ─── Step navigation validation ─────────────────────────────────────────

    const canAdvance = (): boolean => {
        if (currentStep === 'basics')   return !!brandName.trim();
        if (currentStep === 'business') return !!businessModel && goals.length > 0;
        if (currentStep === 'audience') return true;
        if (currentStep === 'voice')    return toneDescription.length > 0 || brandValues.length > 0;
        return true;
    };

    const handleNext = () => {
        if (!canAdvance()) return;
        if (currentStep === 'voice') {
            // Auto-trigger AI analysis when entering step 5
            goTo('ai-analysis');
            if (aiStatus === 'idle') runAIAnalysis();
            return;
        }
        if (currentStep === 'ai-analysis') {
            // Auto-save brand before connect step so we have an ID
            saveBrand();
            goNext();
            return;
        }
        if (currentStep === 'connect') {
            handleComplete();
            return;
        }
        goNext();
    };

    const handleBack = () => {
        const prev = WIZARD_STEPS[stepIndex - 1];
        if (prev) setCurrentStep(prev.key);
    };

    // ─── Intelligence score ──────────────────────────────────────────────────

    const { total: intelligenceScore, sections: scoreSections } = calcIntelligenceScore({
        brandName, industry, country, website, businessModel, goals, description,
        language: language2, targetAudienceSummary, ageRange,
        toneDescription, brandValues, keySellingPoints, aiAnalysis,
    });

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <>
            {showImport && (
                <BrandImportModal
                    onClose={() => setShowImport(false)}
                    onImported={id => { setShowImport(false); onComplete(id); }}
                />
            )}

            <div
                className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-3 sm:p-4 backdrop-blur-sm"
                dir={ar ? 'rtl' : 'ltr'}
            >
                <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col border border-light-border dark:border-dark-border overflow-hidden">

                    {/* ── Header ── */}
                    <div className="px-5 pt-5 pb-4 border-b border-light-border dark:border-dark-border flex-shrink-0">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-primary to-indigo-600 flex items-center justify-center shadow-sm">
                                    <i className="fas fa-layer-group text-white text-xs" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-light-text dark:text-dark-text leading-tight">
                                        {ar ? 'إعداد براند جديد' : 'New Brand Setup'}
                                    </h2>
                                    <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                        {ar ? `الخطوة ${stepIndex + 1} من ${WIZARD_STEPS.length}` : `Step ${stepIndex + 1} of ${WIZARD_STEPS.length}`}
                                    </p>
                                </div>
                            </div>
                            {currentStep !== 'done' && (
                                <button
                                    onClick={onCancel}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-light-text-secondary hover:text-light-text dark:text-dark-text-secondary dark:hover:text-dark-text hover:bg-light-bg dark:hover:bg-dark-bg transition-all"
                                >
                                    <i className="fas fa-xmark text-sm" />
                                </button>
                            )}
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-2">
                            <div className="h-1.5 bg-light-bg dark:bg-dark-bg rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-brand-primary to-indigo-500 rounded-full transition-all duration-500"
                                    style={{ width: `${((stepIndex + 1) / WIZARD_STEPS.length) * 100}%` }}
                                />
                            </div>
                            {/* Step pills — show compact on small screens */}
                            <div className="hidden sm:flex items-center justify-between">
                                {WIZARD_STEPS.map((step, i) => (
                                    <div key={step.key} className="flex items-center gap-1">
                                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
                                            i < stepIndex  ? 'text-emerald-500 bg-emerald-500/10' :
                                            i === stepIndex ? 'text-brand-primary bg-brand-primary/10' :
                                                             'text-light-text-secondary dark:text-dark-text-secondary'
                                        }`}>
                                            <i className={`fas ${i < stepIndex ? 'fa-check' : step.icon} text-[9px]`} />
                                            <span>{ar ? step.iconAr : step.iconEn}</span>
                                        </div>
                                        {i < WIZARD_STEPS.length - 1 && (
                                            <div className={`w-3 h-px ${i < stepIndex ? 'bg-emerald-500/40' : 'bg-light-border dark:bg-dark-border'}`} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── Content ── */}
                    <div className="flex-1 overflow-y-auto px-5 py-5">

                        {/* ═══════════════════════════════════════ STEP 1: BASICS ══ */}
                        {currentStep === 'basics' && (
                            <div className="space-y-5 animate-fade-in">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-1">
                                        {ar ? 'الخطوة ١' : 'Step 1'}
                                    </p>
                                    <h3 className="text-xl font-bold text-light-text dark:text-dark-text">
                                        {ar ? 'ما اسم علامتك التجارية؟' : "What's your brand name?"}
                                    </h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                        {ar ? 'ابدأ بالاسم — يمكنك إضافة التفاصيل في الخطوات التالية' : 'Start with the name — details come next'}
                                    </p>
                                </div>

                                {/* Import shortcut */}
                                <button
                                    type="button"
                                    onClick={() => setShowImport(true)}
                                    className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed border-brand-primary/30 hover:border-brand-primary/60 hover:bg-brand-primary/5 transition-all group"
                                >
                                    <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-primary/20 transition-colors">
                                        <i className="fas fa-file-import text-brand-primary text-sm" />
                                    </div>
                                    <div className="flex-1 text-start">
                                        <p className="font-semibold text-light-text dark:text-dark-text text-sm">
                                            {ar ? 'استيراد من ملف' : 'Import from file'}
                                        </p>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                            {ar ? 'لديك ملف براند؟ الذكاء الاصطناعي يملأ كل شيء في ثوانٍ' : 'Have a brand doc? AI fills everything in seconds'}
                                        </p>
                                    </div>
                                    <i className={`fas fa-chevron-${ar ? 'left' : 'right'} text-brand-primary/40 group-hover:text-brand-primary text-xs`} />
                                </button>

                                <div className="flex items-center gap-3">
                                    <div className="flex-1 border-t border-light-border dark:border-dark-border" />
                                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'أو أدخل يدوياً' : 'or enter manually'}</span>
                                    <div className="flex-1 border-t border-light-border dark:border-dark-border" />
                                </div>

                                {/* Brand name */}
                                <div>
                                    <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-1.5">
                                        {ar ? 'اسم البراند' : 'Brand Name'} <span className="text-brand-primary">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={brandName}
                                        onChange={e => setBrandName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && canAdvance() && goNext()}
                                        placeholder={ar ? 'مثال: شركتي للتجارة' : 'E.g. Acme Corp'}
                                        autoFocus
                                        className="w-full px-4 py-3 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text text-base font-medium focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none transition-all"
                                    />
                                </div>

                                {/* Industry */}
                                <div>
                                    <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-1">
                                        {ar ? 'القطاع / الصناعة' : 'Industry'} <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-normal">({ar ? 'اختياري' : 'optional'})</span>
                                    </label>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {INDUSTRY_OPTIONS.map(opt => (
                                            <SelectableChip
                                                key={opt.en}
                                                label={ar ? opt.ar : opt.en}
                                                icon={opt.icon}
                                                selected={industry === opt.en}
                                                onClick={() => setIndustry(prev => prev === opt.en ? '' : opt.en)}
                                                size="sm"
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Country */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-1.5">
                                            {ar ? 'الدولة / السوق' : 'Country / Market'}
                                        </label>
                                        <select
                                            value={country}
                                            onChange={e => setCountry(e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none"
                                        >
                                            <option value="">{ar ? 'اختر دولة...' : 'Select country...'}</option>
                                            {COUNTRY_OPTIONS.map(c => (
                                                <option key={c.code} value={c.code}>{ar ? c.ar : c.en}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-1.5">
                                            {ar ? 'رابط الشعار' : 'Logo URL'}
                                        </label>
                                        <input
                                            type="url"
                                            value={logoUrl}
                                            onChange={e => setLogoUrl(e.target.value)}
                                            placeholder="https://..."
                                            className="w-full px-3 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ══════════════════════════════════════ STEP 2: BUSINESS ══ */}
                        {currentStep === 'business' && (
                            <div className="space-y-6 animate-fade-in">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-1">
                                        {ar ? 'الخطوة ٢' : 'Step 2'}
                                    </p>
                                    <h3 className="text-xl font-bold text-light-text dark:text-dark-text">
                                        {ar ? 'نموذج عملك وأهدافك' : 'Your business model & goals'}
                                    </h3>
                                </div>

                                {/* Business model */}
                                <div>
                                    <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                        {ar ? 'نموذج العمل' : 'Business Model'} <span className="text-brand-primary">*</span>
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {BUSINESS_MODEL_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setBusinessModel(opt.value)}
                                                className={`p-3 rounded-xl border text-start transition-all ${
                                                    businessModel === opt.value
                                                        ? 'border-brand-primary bg-brand-primary/8 shadow-sm'
                                                        : 'border-light-border dark:border-dark-border hover:border-brand-primary/40'
                                                }`}
                                            >
                                                <i className={`fas ${opt.icon} text-brand-primary text-sm mb-1.5`} />
                                                <p className="font-semibold text-light-text dark:text-dark-text text-sm">{ar ? opt.ar : opt.en}</p>
                                                <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{ar ? opt.desc_ar : opt.desc_en}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Goals */}
                                <div>
                                    <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                        {ar ? 'الأهداف الرئيسية' : 'Main Goals'} <span className="text-brand-primary">*</span>
                                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-normal ml-2">({ar ? 'يمكن اختيار أكثر من هدف' : 'multiple allowed'})</span>
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {GOAL_OPTIONS.map(opt => (
                                            <SelectableChip
                                                key={opt.value}
                                                label={ar ? opt.ar : opt.en}
                                                icon={opt.icon}
                                                selected={goals.includes(opt.value)}
                                                onClick={() => toggleGoal(opt.value)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-1">
                                        {ar ? 'وصف البراند' : 'Brand Description'}
                                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-normal ml-2">({ar ? 'اختياري — يُحسّن نتائج الذكاء الاصطناعي' : 'optional — improves AI quality'})</span>
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        rows={3}
                                        placeholder={ar ? 'اكتب وصفاً مختصراً لنشاطك التجاري، منتجاتك، وما يُميّزك...' : 'Describe your business, products, and what makes you unique...'}
                                        className="w-full px-3 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text text-sm resize-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none"
                                    />
                                </div>

                                {/* Website + Language */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-1.5">
                                            {ar ? 'الموقع الإلكتروني' : 'Website'}
                                        </label>
                                        <input
                                            type="url"
                                            value={website}
                                            onChange={e => setWebsite(e.target.value)}
                                            placeholder="https://yoursite.com"
                                            className="w-full px-3 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-1.5">
                                            {ar ? 'لغة المحتوى' : 'Content Language'}
                                        </label>
                                        <select
                                            value={language2}
                                            onChange={e => setLanguage2(e.target.value as BrandLanguage)}
                                            className="w-full px-3 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none"
                                        >
                                            <option value="">{ar ? 'اختر...' : 'Select...'}</option>
                                            <option value="ar">{ar ? 'عربي' : 'Arabic'}</option>
                                            <option value="en">{ar ? 'إنجليزي' : 'English'}</option>
                                            <option value="both">{ar ? 'عربي وإنجليزي' : 'Arabic & English'}</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ══════════════════════════════════════ STEP 3: AUDIENCE ══ */}
                        {currentStep === 'audience' && (
                            <div className="space-y-6 animate-fade-in">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-1">
                                        {ar ? 'الخطوة ٣' : 'Step 3'}
                                    </p>
                                    <h3 className="text-xl font-bold text-light-text dark:text-dark-text">
                                        {ar ? 'من هو عميلك المثالي؟' : 'Who is your ideal customer?'}
                                    </h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                        {ar ? 'كلما كنت دقيقاً، كلما كان الذكاء الاصطناعي أكثر دقة في المحتوى والردود' : 'More detail means smarter AI content and replies'}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-1.5">
                                        {ar ? 'وصف الجمهور المستهدف' : 'Target Audience Description'}
                                    </label>
                                    <textarea
                                        value={targetAudienceSummary}
                                        onChange={e => setTargetAudienceSummary(e.target.value)}
                                        rows={3}
                                        placeholder={ar
                                            ? 'مثال: أصحاب الأعمال في السعودية من ٢٥ إلى ٤٠ سنة، مهتمون بالتقنية والتطوير، يبحثون عن حلول تسويقية سهلة'
                                            : 'E.g. Small business owners aged 25-40 in the GCC, interested in tech and growth, looking for easy marketing solutions'}
                                        className="w-full px-3 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text text-sm resize-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                        {ar ? 'الفئة العمرية' : 'Age Range'}
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {AGE_RANGES.map(range => (
                                            <SelectableChip
                                                key={range}
                                                label={range}
                                                selected={ageRange === range}
                                                onClick={() => setAgeRange(prev => prev === range ? '' : range)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-1.5">
                                        {ar ? 'مشاكل وتحديات جمهورك' : "Audience Pain Points"}
                                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-normal ml-2">({ar ? 'اختياري' : 'optional'})</span>
                                    </label>
                                    <TagsInput
                                        tags={audiencePainPoints}
                                        onAdd={v => setAudiencePainPoints(p => [...p, v])}
                                        onRemove={v => setAudiencePainPoints(p => p.filter(x => x !== v))}
                                        placeholder={ar ? 'مثال: الأسعار العالية، صعوبة الإدارة...' : 'E.g. high costs, hard to manage...'}
                                        colorClass="bg-red-500/10 text-red-400"
                                        maxTags={8}
                                    />
                                </div>

                                <div className="flex items-start gap-2.5 p-3 bg-cyan-500/8 rounded-xl border border-cyan-500/20">
                                    <i className="fas fa-lightbulb text-cyan-400 text-sm mt-0.5 shrink-0" />
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                                        {ar
                                            ? 'هذه البيانات ستُستخدم لتوليد محتوى مخصص، اقتراح حملات، وتدريب بوت الدعم على فهم عملائك'
                                            : 'This data trains the AI to generate personalized content, campaign ideas, and smart support bot replies'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ════════════════════════════════════════ STEP 4: VOICE ══ */}
                        {currentStep === 'voice' && (
                            <div className="space-y-6 animate-fade-in">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-1">
                                        {ar ? 'الخطوة ٤' : 'Step 4'}
                                    </p>
                                    <h3 className="text-xl font-bold text-light-text dark:text-dark-text">
                                        {ar ? 'صوت وهوية براندك' : 'Your brand voice & identity'}
                                    </h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                        {ar ? 'هذا ما يجعل محتواك مميزاً ومختلفاً' : 'This is what makes your content uniquely yours'}
                                    </p>
                                </div>

                                {/* Tone */}
                                <div>
                                    <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-1">
                                        {ar ? 'نبرة الصوت' : 'Tone of Voice'}
                                    </label>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-2.5">
                                        {ar ? 'كيف تريد أن يشعر جمهورك عند قراءة محتواك؟' : 'How should your audience feel when reading your content?'}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {TONE_OPTIONS.map(opt => (
                                            <SelectableChip
                                                key={opt.en}
                                                label={ar ? opt.ar : opt.en}
                                                selected={toneDescription.includes(opt.en)}
                                                onClick={() => toggleTone(opt.en)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Values */}
                                <div>
                                    <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-1">
                                        {ar ? 'قيم البراند' : 'Brand Values'}
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {BRAND_VALUE_OPTIONS.map(opt => (
                                            <SelectableChip
                                                key={opt.en}
                                                label={ar ? opt.ar : opt.en}
                                                selected={brandValues.includes(opt.en)}
                                                onClick={() => toggleValue(opt.en)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Key selling points */}
                                <div>
                                    <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-1.5">
                                        {ar ? 'نقاط البيع الرئيسية' : 'Key Selling Points'}
                                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-normal ml-2">({ar ? 'ما يميّزك عن المنافسين' : 'what sets you apart'})</span>
                                    </label>
                                    <TagsInput
                                        tags={keySellingPoints}
                                        onAdd={v => setKeySellingPoints(p => [...p, v])}
                                        onRemove={v => setKeySellingPoints(p => p.filter(x => x !== v))}
                                        placeholder={ar ? 'مثال: توصيل سريع، دعم ٢٤/٧...' : 'E.g. fast delivery, 24/7 support...'}
                                        maxTags={6}
                                    />
                                </div>

                                {/* Keywords */}
                                <div>
                                    <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-1.5">
                                        {ar ? 'الكلمات المفتاحية' : 'Brand Keywords'}
                                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-normal ml-2">({ar ? 'هاشتاق، مصطلحات صناعتك...' : 'hashtags, industry terms...'})</span>
                                    </label>
                                    <TagsInput
                                        tags={keywords}
                                        onAdd={v => setKeywords(p => [...p, v])}
                                        onRemove={v => setKeywords(p => p.filter(x => x !== v))}
                                        placeholder={ar ? 'مثال: تسويق، تجارة_إلكترونية...' : 'E.g. marketing, ecommerce...'}
                                        colorClass="bg-indigo-500/10 text-indigo-400"
                                        maxTags={12}
                                    />
                                </div>
                            </div>
                        )}

                        {/* ═══════════════════════════════════ STEP 5: AI ANALYSIS ══ */}
                        {currentStep === 'ai-analysis' && (
                            <div className="space-y-5 animate-fade-in">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400 mb-1">
                                        {ar ? 'الخطوة ٥' : 'Step 5'}
                                    </p>
                                    <h3 className="text-xl font-bold text-light-text dark:text-dark-text">
                                        {ar ? 'ذكاء البراند' : 'Brand Intelligence'}
                                    </h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                        {ar ? 'الذكاء الاصطناعي يحلّل بيانات براندك ويبني أساس قاعدة معرفته' : 'AI analyzes your brand data and builds its knowledge foundation'}
                                    </p>
                                </div>

                                {/* LOADING STATE */}
                                {aiStatus === 'loading' && (
                                    <div className="py-8 text-center space-y-6">
                                        <div className="relative w-20 h-20 mx-auto">
                                            <div className="absolute inset-0 rounded-full border-4 border-brand-primary/20" />
                                            <div className="absolute inset-0 rounded-full border-4 border-t-brand-primary animate-spin" />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <i className="fas fa-brain text-brand-primary text-2xl" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {AI_LOADING_STEPS.map((step, i) => (
                                                <div key={step} className={`flex items-center gap-2 justify-center text-sm transition-all duration-300 ${
                                                    i < aiLoadingStep  ? 'text-emerald-400' :
                                                    i === aiLoadingStep ? 'text-light-text dark:text-dark-text font-medium' :
                                                                         'text-light-text-secondary dark:text-dark-text-secondary opacity-40'
                                                }`}>
                                                    <i className={`fas text-xs ${
                                                        i < aiLoadingStep  ? 'fa-check-circle' :
                                                        i === aiLoadingStep ? 'fa-circle-notch fa-spin' :
                                                                             'fa-circle'
                                                    }`} />
                                                    {step}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* IDLE STATE */}
                                {aiStatus === 'idle' && (
                                    <div className="py-6 text-center space-y-5">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-brand-primary/20 flex items-center justify-center mx-auto">
                                            <i className="fas fa-brain text-brand-primary text-3xl" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-light-text dark:text-dark-text">
                                                {ar ? 'جاهز لتحليل براندك' : 'Ready to analyze your brand'}
                                            </h4>
                                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1.5 max-w-sm mx-auto">
                                                {ar
                                                    ? 'الذكاء الاصطناعي سيولّد: ملخص البراند، محاور المحتوى، الكلمات المفتاحية، أسئلة العملاء الشائعة، وأولويات المنصات'
                                                    : 'AI will generate: brand summary, content pillars, keywords, customer FAQs, and platform priorities'}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={runAIAnalysis}
                                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-primary to-indigo-600 text-white font-semibold rounded-xl hover:opacity-90 transition-all shadow-lg shadow-brand-primary/25"
                                        >
                                            <i className="fas fa-wand-magic-sparkles" />
                                            {ar ? 'ابدأ تحليل البراند' : 'Start Brand Analysis'}
                                        </button>
                                    </div>
                                )}

                                {/* ERROR STATE */}
                                {aiStatus === 'error' && (
                                    <div className="py-6 text-center space-y-4">
                                        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto">
                                            <i className="fas fa-triangle-exclamation text-amber-400 text-2xl" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-light-text dark:text-dark-text">
                                                {ar ? 'تعذّر إتمام التحليل' : 'Analysis could not complete'}
                                            </p>
                                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                                {ar ? 'يمكنك المتابعة يدوياً أو المحاولة مرة أخرى' : 'You can continue manually or try again'}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={runAIAnalysis}
                                            className="inline-flex items-center gap-2 px-5 py-2 bg-brand-primary text-white rounded-xl text-sm font-semibold"
                                        >
                                            <i className="fas fa-rotate" />
                                            {ar ? 'حاول مرة أخرى' : 'Try Again'}
                                        </button>
                                    </div>
                                )}

                                {/* RESULTS STATE */}
                                {aiStatus === 'done' && aiAnalysis && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg text-sm font-medium border border-emerald-500/20">
                                            <i className="fas fa-circle-check text-sm" />
                                            {ar ? 'تم تحليل براندك بنجاح — راجع النتائج وأقرّ ما تريد حفظه' : 'Brand analyzed successfully — review and approve what to save'}
                                        </div>

                                        {/* Brand Summary */}
                                        <div className="bg-light-bg dark:bg-dark-bg rounded-xl border border-light-border dark:border-dark-border p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <i className="fas fa-id-card text-brand-primary text-xs" />
                                                <span className="text-xs font-semibold text-light-text dark:text-dark-text uppercase tracking-wide">
                                                    {ar ? 'ملخص البراند' : 'Brand Summary'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-light-text dark:text-dark-text leading-relaxed">{aiAnalysis.brandSummary}</p>
                                        </div>

                                        {/* Content Pillars */}
                                        <div className="bg-light-bg dark:bg-dark-bg rounded-xl border border-light-border dark:border-dark-border p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <i className="fas fa-columns-3 text-indigo-400 text-xs" />
                                                <span className="text-xs font-semibold text-light-text dark:text-dark-text uppercase tracking-wide">
                                                    {ar ? 'محاور المحتوى المقترحة' : 'Suggested Content Pillars'}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {aiAnalysis.contentPillars.map((p, i) => (
                                                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg text-xs font-medium border border-indigo-500/20">
                                                        <i className="fas fa-hashtag text-[9px]" />
                                                        {p}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Keywords */}
                                        <div className="bg-light-bg dark:bg-dark-bg rounded-xl border border-light-border dark:border-dark-border p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <i className="fas fa-tags text-cyan-400 text-xs" />
                                                <span className="text-xs font-semibold text-light-text dark:text-dark-text uppercase tracking-wide">
                                                    {ar ? 'الكلمات المفتاحية المقترحة' : 'Suggested Keywords'}
                                                </span>
                                                <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                                                    ({ar ? 'تمت إضافتها لقائمة كلماتك' : 'added to your keywords'})
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {aiAnalysis.keywords.map((k, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded-md text-xs font-medium border border-cyan-500/20">{k}</span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Platform Priorities */}
                                        <div className="bg-light-bg dark:bg-dark-bg rounded-xl border border-light-border dark:border-dark-border p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <i className="fas fa-trophy text-amber-400 text-xs" />
                                                <span className="text-xs font-semibold text-light-text dark:text-dark-text uppercase tracking-wide">
                                                    {ar ? 'أولويات المنصات' : 'Platform Priorities'}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {aiAnalysis.platformPriorities.map((p, i) => (
                                                    <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-lg text-xs font-medium border border-amber-500/20">
                                                        <span className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center text-[9px] font-bold">{i + 1}</span>
                                                        {p}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* FAQs */}
                                        <div className="bg-light-bg dark:bg-dark-bg rounded-xl border border-light-border dark:border-dark-border p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <i className="fas fa-comments text-purple-400 text-xs" />
                                                <span className="text-xs font-semibold text-light-text dark:text-dark-text uppercase tracking-wide">
                                                    {ar ? 'أسئلة العملاء الشائعة' : 'Common Customer Questions'}
                                                </span>
                                                <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                                                    ({ar ? 'ستُحفظ في قاعدة المعرفة' : 'will be saved to knowledge base'})
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                {aiAnalysis.faqSuggestions.map((faq, i) => (
                                                    <div key={i} className={`p-3 rounded-lg border transition-all ${
                                                        faq.approved
                                                            ? 'border-emerald-500/30 bg-emerald-500/5'
                                                            : 'border-light-border dark:border-dark-border opacity-50'
                                                    }`}>
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-semibold text-light-text dark:text-dark-text mb-0.5">{faq.question}</p>
                                                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{faq.answer}</p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setAiAnalysis(prev => prev ? {
                                                                    ...prev,
                                                                    faqSuggestions: prev.faqSuggestions.map((f, j) =>
                                                                        j === i ? { ...f, approved: !f.approved } : f,
                                                                    ),
                                                                } : null)}
                                                                className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                                                                    faq.approved
                                                                        ? 'bg-emerald-500 text-white'
                                                                        : 'bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary'
                                                                }`}
                                                            >
                                                                <i className={`fas ${faq.approved ? 'fa-check' : 'fa-xmark'} text-[9px]`} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ══════════════════════════════════════ STEP 6: CONNECT ══ */}
                        {currentStep === 'connect' && (
                            <div className="space-y-5 animate-fade-in">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-1">
                                        {ar ? 'الخطوة ٦' : 'Step 6'}
                                    </p>
                                    <h3 className="text-xl font-bold text-light-text dark:text-dark-text">
                                        {ar ? 'ربط حسابات التواصل الاجتماعي' : 'Connect your social accounts'}
                                    </h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                        {ar
                                            ? 'الربط يتيح للذكاء الاصطناعي الوصول لبياناتك ومزامنة الأداء — يمكن تخطيه الآن وتنفيذه لاحقاً'
                                            : 'Connecting lets AI access your data and sync performance — skip now and connect later if you prefer'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {PLATFORM_DISPLAY.map(p => (
                                        <div
                                            key={p.id}
                                            className="p-4 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg"
                                        >
                                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.grad} flex items-center justify-center text-white mb-3`}>
                                                <i className={`${p.icon} text-base`} />
                                            </div>
                                            <p className="font-semibold text-light-text dark:text-dark-text text-sm">{p.name}</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                                {ar ? p.desc_ar : p.desc_en}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-start gap-3 p-4 rounded-xl bg-brand-primary/5 border border-brand-primary/20">
                                    <div className="w-8 h-8 rounded-lg bg-brand-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <i className="fas fa-circle-info text-brand-primary text-sm" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-light-text dark:text-dark-text">
                                            {ar ? 'كيف تربط حساباتك؟' : 'How to connect your accounts?'}
                                        </p>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 leading-relaxed">
                                            {ar
                                                ? 'بعد الإنهاء، اذهب إلى Integrations من القائمة الجانبية واربط حساباتك بأمان عبر OAuth الرسمي. سيقوم النظام بالتحقق من تطابق الصفحة مع البراند تلقائياً.'
                                                : 'After setup, go to Integrations in the sidebar to connect securely via each platform\'s official OAuth. The system will automatically verify the page matches your brand.'}
                                        </p>
                                    </div>
                                </div>

                                {/* What happens after connecting */}
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">
                                        {ar ? 'ما الذي يحدث بعد الربط؟' : 'What happens after connecting?'}
                                    </p>
                                    {[
                                        { icon: 'fa-shield-check',  color: 'text-emerald-400', textAr: 'تحقق من تطابق الصفحة مع البراند', textEn: 'Page-brand match verification' },
                                        { icon: 'fa-cloud-arrow-down', color: 'text-cyan-400',  textAr: 'استيراد بيانات وتفاعلات سابقة',    textEn: 'Import historical data & engagement' },
                                        { icon: 'fa-brain',           color: 'text-purple-400', textAr: 'تدريب الذكاء الاصطناعي على بيانات صفحتك', textEn: 'Train AI on your page data' },
                                        { icon: 'fa-chart-line',      color: 'text-amber-400',  textAr: 'تحليلات آنية لأداء المنشورات',    textEn: 'Real-time post performance analytics' },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-3 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                            <i className={`fas ${item.icon} ${item.color} text-xs w-4`} />
                                            {ar ? item.textAr : item.textEn}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ═══════════════════════════════════════════ STEP 7: DONE ══ */}
                        {currentStep === 'done' && (
                            <div className="space-y-6 animate-fade-in py-2">
                                {/* Header */}
                                <div className="text-center">
                                    <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                                        <i className="fas fa-circle-check text-emerald-400 text-4xl" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-light-text dark:text-dark-text">
                                        {ar ? 'براندك جاهز!' : 'Your brand is ready!'}
                                    </h3>
                                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1.5 text-sm">
                                        {ar ? `تم إنشاء "${brandName}" وبدأ الذكاء الاصطناعي بتعلّم هويته` : `"${brandName}" is set up and AI has started learning its identity`}
                                    </p>
                                </div>

                                {/* Intelligence Score */}
                                <div className="bg-light-bg dark:bg-dark-bg rounded-2xl border border-light-border dark:border-dark-border p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">
                                                {ar ? 'درجة ذكاء البراند' : 'Brand Intelligence Score'}
                                            </p>
                                            <div className="flex items-baseline gap-1.5 mt-1">
                                                <span className={`text-4xl font-bold ${
                                                    intelligenceScore >= 70 ? 'text-emerald-400' :
                                                    intelligenceScore >= 40 ? 'text-amber-400' : 'text-red-400'
                                                }`}>{intelligenceScore}</span>
                                                <span className="text-light-text-secondary dark:text-dark-text-secondary text-sm">/100</span>
                                            </div>
                                        </div>
                                        <div className="relative w-16 h-16">
                                            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                                <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-light-border dark:text-dark-border" />
                                                <circle
                                                    cx="18" cy="18" r="15.9" fill="none"
                                                    strokeWidth="3" strokeLinecap="round"
                                                    stroke={intelligenceScore >= 70 ? '#10b981' : intelligenceScore >= 40 ? '#f59e0b' : '#ef4444'}
                                                    strokeDasharray={`${intelligenceScore} 100`}
                                                    style={{ transition: 'stroke-dasharray 1s ease-out' }}
                                                />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Section breakdown */}
                                    <div className="space-y-2">
                                        {scoreSections.map(s => (
                                            <div key={s.label} className="flex items-center gap-3">
                                                <i className={`fas ${s.complete ? 'fa-check-circle text-emerald-400' : 'fa-circle-minus text-light-text-secondary dark:text-dark-text-secondary'} text-xs w-3`} />
                                                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex-1">{s.label}</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 bg-light-border dark:bg-dark-border rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${s.complete ? 'bg-emerald-400' : 'bg-brand-primary/50'}`}
                                                            style={{ width: `${(s.score / s.max) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary w-8">
                                                        {s.score}/{s.max}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Next steps */}
                                <div className="bg-light-bg dark:bg-dark-bg rounded-xl border border-light-border dark:border-dark-border p-4">
                                    <h4 className="text-sm font-bold text-light-text dark:text-dark-text mb-3 flex items-center gap-2">
                                        <i className="fas fa-list-check text-brand-primary text-xs" />
                                        {ar ? 'خطواتك التالية' : 'Your next steps'}
                                    </h4>
                                    <div className="space-y-2.5">
                                        {[
                                            { icon: 'fa-plug-circle-check', color: 'text-cyan-400',   textAr: 'اربط حسابات السوشيال من Integrations',     textEn: 'Connect social accounts via Integrations' },
                                            { icon: 'fa-database',          color: 'text-purple-400', textAr: 'أضف منتجاتك لقاعدة المعرفة من Brand Hub', textEn: 'Add products to knowledge base in Brand Hub' },
                                            { icon: 'fa-pen-nib',           color: 'text-brand-primary', textAr: 'أنشئ أول منشور من Content Studio',       textEn: 'Create your first post in Content Studio' },
                                            { icon: 'fa-chart-line',        color: 'text-emerald-400', textAr: 'تابع الأداء من Analytics',                textEn: 'Track performance in Analytics' },
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-3 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                                <div className="w-7 h-7 rounded-lg bg-light-card dark:bg-dark-card flex items-center justify-center flex-shrink-0">
                                                    <i className={`fas ${item.icon} ${item.color} text-xs`} />
                                                </div>
                                                {ar ? item.textAr : item.textEn}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Footer ── */}
                    <div className="px-5 py-4 border-t border-light-border dark:border-dark-border flex items-center justify-between flex-shrink-0">
                        <div>
                            {currentStep !== 'basics' && currentStep !== 'done' && (
                                <button
                                    onClick={handleBack}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-4 py-2 text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text transition-colors disabled:opacity-40"
                                >
                                    <i className={`fas fa-arrow-${ar ? 'right' : 'left'} text-xs`} />
                                    {ar ? 'رجوع' : 'Back'}
                                </button>
                            )}
                            {currentStep === 'basics' && (
                                <button
                                    onClick={onCancel}
                                    className="px-4 py-2 text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text transition-colors"
                                >
                                    {ar ? 'إلغاء' : 'Cancel'}
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Skip button for optional steps */}
                            {(currentStep === 'audience' || currentStep === 'ai-analysis' || currentStep === 'connect') && (
                                <button
                                    onClick={() => {
                                        if (currentStep === 'connect') { handleComplete(); return; }
                                        if (currentStep === 'ai-analysis') { saveBrand(); goNext(); return; }
                                        goNext();
                                    }}
                                    disabled={isSaving}
                                    className="px-4 py-2 text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text transition-colors disabled:opacity-40"
                                >
                                    {ar ? 'تخطي' : 'Skip'}
                                </button>
                            )}

                            {/* Main CTA */}
                            {currentStep === 'done' ? (
                                <button
                                    onClick={() => onComplete(createdBrandId || '')}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-primary to-indigo-600 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-brand-primary/25"
                                >
                                    <i className="fas fa-rocket text-xs" />
                                    {ar ? 'ابدأ الآن' : 'Get Started'}
                                </button>
                            ) : currentStep === 'ai-analysis' && aiStatus === 'loading' ? (
                                <span className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary/20 text-brand-primary rounded-xl text-sm font-semibold">
                                    <i className="fas fa-circle-notch fa-spin text-xs" />
                                    {ar ? 'جارٍ التحليل...' : 'Analyzing...'}
                                </span>
                            ) : (
                                <button
                                    onClick={handleNext}
                                    disabled={!canAdvance() || isSaving}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white rounded-xl font-semibold text-sm hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-brand-primary/20"
                                >
                                    {isSaving ? (
                                        <><i className="fas fa-circle-notch fa-spin text-xs" /> {ar ? 'جارٍ الحفظ...' : 'Saving...'}</>
                                    ) : (
                                        <>
                                            {currentStep === 'connect' ? (ar ? 'إنهاء وحفظ' : 'Finish & Save') : (ar ? 'التالي' : 'Next')}
                                            <i className={`fas fa-arrow-${ar ? 'left' : 'right'} text-xs`} />
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
