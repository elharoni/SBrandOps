import React, { useState, useEffect, useMemo, useRef } from 'react';
import { InboxConversation, NotificationType, PLATFORM_ASSETS, BrandHubProfile, ConversationIntent, ConversationSentiment, SocialPlatform, SkillType } from '../../types';
import { persistConversationAnalysis, replyToConversation } from '../../services/inboxService';
import { analyzeConversation } from '../../services/geminiService';
import { useLanguage } from '../../context/LanguageContext';
import { useBrandStore } from '../../stores/brandStore';
import { PageScaffold, PageSection } from '../shared/PageScaffold';
import { EvaluationButtons } from '../shared/EvaluationButtons';

interface InboxPageProps {
    addNotification: (type: NotificationType, message: string) => void;
    brandId: string;
    brandProfile: BrandHubProfile;
    conversations: InboxConversation[];
    onAddTask: (title: string, description: string) => void;
}

const INTENT_CONFIG: Record<ConversationIntent, { color: string, icon: string }> = {
    [ConversationIntent.PurchaseInquiry]: { color: 'text-green-400', icon: 'fa-shopping-cart' },
    [ConversationIntent.GeneralQuestion]: { color: 'text-blue-400', icon: 'fa-question-circle' },
    [ConversationIntent.Complaint]: { color: 'text-red-400', icon: 'fa-exclamation-triangle' },
    [ConversationIntent.Feedback]: { color: 'text-yellow-400', icon: 'fa-star' },
    [ConversationIntent.Spam]: { color: 'text-gray-500', icon: 'fa-ban' },
    [ConversationIntent.Unknown]: { color: 'text-gray-400', icon: 'fa-question' },
};

// Arabic labels for intent — بدلاً من عرض الـ enum value الإنجليزي للمستخدم
const INTENT_ARABIC: Record<ConversationIntent, string> = {
    [ConversationIntent.PurchaseInquiry]: '🛒 استفسار عن شراء',
    [ConversationIntent.GeneralQuestion]:  '❓ سؤال عام',
    [ConversationIntent.Complaint]:        '⚠️ شكوى تحتاج متابعة',
    [ConversationIntent.Feedback]:         '⭐ ملاحظة أو رأي',
    [ConversationIntent.Spam]:             '🚫 رسالة مزعجة',
    [ConversationIntent.Unknown]:          '💬 محادثة عامة',
};

const SENTIMENT_CONFIG: Record<ConversationSentiment, { label: string; color: string; icon: string }> = {
    positive: { label: 'إيجابي', color: 'text-green-500', icon: 'fa-face-smile' },
    neutral: { label: 'محايد', color: 'text-slate-500', icon: 'fa-face-meh' },
    negative: { label: 'سلبي', color: 'text-red-500', icon: 'fa-face-frown' },
};

