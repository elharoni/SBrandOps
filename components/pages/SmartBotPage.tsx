// components/pages/SmartBotPage.tsx
// البوت الذكي للمبيعات — Smart Sales Bot Studio
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Brand, BrandHubProfile, NotificationType,
    BotPersona, BotConversation, BotMessage,
    BotScenario, BotPersonality, BotLanguage, BotTrigger,
} from '../../types';
import {
    getBotPersonas, createBotPersona, updateBotPersona, updateBotPersonaStatus,
    deleteBotPersona, getBotConversations, saveBotConversation,
    incrementConversationCount, buildBotSystemPrompt, getBotReply, generateBrandFAQ,
    getBotAnalytics, BotAnalyticsResult,
} from '../../services/smartBotService';
import { BotFlowBuilder } from '../shared/BotFlowBuilder';
import { BotTriggerEditor, TriggerConfig, DEFAULT_TRIGGER_CONFIG } from '../shared/BotTriggerEditor';

// ── Template Definitions ──────────────────────────────────────────────────────

interface BotTemplate {
    id: string;
    scenario: BotScenario;
    nameAr: string;
    emoji: string;
    personaName: string;
    tagline: string;
    description: string;
    gradient: string;
    borderColor: string;
    tags: string[];
    metrics: { label: string; value: string }[];
    greetingTemplate: string;
    closingTemplate: string;
    defaultPersonality: BotPersonality;
    sampleConvo: { role: 'bot' | 'customer'; text: string }[];
}

