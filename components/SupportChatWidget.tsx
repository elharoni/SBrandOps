import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useBrandStore } from '../stores/brandStore';
import { answerSupportQuery } from '../services/geminiService';
import {
    createSession,
    getActiveSessionForUser,
    addMessage,
    getMessages,
    createTicket,
    updateSessionStatus,
} from '../services/supportChatService';
import {
    SupportChatMessage,
    SupportChatSession,
    SupportTicketCategory,
    SupportTicketPriority,
} from '../types';

// ── Ticket Form ───────────────────────────────────────────────────────────────

interface TicketFormProps {
    ar: boolean;
    onSubmit: (data: { title: string; description: string; priority: SupportTicketPriority; category: SupportTicketCategory }) => void;
    onCancel: () => void;
    isLoading: boolean;
    prefillTitle?: string;
    prefillDescription?: string;
    prefillCategory?: SupportTicketCategory;
    prefillPriority?: SupportTicketPriority;
}

const TicketForm: React.FC<TicketFormProps> = ({
    ar, onSubmit, onCancel, isLoading,
    prefillTitle = '', prefillDescription = '', prefillCategory = 'other', prefillPriority = 'medium',
}) => {
    const [title, setTitle]             = useState(prefillTitle);
    const [description, setDescription] = useState(prefillDescription);
    const [priority, setPriority]       = useState<SupportTicketPriority>(prefillPriority);
    const [category, setCategory]       = useState<SupportTicketCategory>(prefillCategory);

    const categories: { value: SupportTicketCategory; label: string }[] = [
        { value: 'technical', label: ar ? 'مشكلة تقنية' : 'Technical Issue' },
        { value: 'billing',   label: ar ? 'الدفع والاشتراك' : 'Billing' },
        { value: 'feature',   label: ar ? 'طلب ميزة' : 'Feature Request' },
        { value: 'bug',       label: ar ? 'خطأ في التطبيق' : 'Bug Report' },
        { value: 'other',     label: ar ? 'أخرى' : 'Other' },
    ];

    const priorities: { value: SupportTicketPriority; label: string; color: string }[] = [
        { value: 'low',    label: ar ? 'منخفضة' : 'Low',    color: 'text-green-400' },
        { value: 'medium', label: ar ? 'متوسطة' : 'Medium', color: 'text-yellow-400' },
        { value: 'high',   label: ar ? 'عالية'  : 'High',   color: 'text-orange-400' },
        { value: 'urgent', label: ar ? 'عاجلة'  : 'Urgent', color: 'text-red-400' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) return;
        onSubmit({ title, description, priority, category });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-sm font-medium text-light-text dark:text-dark-text">
                {ar ? 'تفاصيل تذكرة الدعم' : 'Support Ticket Details'}
            </p>

            <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={ar ? 'عنوان المشكلة...' : 'Issue title...'}
                className="w-full rounded-lg border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg px-3 py-2 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary"
                required
            />

            <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={ar ? 'اشرح المشكلة بالتفصيل...' : 'Describe the issue in detail...'}
                rows={3}
                className="w-full rounded-lg border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg px-3 py-2 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary resize-none"
                required
            />

            <div className="grid grid-cols-2 gap-2">
                <select
                    value={category}
                    onChange={e => setCategory(e.target.value as SupportTicketCategory)}
                    className="rounded-lg border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg px-2 py-2 text-xs text-light-text dark:text-dark-text outline-none"
                >
                    {categories.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                </select>

                <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as SupportTicketPriority)}
                    className="rounded-lg border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg px-2 py-2 text-xs text-light-text dark:text-dark-text outline-none"
                >
                    {priorities.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                </select>
            </div>

            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 rounded-lg bg-brand-primary px-3 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-50"
                >
                    {isLoading
                        ? (ar ? 'جارٍ الإرسال...' : 'Sending...')
                        : (ar ? 'إرسال التذكرة' : 'Submit Ticket')}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-lg border border-light-border dark:border-dark-border px-3 py-2 text-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/30 dark:hover:bg-dark-border/30"
                >
                    {ar ? 'إلغاء' : 'Cancel'}
                </button>
            </div>
        </form>
    );
};