const FilterSidebar: React.FC<{
    conversations: InboxConversation[];
    activeFilter: 'all' | SocialPlatform;
    onFilterChange: (filter: 'all' | SocialPlatform) => void;
}> = ({ conversations, activeFilter, onFilterChange }) => {
    const { t } = useLanguage();

    const filterTabs = useMemo(() => [
        { id: 'all', label: t.inbox.all, icon: 'fa-inbox' },
        ...Object.values(SocialPlatform).map(p => ({
            id: p,
            label: p,
            icon: PLATFORM_ASSETS[p].icon,
        }))
    ], [t]);

    const getCount = (filter: 'all' | SocialPlatform) => {
        if (filter === 'all') return conversations.length;
        return conversations.filter(c => c.platform === filter).length;
    };

    return (
        <div className="w-60 bg-light-card dark:bg-dark-card border-s border-light-border dark:border-dark-border flex-shrink-0 flex flex-col">
            <div className="p-4 border-b border-light-border dark:border-dark-border">
                <h1 className="text-xl font-bold text-light-text dark:text-dark-text">{t.inbox.title}</h1>
            </div>
            <div className="flex-1 p-2 space-y-1 overflow-y-auto">
                {filterTabs.map(tab => {
                    const count = getCount(tab.id as 'all' | SocialPlatform);
                    if (count === 0 && tab.id !== 'all') return null; // Hide empty platforms

                    const isActive = activeFilter === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onFilterChange(tab.id as 'all' | SocialPlatform)}
                            className={`w-full flex justify-between items-center p-2 rounded-md text-right transition-colors ${isActive ? 'bg-brand-pink/10 text-brand-pink font-bold' : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg hover:text-light-text dark:hover:text-dark-text'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <i className={`fas ${tab.icon} w-5 text-center`}></i>
                                <span>{tab.label}</span>
                            </div>
                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded-full ${isActive ? 'bg-brand-pink text-white' : 'bg-light-bg dark:bg-dark-bg'}`}>{count}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};


const ConversationListItem: React.FC<{
    conv: InboxConversation;
    isActive: boolean;
    onClick: () => void;
    onMarkRead: (id: string) => void;
}> = ({ conv, isActive, onClick, onMarkRead }) => {
    const { language } = useLanguage();
    const asset = PLATFORM_ASSETS[conv.platform];
    const lastMessage = conv.messages.at(-1);
    const isUnread = !conv.isRead;

    return (
        <button
            onClick={() => { onClick(); onMarkRead(conv.id); }}
            className={`w-full text-right p-3 border-b border-light-border dark:border-dark-border flex items-start gap-3 transition-colors
                ${isActive
                    ? 'bg-brand-primary/10 border-s-2 border-s-brand-primary'
                    : isUnread
                        ? 'bg-brand-pink/5 hover:bg-brand-pink/10'
                        : 'hover:bg-light-bg dark:hover:bg-dark-bg'
                }`}
        >
            {/* Avatar with platform badge */}
            <div className="relative flex-shrink-0">
                <img src={conv.user.avatarUrl} alt={conv.user.name} className="w-10 h-10 rounded-full" />
                <span className={`absolute -bottom-0.5 -end-0.5 w-4 h-4 rounded-full flex items-center justify-center bg-white dark:bg-dark-card shadow`}>
                    <i className={`${asset.icon} text-[9px]`} style={{ color: asset.hexColor }}></i>
                </span>
            </div>

            <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-center gap-1">
                    <span className={`text-sm truncate ${isUnread ? 'font-bold text-light-text dark:text-dark-text' : 'font-medium text-light-text dark:text-dark-text'}`}>
                        {conv.user.name}
                    </span>
                    <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0">
                        {new Date(conv.lastMessageTimestamp).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
                <p className={`text-xs truncate mt-0.5 ${isUnread ? 'text-light-text dark:text-dark-text font-medium' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                    {lastMessage?.text ?? ''}
                </p>
            </div>

            {/* Unread badge */}
            {isUnread && (
                <span className="w-2.5 h-2.5 bg-brand-pink rounded-full self-center flex-shrink-0 shadow-sm shadow-brand-pink/50 animate-pulse"></span>
            )}
        </button>
    );
};

// Quick templates shown in chat window — أسماء أكثر وصفاً تساعد في الاختيار السريع
const QUICK_TEMPLATES = [
    { label: '👋 ترحيب بعميل جديد',     body: 'أهلاً وسهلاً! نشكرك على تواصلك معنا. كيف يمكننا مساعدتك؟' },
    { label: '🙏 اعتذار عن التأخير',    body: 'نعتذر منك بشدة على هذا الإزعاج. موضوعك أولوية لدينا وسنتابعه فوراً.' },
    { label: '✅ تأكيد استلام الطلب',   body: 'تم استلام طلبك بنجاح! ستصلك رسالة تأكيد على بريدك الإلكتروني خلال لحظات.' },
    { label: '⭐ طلب تقييم التجربة',    body: 'نأمل أن تكون تجربتك معنا ممتازة! هل يمكنك تقييم خدمتنا؟ رأيك يهمنا كثيراً 🙏' },
];

const ChatWindow: React.FC<{
    conversation: InboxConversation;
    onReply: (text: string) => void;
    replyText: string;
    onReplyTextChange: (text: string) => void;
}> = ({ conversation, onReply, replyText, onReplyTextChange }) => {
    const { t, language } = useLanguage();
    const [showTemplates, setShowTemplates] = useState(false);
    const asset = PLATFORM_ASSETS[conversation.platform];
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversation.messages]);

    const handleSend = () => {
        if (!replyText.trim()) return;
        onReply(replyText);
        onReplyTextChange('');
        setShowTemplates(false);
    };

    const handleApplyTemplate = (body: string) => {
        onReplyTextChange(body);
        setShowTemplates(false);
    };

    return (
        <div className="flex flex-col h-full bg-light-card dark:bg-dark-card">
            {/* Header */}
            <div className="p-4 border-b border-light-border dark:border-dark-border flex items-center gap-3">
                <div className="relative">
                    <img src={conversation.user.avatarUrl} alt={conversation.user.name} className="w-10 h-10 rounded-full" />
                    <span className="absolute -bottom-0.5 -end-0.5 w-4 h-4 rounded-full bg-white dark:bg-dark-card shadow flex items-center justify-center">
                        <i className={`${asset.icon} text-[9px]`} style={{ color: asset.hexColor }}></i>
                    </span>
                </div>
                <div className="flex-1">
                    <p className="font-bold text-light-text dark:text-dark-text">{conversation.user.name}</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        @{conversation.user.handle} · {conversation.platform}
                        {!conversation.isRead && (
                            <span className="ms-2 bg-brand-pink/10 text-brand-pink text-[10px] px-1.5 py-0.5 rounded-full font-bold">غير مقروء</span>
                        )}
                    </p>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1">
                    <button className="w-8 h-8 rounded-lg flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg hover:text-brand-primary transition-colors" title="فتح الملف الشخصي">
                        <i className="fas fa-user text-xs"></i>
                    </button>
                    <button className="w-8 h-8 rounded-lg flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg hover:text-brand-primary transition-colors" title="أرشفة">
                        <i className="fas fa-archive text-xs"></i>
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-light-bg/40 dark:bg-dark-bg/40">
                {conversation.messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md p-3 rounded-2xl shadow-sm ${
                            msg.sender === 'agent'
                                ? 'bg-brand-primary text-white rounded-br-sm'
                                : 'bg-light-card dark:bg-dark-card text-light-text dark:text-dark-text rounded-bl-sm border border-light-border dark:border-dark-border'
                        }`}>
                            <p className="text-sm leading-relaxed">{msg.text}</p>
                            <p className={`text-[10px] mt-1.5 opacity-60`}>
                                {new Date(msg.timestamp).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Quick Templates Picker */}
            {showTemplates && (
                <div className="border-t border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">ردود سريعة</span>
                        <button onClick={() => setShowTemplates(false)} className="text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {QUICK_TEMPLATES.map((tmpl, i) => (
                            <button key={i} onClick={() => handleApplyTemplate(tmpl.body)}
                                className="text-xs px-3 py-1.5 rounded-xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border hover:border-brand-primary hover:text-brand-primary text-light-text dark:text-dark-text transition-colors font-medium">
                                ⚡ {tmpl.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Reply Box */}
            <div className="p-4 border-t border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg">
                <div className="flex items-end gap-2">
                    {/* Quick templates trigger */}
                    <button
                        onClick={() => setShowTemplates(v => !v)}
                        title="ردود سريعة"
                        className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border transition-colors
                            ${showTemplates
                                ? 'bg-brand-primary border-brand-primary text-white'
                                : 'bg-light-card dark:bg-dark-card border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-brand-primary hover:text-brand-primary'
                            }`}
                    >
                        <i className="fas fa-bolt text-xs"></i>
                    </button>

                    <textarea
                        value={replyText}
                        onChange={e => onReplyTextChange(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder={t.inbox.typeReply + ' (Enter للإرسال، Shift+Enter لسطر جديد)'}
                        rows={2}
                        className="flex-1 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-light-text dark:text-dark-text resize-none transition-shadow"
                    />

                    <button
                        onClick={handleSend}
                        disabled={!replyText.trim()}
                        className="flex-shrink-0 h-9 bg-brand-pink text-white font-bold py-2 px-4 rounded-xl hover:bg-brand-pink/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                    >
                        <i className="fas fa-paper-plane text-xs"></i>
                        {t.common.send}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AIAssistantPanel: React.FC<{
    brandId: string;
    conversation: InboxConversation;
    brandProfile: BrandHubProfile;
    onApplyReply: (text: string) => void;
    onAddTask: (title: string, description: string) => void;
    addNotification: (type: NotificationType, message: string) => void;
}> = ({ brandId, conversation, brandProfile, onApplyReply, onAddTask, addNotification }) => {
    const { t } = useLanguage();
    const [analysis, setAnalysis] = useState<{ summary: string, intent: ConversationIntent, sentiment: ConversationSentiment, suggestedReplies: string[] } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [brandReply, setBrandReply] = useState<{ text: string; executionId: string } | null>(null);
    const [isGeneratingBrandReply, setIsGeneratingBrandReply] = useState(false);

    useEffect(() => {
        let isCancelled = false;
        const getAnalysis = async () => {
            setIsLoading(true);
            try {
                const result = await analyzeConversation(conversation, brandProfile);
                if (!isCancelled) {
                    setAnalysis(result);
                }
                try {
                    await persistConversationAnalysis(brandId, conversation.id, {
                        summary: result.summary,
                        intent: result.intent,
                        sentiment: result.sentiment,
                    });
                } catch (persistError) {
                    console.warn('Failed to persist conversation analysis', persistError);
                }
            } catch (error) {
                if (!isCancelled) console.error("Failed to get AI analysis", error);
            } finally {
                if (!isCancelled) setIsLoading(false);
            }
        };
        getAnalysis();
        return () => { isCancelled = true; };
    }, [brandId, conversation, brandProfile]);

    // Clear brand reply when switching conversations
    useEffect(() => { setBrandReply(null); }, [conversation.id]);

    const handleGenerateBrandReply = async () => {
        setIsGeneratingBrandReply(true);
        setBrandReply(null);
        try {
            const { processMarketingRequest } = await import('../../services/platformBrainService');
            const messages = conversation.messages.map(m => ({ sender: m.sender as 'customer' | 'agent', text: m.text }));
            const response = await processMarketingRequest(
                {
                    brandId,
                    requestText: conversation.messages.at(-1)?.text ?? '',
                    forcedSkill: SkillType.ConversationReply,
                    context: { messages },
                },
                brandProfile,
            );
            const reply = response.output.reply as string | undefined;
            if (reply) setBrandReply({ text: reply, executionId: response.executionId });
        } catch (err) {
            console.error('[InboxPage] brand reply failed:', err);
            addNotification(NotificationType.Error, 'فشل توليد رد البراند.');
        } finally {
            setIsGeneratingBrandReply(false);
        }
    };

    const handleCreateTask = () => {
        const title = `متابعة محادثة مع ${conversation.user.name} بخصوص "${analysis?.intent || 'موضوع عام'}"`;
        const description = `الرجاء متابعة المحادثة مع ${conversation.user.name} (@${conversation.user.handle}) على ${conversation.platform}.\n\nالنية المكتشفة بواسطة AI: ${analysis?.intent || 'غير معروف'}.\nملخص AI: ${analysis?.summary || 'لا يوجد ملخص'}\nآخر رسالة من المستخدم: "${conversation.messages.filter(m => m.sender === 'user').pop()?.text || 'لا توجد رسالة'}"`;
        onAddTask(title, description);
    }

    const intentConfig = analysis ? INTENT_CONFIG[analysis.intent] : INTENT_CONFIG.Unknown;
    const sentimentConfig = analysis ? SENTIMENT_CONFIG[analysis.sentiment] : null;

    // Intent-specific action buttons
    const intentActions: Record<ConversationIntent, { label: string; icon: string; color: string; action: () => void }[]> = {
        [ConversationIntent.PurchaseInquiry]: [
            { label: 'إضافة للـ CRM كـ Lead', icon: 'fa-user-plus', color: 'bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20', action: () => { onAddTask(`Lead جديد: ${conversation.user.name}`, `استفسار شراء من @${conversation.user.handle} على ${conversation.platform}`); addNotification(NotificationType.Success, `✅ تمت إضافة ${conversation.user.name} كـ Lead في CRM`); } },
            { label: 'إرسال قائمة الأسعار', icon: 'fa-file-invoice-dollar', color: 'bg-blue-500/10 border-blue-500/30 text-blue-600 hover:bg-blue-500/20', action: () => onApplyReply('شكراً لاستفسارك! إليك قائمة أسعارنا المحدثة: [رابط القائمة]. هل تحتاج مزيداً من المعلومات؟') },
        ],
        [ConversationIntent.Complaint]: [
            { label: 'فتح تذكرة دعم', icon: 'fa-ticket-alt', color: 'bg-red-500/10 border-red-500/30 text-red-600 hover:bg-red-500/20', action: () => { onAddTask(`شكوى من ${conversation.user.name}`, `شكوى على ${conversation.platform} من @${conversation.user.handle} — يحتاج متابعة عاجلة`); addNotification(NotificationType.Info, '🎫 تم فتح تذكرة دعم'); } },
            { label: 'ردّ اعتذار تلقائي', icon: 'fa-heart', color: 'bg-orange-500/10 border-orange-500/30 text-orange-600 hover:bg-orange-500/20', action: () => onApplyReply('نعتذر منك بشدة على هذه التجربة. موضوعك أولوية لدينا وسنتواصل معك خلال ساعة.') },
        ],
        [ConversationIntent.Feedback]: [
            { label: 'تسجيل في لوحة الآراء', icon: 'fa-clipboard-list', color: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/20', action: () => { onAddTask(`Feedback من ${conversation.user.name}`, analysis?.summary || 'رأي عميل يحتاج مراجعة'); addNotification(NotificationType.Success, '📋 تم تسجيل الملاحظة'); } },
        ],
        [ConversationIntent.GeneralQuestion]: [
            { label: 'إرسال لـ FAQ', icon: 'fa-question-circle', color: 'bg-blue-500/10 border-blue-500/30 text-blue-600 hover:bg-blue-500/20', action: () => onApplyReply('يمكنك إيجاد الإجابة في صفحة الأسئلة الشائعة: [رابط FAQ]. لا تتردد في التواصل معنا!') },
        ],
        [ConversationIntent.Spam]: [
            { label: 'أرشفة وتجاهل', icon: 'fa-ban', color: 'bg-gray-500/10 border-gray-500/30 text-gray-500 hover:bg-gray-500/20', action: () => addNotification(NotificationType.Info, 'تم تمييز المحادثة كـ Spam') },
        ],
        [ConversationIntent.Unknown]: [],
    };

    const currentIntentActions = analysis ? (intentActions[analysis.intent] || []) : [];

    return (
        <div className="p-4 space-y-4 h-full overflow-y-auto">
            <h2 className="text-sm font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                <i className="fas fa-brain text-brand-purple"></i>
                {t.inbox.aiAssistant}
            </h2>
            {isLoading ? (
                <div className="space-y-3">
                    {[1,2,3].map(i => <div key={i} className="h-10 bg-light-bg dark:bg-dark-bg rounded-xl animate-pulse" />)}
                </div>
            ) : analysis ? (
                <div className="space-y-4">
                    {/* Intent badge — Arabic label */}
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg">
                        <i className={`fas ${intentConfig.icon} ${intentConfig.color} flex-shrink-0`}></i>
                        <div className="min-w-0">
                            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mb-0.5">النية المكتشفة بالـ AI</p>
                            <p className={`text-sm font-bold ${intentConfig.color} leading-snug`}>{INTENT_ARABIC[analysis.intent]}</p>
                        </div>
                    </div>

                    {sentimentConfig && (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg">
                            <i className={`fas ${sentimentConfig.icon} ${sentimentConfig.color} flex-shrink-0`}></i>
                            <div className="min-w-0">
                                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mb-0.5">المشاعر المكتشفة</p>
                                <p className={`text-sm font-bold ${sentimentConfig.color} leading-snug`}>{sentimentConfig.label}</p>
                            </div>
                        </div>
                    )}

                    {/* Intent-specific Actions */}
                    {currentIntentActions.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-2">إجراءات مقترحة</p>
                            <div className="space-y-1.5">
                                {currentIntentActions.map((action, i) => (
                                    <button key={i} onClick={action.action}
                                        className={`w-full text-right flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${action.color}`}>
                                        <i className={`fas ${action.icon}`}></i>
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Summary */}
                    <div>
                        <h3 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">{t.inbox.aiSummary}</h3>
                        <p className="text-xs p-2.5 bg-light-bg dark:bg-dark-bg rounded-xl text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">{analysis.summary}</p>
                    </div>

                    {/* Suggested Replies */}
                    <div>
                        <h3 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-2">{t.inbox.suggestedReplies}</h3>
                        <div className="space-y-1.5">
                            {analysis.suggestedReplies.map((reply, i) => (
                                <button key={i} onClick={() => onApplyReply(reply)}
                                    className="w-full text-right text-xs p-2.5 bg-light-bg dark:bg-dark-bg rounded-xl hover:bg-brand-primary/10 hover:border-brand-primary border border-light-border dark:border-dark-border text-light-text dark:dark:text-dark-text transition-colors leading-relaxed">
                                    <i className="fas fa-reply text-brand-primary me-1.5 opacity-60"></i>{reply}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Brand Voice Reply — عبر Platform Brain */}
                    <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-brand-secondary flex items-center gap-1.5">
                                <i className="fas fa-brain text-xs" />
                                رد بصوت البراند
                            </p>
                            <button
                                onClick={handleGenerateBrandReply}
                                disabled={isGeneratingBrandReply}
                                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-brand-primary/15 hover:bg-brand-primary/30 text-brand-secondary rounded-lg transition-colors disabled:opacity-40"
                            >
                                <i className={`fas ${isGeneratingBrandReply ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} text-[10px]`} />
                                {isGeneratingBrandReply ? 'جارٍ التوليد...' : 'توليد'}
                            </button>
                        </div>
                        {brandReply && (
                            <div className="space-y-2">
                                <p className="text-xs leading-relaxed text-light-text dark:text-dark-text bg-light-bg dark:bg-dark-bg rounded-lg p-2.5 border border-light-border dark:border-dark-border">
                                    {brandReply.text}
                                </p>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        onClick={() => onApplyReply(brandReply.text)}
                                        className="flex-1 text-xs py-1.5 bg-brand-primary/15 hover:bg-brand-primary/30 text-brand-secondary rounded-lg font-semibold transition-colors"
                                    >
                                        <i className="fas fa-reply me-1.5 text-[10px]" />
                                        تطبيق الرد
                                    </button>
                                    <EvaluationButtons
                                        executionId={brandReply.executionId}
                                        brandId={brandId}
                                        skillType={SkillType.ConversationReply}
                                        output={brandReply.text}
                                        onUsed={() => onApplyReply(brandReply.text)}
                                        compact
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Create Task */}
                    <button onClick={handleCreateTask}
                        className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-text dark:text-dark-text font-semibold py-2.5 rounded-xl hover:border-brand-primary hover:text-brand-primary transition-colors text-sm">
                        <i className="fas fa-plus-circle me-2 text-brand-primary opacity-70"></i>أضف مهمة متابعة لهذه المحادثة
                    </button>
                </div>
            ) : (
                <p className="text-center text-red-400 text-sm py-4">{t.inbox.analysisFailed}</p>
            )}
        </div>
    );
};


// ── INB-1: Reply Templates ─────────────────────────────────────────────────────
interface ReplyTemplate { id: string; title: string; body: string; category: string }

const DEFAULT_TEMPLATES: ReplyTemplate[] = [
    { id: 't1', title: 'ترحيب عام',         category: 'عام',       body: 'أهلاً وسهلاً! نشكرك على تواصلك معنا. كيف يمكننا مساعدتك؟' },
    { id: 't2', title: 'شكر على الاستفسار',  category: 'عام',       body: 'شكراً لاستفسارك! سيتم الرد عليك خلال 24 ساعة.' },
    { id: 't3', title: 'رد على شكوى',        category: 'دعم',       body: 'نعتذر منك على هذا الإزعاج. سنقوم بمتابعة موضوعك فوراً وإيجاد حل مناسب.' },
    { id: 't4', title: 'تأكيد استلام الطلب', category: 'مبيعات',    body: 'تم استلام طلبك بنجاح! سيصلك التأكيد عبر البريد الإلكتروني خلال لحظات.' },
    { id: 't5', title: 'عرض خاص',            category: 'مبيعات',    body: 'لدينا عرض حصري لك! استخدم الكود SPECIAL20 للحصول على خصم 20% على طلبك.' },
    { id: 't6', title: 'طلب تقييم',          category: 'متابعة',    body: 'نأمل أن تكون تجربتك معنا ممتازة! هل يمكنك تقييم خدمتنا لمساعدتنا في التحسين؟' },
];

// ── INB-2: Auto-routing Rules ─────────────────────────────────────────────────
interface RoutingRule { id: string; name: string; condition: string; conditionValue: string; action: string; assignTo: string; enabled: boolean }

const DEFAULT_RULES: RoutingRule[] = [
    { id: 'r1', name: 'استفسارات الشراء → مبيعات',   condition: 'intent',   conditionValue: 'PurchaseInquiry', action: 'assign',    assignTo: 'فريق المبيعات',   enabled: true },
    { id: 'r2', name: 'الشكاوى → الدعم',             condition: 'intent',   conditionValue: 'Complaint',       action: 'assign',    assignTo: 'فريق الدعم',      enabled: true },
    { id: 'r3', name: 'الرسائل المزعجة → أرشيف',    condition: 'intent',   conditionValue: 'Spam',            action: 'archive',   assignTo: '',                enabled: true },
    { id: 'r4', name: 'Instagram → فريق إنستغرام',   condition: 'platform', conditionValue: 'Instagram',       action: 'assign',    assignTo: 'فريق إنستغرام',   enabled: false },
];

export const InboxPage: React.FC<InboxPageProps> = ({ addNotification, brandId, brandProfile, conversations, onAddTask }) => {
    const { t } = useLanguage();
    const { activeBrand } = useBrandStore();
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<'all' | SocialPlatform>('all');
    const [replyText, setReplyText] = useState('');
    const [inboxView, setInboxView] = useState<'inbox' | 'templates' | 'routing'>('inbox');
    // Mobile: stack between list and chat views
    const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
    const [showMobileAI, setShowMobileAI] = useState(false);
    // Local read state (in production would be persisted to DB)
    const [readIds, setReadIds] = useState<Set<string>>(() => new Set(conversations.filter(c => c.isRead).map(c => c.id)));

    const handleMarkRead = (id: string) => {
        setReadIds(prev => new Set([...prev, id]));
    };

    const unreadCount = conversations.filter(c => !readIds.has(c.id)).length;
    // Templates state
    const [templates, setTemplates] = useState<ReplyTemplate[]>(DEFAULT_TEMPLATES);
    const [editingTemplate, setEditingTemplate] = useState<ReplyTemplate | null>(null);
    const [newTemplate, setNewTemplate] = useState<Partial<ReplyTemplate>>({});
    // Routing state
    const [rules, setRules] = useState<RoutingRule[]>(DEFAULT_RULES);

    const filteredConversations = useMemo(() => {
        if (activeFilter === 'all') {
            return conversations;
        }
        return conversations.filter(c => c.platform === activeFilter);
    }, [conversations, activeFilter]);

    const selectedConversationIdRef = useRef(selectedConversationId);
    selectedConversationIdRef.current = selectedConversationId;

    useEffect(() => {
        // Auto-select first conversation in the filtered list if the current selection is not in it
        if (filteredConversations.length > 0) {
            const isSelectedVisible = filteredConversations.some(c => c.id === selectedConversationIdRef.current);
            if (!isSelectedVisible) {
                setSelectedConversationId(filteredConversations[0].id);
            }
        } else {
            setSelectedConversationId(null);
        }
    }, [filteredConversations]);

    const handleReply = async (text: string) => {
        if (!selectedConversationId) return;
        try {
            await replyToConversation(selectedConversationId, text, activeBrand?.id ?? '');
            addNotification(NotificationType.Success, t.inbox.replySent);
            // In a real app, you'd refetch or update state via websockets
        } catch {
            addNotification(NotificationType.Error, t.inbox.replyFailed);
        }
    };

    const selectedConversation = useMemo(() => {
        return conversations.find(c => c.id === selectedConversationId);
    }, [conversations, selectedConversationId]);

    return (
        <PageScaffold
            kicker="Support Ops"
            title="إدارة الرسائل (Inbox)"
            description="متابعة رسائل كافة المنصات، تحليل نية العملاء، والرد بكفاءة عبر الذكاء الاصطناعي."
            stats={[
                { label: 'الرسائل غير المقروءة', value: unreadCount.toString(), tone: 'text-brand-pink', icon: 'fa-envelope-open' },
                { label: 'إجمالي المحادثات', value: conversations.length.toString(), icon: 'fa-comments' }
            ]}
        >
            <PageSection className="space-y-4 pt-0">
            {/* View switcher */}
            <div className="flex gap-2 border-b border-light-border dark:border-dark-border">
                {[
                    { id: 'inbox',     label: unreadCount > 0 ? `الصندوق (${unreadCount})` : 'الصندوق', icon: 'fa-inbox' },
                    { id: 'templates', label: 'قوالب الردود',  icon: 'fa-comment-dots' },
                    { id: 'routing',   label: 'قواعد التوجيه', icon: 'fa-random' },
                ].map(v => (
                    <button key={v.id} onClick={() => setInboxView(v.id as typeof inboxView)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${inboxView === v.id ? 'border-brand-primary text-brand-primary' : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}>
                        <i className={`fas ${v.icon} text-xs`} />{v.label}
                    </button>
                ))}
            </div>

            {/* ── Mobile Inbox Layout (lg:hidden) ─────────────────────────────── */}
            {inboxView === 'inbox' && (
                <div className="lg:hidden">
                    {/* Mobile filter bar — horizontal scroll */}
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar">
                        {(['all', ...Object.values(SocialPlatform)] as ('all' | SocialPlatform)[])
                            .filter(f => f === 'all' || conversations.some(c => c.platform === f))
                            .map(f => {
                                const isActive = activeFilter === f;
                                const count = f === 'all' ? conversations.length : conversations.filter(c => c.platform === f).length;
                                return (
                                    <button
                                        key={f}
                                        onClick={() => setActiveFilter(f)}
                                        className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                                            isActive
                                                ? 'bg-brand-primary text-white'
                                                : 'bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary border border-light-border dark:border-dark-border'
                                        }`}
                                    >
                                        {f !== 'all' && <i className={`${PLATFORM_ASSETS[f as SocialPlatform].icon} text-[10px]`} />}
                                        {f === 'all' ? 'الكل' : f}
                                        <span className={`rounded-full px-1.5 text-[9px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-light-border dark:bg-dark-border'}`}>{count}</span>
                                    </button>
                                );
                            })}
                    </div>

                    {/* Mobile: conversation list */}
                    {mobileView === 'list' && (
                        <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card overflow-hidden">
                            {filteredConversations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                                    <i className="fas fa-inbox text-3xl text-light-text-secondary dark:text-dark-text-secondary opacity-40" />
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">لا توجد محادثات</p>
                                </div>
                            ) : (
                                filteredConversations
                                    .sort((a, b) => {
                                        const aU = !readIds.has(a.id) ? 0 : 1;
                                        const bU = !readIds.has(b.id) ? 0 : 1;
                                        if (aU !== bU) return aU - bU;
                                        return new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime();
                                    })
                                    .map(conv => (
                                        <ConversationListItem
                                            key={conv.id}
                                            conv={{ ...conv, isRead: readIds.has(conv.id) }}
                                            isActive={false}
                                            onClick={() => {
                                                setSelectedConversationId(conv.id);
                                                setMobileView('chat');
                                                setShowMobileAI(false);
                                            }}
                                            onMarkRead={handleMarkRead}
                                        />
                                    ))
                            )}
                        </div>
                    )}

                    {/* Mobile: chat view */}
                    {mobileView === 'chat' && selectedConversation && (
                        <div className="flex flex-col rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
                            {/* Back + AI toggle */}
                            <div className="flex items-center gap-3 border-b border-light-border dark:border-dark-border px-3 py-2.5 bg-light-bg dark:bg-dark-bg">
                                <button
                                    onClick={() => setMobileView('list')}
                                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-light-card dark:bg-dark-card text-light-text dark:text-dark-text"
                                >
                                    <i className="fas fa-arrow-right" />
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-light-text dark:text-dark-text truncate">{selectedConversation.user.name}</p>
                                    <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{selectedConversation.platform}</p>
                                </div>
                                <button
                                    onClick={() => setShowMobileAI(v => !v)}
                                    className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${showMobileAI ? 'bg-brand-primary text-white' : 'bg-light-card dark:bg-dark-card text-light-text-secondary dark:text-dark-text-secondary'}`}
                                >
                                    <i className="fas fa-brain text-sm" />
                                </button>
                            </div>

                            {/* Chat or AI panel */}
                            {showMobileAI ? (
                                <div className="flex-1 overflow-y-auto">
                                    <AIAssistantPanel brandId={brandId} conversation={selectedConversation} brandProfile={brandProfile} onApplyReply={(text) => { setReplyText(text); setShowMobileAI(false); }} onAddTask={onAddTask} addNotification={addNotification} />
                                </div>
                            ) : (
                                <ChatWindow conversation={selectedConversation} onReply={handleReply} replyText={replyText} onReplyTextChange={setReplyText} />
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Desktop Inbox Layout (hidden lg:flex) ────────────────────────── */}
            {inboxView === 'inbox' && (
                <div className="hidden lg:flex h-[calc(100vh-160px)] bg-light-card dark:bg-dark-card rounded-xl border border-light-border dark:border-dark-border overflow-hidden">
                    <FilterSidebar conversations={conversations} activeFilter={activeFilter} onFilterChange={setActiveFilter} />
                    <div className="w-80 border-s border-light-border dark:border-dark-border flex-shrink-0 flex flex-col">
                        <div className="p-4 border-b border-light-border dark:border-dark-border">
                            <input type="text" placeholder={t.inbox.searchConversations} className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg p-2 text-sm text-light-text dark:text-dark-text" />
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {filteredConversations
                                .sort((a, b) => {
                                    // Unread conversations first
                                    const aUnread = !readIds.has(a.id) ? 0 : 1;
                                    const bUnread = !readIds.has(b.id) ? 0 : 1;
                                    if (aUnread !== bUnread) return aUnread - bUnread;
                                    return new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime();
                                })
                                .map(conv => (
                                    <ConversationListItem
                                        key={conv.id}
                                        conv={{ ...conv, isRead: readIds.has(conv.id) }}
                                        isActive={selectedConversationId === conv.id}
                                        onClick={() => setSelectedConversationId(conv.id)}
                                        onMarkRead={handleMarkRead}
                                    />
                                ))
                            }
                        </div>
                    </div>
                    <div className="flex-grow border-s border-light-border dark:border-dark-border">
                        {selectedConversation ? (
                            <ChatWindow conversation={selectedConversation} onReply={handleReply} replyText={replyText} onReplyTextChange={setReplyText} />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
                                <div className="w-14 h-14 rounded-2xl bg-light-bg dark:bg-dark-bg flex items-center justify-center">
                                    <i className="fas fa-comment-dots text-2xl text-light-text-secondary dark:text-dark-text-secondary" />
                                </div>
                                <p className="font-semibold text-light-text dark:text-dark-text">اختر محادثة للرد</p>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                                    اضغط على أي محادثة من القائمة لعرضها والرد عليها
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="w-80 border-s border-light-border dark:border-dark-border bg-light-bg/50 dark:bg-dark-bg/50 flex-shrink-0">
                        {selectedConversation && <AIAssistantPanel brandId={brandId} conversation={selectedConversation} brandProfile={brandProfile} onApplyReply={setReplyText} onAddTask={onAddTask} addNotification={addNotification} />}
                    </div>
                </div>
            )}

            {/* INB-1: Reply Templates */}
            {inboxView === 'templates' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">قوالب جاهزة للرد السريع — استخدمها في الصندوق أو أنشئ قوالب مخصصة</p>
                        <button onClick={() => setEditingTemplate({ id: crypto.randomUUID(), title: '', body: '', category: 'عام' })}
                            className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary/90 transition">
                            <i className="fas fa-plus text-xs" /> قالب جديد
                        </button>
                    </div>
                    {/* Categories */}
                    {[...new Set(templates.map(t => t.category))].map(cat => (
                        <div key={cat} className="space-y-2">
                            <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wide">{cat}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {templates.filter(tmpl => tmpl.category === cat).map(tmpl => (
                                    <div key={tmpl.id} className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-sm text-light-text dark:text-dark-text">{tmpl.title}</span>
                                            <div className="flex gap-1">
                                                <button onClick={() => setEditingTemplate(tmpl)} className="text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary px-1.5 py-0.5 rounded">
                                                    <i className="fas fa-pen" />
                                                </button>
                                                <button onClick={() => setTemplates(prev => prev.filter(t => t.id !== tmpl.id))} className="text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 px-1.5 py-0.5 rounded">
                                                    <i className="fas fa-trash" />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary line-clamp-3">{tmpl.body}</p>
                                        <button onClick={() => { navigator.clipboard.writeText(tmpl.body).catch(() => {}); addNotification(NotificationType.Success, 'تم النسخ!'); }}
                                            className="text-xs text-brand-primary hover:underline flex items-center gap-1">
                                            <i className="fas fa-copy" /> نسخ
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {/* Edit modal */}
                    {editingTemplate && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                                <h3 className="font-bold text-light-text dark:text-dark-text">تحرير القالب</h3>
                                <input value={editingTemplate.title} onChange={e => setEditingTemplate(prev => prev ? { ...prev, title: e.target.value } : prev)}
                                    placeholder="اسم القالب" className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                                <input value={editingTemplate.category} onChange={e => setEditingTemplate(prev => prev ? { ...prev, category: e.target.value } : prev)}
                                    placeholder="الفئة" className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                                <textarea value={editingTemplate.body} onChange={e => setEditingTemplate(prev => prev ? { ...prev, body: e.target.value } : prev)}
                                    rows={4} placeholder="نص القالب" className="w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none" />
                                <div className="flex gap-3">
                                    <button onClick={() => {
                                        if (!editingTemplate.title || !editingTemplate.body) return;
                                        setTemplates(prev => {
                                            const exists = prev.find(t => t.id === editingTemplate.id);
                                            return exists ? prev.map(t => t.id === editingTemplate.id ? editingTemplate : t) : [...prev, editingTemplate];
                                        });
                                        setEditingTemplate(null);
                                        addNotification(NotificationType.Success, 'تم حفظ القالب');
                                    }} className="flex-1 px-4 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary/90">حفظ</button>
                                    <button onClick={() => setEditingTemplate(null)} className="px-4 py-2.5 border border-light-border dark:border-dark-border rounded-xl text-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/30 dark:hover:bg-dark-border/30">إلغاء</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* INB-2: Auto-routing Rules */}
            {inboxView === 'routing' && (
                <div className="space-y-4">
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">قواعد توجيه تلقائية — حدّد شروطاً للتوجيه التلقائي للمحادثات للفريق المناسب</p>
                    <div className="space-y-3">
                        {rules.map(rule => (
                            <div key={rule.id} className={`bg-light-card dark:bg-dark-card border rounded-2xl p-5 transition-all ${rule.enabled ? 'border-light-border dark:border-dark-border' : 'border-light-border/50 dark:border-dark-border/50 opacity-60'}`}>
                                <div className="flex items-center gap-4">
                                    {/* Toggle */}
                                    <div onClick={() => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))}
                                        className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative shrink-0 ${rule.enabled ? 'bg-brand-primary' : 'bg-light-border dark:bg-dark-border'}`}>
                                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${rule.enabled ? 'left-5' : 'left-0.5'}`} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm text-light-text dark:text-dark-text">{rule.name}</p>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary flex-wrap">
                                            <span>إذا <span className="font-mono bg-light-surface dark:bg-dark-surface px-1.5 py-0.5 rounded">{rule.condition}</span> = <span className="font-mono bg-light-surface dark:bg-dark-surface px-1.5 py-0.5 rounded">{rule.conditionValue}</span></span>
                                            <i className="fas fa-arrow-right text-[10px]" />
                                            <span className="font-medium text-brand-primary">{rule.action === 'assign' ? `تعيين إلى: ${rule.assignTo}` : 'أرشفة تلقائية'}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setRules(prev => prev.filter(r => r.id !== rule.id))} className="text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition-colors">
                                        <i className="fas fa-trash" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => { addNotification(NotificationType.Success, 'تم حفظ قواعد التوجيه'); }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary/90 transition">
                        <i className="fas fa-save" /> حفظ القواعد
                    </button>
                </div>
            )}
            </PageSection>
        </PageScaffold>
    );
};