const BOT_TEMPLATES: BotTemplate[] = [
    {
        id: 'sales-closer',
        scenario: 'sales-closing',
        nameAr: 'مغلق البيعة',
        emoji: '🎯',
        personaName: 'ليلى',
        tagline: 'يحوّل المهتمين إلى عملاء في 5 رسائل',
        description: 'بوت مبيعات ذكي يكتشف احتياج العميل ويقنعه ويغلق الصفقة بشكل طبيعي — دون أن يشعر بأنه يُباع له.',
        gradient: 'from-red-500 to-orange-500',
        borderColor: 'border-red-500/30',
        tags: ['مبيعات', 'إغلاق', 'اقتناع'],
        metrics: [
            { label: 'معدل الإغلاق', value: '34%' },
            { label: 'متوسط الرسائل', value: '4.8' },
        ],
        greetingTemplate: 'أهلاً بك! 👋 أنا ليلى، مستشارتك الشخصية في [اسم البراند]. كيف أقدر أساعدك اليوم؟ 😊',
        closingTemplate: 'يسعدنا خدمتك! إذا كان عندك أي استفسار مستقبلاً، أنا هنا دائماً 💪',
        defaultPersonality: 'professional',
        sampleConvo: [
            { role: 'customer', text: 'كم سعر الباقة الاحترافية؟' },
            { role: 'bot', text: 'الباقة الاحترافية بـ 299 ريال شهرياً ✨ وبصراحة هي الأكثر مبيعاً عندنا لأنها تشمل [الميزات]. بس قبل ما أخبرك أكثر — ما هو هدفك الأساسي من الخدمة؟' },
            { role: 'customer', text: 'أبي أزيد مبيعاتي' },
            { role: 'bot', text: 'ممتاز! عملاؤنا الذين لديهم نفس هدفك شهدوا زيادة 40%+ في أول 3 أشهر 📈 هل تريد أن أرتب لك تجربة مجانية لأسبوع؟' },
        ],
    },
    {
        id: 'lead-qualifier',
        scenario: 'lead-qualification',
        nameAr: 'مؤهّل العملاء',
        emoji: '🔍',
        personaName: 'خالد',
        tagline: 'يصفي ويصنّف العملاء تلقائياً',
        description: 'يطرح الأسئلة الذكية الصح ويصنّف كل عميل (حار / دافئ / بارد) حتى يعرف فريقك من يستحق الوقت أولاً.',
        gradient: 'from-blue-500 to-violet-500',
        borderColor: 'border-blue-500/30',
        tags: ['تأهيل', 'CRM', 'ترتيب'],
        metrics: [
            { label: 'عملاء مؤهَّلون', value: '67%' },
            { label: 'توفير يومي', value: '3 ساعات' },
        ],
        greetingTemplate: 'أهلاً! 👋 أنا خالد من فريق [اسم البراند]. قبل ما أوجهك للشخص المناسب — هل تسمح لي بسؤالين سريعين؟',
        closingTemplate: 'شكراً على وقتك! سيتواصل معك أحد من الفريق المتخصص خلال 24 ساعة 📞',
        defaultPersonality: 'friendly',
        sampleConvo: [
            { role: 'customer', text: 'مرحبا، أبي أعرف عن خدماتكم' },
            { role: 'bot', text: 'أهلاً بك! 😊 سؤال سريع — هل أنت تبحث لنفسك أو لشركتك؟' },
            { role: 'customer', text: 'لشركتي' },
            { role: 'bot', text: 'ممتاز! وكم عدد موظفيك تقريباً؟ هذا يساعدني أرشح لك الحل الأنسب.' },
        ],
    },
    {
        id: 'smart-advisor',
        scenario: 'faq',
        nameAr: 'المستشار الذكي',
        emoji: '💡',
        personaName: 'نور',
        tagline: 'دعم ذكي 24/7 بدون تدخل بشري',
        description: 'يجاوب على كل سؤال بدقة وبشكل احترافي — مبني على معرفة كاملة بالبراند ومنتجاته وسياساته.',
        gradient: 'from-teal-500 to-emerald-500',
        borderColor: 'border-teal-500/30',
        tags: ['دعم', 'أسئلة', '24/7'],
        metrics: [
            { label: 'معدل الحل', value: '89%' },
            { label: 'رضا العملاء', value: '4.8/5' },
        ],
        greetingTemplate: 'مرحباً! 💡 أنا نور، مستشارتك الذكية في [اسم البراند]. سعيدة بمساعدتك — ما سؤالك؟',
        closingTemplate: 'سعيدة بمساعدتك! لا تتردد في التواصل في أي وقت 🌟',
        defaultPersonality: 'friendly',
        sampleConvo: [
            { role: 'customer', text: 'هل الشحن مجاني؟' },
            { role: 'bot', text: 'نعم! الشحن مجاني على جميع الطلبات فوق 200 ريال 🚚 وعادةً يصلك خلال 2-3 أيام عمل. هل هناك شيء آخر تريد معرفته؟' },
        ],
    },
    {
        id: 'product-advisor',
        scenario: 'product-advisor',
        nameAr: 'خبير المنتج',
        emoji: '🛒',
        personaName: 'أمير',
        tagline: 'يوصّح المنتج الصح لكل عميل',
        description: 'يكتشف احتياج العميل الحقيقي ويوصي بالمنتج المناسب مع مقارنة واضحة — يزيد متوسط قيمة الطلب تلقائياً.',
        gradient: 'from-purple-500 to-pink-500',
        borderColor: 'border-purple-500/30',
        tags: ['منتجات', 'توصية', 'upsell'],
        metrics: [
            { label: 'معدل Upsell', value: '28%' },
            { label: 'متوسط الطلب', value: '+45%' },
        ],
        greetingTemplate: 'أهلاً! 🛒 أنا أمير، مستشار المنتجات في [اسم البراند]. أخبرني احتياجك وأنا أوجهك للخيار الأنسب!',
        closingTemplate: 'يسعدني أنني ساعدتك في اختيار المنتج الصح! 🎉 هل تريد إتمام الطلب؟',
        defaultPersonality: 'enthusiastic',
        sampleConvo: [
            { role: 'customer', text: 'مو عارف أي منتج يناسبني' },
            { role: 'bot', text: 'لا مشكلة، أنا هنا لهذا! 😊 سؤال واحد: ما هو استخدامك الأساسي — للمنزل أم للعمل؟' },
            { role: 'customer', text: 'للعمل' },
            { role: 'bot', text: 'ممتاز! إذاً الباقة Pro هي الأنسب لك تماماً — فيها [الميزات]. معظم عملائنا من بيئة العمل يختارونها. تريد أطلعك على تفاصيلها؟' },
        ],
    },
    {
        id: 'retention-bot',
        scenario: 'retention',
        nameAr: 'حارس العلاقة',
        emoji: '🤝',
        personaName: 'ريم',
        tagline: 'يمنع العميل من المغادرة ويعيد الغائبين',
        description: 'يتعامل مع العملاء الساخطين أو الغائبين بتعاطف وذكاء — يحوّل التجارب السلبية إلى فرص ولاء.',
        gradient: 'from-emerald-500 to-teal-500',
        borderColor: 'border-emerald-500/30',
        tags: ['احتفاظ', 'churn', 'ولاء'],
        metrics: [
            { label: 'معدل الاحتفاظ', value: '71%' },
            { label: 'إعادة تفعيل', value: '23%' },
        ],
        greetingTemplate: 'أهلاً بك مجدداً 💚 أنا ريم من فريق [اسم البراند]. لاحظت أنك لم تكن معنا فترة — كيف أقدر أساعدك اليوم؟',
        closingTemplate: 'نسعد بوجودك دائماً معنا! أي شيء تحتاجه، أنا هنا 💚',
        defaultPersonality: 'friendly',
        sampleConvo: [
            { role: 'customer', text: 'أبي أوقف اشتراكي' },
            { role: 'bot', text: 'أسمعك 💚 أعتذر إذا كانت تجربتك لم تكن بالمستوى المطلوب. ممكن تخبرني السبب؟ أنا هنا للاستماع بصدق.' },
            { role: 'customer', text: 'السعر غالي علي' },
            { role: 'bot', text: 'أقدر أفهمك تماماً. عندي خيار قد يناسبك — هل يمكنني أعرض عليك باقة مؤقتة بسعر مخصص لك أنت تحديداً؟' },
        ],
    },
    {
        id: 'appointment-bot',
        scenario: 'appointment',
        nameAr: 'مساعد الحجز',
        emoji: '📅',
        personaName: 'لمى',
        tagline: 'يحجز المواعيد تلقائياً بدون جدول',
        description: 'يدير المواعيد والاستشارات بشكل كامل — يجد الوقت المناسب ويرسل التأكيد والتذكيرات تلقائياً.',
        gradient: 'from-orange-500 to-amber-500',
        borderColor: 'border-orange-500/30',
        tags: ['مواعيد', 'حجز', 'جدولة'],
        metrics: [
            { label: 'معدل الحجز', value: '82%' },
            { label: 'تقليل No-Show', value: '40%' },
        ],
        greetingTemplate: 'أهلاً! 📅 أنا لمى من [اسم البراند]. أقدر أساعدك في حجز موعدك بسهولة — متى يناسبك؟',
        closingTemplate: 'تم تأكيد موعدك! 🎉 ستصلك رسالة تأكيد، ونراك قريباً إن شاء الله.',
        defaultPersonality: 'friendly',
        sampleConvo: [
            { role: 'customer', text: 'أبي أحجز موعد استشارة' },
            { role: 'bot', text: 'يسعدنا! 📅 متى يناسبك — صباحاً أم مساءً؟ وأي يوم هذا الأسبوع يناسبك؟' },
            { role: 'customer', text: 'يوم الأربعاء مساءً' },
            { role: 'bot', text: 'ممتاز! عندي متاح الأربعاء: 4 م أو 6 م — أيهما يناسبك أكثر؟ 😊' },
        ],
    },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'templates' | 'mybots' | 'conversations' | 'analytics';

interface SmartBotPageProps {
    brandId: string;
    brand?: Brand | null;
    brandProfile: BrandHubProfile | null;
    addNotification: (type: NotificationType, msg: string) => void;
}

interface WizardState {
    step: 1 | 2 | 3 | 4;
    editingId: string | null;
    template: BotTemplate | null;
    name: string;
    emoji: string;
    personality: BotPersonality;
    language: BotLanguage;
    persuasionLevel: 1 | 2 | 3;
    extraKnowledge: string;
    greetingMessage: string;
    closingMessage: string;
    triggerConfig: TriggerConfig;
    saving: boolean;
}

const DEFAULT_WIZARD: WizardState = {
    step: 1, editingId: null, template: null,
    name: '', emoji: '🤖',
    personality: 'professional', language: 'arabic', persuasionLevel: 2,
    extraKnowledge: '', greetingMessage: '', closingMessage: '',
    triggerConfig: DEFAULT_TRIGGER_CONFIG,
    saving: false,
};

// ── Component ─────────────────────────────────────────────────────────────────

export const SmartBotPage: React.FC<SmartBotPageProps> = ({
    brandId, brand, brandProfile, addNotification,
}) => {
    const [tab, setTab] = useState<TabId>('templates');
    const [personas, setPersonas]           = useState<BotPersona[]>([]);
    const [loading, setLoading]             = useState(true);
    const [showBuilder, setShowBuilder]     = useState(false);
    const [wizard, setWizard]               = useState<WizardState>(DEFAULT_WIZARD);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [conversations, setConversations] = useState<BotConversation[]>([]);
    const [convoLoading, setConvoLoading]   = useState(false);
    const [generatingFAQ, setGeneratingFAQ] = useState(false);

    // Flow Builder
    const [flowBuilderPersona, setFlowBuilderPersona] = useState<BotPersona | null>(null);

    // Analytics
    const [analytics, setAnalytics]         = useState<BotAnalyticsResult | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    // Demo chat
    const [showDemo, setShowDemo]               = useState(false);
    const [demoPersona, setDemoPersona]         = useState<BotPersona | null>(null);
    const [demoTemplate, setDemoTemplate]       = useState<BotTemplate | null>(null);
    const [chatMessages, setChatMessages]       = useState<BotMessage[]>([]);
    const [chatInput, setChatInput]             = useState('');
    const [botTyping, setBotTyping]             = useState(false);
    const [demoSystemPrompt, setDemoSystemPrompt] = useState('');
    const [demoSaved, setDemoSaved]             = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const brandName = brandProfile?.brandName || brand?.name || 'البراند';

    // ── Effects ──────────────────────────────────────────────────────────────

    useEffect(() => {
        getBotPersonas(brandId).then(p => {
            setPersonas(p);
            setLoading(false);
            if (p.length > 0) setTab('mybots');
        });
    }, [brandId]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, botTyping]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (showDemo) setShowDemo(false);
            else if (showBuilder) setShowBuilder(false);
            else if (deleteConfirm) setDeleteConfirm(null);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [showDemo, showBuilder, deleteConfirm]);

    useEffect(() => {
        if (tab !== 'conversations') return;
        setConvoLoading(true);
        getBotConversations(brandId).then(c => { setConversations(c); setConvoLoading(false); });
    }, [tab, brandId]);

    useEffect(() => {
        if (tab !== 'analytics') return;
        setAnalyticsLoading(true);
        getBotAnalytics(brandId).then(r => { setAnalytics(r); setAnalyticsLoading(false); });
    }, [tab, brandId]);

    // ── Demo open / close ─────────────────────────────────────────────────────

    const closeDemo = useCallback(async () => {
        setShowDemo(false);
        if (demoPersona && demoPersona.id !== 'demo' && chatMessages.length > 1 && !demoSaved) {
            setDemoSaved(true);
            try {
                await saveBotConversation(brandId, demoPersona.id, chatMessages);
                await incrementConversationCount(brandId, demoPersona.id);
                setPersonas(prev => prev.map(p =>
                    p.id === demoPersona.id ? { ...p, conversationCount: p.conversationCount + 1 } : p
                ));
            } catch { /* non-critical */ }
        }
        setChatMessages([]);
        setChatInput('');
        setDemoPersona(null);
        setDemoTemplate(null);
        setDemoSaved(false);
    }, [demoPersona, chatMessages, demoSaved, brandId]);

    const openTemplateDemo = (template: BotTemplate) => {
        const draftPersona: BotPersona = {
            id: 'demo',
            brandId,
            name: template.personaName,
            avatarEmoji: template.emoji,
            scenario: template.scenario,
            personality: template.defaultPersonality,
            language: 'arabic',
            persuasionLevel: 2,
            systemPrompt: '',
            greetingMessage: template.greetingTemplate.replace('[اسم البراند]', brandName),
            closingMessage: template.closingTemplate,
            trigger: 'dm-received',
            triggerKeywords: [],
            status: 'draft',
            conversationCount: 0,
            conversionRate: 0,
            createdAt: new Date().toISOString(),
        };
        setDemoSystemPrompt(buildBotSystemPrompt(draftPersona, brand ?? null, brandProfile));
        setDemoPersona(draftPersona);
        setDemoTemplate(template);
        setDemoSaved(false);
        setChatMessages([{
            id: crypto.randomUUID(),
            role: 'bot',
            content: draftPersona.greetingMessage,
            timestamp: new Date().toISOString(),
        }]);
        setShowDemo(true);
    };

    const openPersonaDemo = (p: BotPersona) => {
        setDemoSystemPrompt(buildBotSystemPrompt(p, brand ?? null, brandProfile));
        setDemoPersona(p);
        setDemoTemplate(null);
        setDemoSaved(false);
        setChatMessages([{
            id: crypto.randomUUID(),
            role: 'bot',
            content: p.greetingMessage || `أهلاً! أنا ${p.name}، كيف أقدر أساعدك؟`,
            timestamp: new Date().toISOString(),
        }]);
        setShowDemo(true);
    };

    // ── Builder open ──────────────────────────────────────────────────────────

    const openBuilder = (template: BotTemplate) => {
        setWizard({
            ...DEFAULT_WIZARD,
            template,
            name: template.personaName,
            emoji: template.emoji,
            personality: template.defaultPersonality,
            greetingMessage: template.greetingTemplate.replace('[اسم البراند]', brandName),
            closingMessage: template.closingTemplate,
        });
        setShowBuilder(true);
    };

    const openEditor = (p: BotPersona) => {
        const template = BOT_TEMPLATES.find(t => t.scenario === p.scenario) ?? BOT_TEMPLATES[0];
        setWizard({
            ...DEFAULT_WIZARD,
            editingId: p.id,
            template,
            name: p.name,
            emoji: p.avatarEmoji,
            personality: p.personality,
            language: p.language,
            persuasionLevel: p.persuasionLevel,
            greetingMessage: p.greetingMessage,
            closingMessage: p.closingMessage,
            triggerConfig: {
                ...DEFAULT_TRIGGER_CONFIG,
                trigger: p.trigger,
                triggerKeywords: p.triggerKeywords.join(', '),
            },
        });
        setShowBuilder(true);
    };

    // ── Send demo message ──────────────────────────────────────────────────────

    const sendDemoMessage = useCallback(async () => {
        if (!chatInput.trim() || botTyping || !demoPersona) return;
        const userMsg: BotMessage = {
            id: crypto.randomUUID(),
            role: 'customer',
            content: chatInput.trim(),
            timestamp: new Date().toISOString(),
        };
        const updatedMessages = [...chatMessages, userMsg];
        setChatMessages(updatedMessages);
        setChatInput('');
        setBotTyping(true);
        try {
            const reply = await getBotReply(
                demoSystemPrompt,
                updatedMessages.map(m => ({ role: m.role, content: m.content }))
            );
            setChatMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                role: 'bot',
                content: reply,
                timestamp: new Date().toISOString(),
            }]);
        } catch {
            addNotification(NotificationType.Error, 'فشل رد البوت — تحقق من إعدادات AI');
        } finally {
            setBotTyping(false);
        }
    }, [chatInput, botTyping, demoPersona, demoSystemPrompt, chatMessages, addNotification]);

    // ── Wizard save ───────────────────────────────────────────────────────────

    const handleSaveBot = async () => {
        if (!wizard.template) return;
        if (!wizard.name.trim()) {
            addNotification(NotificationType.Warning, 'اكتب اسم البوت أولاً');
            return;
        }
        setWizard(w => ({ ...w, saving: true }));
        try {
            const systemPrompt = buildBotSystemPrompt(
                {
                    name: wizard.name,
                    scenario: wizard.template.scenario,
                    personality: wizard.personality,
                    language: wizard.language,
                    persuasionLevel: wizard.persuasionLevel,
                },
                brand ?? null,
                brandProfile,
                wizard.extraKnowledge
            );
            const personaData = {
                name:            wizard.name,
                avatarEmoji:     wizard.emoji,
                scenario:        wizard.template.scenario,
                personality:     wizard.personality,
                language:        wizard.language,
                persuasionLevel: wizard.persuasionLevel,
                systemPrompt,
                greetingMessage: wizard.greetingMessage,
                closingMessage:  wizard.closingMessage,
                trigger:         wizard.triggerConfig.trigger,
                triggerKeywords: wizard.triggerConfig.triggerKeywords.split(',').map(k => k.trim()).filter(Boolean),
                status:          'active' as const,
            };

            if (wizard.editingId) {
                const updated = await updateBotPersona(brandId, wizard.editingId, personaData);
                setPersonas(prev => prev.map(x => x.id === wizard.editingId ? updated : x));
                addNotification(NotificationType.Success, `✅ تم تحديث بوت "${updated.name}"`);
            } else {
                const created = await createBotPersona(brandId, personaData);
                setPersonas(prev => [created, ...prev]);
                addNotification(NotificationType.Success, `✅ تم إنشاء بوت "${created.name}" وتفعيله`);
            }

            setShowBuilder(false);
            setWizard(DEFAULT_WIZARD);
            setTab('mybots');
        } catch (err: unknown) {
            addNotification(NotificationType.Error, (err as Error).message || 'فشل حفظ البوت');
        } finally {
            setWizard(w => ({ ...w, saving: false }));
        }
    };

    // ── Other handlers ────────────────────────────────────────────────────────

    const handleToggleStatus = async (p: BotPersona) => {
        const next = p.status === 'active' ? 'paused' : 'active';
        try {
            await updateBotPersonaStatus(brandId, p.id, next);
            setPersonas(prev => prev.map(x => x.id === p.id ? { ...x, status: next } : x));
        } catch (err: unknown) {
            addNotification(NotificationType.Error, (err as Error).message);
        }
    };

    const handleDuplicate = async (p: BotPersona) => {
        try {
            const created = await createBotPersona(brandId, {
                name:            `نسخة من ${p.name}`,
                avatarEmoji:     p.avatarEmoji,
                scenario:        p.scenario,
                personality:     p.personality,
                language:        p.language,
                persuasionLevel: p.persuasionLevel,
                systemPrompt:    p.systemPrompt,
                greetingMessage: p.greetingMessage,
                closingMessage:  p.closingMessage,
                trigger:         p.trigger,
                triggerKeywords: p.triggerKeywords,
                status:          'draft',
            });
            setPersonas(prev => [created, ...prev]);
            addNotification(NotificationType.Success, `✅ تم نسخ البوت — "${created.name}"`);
        } catch (err: unknown) {
            addNotification(NotificationType.Error, (err as Error).message);
        }
    };

    const handleDelete = async (p: BotPersona) => {
        try {
            await deleteBotPersona(brandId, p.id);
            setPersonas(prev => prev.filter(x => x.id !== p.id));
            addNotification(NotificationType.Success, `تم حذف بوت "${p.name}"`);
        } catch (err: unknown) {
            addNotification(NotificationType.Error, (err as Error).message);
        } finally {
            setDeleteConfirm(null);
        }
    };

    const handleGenerateFAQ = async () => {
        setGeneratingFAQ(true);
        try {
            const faq = await generateBrandFAQ(brand ?? null, brandProfile);
            setWizard(w => ({ ...w, extraKnowledge: faq }));
        } catch {
            addNotification(NotificationType.Error, 'فشل توليد المعلومات — تحقق من إعدادات AI');
        } finally {
            setGeneratingFAQ(false);
        }
    };

    const scenarioLabel: Record<BotScenario, string> = {
        'sales-closing':      'مبيعات',
        'lead-qualification': 'تأهيل',
        'faq':                'دعم',
        'product-advisor':    'منتجات',
        'retention':          'احتفاظ',
        'appointment':        'حجز',
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const totalConversations = personas.reduce((s, p) => s + p.conversationCount, 0);
    const activeBots = personas.filter(p => p.status === 'active').length;
    const avgConversion = personas.length
        ? Math.round(personas.reduce((s, p) => s + p.conversionRate, 0) / personas.length)
        : 0;

    return (
        <>
        <div className="space-y-6">

            {/* ── Brand Agent Banner ──────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/20">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                    <i className="fas fa-brain text-indigo-500 text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">البوت الذكي + وكيل البراند</p>
                    <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                        البوتات هنا تتولى الأسئلة الروتينية · وكيل البراند يتعامل مع الحالات التي تحتاج لهجة البراند ونبضه
                    </p>
                </div>
                <button
                    onClick={() => {}}
                    className="shrink-0 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
                >
                    إعدادات الوكيل ←
                </button>
            </div>

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                            <i className="fas fa-robot text-white" />
                            {activeBots > 0 && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white dark:border-dark-bg animate-pulse" />
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold text-light-text dark:text-dark-text">البوت الذكي للمبيعات</h1>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-600 dark:text-violet-300 border border-violet-300/30">
                                    AI-Powered
                                </span>
                            </div>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                حوّل رسائل السوشيال ميديا إلى صفقات مغلقة — تلقائياً 24/7
                            </p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => setTab('templates')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl font-bold text-sm hover:opacity-90 hover:-translate-y-0.5 transition-all shadow-lg shadow-violet-500/25"
                >
                    <i className="fas fa-plus" />
                    إنشاء بوت جديد
                </button>
            </div>

            {/* ── Stats ───────────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'بوتات نشطة',       value: activeBots,         suffix: '',  icon: 'fa-robot',      grad: 'from-violet-500 to-purple-600',  glow: 'shadow-violet-500/20' },
                    { label: 'إجمالي المحادثات', value: totalConversations, suffix: '',  icon: 'fa-comments',   grad: 'from-blue-500 to-indigo-600',    glow: 'shadow-blue-500/20' },
                    { label: 'متوسط التحويل',    value: avgConversion,      suffix: '%', icon: 'fa-chart-line', grad: 'from-emerald-500 to-teal-600',   glow: 'shadow-emerald-500/20' },
                ].map(stat => (
                    <div key={stat.label} className="relative bg-light-card dark:bg-dark-card rounded-2xl p-4 border border-light-border dark:border-dark-border overflow-hidden group hover:shadow-lg transition-all">
                        <div className={`absolute inset-0 bg-gradient-to-br ${stat.grad} opacity-0 group-hover:opacity-5 transition-opacity`} />
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.grad} flex items-center justify-center mb-3 shadow-md ${stat.glow}`}>
                            <i className={`fas ${stat.icon} text-white text-sm`} />
                        </div>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text">
                            {stat.value}{stat.suffix}
                        </p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Tabs ────────────────────────────────────────────────────── */}
            <div className="flex gap-1 border-b border-light-border dark:border-dark-border">
                {([
                    { id: 'templates',     label: 'القوالب',                         icon: 'fa-th-large' },
                    { id: 'mybots',        label: `بوتاتي (${personas.length})`,     icon: 'fa-robot' },
                    { id: 'analytics',     label: 'التحليلات',                       icon: 'fa-chart-pie' },
                    { id: 'conversations', label: 'المحادثات',                       icon: 'fa-comments' },
                ] as { id: TabId; label: string; icon: string }[]).map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
                            tab === t.id
                                ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                                : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                        }`}
                    >
                        <i className={`fas ${t.icon} text-xs`} />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Tab: Templates ──────────────────────────────────────────── */}
            {tab === 'templates' && (
                <div className="space-y-5">
                    <div>
                        <p className="text-sm font-bold text-light-text dark:text-dark-text">اختر سيناريو البوت</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                            كل سيناريو مبني على استراتيجيات مبيعات عالمية — جاهز للإطلاق في دقيقتين
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {BOT_TEMPLATES.map(template => (
                            <div
                                key={template.id}
                                className={`bg-light-card dark:bg-dark-card rounded-2xl border ${template.borderColor} dark:border-opacity-50 overflow-hidden hover:shadow-lg transition-all group`}
                            >
                                <div className={`bg-gradient-to-r ${template.gradient} p-4`}>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="text-3xl mb-1">{template.emoji}</div>
                                            <h3 className="text-white font-bold text-base">{template.nameAr}</h3>
                                            <p className="text-white/80 text-xs mt-0.5">{template.tagline}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-white/70 text-[10px]">شخصية البوت</div>
                                            <div className="text-white font-bold text-sm">{template.personaName}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 space-y-3">
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                                        {template.description}
                                    </p>

                                    <div className="flex gap-3">
                                        {template.metrics.map(m => (
                                            <div key={m.label} className="flex-1 bg-light-bg dark:bg-dark-bg rounded-xl p-2.5 text-center border border-light-border dark:border-dark-border">
                                                <div className="text-base font-bold text-light-text dark:text-dark-text">{m.value}</div>
                                                <div className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{m.label}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex flex-wrap gap-1.5">
                                        {template.tags.map(tag => (
                                            <span key={tag} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="bg-light-bg dark:bg-dark-bg rounded-xl p-3 border border-light-border dark:border-dark-border space-y-1.5">
                                        <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-2">معاينة محادثة:</p>
                                        {template.sampleConvo.slice(0, 2).map((msg, i) => (
                                            <div key={i} className={`flex ${msg.role === 'bot' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] px-3 py-1.5 rounded-xl text-[11px] leading-relaxed ${
                                                    msg.role === 'bot'
                                                        ? 'bg-violet-500 text-white rounded-br-sm'
                                                        : 'bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border text-light-text dark:text-dark-text rounded-bl-sm'
                                                }`}>
                                                    {msg.text}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex gap-2 pt-1">
                                        <button
                                            onClick={() => openTemplateDemo(template)}
                                            className="flex-1 py-2 rounded-xl border border-light-border dark:border-dark-border text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary hover:border-violet-500/50 hover:text-violet-600 dark:hover:text-violet-400 transition flex items-center justify-center gap-1.5"
                                        >
                                            <i className="fas fa-play text-[10px]" />
                                            جرّبه الآن
                                        </button>
                                        <button
                                            onClick={() => openBuilder(template)}
                                            className={`flex-1 py-2 rounded-xl bg-gradient-to-r ${template.gradient} text-white text-xs font-bold hover:opacity-90 transition flex items-center justify-center gap-1.5`}
                                        >
                                            <i className="fas fa-plus text-[10px]" />
                                            إنشاء البوت
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Tab: My Bots ────────────────────────────────────────────── */}
            {tab === 'mybots' && (
                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-16 text-light-text-secondary dark:text-dark-text-secondary">
                            <i className="fas fa-spinner fa-spin text-2xl mb-3" />
                            <p>جاري التحميل...</p>
                        </div>
                    ) : personas.length === 0 ? (
                        <div className="text-center py-16 bg-light-card dark:bg-dark-card rounded-2xl border-2 border-dashed border-light-border dark:border-dark-border">
                            <div className="text-5xl mb-4">🤖</div>
                            <p className="text-light-text dark:text-dark-text font-bold text-lg mb-1">لا توجد بوتات بعد</p>
                            <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm mb-4">
                                ابدأ بالضغط على "التامبلتس" واختر السيناريو المناسب لبراندك
                            </p>
                            <button
                                onClick={() => setTab('templates')}
                                className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-bold text-sm hover:opacity-90 transition"
                            >
                                استعرض التامبلتس
                            </button>
                        </div>
                    ) : (
                        personas.map(p => (
                            <div key={p.id} className="bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border p-5 hover:border-violet-500/30 transition-all">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20 flex items-center justify-center text-2xl flex-shrink-0">
                                        {p.avatarEmoji}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <h3 className="font-bold text-light-text dark:text-dark-text">{p.name}</h3>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary">
                                                {scenarioLabel[p.scenario] || p.scenario}
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                p.status === 'active'
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    : p.status === 'paused'
                                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                            }`}>
                                                {p.status === 'active' ? '● نشط' : p.status === 'paused' ? '⏸ موقف' : '◎ مسودة'}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap gap-4 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                            <span><i className="fas fa-comments me-1" />{p.conversationCount} محادثة</span>
                                            <span><i className="fas fa-chart-line me-1" />{p.conversionRate}% تحويل</span>
                                            <span><i className="fas fa-globe me-1" />{p.language === 'arabic' ? 'عربي' : p.language === 'english' ? 'إنجليزي' : 'ثنائي'}</span>
                                        </div>

                                        {p.greetingMessage && (
                                            <div className="mt-2 text-xs text-light-text-secondary dark:text-dark-text-secondary bg-light-bg dark:bg-dark-bg rounded-lg px-3 py-2 border border-light-border dark:border-dark-border max-w-md truncate">
                                                <i className="fas fa-quote-left text-[8px] me-1 opacity-50" />
                                                {p.greetingMessage}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <button
                                            onClick={() => handleToggleStatus(p)}
                                            className={`relative w-11 h-6 rounded-full transition-colors ${p.status === 'active' ? 'bg-green-500' : 'bg-light-border dark:bg-dark-border'}`}
                                            title={p.status === 'active' ? 'إيقاف مؤقت' : 'تفعيل'}
                                        >
                                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${p.status === 'active' ? 'left-5' : 'left-0.5'}`} />
                                        </button>
                                        <button
                                            onClick={() => setFlowBuilderPersona(p)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:text-indigo-500 hover:bg-indigo-500/10 transition"
                                            title="Flow Builder — بناء مسار المحادثة"
                                        >
                                            <i className="fas fa-diagram-project text-xs" />
                                        </button>
                                        <button
                                            onClick={() => openPersonaDemo(p)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:text-violet-500 hover:bg-violet-500/10 transition"
                                            title="تجربة البوت"
                                        >
                                            <i className="fas fa-play text-xs" />
                                        </button>
                                        <button
                                            onClick={() => openEditor(p)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                                            title="تعديل"
                                        >
                                            <i className="fas fa-edit text-xs" />
                                        </button>
                                        <button
                                            onClick={() => handleDuplicate(p)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition"
                                            title="نسخ البوت"
                                        >
                                            <i className="fas fa-copy text-xs" />
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirm(p.id)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                                            title="حذف"
                                        >
                                            <i className="fas fa-trash text-xs" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── Tab: Analytics ───────────────────────────────────────────── */}
            {tab === 'analytics' && (
                <div className="space-y-5">
                    {/* Loading */}
                    {analyticsLoading && (
                        <div className="text-center py-16">
                            <div className="inline-flex flex-col items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                                    <i className="fas fa-spinner fa-spin text-violet-500 text-xl" />
                                </div>
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">جاري تحليل بيانات آخر 30 يوم...</p>
                            </div>
                        </div>
                    )}

                    {!analyticsLoading && analytics && (
                        <>
                        {/* ── Last 30 days header ───────────────────────────── */}
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-px bg-light-border dark:bg-dark-border" />
                            <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary px-2 whitespace-nowrap">
                                <i className="fas fa-calendar-alt me-1" />آخر 30 يوم — بيانات حقيقية
                            </span>
                            <div className="flex-1 h-px bg-light-border dark:bg-dark-border" />
                        </div>

                        {/* ── Conversion Funnel (real) ──────────────────────── */}
                        <div className="bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border p-5">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-bold text-light-text dark:text-dark-text">مسار التحويل</p>
                                {analytics.funnel.botStarted === 0 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-bold">
                                        لا توجد بيانات بعد
                                    </span>
                                )}
                            </div>
                            {(() => {
                                const f = analytics.funnel;
                                const base = Math.max(f.totalMessages, f.botStarted, 1);
                                const rows = [
                                    { label: 'رسائل وصلت',          value: f.totalMessages,    pct: 100,                                                               color: 'from-violet-500 to-violet-600' },
                                    { label: 'محادثات بدأها البوت', value: f.botStarted,       pct: Math.round((f.botStarted / base) * 100),                          color: 'from-blue-500 to-blue-600' },
                                    { label: 'استجابة إيجابية',    value: f.positiveResponse,  pct: Math.round((f.positiveResponse / Math.max(base, 1)) * 100),       color: 'from-indigo-500 to-indigo-600' },
                                    { label: 'تحويل مكتمل',        value: f.converted,         pct: Math.round((f.converted / Math.max(f.botStarted, 1)) * 100),      color: 'from-emerald-500 to-emerald-600' },
                                ];
                                return rows.map((row, i) => (
                                    <div key={i} className="flex items-center gap-3 mb-3 last:mb-0">
                                        <div className="w-32 text-xs text-light-text-secondary dark:text-dark-text-secondary text-end shrink-0">{row.label}</div>
                                        <div className="flex-1 h-7 bg-light-bg dark:bg-dark-bg rounded-lg overflow-hidden">
                                            <div
                                                className={`h-full bg-gradient-to-r ${row.color} rounded-lg flex items-center justify-end px-2 transition-all duration-700 min-w-[32px]`}
                                                style={{ width: `${Math.max(row.pct, 4)}%` }}
                                            >
                                                <span className="text-[10px] font-bold text-white">{row.value.toLocaleString('ar-SA')}</span>
                                            </div>
                                        </div>
                                        <div className="w-10 text-xs font-bold text-light-text dark:text-dark-text text-end">{row.pct}%</div>
                                    </div>
                                ));
                            })()}
                        </div>

                        {/* ── Quick KPIs ────────────────────────────────────── */}
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                {
                                    icon: 'fa-clock',
                                    label: 'متوسط وقت الرد',
                                    value: analytics.avgReplyTimeSec !== null
                                        ? analytics.avgReplyTimeSec < 60
                                            ? `${analytics.avgReplyTimeSec}ث`
                                            : `${Math.round(analytics.avgReplyTimeSec / 60)}د`
                                        : '< 3ث',
                                    sub: 'شبه فوري',
                                    color: 'text-blue-500', bg: 'bg-blue-500/10',
                                },
                                {
                                    icon: 'fa-fire',
                                    label: 'أكثر وقت نشاط',
                                    value: analytics.bestHour !== null
                                        ? `${analytics.bestHour > 12 ? analytics.bestHour - 12 : analytics.bestHour}:00 ${analytics.bestHour >= 12 ? 'م' : 'ص'}`
                                        : '—',
                                    sub: analytics.bestHour !== null ? 'أعلى تحويل' : 'لا بيانات',
                                    color: 'text-orange-500', bg: 'bg-orange-500/10',
                                },
                                {
                                    icon: 'fa-star',
                                    label: 'رضا العملاء',
                                    value: analytics.satisfactionScore !== null
                                        ? `${analytics.satisfactionScore}/5`
                                        : '—',
                                    sub: 'بناءً على التحويلات',
                                    color: 'text-amber-500', bg: 'bg-amber-500/10',
                                },
                            ].map(s => (
                                <div key={s.label} className="bg-light-card dark:bg-dark-card rounded-xl p-4 border border-light-border dark:border-dark-border text-center">
                                    <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center mx-auto mb-2`}>
                                        <i className={`fas ${s.icon} ${s.color} text-sm`} />
                                    </div>
                                    <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                    <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{s.label}</p>
                                    <p className="text-[9px] text-light-text-secondary/60 dark:text-dark-text-secondary/60">{s.sub}</p>
                                </div>
                            ))}
                        </div>

                        {/* ── Per-bot real performance ──────────────────────── */}
                        <div className="bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border p-5">
                            <p className="text-sm font-bold text-light-text dark:text-dark-text mb-4">أداء كل بوت — آخر 30 يوم</p>
                            {analytics.perBot.length === 0 ? (
                                <div className="text-center py-10">
                                    <div className="text-4xl mb-3">📊</div>
                                    <p className="text-sm font-bold text-light-text dark:text-dark-text mb-1">لا توجد محادثات بعد</p>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                        جرّب أي بوت في التجربة المباشرة لتبدأ البيانات تظهر هنا
                                    </p>
                                    <button onClick={() => setTab('mybots')} className="mt-3 text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline">
                                        اذهب إلى بوتاتي ←
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {analytics.perBot.map(bot => (
                                        <div key={bot.personaId} className="p-3 rounded-xl bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border">
                                            <div className="flex items-start gap-3">
                                                <span className="text-2xl shrink-0">{bot.avatarEmoji}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <p className="text-xs font-bold text-light-text dark:text-dark-text">{bot.personaName}</p>
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                                            bot.conversionRate >= 25 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                            : bot.conversionRate >= 10 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                                        }`}>
                                                            {bot.conversionRate}% تحويل
                                                        </span>
                                                    </div>
                                                    {/* Progress bar */}
                                                    <div className="h-1.5 bg-light-border dark:bg-dark-border rounded-full overflow-hidden mb-2">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-700 ${
                                                                bot.conversionRate >= 25 ? 'bg-emerald-500'
                                                                : bot.conversionRate >= 10 ? 'bg-amber-500'
                                                                : 'bg-red-400'
                                                            }`}
                                                            style={{ width: `${Math.min(bot.conversionRate * 2, 100)}%` }}
                                                        />
                                                    </div>
                                                    {/* Stats row */}
                                                    <div className="flex items-center gap-3 text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                                                        <span className="flex items-center gap-1">
                                                            <i className="fas fa-comments" />
                                                            {bot.conversationCount} محادثة
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <i className="fas fa-check-circle text-emerald-500" />
                                                            {bot.converted} تحويل
                                                        </span>
                                                        {bot.escalated > 0 && (
                                                            <span className="flex items-center gap-1">
                                                                <i className="fas fa-arrow-up text-orange-400" />
                                                                {bot.escalated} تصعيد
                                                            </span>
                                                        )}
                                                        <span className="flex items-center gap-1">
                                                            <i className="fas fa-envelope" />
                                                            {bot.avgMessages} رسالة/محادثة
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        </>
                    )}

                    {/* Empty state — no analytics loaded yet */}
                    {!analyticsLoading && !analytics && (
                        <div className="text-center py-16 bg-light-card dark:bg-dark-card rounded-2xl border border-dashed border-light-border dark:border-dark-border">
                            <div className="text-5xl mb-4">📊</div>
                            <p className="text-light-text dark:text-dark-text font-bold text-lg mb-1">لم يتم تحميل التحليلات</p>
                            <button onClick={() => { setAnalyticsLoading(true); getBotAnalytics(brandId).then(r => { setAnalytics(r); setAnalyticsLoading(false); }); }}
                                className="mt-3 px-4 py-2 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-xl text-sm font-bold hover:bg-violet-500/20 transition">
                                إعادة التحميل
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab: Conversations ───────────────────────────────────────── */}
            {tab === 'conversations' && (
                <div className="space-y-3">
                    {convoLoading ? (
                        <div className="text-center py-12 text-light-text-secondary dark:text-dark-text-secondary">
                            <i className="fas fa-spinner fa-spin text-2xl mb-2" />
                            <p>جاري التحميل...</p>
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="text-center py-16 bg-light-card dark:bg-dark-card rounded-2xl border border-dashed border-light-border dark:border-dark-border">
                            <div className="text-5xl mb-4">💬</div>
                            <p className="text-light-text dark:text-dark-text font-bold text-lg mb-1">لا توجد محادثات بعد</p>
                            <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm max-w-sm mx-auto">
                                جرّب أحد بوتاتك في التجربة المباشرة وستُحفظ المحادثة هنا تلقائياً.
                            </p>
                            <button onClick={() => setTab('mybots')} className="mt-4 px-5 py-2 border border-light-border dark:border-dark-border rounded-xl text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary hover:border-violet-500/50 transition">
                                استعرض البوتات
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-2xl border border-light-border dark:border-dark-border">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-light-card dark:bg-dark-card border-b border-light-border dark:border-dark-border">
                                        <th className="text-start px-4 py-3 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">العميل</th>
                                        <th className="text-start px-4 py-3 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">البوت</th>
                                        <th className="text-start px-4 py-3 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">رسائل</th>
                                        <th className="text-start px-4 py-3 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">الحالة</th>
                                        <th className="text-start px-4 py-3 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">التاريخ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-light-border dark:divide-dark-border">
                                    {conversations.map(c => {
                                        const persona = personas.find(p => p.id === c.personaId);
                                        return (
                                            <tr key={c.id} className="bg-white dark:bg-dark-bg hover:bg-light-card dark:hover:bg-dark-card transition">
                                                <td className="px-4 py-3">
                                                    <p className="font-bold text-light-text dark:text-dark-text text-sm">{c.customerName}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-base">{persona?.avatarEmoji || '🤖'}</span>
                                                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{persona?.name || '—'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-xs font-bold text-light-text dark:text-dark-text">{c.messages.length}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                        c.status === 'converted' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                        c.status === 'escalated' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                                        c.status === 'closed'    ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
                                                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                    }`}>
                                                        {c.status === 'converted' ? '✅ تحويل' : c.status === 'escalated' ? '⚠️ تصعيد' : c.status === 'closed' ? '◎ مغلقة' : '● نشطة'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                        {new Date(c.createdAt).toLocaleDateString('ar-SA')}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Bot Builder Wizard Modal ─────────────────────────────────── */}
            {showBuilder && wizard.template && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowBuilder(false)}>
                    <div className="bg-light-card dark:bg-dark-card rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

                        <div className={`bg-gradient-to-r ${wizard.template.gradient} p-5 rounded-t-2xl flex items-center justify-between`}>
                            <div>
                                <div className="text-2xl mb-0.5">{wizard.emoji}</div>
                                <h2 className="text-white font-bold">
                                    {wizard.editingId ? 'تعديل بوت:' : 'إعداد بوت:'} {wizard.template.nameAr}
                                </h2>
                                <p className="text-white/70 text-xs">الخطوة {wizard.step} من 4</p>
                            </div>
                            <button onClick={() => setShowBuilder(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/20 text-white hover:bg-white/30 transition">
                                <i className="fas fa-times" />
                            </button>
                        </div>

                        <div className="h-1 bg-light-border dark:bg-dark-border">
                            <div
                                className={`h-full bg-gradient-to-r ${wizard.template.gradient} transition-all duration-300`}
                                style={{ width: `${(wizard.step / 4) * 100}%` }}
                            />
                        </div>

                        <div className="p-5 overflow-y-auto flex-1 space-y-4">

                            {/* Step 1: Persona */}
                            {wizard.step === 1 && (
                                <>
                                    <p className="text-sm font-bold text-light-text dark:text-dark-text">الخطوة 1: شخصية البوت</p>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">اسم البوت</label>
                                            <input
                                                value={wizard.name}
                                                onChange={e => setWizard(w => ({ ...w, name: e.target.value }))}
                                                placeholder="مثال: ليلى"
                                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm text-light-text dark:text-dark-text focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">الإيموجي</label>
                                            <input
                                                value={wizard.emoji}
                                                onChange={e => setWizard(w => ({ ...w, emoji: e.target.value }))}
                                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-xl text-center focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 outline-none"
                                                maxLength={2}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">الشخصية</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {([
                                                { v: 'professional', l: '🎩 محترف' },
                                                { v: 'friendly', l: '😊 ودود' },
                                                { v: 'urgent', l: '⚡ عاجل' },
                                                { v: 'luxury', l: '✨ فاخر' },
                                                { v: 'enthusiastic', l: '🔥 متحمس' },
                                            ] as const).map(opt => (
                                                <button
                                                    key={opt.v}
                                                    onClick={() => setWizard(w => ({ ...w, personality: opt.v }))}
                                                    className={`py-2 rounded-xl border text-xs font-bold transition ${
                                                        wizard.personality === opt.v
                                                            ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                                                            : 'border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-violet-500/40'
                                                    }`}
                                                >
                                                    {opt.l}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">لغة البوت</label>
                                        <div className="flex gap-2">
                                            {([
                                                { v: 'arabic', l: '🇸🇦 عربي' },
                                                { v: 'english', l: '🇬🇧 English' },
                                                { v: 'bilingual', l: '🌐 ثنائي' },
                                            ] as const).map(opt => (
                                                <button
                                                    key={opt.v}
                                                    onClick={() => setWizard(w => ({ ...w, language: opt.v }))}
                                                    className={`flex-1 py-2 rounded-xl border text-xs font-bold transition ${
                                                        wizard.language === opt.v
                                                            ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                                                            : 'border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-violet-500/40'
                                                    }`}
                                                >
                                                    {opt.l}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                                            قوة الإقناع: {['', 'خفيف', 'متوسط', 'قوي'][wizard.persuasionLevel]}
                                        </label>
                                        <div className="flex gap-2">
                                            {([1, 2, 3] as const).map(n => (
                                                <button
                                                    key={n}
                                                    onClick={() => setWizard(w => ({ ...w, persuasionLevel: n }))}
                                                    className={`flex-1 py-2 rounded-xl border text-xs font-bold transition ${
                                                        wizard.persuasionLevel === n
                                                            ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                                                            : 'border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary'
                                                    }`}
                                                >
                                                    {['', 'خفيف 🌱', 'متوسط ⚡', 'قوي 🔥'][n]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Step 2: Brand Knowledge */}
                            {wizard.step === 2 && (
                                <>
                                    <p className="text-sm font-bold text-light-text dark:text-dark-text">الخطوة 2: معرفة البراند</p>

                                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-3 space-y-1">
                                        <p className="text-xs font-bold text-green-700 dark:text-green-400">
                                            <i className="fas fa-check-circle me-1.5" />
                                            تم تحميل معرفة البراند تلقائياً
                                        </p>
                                        {[
                                            brandName && `✓ اسم البراند: ${brandName}`,
                                            brandProfile?.industry && `✓ المجال: ${brandProfile.industry}`,
                                            brandProfile?.brandVoice?.toneDescription?.length && `✓ صوت البراند (${brandProfile.brandVoice.toneDescription.slice(0, 2).join('، ')})`,
                                            brandProfile?.keySellingPoints?.length && `✓ ${brandProfile.keySellingPoints.length} نقطة بيع مميزة`,
                                        ].filter(Boolean).map((item, i) => (
                                            <p key={i} className="text-[11px] text-green-600 dark:text-green-500">{item}</p>
                                        ))}
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">
                                                معلومات إضافية (منتجات، أسعار، عروض، FAQ)
                                            </label>
                                            <button
                                                onClick={handleGenerateFAQ}
                                                disabled={generatingFAQ}
                                                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[11px] font-bold hover:bg-violet-500/20 transition disabled:opacity-50"
                                            >
                                                {generatingFAQ ? (
                                                    <><i className="fas fa-spinner fa-spin text-[10px]" />جاري التوليد...</>
                                                ) : (
                                                    <><i className="fas fa-magic text-[10px]" />توليد من البراند</>
                                                )}
                                            </button>
                                        </div>
                                        <textarea
                                            value={wizard.extraKnowledge}
                                            onChange={e => setWizard(w => ({ ...w, extraKnowledge: e.target.value }))}
                                            rows={6}
                                            placeholder={`مثال:\n- باقة Basic: 99 ريال/شهر — تشمل 5 مستخدمين\n- باقة Pro: 299 ريال/شهر — تشمل 20 مستخدم + تقارير متقدمة\n- خصم 20% عند الدفع السنوي\n- يوجد تجربة مجانية 14 يوم`}
                                            className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-3 text-sm text-light-text dark:text-dark-text resize-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 outline-none leading-relaxed"
                                        />
                                        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                            كلما كانت المعلومات أكثر دقة، كان البوت أقوى في الإقناع
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* Step 3: Messages */}
                            {wizard.step === 3 && (
                                <>
                                    <p className="text-sm font-bold text-light-text dark:text-dark-text">الخطوة 3: رسائل البوت</p>

                                    <div>
                                        <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">رسالة الترحيب (أول رد)</label>
                                        <textarea
                                            value={wizard.greetingMessage}
                                            onChange={e => setWizard(w => ({ ...w, greetingMessage: e.target.value }))}
                                            rows={3}
                                            className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-3 text-sm text-light-text dark:text-dark-text resize-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">رسالة الإغلاق (نهاية المحادثة)</label>
                                        <textarea
                                            value={wizard.closingMessage}
                                            onChange={e => setWizard(w => ({ ...w, closingMessage: e.target.value }))}
                                            rows={2}
                                            className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-3 text-sm text-light-text dark:text-dark-text resize-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 outline-none"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Step 4: Trigger — BotTriggerEditor */}
                            {wizard.step === 4 && (
                                <>
                                    <BotTriggerEditor
                                        value={wizard.triggerConfig}
                                        onChange={cfg => setWizard(w => ({ ...w, triggerConfig: cfg }))}
                                        gradient={wizard.template?.gradient}
                                    />
                                    {/* Summary */}
                                    <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700/50 rounded-xl p-4 space-y-1.5">
                                        <p className="text-xs font-bold text-violet-700 dark:text-violet-400 mb-2">📋 ملخص البوت</p>
                                        <p className="text-xs text-light-text dark:text-dark-text"><span className="text-light-text-secondary dark:text-dark-text-secondary">الاسم:</span> {wizard.emoji} {wizard.name}</p>
                                        <p className="text-xs text-light-text dark:text-dark-text"><span className="text-light-text-secondary dark:text-dark-text-secondary">السيناريو:</span> {wizard.template?.nameAr}</p>
                                        <p className="text-xs text-light-text dark:text-dark-text"><span className="text-light-text-secondary dark:text-dark-text-secondary">الشخصية:</span> {wizard.personality} · {wizard.language === 'arabic' ? 'عربي' : wizard.language === 'english' ? 'إنجليزي' : 'ثنائي'}</p>
                                        <p className="text-xs text-light-text dark:text-dark-text"><span className="text-light-text-secondary dark:text-dark-text-secondary">التشغيل:</span> {wizard.triggerConfig.trigger === 'dm-received' ? 'رسائل مباشرة' : wizard.triggerConfig.trigger === 'keyword-match' ? 'كلمة مفتاحية' : wizard.triggerConfig.trigger === 'comment-reply' ? 'تعليقات' : 'يدوي'}</p>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-3 p-5 border-t border-light-border dark:border-dark-border">
                            {wizard.step > 1 ? (
                                <button
                                    onClick={() => setWizard(w => ({ ...w, step: (w.step - 1) as 1 | 2 | 3 | 4 }))}
                                    className="px-4 py-2 text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text transition"
                                >
                                    <i className="fas fa-arrow-right me-1.5" />
                                    السابق
                                </button>
                            ) : (
                                <div />
                            )}

                            {wizard.step < 4 ? (
                                <button
                                    onClick={() => setWizard(w => ({ ...w, step: (w.step + 1) as 1 | 2 | 3 | 4 }))}
                                    className={`flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r ${wizard.template.gradient} text-white font-bold text-sm hover:opacity-90 transition`}
                                >
                                    التالي
                                    <i className="fas fa-arrow-left" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleSaveBot}
                                    disabled={wizard.saving}
                                    className={`flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r ${wizard.template.gradient} text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition`}
                                >
                                    {wizard.saving ? (
                                        <><i className="fas fa-spinner fa-spin" />جاري الحفظ...</>
                                    ) : wizard.editingId ? (
                                        <><i className="fas fa-save" />حفظ التعديلات</>
                                    ) : (
                                        <><i className="fas fa-rocket" />إطلاق البوت 🚀</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Demo Chat Modal ──────────────────────────────────────────── */}
            {showDemo && demoPersona && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={closeDemo}>
                    <div
                        className="bg-light-bg dark:bg-dark-bg w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                        style={{ height: '85vh', maxHeight: '700px' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-3 flex items-center gap-3">
                            <div className="text-2xl">{demoPersona.avatarEmoji}</div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-bold text-sm">{demoPersona.name}</p>
                                <p className="text-white/70 text-[10px]">
                                    {demoTemplate ? `تجربة سيناريو: ${demoTemplate.nameAr}` : 'تجربة مباشرة'} • Gemini AI
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-white/70 text-[10px]">نشط</span>
                            </div>
                            <button
                                onClick={() => {
                                    const greeting: BotMessage = {
                                        id: crypto.randomUUID(),
                                        role: 'bot',
                                        content: demoPersona.greetingMessage || `أهلاً! أنا ${demoPersona.name}، كيف أقدر أساعدك؟`,
                                        timestamp: new Date().toISOString(),
                                    };
                                    setChatMessages([greeting]);
                                    setChatInput('');
                                }}
                                className="w-7 h-7 flex items-center justify-center rounded-xl bg-white/20 text-white hover:bg-white/30 transition"
                                title="مسح المحادثة"
                            >
                                <i className="fas fa-eraser text-xs" />
                            </button>
                            <button onClick={closeDemo} className="w-7 h-7 flex items-center justify-center rounded-xl bg-white/20 text-white hover:bg-white/30 transition">
                                <i className="fas fa-times text-xs" />
                            </button>
                        </div>

                        <div className="bg-violet-50 dark:bg-violet-900/20 border-b border-violet-200/50 dark:border-violet-700/50 px-4 py-2">
                            <p className="text-[10px] text-violet-700 dark:text-violet-400 text-center">
                                <i className="fas fa-robot me-1" />
                                هذه تجربة مباشرة للبوت — يرد بالفعل باستخدام Gemini AI وبيانات براندك
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {chatMessages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.role === 'bot' ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                        msg.role === 'bot'
                                            ? 'bg-white dark:bg-dark-card border border-light-border dark:border-dark-border text-light-text dark:text-dark-text rounded-bl-sm shadow-sm'
                                            : 'bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-br-sm shadow-sm shadow-violet-500/20'
                                    }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}

                            {botTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                                        <div className="flex gap-1 items-center">
                                            <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* CTA after 3 customer messages */}
                        {chatMessages.filter(m => m.role === 'customer').length >= 3 && demoTemplate && (
                            <div className="px-4 py-3 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-t border-violet-200/50 dark:border-violet-700/50">
                                <p className="text-[11px] text-violet-700 dark:text-violet-400 text-center mb-2 font-bold">
                                    🚀 أعجبك هذا البوت؟ أنشئه الآن لبراندك
                                </p>
                                <button
                                    onClick={() => { closeDemo(); openBuilder(demoTemplate); }}
                                    className="w-full py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-bold hover:opacity-90 transition"
                                >
                                    <i className="fas fa-plus me-1.5" />
                                    إنشاء هذا البوت لبراندك
                                </button>
                            </div>
                        )}

                        <div className="p-3 border-t border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card">
                            <div className="flex gap-2 items-end">
                                <textarea
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDemoMessage(); } }}
                                    placeholder="اكتب رسالتك كأنك العميل..."
                                    rows={1}
                                    className="flex-1 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-3 py-2.5 text-sm text-light-text dark:text-dark-text resize-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 outline-none max-h-20 overflow-y-auto"
                                    style={{ minHeight: '40px' }}
                                />
                                <button
                                    onClick={sendDemoMessage}
                                    disabled={!chatInput.trim() || botTyping}
                                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition flex-shrink-0"
                                >
                                    <i className="fas fa-paper-plane text-xs" />
                                </button>
                            </div>
                            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1.5 text-center">
                                Enter للإرسال • Shift+Enter لسطر جديد
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Confirm ───────────────────────────────────────────── */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-light-card dark:bg-dark-card rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
                        <div className="text-4xl mb-3">🗑️</div>
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">حذف البوت</h3>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-5">
                            هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-sm font-bold text-light-text dark:text-dark-text hover:bg-light-bg dark:hover:bg-dark-bg transition">
                                إلغاء
                            </button>
                            <button
                                onClick={() => {
                                    const p = personas.find(x => x.id === deleteConfirm);
                                    if (p) handleDelete(p);
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition"
                            >
                                حذف
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* ── Flow Builder — fullscreen overlay ────────────────────────────── */}
        {flowBuilderPersona && (
            <BotFlowBuilder
                personaId={flowBuilderPersona.id}
                personaName={flowBuilderPersona.name}
                personaEmoji={flowBuilderPersona.avatarEmoji}
                onClose={() => setFlowBuilderPersona(null)}
            />
        )}
        </>
    );
};
