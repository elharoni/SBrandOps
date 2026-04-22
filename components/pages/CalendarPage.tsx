import React, { useState, useMemo } from 'react';
import { ScheduledPost, PostStatus, PLATFORM_ASSETS, ContentPiece, BrandHubProfile, PublisherBrief } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { SmartOccasionsPanel } from '../SmartOccasionsPanel';
import { getUpcomingOccasions, getDaysUntil } from '../../data/occasions';

type CalendarEvent = {
    id: string;
    date: Date;
    title: string;
    type: 'post' | 'task';
    data: ScheduledPost | ContentPiece;
};

interface CalendarPageProps {
    posts: ScheduledPost[];
    contentPipeline: ContentPiece[];
    onEditPost: (post: ScheduledPost) => void;
    onUpdatePost: (postId: string, updates: Partial<Omit<ScheduledPost, 'id'>>) => void;
    onDeletePost?: (id: string) => void;
    brandProfile?: BrandHubProfile;
    onSendToPublisher?: (brief: PublisherBrief) => void;
}

const CONTENT_TYPE_COLORS: { [key: string]: { bg: string; border: string; text: string } } = {
    'Blog': { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-400' },
    'Video': { bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-400' },
    'Social': { bg: 'bg-indigo-500', border: 'border-indigo-500', text: 'text-indigo-400' },
    'Task': { bg: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-400' },
    'post': { bg: 'bg-brand-blue', border: 'border-brand-blue', text: 'text-blue-400' },
};

const getEventType = (event: CalendarEvent): ContentPiece['type'] | 'post' => {
    if (event.type === 'post') return 'post';
    return (event.data as ContentPiece).type;
};


const DayDetailModal: React.FC<{
    day: Date;
    events: CalendarEvent[];
    onClose: () => void;
    onEditPost: (post: ScheduledPost) => void;
    onDeletePost?: (id: string) => void;
}> = ({ day, events, onClose, onEditPost, onDeletePost }) => {
    const { t, language } = useLanguage();
    const isToday = (() => {
        const today = new Date();
        return day.getDate() === today.getDate() && day.getMonth() === today.getMonth() && day.getFullYear() === today.getFullYear();
    })();
    const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-2xl w-full max-w-lg border border-light-border dark:border-dark-border overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-5 border-b border-light-border dark:border-dark-border flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-light-text dark:text-dark-text">
                                {day.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </h2>
                            {isToday && (
                                <span className="text-[10px] font-bold bg-brand-pink text-white px-2 py-0.5 rounded-full">اليوم</span>
                            )}
                        </div>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                            {events.length > 0 ? `${events.length} ${events.length === 1 ? 'عنصر مجدول' : 'عناصر مجدولة'}` : 'لا يوجد محتوى مجدول'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg hover:text-light-text dark:hover:text-dark-text transition-colors"
                    >
                        <i className="fas fa-times text-sm" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 max-h-[55vh] overflow-y-auto space-y-3">
                    {events.length > 0 ? events.map(event => {
                        const eventType = getEventType(event);
                        const colors = CONTENT_TYPE_COLORS[eventType];
                        const typeLabel = event.type === 'post' ? 'بوست' : (event.data as ContentPiece).type;

                        return (
                            <div key={event.id} className={`bg-light-bg dark:bg-dark-bg p-4 rounded-xl border-s-4 ${colors.border} hover:shadow-sm transition-shadow`}>
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <i className={`fas ${event.type === 'post' ? 'fa-paper-plane' : 'fa-tasks'} text-xs ${colors.text}`} />
                                        <span className="text-xs font-bold text-light-text dark:text-dark-text">
                                            {event.date.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors.bg}/20 ${colors.text}`}>
                                        {typeLabel}
                                    </span>
                                </div>
                                <p className="text-sm text-light-text dark:text-dark-text leading-relaxed line-clamp-2">{event.title}</p>
                                {event.type === 'post' && (
                                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-light-border dark:border-dark-border">
                                        <div className="flex items-center gap-1.5">
                                            {(event.data as ScheduledPost).platforms.map(p => {
                                                const asset = PLATFORM_ASSETS[p];
                                                return <i key={p} className={`${asset.icon} text-sm ${asset.textColor}`} title={p} />;
                                            })}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => onEditPost(event.data as ScheduledPost)}
                                                className="text-xs font-semibold text-brand-pink hover:text-brand-pink/80 flex items-center gap-1 transition-colors"
                                            >
                                                <i className="fas fa-pen text-[10px]" /> تعديل
                                            </button>
                                            {onDeletePost && (event.data as ScheduledPost).id && (
                                                <button
                                                    onClick={() => { onDeletePost((event.data as ScheduledPost).id!); onClose(); }}
                                                    className="text-xs font-semibold text-rose-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
                                                >
                                                    <i className="fas fa-trash text-[10px]" /> حذف
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    }) : (
                        /* Empty state with CTA */
                        <div className="text-center py-10">
                            <div className="w-16 h-16 rounded-2xl bg-light-bg dark:bg-dark-bg flex items-center justify-center mx-auto mb-4">
                                <i className="fas fa-calendar-plus text-2xl text-light-text-secondary dark:text-dark-text-secondary" />
                            </div>
                            <p className="font-semibold text-light-text dark:text-dark-text mb-1">لا يوجد محتوى مجدول</p>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
                                {isPast ? 'لم يُنشر شيء في هذا اليوم' : 'جدول بوست أو مهمة لهذا اليوم'}
                            </p>
                            {!isPast && (
                                <button
                                    onClick={onClose}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary/90 transition-colors"
                                >
                                    <i className="fas fa-plus text-xs" /> جدول محتوى جديد
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer actions */}
                {events.length > 0 && (
                    <div className="px-4 py-3 border-t border-light-border dark:border-dark-border flex justify-end">
                        <button onClick={onClose} className="text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text transition-colors">
                            إغلاق
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export const CalendarPage: React.FC<CalendarPageProps> = ({ posts, contentPipeline, onEditPost, onUpdatePost, onDeletePost, brandProfile, onSendToPublisher }) => {
    const { t, language } = useLanguage();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

    const allEvents = useMemo<CalendarEvent[]>(() => {
        const postEvents: CalendarEvent[] = posts
            .filter(p => p.status === PostStatus.Scheduled && p.scheduledAt)
            .map(p => ({
                id: `post-${p.id}`,
                date: p.scheduledAt!,
                title: p.content,
                type: 'post',
                data: p,
            }));

        const taskEvents: CalendarEvent[] = contentPipeline
            .filter(t => !!t.dueDate)
            .map(t => ({
                id: `task-${t.id}`,
                date: new Date(t.dueDate!),
                title: t.title,
                type: 'task',
                data: t,
            }));

        return [...postEvents, ...taskEvents].sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [posts, contentPipeline]);

    const eventsByDay = useMemo(() => {
        return allEvents.reduce((acc, event) => {
            const dayKey = event.date.toISOString().split('T')[0];
            if (!acc[dayKey]) {
                acc[dayKey] = [];
            }
            acc[dayKey].push(event);
            return acc;
        }, {} as Record<string, CalendarEvent[]>);
    }, [allEvents]);

    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const startingDay = firstDayOfMonth.getDay(); // 0 for Sunday, 1 for Monday...
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

    const calendarDays = useMemo(() => {
        const days = [];
        // Days from previous month
        const prevMonthDays = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
        for (let i = startingDay - 1; i >= 0; i--) {
            days.push({ day: prevMonthDays - i, isCurrentMonth: false, date: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthDays - i) });
        }
        // Days in current month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ day: i, isCurrentMonth: true, date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i) });
        }
        // Days from next month
        const remainingDays = 42 - days.length; // 6 weeks grid
        for (let i = 1; i <= remainingDays; i++) {
            days.push({ day: i, isCurrentMonth: false, date: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i) });
        }
        return days;
    }, [currentDate, startingDay, daysInMonth]);

    const goToPreviousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const goToNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const goToToday = () => setCurrentDate(new Date());

    // Week view helpers
    const getWeekStart = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        d.setDate(d.getDate() - day);
        return d;
    };
    const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
    const weekDaysArr = useMemo(() => Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
    }), [weekStart]);

    const goToPreviousWeek = () => setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
    const goToNextWeek = () => setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });

    // Hours for week view (8am-11pm)
    const HOURS = Array.from({ length: 16 }, (_, i) => i + 8);

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    };

    const weekDays = language === 'ar'
        ? [t.calendar.sunday, t.calendar.monday, t.calendar.tuesday, t.calendar.wednesday, t.calendar.thursday, t.calendar.friday, t.calendar.saturday]
        : [t.calendar.sunday, t.calendar.monday, t.calendar.tuesday, t.calendar.wednesday, t.calendar.thursday, t.calendar.friday, t.calendar.saturday];

    const locale = language === 'ar' ? 'ar-EG' : 'en-US';

    // Month-level stats
    const monthPostCount = useMemo(() => {
        return allEvents.filter(ev => {
            const d = ev.date;
            return d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth();
        }).length;
    }, [allEvents, currentDate]);

    const scheduledPostCount = useMemo(() => {
        return allEvents.filter(ev => ev.type === 'post' && ev.date >= new Date()).length;
    }, [allEvents]);

    const [showOccasions, setShowOccasions] = useState(true);
    const upcomingCount = getUpcomingOccasions(7).length;

    return (
        <div className="flex gap-4 h-[calc(100vh-8rem)]">

        {/* ── Main Calendar Column ── */}
        <div className="flex-1 min-w-0 overflow-y-auto space-y-4">
            {/* ── Header ── */}
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">{t.calendar.title}</h1>
                    <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                            <i className="fas fa-calendar-check text-brand-primary text-[10px]" />
                            {monthPostCount} عنصر هذا الشهر
                        </span>
                        {scheduledPostCount > 0 && (
                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                                <i className="fas fa-clock text-brand-pink text-[10px]" />
                                {scheduledPostCount} بوست مجدول قادم
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* View toggle */}
                    <div className="flex rounded-xl overflow-hidden border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card">
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-3 py-1.5 text-sm font-semibold transition-colors ${viewMode === 'month' ? 'bg-brand-pink text-white' : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg'}`}
                        >
                            <i className="fas fa-calendar-alt me-1.5"></i>شهر
                        </button>
                        <button
                            onClick={() => setViewMode('week')}
                            className={`px-3 py-1.5 text-sm font-semibold transition-colors ${viewMode === 'week' ? 'bg-brand-pink text-white' : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg'}`}
                        >
                            <i className="fas fa-calendar-week me-1.5"></i>أسبوع
                        </button>
                    </div>

                    {/* Navigation */}
                    <button
                        onClick={viewMode === 'month' ? goToPreviousMonth : goToPreviousWeek}
                        className="w-8 h-8 flex items-center justify-center bg-light-card dark:bg-dark-card rounded-xl border border-light-border dark:border-dark-border hover:border-brand-pink transition-colors"
                    >
                        <i className="fas fa-chevron-right text-xs text-light-text dark:text-dark-text"></i>
                    </button>
                    <button onClick={goToToday}
                        className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border px-4 py-1.5 rounded-xl text-sm font-semibold hover:border-brand-pink transition-colors text-light-text dark:text-dark-text">
                        {viewMode === 'month'
                            ? currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
                            : `${weekDaysArr[0].toLocaleDateString(locale, { day: 'numeric', month: 'short' })} — ${weekDaysArr[6].toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`
                        }
                    </button>
                    <button
                        onClick={viewMode === 'month' ? goToNextMonth : goToNextWeek}
                        className="w-8 h-8 flex items-center justify-center bg-light-card dark:bg-dark-card rounded-xl border border-light-border dark:border-dark-border hover:border-brand-pink transition-colors"
                    >
                        <i className="fas fa-chevron-left text-xs text-light-text dark:text-dark-text"></i>
                    </button>

                    <button onClick={goToToday}
                        className="px-3 py-1.5 text-sm font-semibold bg-brand-pink text-white rounded-xl hover:bg-brand-pink/90 transition-colors">
                        اليوم
                    </button>
                </div>
            </div>

            {/* ── MONTH VIEW ── */}
            {viewMode === 'month' && (
                <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-7 border-b border-light-border dark:border-dark-border">
                        {weekDays.map(day => (
                            <div key={day} className="text-center py-3 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 h-[calc(100vh-260px)]">
                        {calendarDays.map(({ day, isCurrentMonth, date }, index) => {
                            const dayKey = date.toISOString().split('T')[0];
                            const dayEvents = eventsByDay[dayKey] || [];
                            const today = isToday(date);
                            return (
                                <div
                                    key={index}
                                    onClick={() => setSelectedDay(date)}
                                    className={`group p-1.5 border-s border-b border-light-border dark:border-dark-border overflow-hidden cursor-pointer transition-colors relative
                                        ${isCurrentMonth ? 'hover:bg-light-bg dark:hover:bg-dark-bg' : 'bg-black/5 dark:bg-white/[0.02]'}
                                        ${today ? 'bg-brand-pink/5 dark:bg-brand-pink/5' : ''}`}
                                >
                                    {/* Day number */}
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-xs font-bold flex items-center justify-center
                                            ${today ? 'w-5 h-5 bg-brand-pink text-white rounded-full' : isCurrentMonth ? 'text-light-text dark:text-dark-text' : 'text-light-text-secondary/30 dark:text-dark-text-secondary/30'}`}>
                                            {day}
                                        </span>
                                        {/* Quick add button on hover */}
                                        {isCurrentMonth && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedDay(date); }}
                                                className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded flex items-center justify-center text-brand-pink hover:bg-brand-pink/10 transition-all text-[10px]"
                                                title="إضافة بوست"
                                            >
                                                <i className="fas fa-plus"></i>
                                            </button>
                                        )}
                                    </div>

                                    {/* Events */}
                                    <div className="space-y-0.5">
                                        {dayEvents.slice(0, 3).map(event => {
                                            const eventType = getEventType(event);
                                            const colors = CONTENT_TYPE_COLORS[eventType];
                                            // Show platform icon for post events
                                            const postData = event.type === 'post' ? (event.data as import('../../types').ScheduledPost) : null;
                                            return (
                                                <div key={event.id}
                                                    className={`px-1 py-0.5 rounded text-[10px] truncate flex items-center gap-1 ${colors.bg}/15 ${colors.text}`}
                                                    title={event.title}
                                                >
                                                    {postData?.platforms?.[0] && (
                                                        <i className={`${PLATFORM_ASSETS[postData.platforms[0]].icon} text-[8px] flex-shrink-0`} style={{ color: PLATFORM_ASSETS[postData.platforms[0]].hexColor }}></i>
                                                    )}
                                                    {event.type === 'task' && <i className="fas fa-tasks text-[8px] flex-shrink-0"></i>}
                                                    <span className="truncate">{event.title}</span>
                                                </div>
                                            );
                                        })}
                                        {dayEvents.length > 3 && (
                                            <div className="text-[10px] text-brand-pink font-semibold px-1">+{dayEvents.length - 3} أخرى</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── WEEK VIEW ── */}
            {viewMode === 'week' && (
                <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl overflow-hidden">
                    {/* Day headers */}
                    <div className="grid grid-cols-8 border-b border-light-border dark:border-dark-border">
                        <div className="py-3 px-2 text-xs text-light-text-secondary dark:text-dark-text-secondary"></div>
                        {weekDaysArr.map((d, i) => {
                            const today = isToday(d);
                            return (
                                <div key={i} className={`py-3 text-center border-s border-light-border dark:border-dark-border ${today ? 'bg-brand-pink/5' : ''}`}>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-semibold">
                                        {d.toLocaleDateString(locale, { weekday: 'short' })}
                                    </p>
                                    <span className={`text-sm font-bold mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full
                                        ${today ? 'bg-brand-pink text-white' : 'text-light-text dark:text-dark-text'}`}>
                                        {d.getDate()}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Time grid */}
                    <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
                        {HOURS.map(hour => (
                            <div key={hour} className="grid grid-cols-8 border-b border-light-border/50 dark:border-dark-border/50 min-h-[56px]">
                                <div className="px-2 py-1 text-[10px] text-light-text-secondary dark:text-dark-text-secondary text-left flex-shrink-0 border-e border-light-border dark:border-dark-border">
                                    {hour}:00
                                </div>
                                {weekDaysArr.map((d, di) => {
                                    const dayKey = d.toISOString().split('T')[0];
                                    const hourEvents = (eventsByDay[dayKey] || []).filter(ev => {
                                        const evHour = ev.date.getHours();
                                        return evHour === hour;
                                    });
                                    const today = isToday(d);
                                    return (
                                        <div key={di}
                                            onClick={() => setSelectedDay(d)}
                                            className={`border-s border-light-border/50 dark:border-dark-border/50 p-0.5 cursor-pointer group hover:bg-light-bg dark:hover:bg-dark-bg transition-colors relative
                                                ${today ? 'bg-brand-pink/5' : ''}`}
                                        >
                                            {hourEvents.map(ev => {
                                                const postData = ev.type === 'post' ? (ev.data as import('../../types').ScheduledPost) : null;
                                                const eventType = getEventType(ev);
                                                const colors = CONTENT_TYPE_COLORS[eventType];
                                                return (
                                                    <div key={ev.id}
                                                        className={`text-[10px] px-1.5 py-1 rounded-lg mb-0.5 ${colors.bg}/20 ${colors.text} border-s-2 ${colors.border} flex items-center gap-1`}
                                                        title={ev.title}
                                                    >
                                                        {postData?.platforms?.[0] && (
                                                            <i className={`${PLATFORM_ASSETS[postData.platforms[0]].icon} text-[9px]`} style={{ color: PLATFORM_ASSETS[postData.platforms[0]].hexColor }}></i>
                                                        )}
                                                        <span className="truncate font-medium">{ev.title}</span>
                                                    </div>
                                                );
                                            })}
                                            {/* Hover add button */}
                                            <button className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                {hourEvents.length === 0 && (
                                                    <span className="text-[10px] text-brand-pink font-semibold bg-brand-pink/10 rounded px-1 py-0.5">+ بوست</span>
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Day Detail Modal */}
            {selectedDay && (
                <DayDetailModal
                    day={selectedDay}
                    events={eventsByDay[selectedDay.toISOString().split('T')[0]] || []}
                    onClose={() => setSelectedDay(null)}
                    onEditPost={onEditPost}
                    onDeletePost={onDeletePost}
                />
            )}
        </div>

        {/* Smart Occasions Sidebar */}
        {brandProfile && onSendToPublisher && (
            <div className={`flex-shrink-0 transition-all duration-300 ${showOccasions ? 'w-80 xl:w-96' : 'w-12'} hidden lg:flex flex-col`}>
                {showOccasions ? (
                    <div className="flex-1 rounded-2xl border border-dark-border bg-dark-card overflow-hidden flex flex-col">
                        <SmartOccasionsPanel
                            brandProfile={brandProfile}
                            onSendToPublisher={onSendToPublisher}
                        />
                    </div>
                ) : (
                    <button
                        onClick={() => setShowOccasions(true)}
                        className="flex-1 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dark-border bg-dark-card hover:border-brand-primary/50 transition-colors group"
                        title="فتح محرك المناسبات"
                    >
                        <i className="fas fa-calendar-star text-dark-text-secondary group-hover:text-brand-primary transition-colors" />
                        {upcomingCount > 0 && (
                            <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                                {upcomingCount}
                            </span>
                        )}
                    </button>
                )}
                <button
                    onClick={() => setShowOccasions(s => !s)}
                    className="mt-2 h-8 w-full flex items-center justify-center rounded-xl border border-dark-border text-dark-text-secondary hover:text-brand-primary hover:border-brand-primary/50 transition-colors text-xs gap-1.5"
                >
                    <i className={`fas fa-chevron-${showOccasions ? 'right' : 'left'} text-[10px]`} />
                    {showOccasions ? 'إخفاء' : ''}
                </button>
            </div>
        )}

        </div>
    );
};