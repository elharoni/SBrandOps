import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    getAllTickets,
    getTicket,
    getTicketReplies,
    addTicketReply,
    updateTicketStatus,
    getMessages,
} from '../../../services/supportChatService';
import {
    SupportTicket,
    SupportTicketReply,
    SupportChatMessage,
    SupportTicketStatus,
    SupportTicketPriority,
    SupportTicketCategory,
} from '../../../types';

// ── Helpers ────────────────────────────────────────────────────────────────────

const priorityConfig: Record<SupportTicketPriority, { label: string; labelAr: string; color: string; bg: string }> = {
    low:    { label: 'Low',    labelAr: 'منخفضة', color: 'text-green-400',  bg: 'bg-green-500/10' },
    medium: { label: 'Medium', labelAr: 'متوسطة', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    high:   { label: 'High',   labelAr: 'عالية',  color: 'text-orange-400', bg: 'bg-orange-500/10' },
    urgent: { label: 'Urgent', labelAr: 'عاجلة',  color: 'text-red-400',   bg: 'bg-red-500/10' },
};

const statusConfig: Record<SupportTicketStatus, { label: string; labelAr: string; color: string; bg: string }> = {
    open:        { label: 'Open',        labelAr: 'مفتوحة',      color: 'text-blue-400',   bg: 'bg-blue-500/10' },
    in_progress: { label: 'In Progress', labelAr: 'قيد المعالجة', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    resolved:    { label: 'Resolved',    labelAr: 'محلولة',      color: 'text-green-400',  bg: 'bg-green-500/10' },
    closed:      { label: 'Closed',      labelAr: 'مغلقة',       color: 'text-gray-400',   bg: 'bg-gray-500/10' },
};

const categoryLabel = (cat: SupportTicketCategory, ar: boolean) => {
    const map: Record<SupportTicketCategory, [string, string]> = {
        technical: ['Technical', 'تقني'],
        billing:   ['Billing',   'الدفع'],
        feature:   ['Feature',   'ميزة'],
        bug:       ['Bug',       'خطأ'],
        other:     ['Other',     'أخرى'],
    };
    const [en, arLabel] = map[cat] ?? ['Other', 'أخرى'];
    return ar ? arLabel : en;
};

function timeAgo(dateStr: string, ar: boolean): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return ar ? `منذ ${d} يوم` : `${d}d ago`;
    if (h > 0) return ar ? `منذ ${h} ساعة` : `${h}h ago`;
    if (m > 0) return ar ? `منذ ${m} دقيقة` : `${m}m ago`;
    return ar ? 'الآن' : 'Just now';
}

// ── Ticket Row ─────────────────────────────────────────────────────────────────

const TicketRow: React.FC<{
    ticket: SupportTicket;
    isSelected: boolean;
    ar: boolean;
    onClick: () => void;
}> = ({ ticket, isSelected, ar, onClick }) => {
    const p = priorityConfig[ticket.priority];
    const s = statusConfig[ticket.status];

    return (
        <button
            onClick={onClick}
            className={`w-full text-left px-4 py-3.5 border-b border-light-border dark:border-dark-border transition-colors hover:bg-light-card dark:hover:bg-dark-card ${isSelected ? 'bg-brand-primary/5 border-r-2 border-r-brand-primary' : ''}`}
        >
            <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${ticket.status === 'open' ? 'bg-blue-400' : ticket.status === 'in_progress' ? 'bg-yellow-400' : 'bg-gray-400'}`} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-mono">#{ticket.ticketNumber}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${p.bg} ${p.color}`}>
                            {ar ? p.labelAr : p.label}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${s.bg} ${s.color}`}>
                            {ar ? s.labelAr : s.label}
                        </span>
                    </div>
                    <p className="text-sm font-medium text-light-text dark:text-dark-text truncate">{ticket.title}</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                        {categoryLabel(ticket.category, ar)} · {timeAgo(ticket.createdAt, ar)}
                    </p>
                </div>
            </div>
        </button>
    );
};

// ── Ticket Detail ──────────────────────────────────────────────────────────────

const TicketDetail: React.FC<{
    ticket: SupportTicket;
    ar: boolean;
    userId: string;
    onStatusChange: (status: SupportTicketStatus) => void;
}> = ({ ticket, ar, userId, onStatusChange }) => {
    const [replies, setReplies]         = useState<SupportTicketReply[]>([]);
    const [chatMsgs, setChatMsgs]       = useState<SupportChatMessage[]>([]);
    const [replyText, setReplyText]     = useState('');
    const [isInternal, setIsInternal]   = useState(false);
    const [isSending, setIsSending]     = useState(false);
    const [activeTab, setActiveTab]     = useState<'replies' | 'chat'>('replies');

    useEffect(() => {
        setReplies([]);
        setChatMsgs([]);
        setReplyText('');
        loadReplies();
        if (ticket.sessionId) loadChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticket.id]);

    const loadReplies = async () => {
        const data = await getTicketReplies(ticket.id, true);
        setReplies(data);
    };

    const loadChat = async () => {
        if (!ticket.sessionId) return;
        const data = await getMessages(ticket.sessionId);
        setChatMsgs(data);
    };

    const sendReply = async () => {
        if (!replyText.trim() || isSending) return;
        setIsSending(true);
        try {
            const reply = await addTicketReply(ticket.id, userId, 'admin', replyText.trim(), isInternal);
            if (reply) setReplies(prev => [...prev, reply]);
            setReplyText('');
        } finally {
            setIsSending(false);
        }
    };

    const p = priorityConfig[ticket.priority];
    const s = statusConfig[ticket.status];

    const nextStatuses: SupportTicketStatus[] = ticket.status === 'open'
        ? ['in_progress', 'resolved', 'closed']
        : ticket.status === 'in_progress'
        ? ['resolved', 'closed']
        : ['closed'];

    return (
        <div className="flex flex-col h-full">
            {/* Ticket Header */}
            <div className="px-6 py-4 border-b border-light-border dark:border-dark-border flex-shrink-0">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-mono text-light-text-secondary dark:text-dark-text-secondary">#{ticket.ticketNumber}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.bg} ${p.color}`}>{ar ? p.labelAr : p.label}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.color}`}>{ar ? s.labelAr : s.label}</span>
                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{categoryLabel(ticket.category, ar)}</span>
                        </div>
                        <h2 className="text-base font-semibold text-light-text dark:text-dark-text">{ticket.title}</h2>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{timeAgo(ticket.createdAt, ar)}</p>
                    </div>
                    {/* Status Changer */}
                    <select
                        value={ticket.status}
                        onChange={e => onStatusChange(e.target.value as SupportTicketStatus)}
                        className="text-xs rounded-lg border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg px-2 py-1.5 text-light-text dark:text-dark-text outline-none focus:border-brand-primary flex-shrink-0"
                    >
                        <option value={ticket.status}>{ar ? s.labelAr : s.label}</option>
                        {nextStatuses.map(st => (
                            <option key={st} value={st}>{ar ? statusConfig[st].labelAr : statusConfig[st].label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Description */}
            <div className="px-6 py-3 border-b border-light-border dark:border-dark-border flex-shrink-0 bg-light-card/50 dark:bg-dark-card/50">
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary whitespace-pre-wrap leading-relaxed line-clamp-4">
                    {ticket.description}
                </p>
            </div>

            {/* Tabs */}
            {ticket.sessionId && (
                <div className="flex border-b border-light-border dark:border-dark-border flex-shrink-0">
                    {(['replies', 'chat'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activeTab === tab ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                        >
                            {tab === 'replies'
                                ? (ar ? 'الردود' : 'Replies')
                                : (ar ? 'المحادثة الأصلية' : 'Original Chat')}
                        </button>
                    ))}
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
                {activeTab === 'replies' && (
                    <>
                        {replies.length === 0 && (
                            <p className="text-center text-sm text-light-text-secondary dark:text-dark-text-secondary py-6">
                                {ar ? 'لا توجد ردود بعد' : 'No replies yet'}
                            </p>
                        )}
                        {replies.map(reply => (
                            <div key={reply.id} className={`flex gap-2 ${reply.senderType === 'user' ? 'flex-row' : 'flex-row-reverse'}`}>
                                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs
                                    ${reply.senderType === 'user' ? 'bg-blue-500/20 text-blue-400' : 'bg-brand-primary/20 text-brand-primary'}`}>
                                    <i className={`fas ${reply.senderType === 'user' ? 'fa-user' : 'fa-headset'}`} />
                                </div>
                                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                                    reply.senderType === 'user'
                                        ? 'bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border text-light-text dark:text-dark-text'
                                        : reply.isInternal
                                        ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-700 dark:text-yellow-300'
                                        : 'bg-brand-primary/10 border border-brand-primary/20 text-brand-primary'
                                }`}>
                                    {reply.isInternal && (
                                        <p className="text-xs font-medium mb-1 opacity-70">
                                            <i className="fas fa-lock me-1" />
                                            {ar ? 'ملاحظة داخلية' : 'Internal Note'}
                                        </p>
                                    )}
                                    <p className="leading-relaxed">{reply.content}</p>
                                    <p className="text-xs opacity-50 mt-1">{timeAgo(reply.createdAt, ar)}</p>
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {activeTab === 'chat' && (
                    <>
                        {chatMsgs.map(msg => (
                            <div key={msg.id} className={`flex gap-2 ${msg.senderType === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs
                                    ${msg.senderType === 'user' ? 'bg-blue-500/20 text-blue-400' : 'bg-brand-primary/20 text-brand-primary'}`}>
                                    <i className={`fas ${msg.senderType === 'user' ? 'fa-user' : 'fa-robot'}`} />
                                </div>
                                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed
                                    ${msg.senderType === 'user'
                                        ? 'bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border text-light-text dark:text-dark-text'
                                        : 'bg-brand-primary/5 border border-brand-primary/10 text-light-text dark:text-dark-text'}`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Reply Input */}
            {activeTab === 'replies' && ticket.status !== 'closed' && (
                <div className="flex-shrink-0 border-t border-light-border dark:border-dark-border px-4 py-3 space-y-2">
                    <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder={ar ? 'اكتب ردك هنا...' : 'Write your reply here...'}
                        rows={2}
                        className="w-full rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg px-3 py-2 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary resize-none"
                    />
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 text-xs text-light-text-secondary dark:text-dark-text-secondary cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isInternal}
                                onChange={e => setIsInternal(e.target.checked)}
                                className="rounded"
                            />
                            {ar ? 'ملاحظة داخلية (لا يراها المستخدم)' : 'Internal note (hidden from user)'}
                        </label>
                        <button
                            onClick={sendReply}
                            disabled={!replyText.trim() || isSending}
                            className="rounded-lg bg-brand-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-primary/90 disabled:opacity-40 transition-colors"
                        >
                            {isSending ? (ar ? 'جارٍ...' : 'Sending...') : (ar ? 'إرسال' : 'Send')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Main Page ──────────────────────────────────────────────────────────────────

export const SupportInboxPage: React.FC = () => {
    const { language } = useLanguage();
    const { user }     = useAuth();
    const ar = language === 'ar';

    const [tickets, setTickets]               = useState<SupportTicket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [isLoading, setIsLoading]           = useState(true);
    const [filterStatus, setFilterStatus]     = useState<SupportTicketStatus | 'all'>('all');
    const [filterPriority, setFilterPriority] = useState<SupportTicketPriority | 'all'>('all');
    const [searchQuery, setSearchQuery]       = useState('');

    const loadTickets = useCallback(async () => {
        setIsLoading(true);
        const data = await getAllTickets(
            filterStatus !== 'all' || filterPriority !== 'all'
                ? {
                    status:   filterStatus   !== 'all' ? filterStatus   : undefined,
                    priority: filterPriority !== 'all' ? filterPriority : undefined,
                  }
                : undefined,
        );
        setTickets(data);
        setIsLoading(false);
    }, [filterStatus, filterPriority]);

    useEffect(() => { loadTickets(); }, [loadTickets]);

    const handleStatusChange = async (status: SupportTicketStatus) => {
        if (!selectedTicket) return;
        await updateTicketStatus(selectedTicket.id, status);
        const updated = await getTicket(selectedTicket.id);
        if (updated) {
            setSelectedTicket(updated);
            setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
        }
    };

    const filtered = tickets.filter(t =>
        !searchQuery ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(t.ticketNumber).includes(searchQuery),
    );

    const stats = {
        open:        tickets.filter(t => t.status === 'open').length,
        in_progress: tickets.filter(t => t.status === 'in_progress').length,
        resolved:    tickets.filter(t => t.status === 'resolved').length,
    };

    return (
        <div className="flex flex-col h-full" dir={ar ? 'rtl' : 'ltr'}>
            {/* Page Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-light-border dark:border-dark-border">
                <h1 className="text-xl font-bold text-light-text dark:text-dark-text mb-3">
                    <i className="fas fa-headset me-2 text-brand-primary" />
                    {ar ? 'صندوق وارد الدعم' : 'Support Inbox'}
                </h1>

                {/* Stats */}
                <div className="flex gap-4 mb-3">
                    {[
                        { key: 'open',        label: ar ? 'مفتوحة' : 'Open',        count: stats.open,        color: 'text-blue-400' },
                        { key: 'in_progress', label: ar ? 'قيد المعالجة' : 'In Progress', count: stats.in_progress, color: 'text-yellow-400' },
                        { key: 'resolved',    label: ar ? 'محلولة' : 'Resolved',    count: stats.resolved,    color: 'text-green-400' },
                    ].map(s => (
                        <button
                            key={s.key}
                            onClick={() => setFilterStatus(s.key === filterStatus ? 'all' : s.key as SupportTicketStatus)}
                            className={`flex items-center gap-1.5 text-sm transition-opacity ${filterStatus === s.key ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`}
                        >
                            <span className={`font-bold ${s.color}`}>{s.count}</span>
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">{s.label}</span>
                        </button>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={ar ? 'بحث بالرقم أو العنوان...' : 'Search by number or title...'}
                        className="flex-1 rounded-lg border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg px-3 py-1.5 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary"
                    />
                    <select
                        value={filterPriority}
                        onChange={e => setFilterPriority(e.target.value as SupportTicketPriority | 'all')}
                        className="rounded-lg border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg px-2 py-1.5 text-xs text-light-text dark:text-dark-text outline-none"
                    >
                        <option value="all">{ar ? 'كل الأولويات' : 'All Priorities'}</option>
                        <option value="urgent">{ar ? 'عاجلة' : 'Urgent'}</option>
                        <option value="high">{ar ? 'عالية' : 'High'}</option>
                        <option value="medium">{ar ? 'متوسطة' : 'Medium'}</option>
                        <option value="low">{ar ? 'منخفضة' : 'Low'}</option>
                    </select>
                    <button
                        onClick={loadTickets}
                        className="rounded-lg border border-light-border dark:border-dark-border px-3 py-1.5 text-xs text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-card dark:hover:bg-dark-card transition-colors"
                    >
                        <i className="fas fa-refresh" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Ticket List */}
                <div className={`flex-shrink-0 border-e border-light-border dark:border-dark-border overflow-y-auto ${selectedTicket ? 'w-72' : 'w-full'}`}>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <i className="fas fa-circle-notch fa-spin text-brand-primary text-xl" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                            <div className="w-12 h-12 rounded-full bg-light-card dark:bg-dark-card flex items-center justify-center mb-3">
                                <i className="fas fa-inbox text-light-text-secondary dark:text-dark-text-secondary text-xl" />
                            </div>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                {ar ? 'لا توجد تذاكر' : 'No tickets found'}
                            </p>
                        </div>
                    ) : (
                        filtered.map(ticket => (
                            <TicketRow
                                key={ticket.id}
                                ticket={ticket}
                                isSelected={selectedTicket?.id === ticket.id}
                                ar={ar}
                                onClick={() => setSelectedTicket(ticket)}
                            />
                        ))
                    )}
                </div>

                {/* Ticket Detail Panel */}
                {selectedTicket && user && (
                    <div className="flex-1 overflow-hidden min-w-0">
                        <TicketDetail
                            ticket={selectedTicket}
                            ar={ar}
                            userId={user.id}
                            onStatusChange={handleStatusChange}
                        />
                    </div>
                )}

                {!selectedTicket && !isLoading && filtered.length > 0 && (
                    <div className="hidden lg:flex flex-1 items-center justify-center text-light-text-secondary dark:text-dark-text-secondary text-sm">
                        <div className="text-center">
                            <i className="fas fa-mouse-pointer text-3xl mb-3 opacity-30" />
                            <p>{ar ? 'اختر تذكرة لعرض التفاصيل' : 'Select a ticket to view details'}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
