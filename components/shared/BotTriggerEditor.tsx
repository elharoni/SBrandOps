// components/shared/BotTriggerEditor.tsx
// ──────────────────────────────────────────────────────────────────────────────
// محرر إعدادات الـ Trigger البصري — بديل حقل النص العادي
// ──────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef } from 'react';
import { BotTrigger } from '../../types';

export interface TriggerConfig {
    trigger:         BotTrigger;
    triggerKeywords: string;    // CSV
    replyDelayMin:   number;    // seconds 0–60
    platforms:       string[];  // 'facebook' | 'instagram' | 'all'
    workingHours:    boolean;
    workStart:       number;    // 0–23
    workEnd:         number;    // 0–23
}

export const DEFAULT_TRIGGER_CONFIG: TriggerConfig = {
    trigger:         'dm-received',
    triggerKeywords: '',
    replyDelayMin:   5,
    platforms:       ['all'],
    workingHours:    false,
    workStart:       9,
    workEnd:         23,
};

interface BotTriggerEditorProps {
    value:    TriggerConfig;
    onChange: (v: TriggerConfig) => void;
    gradient?: string; // template gradient class
}

const TRIGGER_OPTIONS = [
    { v: 'dm-received'   as BotTrigger, icon: 'fa-envelope',     label: 'رسالة مباشرة (DM)', desc: 'يرد على كل رسالة خاصة جديدة' },
    { v: 'keyword-match' as BotTrigger, icon: 'fa-key',          label: 'كلمة مفتاحية',       desc: 'يتدخل عند وجود كلمة محددة' },
    { v: 'comment-reply' as BotTrigger, icon: 'fa-comment',      label: 'تعليق على منشور',    desc: 'يرد تلقائياً على التعليقات' },
    { v: 'manual'        as BotTrigger, icon: 'fa-hand-pointer',  label: 'يدوي',               desc: 'أنت من يقرر متى يبدأ البوت' },
];

const PLATFORM_OPTIONS = [
    { v: 'all',       icon: 'fa-globe',       label: 'كل المنصات',  color: 'text-violet-500' },
    { v: 'facebook',  icon: 'fa-facebook',    label: 'Facebook',    color: 'text-blue-500' },
    { v: 'instagram', icon: 'fa-instagram',   label: 'Instagram',   color: 'text-pink-500' },
];

