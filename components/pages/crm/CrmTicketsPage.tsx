import React, { useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { PageScaffold, PageSection } from '../../shared/PageScaffold';

export interface CrmTicketsPageProps {
    brandId: string;
}

type TicketStatus = 'Open' | 'In Progress' | 'Resolved';
type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

interface Ticket {
    id: string;
    subject: string;
    customerName: string;
    status: TicketStatus;
    priority: TicketPriority;
    lastUpdated: string;
    assignee?: string;
}

const MOCK_TICKETS: Ticket[] = [
    { id: 'TCK-1049', subject: 'مشكلة في إتمام الدفع (سلة)', customerName: 'أحمد محمود', status: 'Open', priority: 'High', lastUpdated: 'منذ 10 دقائق' },
    { id: 'TCK-1048', subject: 'استفسار عن باقة التسويق الشاملة', customerName: 'سارة خالد', status: 'In Progress', priority: 'Medium', lastUpdated: 'منذ ساعتين', assignee: 'Mohamed' },
    { id: 'TCK-1047', subject: 'تأخر في استلام التقرير الشهري', customerName: 'شركة النور', status: 'Resolved', priority: 'Low', lastUpdated: 'منذ يوم', assignee: 'Sara' },
    { id: 'TCK-1046', subject: 'توقف موقع الويب مؤقتاً', customerName: 'مؤسسة التقنية', status: 'In Progress', priority: 'Urgent', lastUpdated: 'منذ ساعة', assignee: 'Ahmed' },
];

const STATUS_BADGES: Record<TicketStatus, string> = {
    'Open': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'In Progress': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    'Resolved': 'bg-green-500/10 text-green-500 border-green-500/20',
};

const PRIORITY_ICONS: Record<TicketPriority, { icon: string, color: string }> = {
    'Low': { icon: 'fa-arrow-down', color: 'text-gray-400' },
    'Medium': { icon: 'fa-minus', color: 'text-blue-400' },
    'High': { icon: 'fa-arrow-up', color: 'text-orange-400' },
    'Urgent': { icon: 'fa-fire', color: 'text-red-500' },
};

export const CrmTicketsPage: React.FC<CrmTicketsPageProps> = ({ brandId }) => {
    const { t } = useLanguage();
    const [filterStatus, setFilterStatus] = useState<TicketStatus | 'All'>('All');

    const filteredTickets = filterStatus === 'All' ? MOCK_TICKETS : MOCK_TICKETS.filter(t => t.status === filterStatus);

    return (
        <PageScaffold
            kicker="Support Ops"
            title="تذاكر الدعم"
            description="إدارة العملاء وحل الشكاوى وتلبية الاستفسارات الواردة."
            stats={[
                { label: 'إجمالي التذاكر', value: MOCK_TICKETS.length.toString() }
            ]}
            actions={
                <button className="btn rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-primary/20 transition-all hover:-translate-y-0.5 active:scale-95">
                    <i className="fas fa-ticket-alt me-2" />
                    تذكرة جديدة
                </button>
            }
        >
            <PageSection className="space-y-6">

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="surface-panel-soft rounded-[1.5rem] !border-0 p-5 shadow-sm text-center">
                    <div className="text-3xl font-black text-light-text dark:text-dark-text">14</div>
                    <div className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1">تذاكر مفتوحة</div>
                </div>
                <div className="surface-panel-soft rounded-[1.5rem] !border-0 p-5 shadow-sm text-center">
                    <div className="text-3xl font-black text-yellow-500">5</div>
                    <div className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1">قيد المعالجة</div>
                </div>
                <div className="surface-panel-soft rounded-[1.5rem] !border-0 p-5 shadow-sm text-center">
                    <div className="text-3xl font-black text-red-500">2</div>
                    <div className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1">تذاكر عاجلة</div>
                </div>
                <div className="surface-panel-soft rounded-[1.5rem] !border-0 p-5 shadow-sm text-center">
                    <div className="text-3xl font-black text-green-500">1h 24m</div>
                    <div className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1">متوسط سرعة الرد</div>
                </div>
            </div>

            {/* List */}
            <div className="surface-panel rounded-[2rem] overflow-hidden !border-0 shadow-[var(--shadow-ambient)]">
                {/* Filters */}
                <div className="flex gap-2 p-6 border-b border-light-border/40 dark:border-dark-border/40">
                    {(['All', 'Open', 'In Progress', 'Resolved'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => setFilterStatus(s)}
                            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                                filterStatus === s
                                    ? 'bg-brand-primary text-white shadow-sm'
                                    : 'bg-light-bg text-light-text-secondary hover:bg-light-border/50 dark:bg-dark-bg dark:text-dark-text-secondary'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="divide-y divide-light-border/40 dark:divide-dark-border/40">
                    {filteredTickets.map(ticket => (
                        <div key={ticket.id} className="group relative flex items-center justify-between p-6 transition-all hover:bg-light-bg/50 dark:hover:bg-dark-bg/50">
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-light-bg shadow-inner dark:bg-dark-bg">
                                    <i className={`fas ${PRIORITY_ICONS[ticket.priority].icon} ${PRIORITY_ICONS[ticket.priority].color}`} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-light-text dark:text-dark-text hover:text-brand-primary cursor-pointer line-clamp-1">{ticket.subject}</h4>
                                    <div className="flex items-center gap-3 mt-1.5 text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">
                                        <span className="font-mono">{ticket.id}</span>
                                        <span>•</span>
                                        <span>{ticket.customerName}</span>
                                        <span>•</span>
                                        <span>{ticket.lastUpdated}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                {ticket.assignee ? (
                                    <div className="hidden items-center gap-2 lg:flex">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary text-[10px] font-bold text-white uppercase shadow-sm">
                                            {ticket.assignee.charAt(0)}
                                        </div>
                                        <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">{ticket.assignee}</span>
                                    </div>
                                ) : (
                                    <button className="hidden lg:block text-xs font-bold border border-dashed border-light-border dark:border-dark-border px-3 py-1 rounded-lg text-light-text-secondary/50 hover:bg-light-bg transition-colors">
                                        تعيين
                                    </button>
                                )}
                                <span className={`flex items-center justify-center rounded-full border px-3 py-1 text-xs font-bold ${STATUS_BADGES[ticket.status]}`}>
                                    {ticket.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            </PageSection>
        </PageScaffold>
    );
};