// ── Message Bubble ─────────────────────────────────────────────────────────────

const MessageBubble: React.FC<{ msg: SupportChatMessage; ar: boolean }> = ({ msg, ar }) => {
    const isUser = msg.senderType === 'user';
    const isAI   = msg.senderType === 'ai';

    return (
        <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {!isUser && (
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs
                    ${isAI ? 'bg-brand-primary/20 text-brand-primary' : 'bg-green-500/20 text-green-400'}`}>
                    <i className={`fas ${isAI ? 'fa-robot' : 'fa-headset'}`} />
                </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed
                ${isUser
                    ? 'bg-brand-primary text-white rounded-tr-sm'
                    : 'bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border text-light-text dark:text-dark-text rounded-tl-sm'
                }`}
            >
                {msg.content}
            </div>
        </div>
    );
};

// ── Main Widget ────────────────────────────────────────────────────────────────

type WidgetView = 'chat' | 'ticket-form' | 'ticket-success';

export const SupportChatWidget: React.FC = () => {
    const { language } = useLanguage();
    const { user }     = useAuth();
    const { activeBrand } = useBrandStore();
    const ar = language === 'ar';

    const [isOpen, setIsOpen]               = useState(false);
    const [view, setView]                   = useState<WidgetView>('chat');
    const [messages, setMessages]           = useState<SupportChatMessage[]>([]);
    const [inputText, setInputText]         = useState('');
    const [isTyping, setIsTyping]           = useState(false);
    const [session, setSession]             = useState<SupportChatSession | null>(null);
    const [isCreatingTicket, setIsCreatingTicket] = useState(false);
    const [lastAIResponse, setLastAIResponse]     = useState<{ category: SupportTicketCategory; priority: SupportTicketPriority } | null>(null);
    const [ticketNumber, setTicketNumber]   = useState<number | null>(null);
    const [unreadCount, setUnreadCount]     = useState(0);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef       = useRef<HTMLInputElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => { scrollToBottom(); }, [messages, isTyping, scrollToBottom]);

    const makeWelcomeMsg = useCallback((sessionId = 'local'): SupportChatMessage => ({
        id:         'welcome',
        sessionId,
        senderType: 'ai',
        content:    ar
            ? 'مرحباً! أنا مساعدك في SBrandOps. كيف يمكنني مساعدتك اليوم؟ يمكنك سؤالي عن أي ميزة في التطبيق أو الإبلاغ عن مشكلة.'
            : "Hello! I'm your SBrandOps assistant. How can I help you today? Ask me about any feature or report an issue.",
        createdAt:  new Date().toISOString(),
    }), [ar]);

    useEffect(() => {
        if (!isOpen || !user) return;
        inputRef.current?.focus();
        setUnreadCount(0);

        // Show welcome immediately — don't wait for DB
        setMessages([makeWelcomeMsg()]);

        // Load or create session in background
        (async () => {
            const existing = await getActiveSessionForUser(user.id);
            if (existing) {
                setSession(existing);
                const msgs = await getMessages(existing.id);
                if (msgs.length > 0) {
                    setMessages(msgs);
                }
                // else keep the welcome message already shown
            } else {
                const newSession = await createSession(user.id, language as 'ar' | 'en', activeBrand?.id);
                if (newSession) setSession(newSession);
                // welcome message already shown above, no need to reset
            }
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, user]);

    const sendMessage = async () => {
        if (!inputText.trim() || !user || isTyping) return;

        const userContent = inputText.trim();
        setInputText('');

        // outer guard — prevent any unhandled rejection from crashing the app
        try { await _doSend(userContent); } catch { /* swallowed */ }
    };

    const _doSend = async (userContent: string) => {

        let activeSession = session;
        if (!activeSession) {
            activeSession = await createSession(user.id, language as 'ar' | 'en', activeBrand?.id);
            setSession(activeSession);
        }

        const userMsg: SupportChatMessage = {
            id:         crypto.randomUUID(),
            sessionId:  activeSession?.id ?? 'local',
            senderType: 'user',
            senderId:   user.id,
            content:    userContent,
            createdAt:  new Date().toISOString(),
        };
        setMessages(prev => [...prev, userMsg]);

        if (activeSession) {
            await addMessage(activeSession.id, 'user', userContent, user.id);
        }

        setIsTyping(true);

        try {
            const history = messages
                .filter(m => m.senderType !== 'ai' || m.id !== 'welcome')
                .slice(-8)
                .map(m => ({ role: (m.senderType === 'user' ? 'user' : 'ai') as 'user' | 'ai', content: m.content }));

            const aiResponse = await answerSupportQuery(userContent, history, language as 'ar' | 'en');

            const aiMsg: SupportChatMessage = {
                id:         crypto.randomUUID(),
                sessionId:  activeSession?.id ?? 'local',
                senderType: 'ai',
                content:    aiResponse.reply,
                metadata:   {
                    category:      aiResponse.category,
                    priority:      aiResponse.priority,
                    canResolve:    aiResponse.canResolve,
                    suggestTicket: aiResponse.suggestTicket,
                },
                createdAt:  new Date().toISOString(),
            };
            setMessages(prev => [...prev, aiMsg]);
            setLastAIResponse({ category: aiResponse.category, priority: aiResponse.priority });

            if (activeSession) {
                await addMessage(activeSession.id, 'ai', aiResponse.reply, undefined, aiMsg.metadata);
            }

            if (!isOpen) setUnreadCount(prev => prev + 1);
        } catch {
            const errMsg: SupportChatMessage = {
                id:         crypto.randomUUID(),
                sessionId:  activeSession?.id ?? 'local',
                senderType: 'ai',
                content:    ar
                    ? 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى أو فتح تذكرة دعم.'
                    : 'Sorry, an error occurred. Please try again or open a support ticket.',
                createdAt:  new Date().toISOString(),
            };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setIsTyping(false);
        }
    };  // end _doSend

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    const handleTicketSubmit = async (data: {
        title: string;
        description: string;
        priority: SupportTicketPriority;
        category: SupportTicketCategory;
    }) => {
        if (!user) return;
        setIsCreatingTicket(true);
        try {
            const conversationSummary = messages
                .filter(m => m.id !== 'welcome')
                .map(m => `${m.senderType === 'user' ? (ar ? 'المستخدم' : 'User') : (ar ? 'AI' : 'AI')}: ${m.content}`)
                .join('\n');

            const fullDescription = `${data.description}\n\n${ar ? '--- سياق المحادثة ---' : '--- Chat Context ---'}\n${conversationSummary}`;

            const ticket = await createTicket({
                sessionId:   session?.id,
                userId:      user.id,
                brandId:     activeBrand?.id,
                title:       data.title,
                description: fullDescription,
                priority:    data.priority,
                category:    data.category,
                language:    language as 'ar' | 'en',
            });

            if (ticket) {
                setTicketNumber(ticket.ticketNumber);
                if (session) await updateSessionStatus(session.id, 'resolved');
                setView('ticket-success');
            }
        } finally {
            setIsCreatingTicket(false);
        }
    };

    const handleClose = () => setIsOpen(false);
    const handleOpen  = () => setIsOpen(true);

    const lastMessage = messages[messages.length - 1];
    const showTicketSuggestion = lastMessage?.senderType === 'ai' && lastMessage.metadata?.suggestTicket;

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={handleOpen}
                className={`fixed bottom-6 ${ar ? 'left-6' : 'right-6'} z-50 w-14 h-14 rounded-full bg-brand-primary text-white shadow-lg hover:bg-brand-primary/90 transition-all duration-200 flex items-center justify-center ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
                aria-label={ar ? 'فتح الدعم' : 'Open Support'}
            >
                <i className="fas fa-headset text-xl" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <div
                    className={`fixed bottom-6 ${ar ? 'left-6' : 'right-6'} z-50 w-[360px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl shadow-2xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg overflow-hidden`}
                    style={{ height: '520px' }}
                    dir={ar ? 'rtl' : 'ltr'}
                >
                    {/* Header */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-brand-primary text-white flex-shrink-0">
                        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                            <i className="fas fa-headset text-sm" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{ar ? 'دعم SBrandOps' : 'SBrandOps Support'}</p>
                            <p className="text-xs text-white/70">{ar ? 'مدعوم بالذكاء الاصطناعي' : 'AI-powered support'}</p>
                        </div>
                        <div className="flex gap-2">
                            {view === 'chat' && (
                                <button
                                    onClick={() => setView('ticket-form')}
                                    title={ar ? 'فتح تذكرة دعم' : 'Open support ticket'}
                                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs transition-colors"
                                >
                                    <i className="fas fa-ticket-alt" />
                                </button>
                            )}
                            <button
                                onClick={handleClose}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            >
                                <i className="fas fa-times text-sm" />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                        {view === 'chat' && (
                            <>
                                {messages.map(msg => (
                                    <MessageBubble key={msg.id} msg={msg} ar={ar} />
                                ))}

                                {isTyping && (
                                    <div className="flex gap-2">
                                        <div className="w-7 h-7 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary text-xs flex-shrink-0">
                                            <i className="fas fa-robot" />
                                        </div>
                                        <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
                                            <span className="w-1.5 h-1.5 rounded-full bg-light-text-secondary dark:bg-dark-text-secondary animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-1.5 h-1.5 rounded-full bg-light-text-secondary dark:bg-dark-text-secondary animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-1.5 h-1.5 rounded-full bg-light-text-secondary dark:bg-dark-text-secondary animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                )}

                                {showTicketSuggestion && !isTyping && (
                                    <button
                                        onClick={() => setView('ticket-form')}
                                        className="w-full text-left rounded-xl border border-brand-primary/30 bg-brand-primary/5 px-3 py-2.5 text-sm text-brand-primary hover:bg-brand-primary/10 transition-colors"
                                    >
                                        <i className="fas fa-ticket-alt me-2" />
                                        {ar ? 'فتح تذكرة دعم لمتابعة المشكلة' : 'Open a support ticket for follow-up'}
                                    </button>
                                )}

                                <div ref={messagesEndRef} />
                            </>
                        )}

                        {view === 'ticket-form' && (
                            <TicketForm
                                ar={ar}
                                onSubmit={handleTicketSubmit}
                                onCancel={() => setView('chat')}
                                isLoading={isCreatingTicket}
                                prefillCategory={lastAIResponse?.category}
                                prefillPriority={lastAIResponse?.priority}
                                prefillDescription={
                                    messages.length > 1
                                        ? (ar ? 'المشكلة من المحادثة: ' : 'Issue from chat: ') +
                                          messages.filter(m => m.senderType === 'user').map(m => m.content).join(' / ')
                                        : ''
                                }
                            />
                        )}

                        {view === 'ticket-success' && (
                            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <i className="fas fa-check-circle text-green-400 text-3xl" />
                                </div>
                                <div>
                                    <p className="font-semibold text-light-text dark:text-dark-text">
                                        {ar ? 'تم إرسال التذكرة!' : 'Ticket submitted!'}
                                    </p>
                                    {ticketNumber && (
                                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                            {ar ? `رقم التذكرة: #${ticketNumber}` : `Ticket #${ticketNumber}`}
                                        </p>
                                    )}
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-2">
                                        {ar
                                            ? 'سيتواصل معك فريق الدعم في أقرب وقت ممكن.'
                                            : 'Our support team will get back to you as soon as possible.'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => { setView('chat'); setSession(null); setMessages([makeWelcomeMsg()]); }}
                                    className="text-sm text-brand-primary hover:underline"
                                >
                                    {ar ? 'محادثة جديدة' : 'Start new chat'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    {view === 'chat' && (
                        <div className="flex-shrink-0 border-t border-light-border dark:border-dark-border px-3 py-3 flex gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={ar ? 'اكتب رسالتك...' : 'Type your message...'}
                                disabled={isTyping}
                                className="flex-1 rounded-xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card px-3 py-2 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary disabled:opacity-50"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!inputText.trim() || isTyping}
                                className="w-9 h-9 rounded-xl bg-brand-primary text-white flex items-center justify-center hover:bg-brand-primary/90 disabled:opacity-40 transition-colors flex-shrink-0"
                            >
                                <i className={`fas ${ar ? 'fa-paper-plane fa-flip-horizontal' : 'fa-paper-plane'} text-sm`} />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
