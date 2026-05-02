import React, { useState, useRef, useEffect } from 'react';
import { callBmbAgent, BmbMessage } from '../../../services/cockpitService';
import { NotificationType } from '../../../types';

interface Props {
    brandId:         string;
    addNotification: (type: NotificationType, msg: string) => void;
}

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

const SUGGESTIONS = [
    'ما أفضل حملة أداءً هذا الشهر؟',
    'هل CPA الحالي مقبول؟',
    'أي حملة يجب إيقافها الآن؟',
];

const BMBPanel: React.FC<Props> = ({ brandId, addNotification }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input,    setInput]    = useState('');
    const [loading,  setLoading]  = useState(false);
    const bottomRef  = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const send = async (text?: string) => {
        const msg = (text ?? input).trim();
        if (!msg || loading) return;

        const history: BmbMessage[] = messages.map(m => ({
            role:  m.role,
            parts: [{ text: m.text }],
        }));

        setMessages(prev => [...prev, { role: 'user', text: msg }]);
        setInput('');
        setLoading(true);

        try {
            const { reply } = await callBmbAgent(brandId, msg, history);
            setMessages(prev => [...prev, { role: 'model', text: reply }]);
        } catch (err) {
            addNotification(
                NotificationType.Error,
                err instanceof Error ? err.message : 'فشل الاتصال بالبيير',
            );
        } finally {
            setLoading(false);
            textareaRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    const isEmpty = messages.length === 0 && !loading;

    return (
        <div className="mt-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <i className="fa fa-robot text-white text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                        البيير — وكيل الميديا بايينج
                    </p>
                    <p className="text-xs text-gray-400 leading-tight">
                        اسأله عن الأداء أو اطلب خطة إعلانية أو قرارات Scale / Kill
                    </p>
                </div>
                {messages.length > 0 && (
                    <button
                        onClick={() => setMessages([])}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        محادثة جديدة
                    </button>
                )}
            </div>

            {/* Messages area */}
            <div className="h-80 overflow-y-auto px-5 py-4 bg-gray-50 dark:bg-gray-950">
                {isEmpty && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-3">
                            <i className="fa fa-comments text-indigo-400 text-xl" />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                            اسأل البيير أي سؤال عن حملاتك
                        </p>
                        <div className="flex flex-wrap justify-center gap-2 mt-4">
                            {SUGGESTIONS.map(s => (
                                <button
                                    key={s}
                                    onClick={() => send(s)}
                                    className="px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {!isEmpty && (
                    <div className="space-y-4">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'model' && (
                                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2 shadow-sm">
                                        <i className="fa fa-robot text-white text-[10px]" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                                        msg.role === 'user'
                                            ? 'bg-indigo-600 text-white rounded-br-sm'
                                            : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-bl-sm shadow-sm'
                                    }`}
                                    dir="rtl"
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex justify-start items-end gap-2">
                                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                                    <i className="fa fa-robot text-white text-[10px]" />
                                </div>
                                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>
                )}
            </div>

            {/* Input area */}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-end gap-3 bg-white dark:bg-gray-900">
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="اكتب سؤالك... (Enter للإرسال، Shift+Enter لسطر جديد)"
                    rows={1}
                    disabled={loading}
                    dir="rtl"
                    className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all disabled:opacity-60"
                    style={{ maxHeight: '120px', overflowY: 'auto' }}
                />
                <button
                    onClick={() => send()}
                    disabled={loading || !input.trim()}
                    className="flex-shrink-0 w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shadow-sm"
                >
                    <i className="fa fa-paper-plane text-sm" />
                </button>
            </div>
        </div>
    );
};

export default BMBPanel;