export const BotTriggerEditor: React.FC<BotTriggerEditorProps> = ({ value, onChange, gradient = 'from-violet-600 to-purple-600' }) => {
    const [keywordInput, setKeywordInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const keywords = value.triggerKeywords
        ? value.triggerKeywords.split(',').map(k => k.trim()).filter(Boolean)
        : [];

    const addKeyword = (kw: string) => {
        const trimmed = kw.trim().replace(/,/g, '');
        if (!trimmed || keywords.includes(trimmed)) return;
        const next = [...keywords, trimmed].join(', ');
        onChange({ ...value, triggerKeywords: next });
        setKeywordInput('');
    };

    const removeKeyword = (kw: string) => {
        const next = keywords.filter(k => k !== kw).join(', ');
        onChange({ ...value, triggerKeywords: next });
    };

    const togglePlatform = (p: string) => {
        if (p === 'all') {
            onChange({ ...value, platforms: ['all'] });
            return;
        }
        const without = value.platforms.filter(x => x !== 'all' && x !== p);
        const next = value.platforms.includes(p) ? without : [...without, p];
        onChange({ ...value, platforms: next.length ? next : ['all'] });
    };

    return (
        <div className="space-y-5">
            <p className="text-sm font-bold text-light-text dark:text-dark-text">الخطوة 4: متى وأين يعمل البوت؟</p>

            {/* ── Trigger type ────────────────────────────────────────────── */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">نوع التشغيل</label>
                <div className="grid grid-cols-2 gap-2">
                    {TRIGGER_OPTIONS.map(opt => (
                        <button
                            key={opt.v}
                            onClick={() => onChange({ ...value, trigger: opt.v })}
                            className={`flex items-start gap-3 p-3 rounded-xl border text-start transition-all ${
                                value.trigger === opt.v
                                    ? 'border-violet-500 bg-violet-500/8 dark:bg-violet-500/10'
                                    : 'border-light-border dark:border-dark-border hover:border-violet-400/50'
                            }`}
                        >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                value.trigger === opt.v ? 'bg-violet-500 text-white' : 'bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary'
                            }`}>
                                <i className={`fas ${opt.icon} text-xs`} />
                            </div>
                            <div className="min-w-0">
                                <p className={`text-xs font-bold ${value.trigger === opt.v ? 'text-violet-600 dark:text-violet-400' : 'text-light-text dark:text-dark-text'}`}>
                                    {opt.label}
                                </p>
                                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5 leading-tight">{opt.desc}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Keywords chips (only for keyword-match) ──────────────────── */}
            {value.trigger === 'keyword-match' && (
                <div>
                    <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-2 block">
                        الكلمات المفتاحية المُحفِّزة
                    </label>
                    <div
                        className="min-h-[48px] flex flex-wrap gap-1.5 p-2 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg cursor-text"
                        onClick={() => inputRef.current?.focus()}
                    >
                        {keywords.map(kw => (
                            <span key={kw} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-xs font-bold text-violet-700 dark:text-violet-300">
                                {kw}
                                <button onClick={() => removeKeyword(kw)} className="hover:text-red-500 transition">
                                    <i className="fas fa-times text-[9px]" />
                                </button>
                            </span>
                        ))}
                        <input
                            ref={inputRef}
                            value={keywordInput}
                            onChange={e => setKeywordInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKeyword(keywordInput); }
                                if (e.key === 'Backspace' && !keywordInput && keywords.length) removeKeyword(keywords[keywords.length - 1]);
                            }}
                            placeholder={keywords.length ? '' : 'اكتب كلمة + Enter...'}
                            className="flex-1 min-w-[120px] bg-transparent text-xs text-light-text dark:text-dark-text outline-none placeholder:text-light-text-secondary/50 dark:placeholder:text-dark-text-secondary/50"
                        />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                        {['سعر', 'كم', 'price', 'buy', 'اشتري', 'خصم', 'offer'].map(s => (
                            !keywords.includes(s) && (
                                <button
                                    key={s}
                                    onClick={() => addKeyword(s)}
                                    className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition"
                                >
                                    + {s}
                                </button>
                            )
                        ))}
                    </div>
                </div>
            )}

            {/* ── Platforms ─────────────────────────────────────────────────── */}
            <div>
                <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-2 block">المنصات</label>
                <div className="flex gap-2">
                    {PLATFORM_OPTIONS.map(p => {
                        const active = value.platforms.includes(p.v);
                        return (
                            <button
                                key={p.v}
                                onClick={() => togglePlatform(p.v)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-bold transition-all ${
                                    active
                                        ? `border-transparent bg-gradient-to-r ${gradient} text-white shadow-sm`
                                        : 'border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-violet-400/50'
                                }`}
                            >
                                <i className={`fab ${p.icon} ${active ? 'text-white' : p.color}`} />
                                {p.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Reply delay ───────────────────────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">
                        تأخير الرد <span className="text-violet-500 font-bold">{value.replyDelayMin}ث</span>
                    </label>
                    <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">يبدو أكثر طبيعية</span>
                </div>
                <div className="relative">
                    <input
                        type="range"
                        min={0}
                        max={60}
                        step={5}
                        value={value.replyDelayMin}
                        onChange={e => onChange({ ...value, replyDelayMin: +e.target.value })}
                        className="w-full accent-violet-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                        <span>فوري</span>
                        <span>30ث</span>
                        <span>60ث</span>
                    </div>
                </div>
            </div>

            {/* ── Working hours ─────────────────────────────────────────────── */}
            <div className={`rounded-xl border transition-all overflow-hidden ${value.workingHours ? 'border-violet-500/40' : 'border-light-border dark:border-dark-border'}`}>
                <button
                    className="w-full flex items-center justify-between px-4 py-3"
                    onClick={() => onChange({ ...value, workingHours: !value.workingHours })}
                >
                    <div className="flex items-center gap-2">
                        <i className="fas fa-clock text-sm text-light-text-secondary dark:text-dark-text-secondary" />
                        <div className="text-start">
                            <p className="text-xs font-bold text-light-text dark:text-dark-text">ساعات العمل</p>
                            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">لا يرد خارج الأوقات المحددة</p>
                        </div>
                    </div>
                    <div className={`relative w-10 h-5 rounded-full transition-colors ${value.workingHours ? 'bg-violet-500' : 'bg-light-border dark:bg-dark-border'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${value.workingHours ? 'left-5' : 'left-0.5'}`} />
                    </div>
                </button>
                {value.workingHours && (
                    <div className="px-4 pb-4 space-y-3 border-t border-light-border dark:border-dark-border pt-3">
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1 block">من</label>
                                <div className="flex items-center gap-1 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-3 py-1.5">
                                    <i className="fas fa-sun text-amber-400 text-xs" />
                                    <select
                                        value={value.workStart}
                                        onChange={e => onChange({ ...value, workStart: +e.target.value })}
                                        className="flex-1 bg-transparent text-xs text-light-text dark:text-dark-text outline-none"
                                    >
                                        {Array.from({ length: 24 }, (_, i) => (
                                            <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="text-light-text-secondary dark:text-dark-text-secondary text-xs mt-4">→</div>
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1 block">إلى</label>
                                <div className="flex items-center gap-1 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-3 py-1.5">
                                    <i className="fas fa-moon text-indigo-400 text-xs" />
                                    <select
                                        value={value.workEnd}
                                        onChange={e => onChange({ ...value, workEnd: +e.target.value })}
                                        className="flex-1 bg-transparent text-xs text-light-text dark:text-dark-text outline-none"
                                    >
                                        {Array.from({ length: 24 }, (_, i) => (
                                            <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                            <i className="fas fa-info-circle me-1" />
                            خارج هذه الأوقات يُرسَل رد اعتذار تلقائي
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
