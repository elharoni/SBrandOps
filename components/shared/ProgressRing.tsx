import React, { useState, useEffect } from 'react';

export interface CompletionStep {
    id: string;
    label: string;
    done: boolean;
    icon: string;
    navigateTo: string;
}

interface ProgressRingProps {
    steps: CompletionStep[];
    isCollapsed: boolean;
    onNavigate: (page: string) => void;
}

const STORAGE_KEY = 'sbrandops-setup-guide-open';

interface RingSvgProps { size: number; r: number; circ: number; offset: number; color: string; pct: number; }

const RingSvg: React.FC<RingSvgProps> = ({ size, r, circ, offset, color, pct }) => (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 40 40" width={size} height={size} className="-rotate-90">
            <circle cx="20" cy="20" r={r} fill="none" stroke="#2a2d3e" strokeWidth="4" />
            <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4"
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-bold text-dark-text" style={{ fontSize: size <= 32 ? 9 : 10 }}>
            {pct}%
        </span>
    </div>
);

export const ProgressRing: React.FC<ProgressRingProps> = ({ steps, isCollapsed: sidebarCollapsed, onNavigate }) => {
    const total = steps.length;
    const done = steps.filter(s => s.done).length;
    const pct = Math.round((done / total) * 100);

    const [open, setOpen] = useState(() => {
        try { return localStorage.getItem(STORAGE_KEY) !== 'false'; } catch { return true; }
    });

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, String(open)); } catch {}
    }, [open]);

    const r = 16;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    const color = pct === 100 ? '#10b981' : pct >= 50 ? '#6366f1' : '#f59e0b';

    if (pct === 100) return null;

    if (sidebarCollapsed) {
        return (
            <div className="flex justify-center py-3">
                <RingSvg size={36} r={r} circ={circ} offset={offset} color={color} pct={pct} />
            </div>
        );
    }

    return (
        <div className="mx-3 mb-3 rounded-2xl border border-dark-border/60 bg-dark-bg/40 overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-dark-card/50 transition-colors group"
                aria-expanded={open}
            >
                <RingSvg size={32} r={r} circ={circ} offset={offset} color={color} pct={pct} />

                <div className="flex-1 text-right min-w-0">
                    <p className="text-[11px] font-bold text-dark-text leading-tight">اكتمال الحساب</p>
                    <p className="text-[10px] text-dark-text-secondary">{done} من {total} خطوات</p>
                </div>

                <i className={`fas fa-chevron-down text-[10px] text-dark-text-secondary transition-transform duration-300 group-hover:text-dark-text ${open ? 'rotate-180' : ''}`} />
            </button>

            <div className={`grid transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    <div className="px-2 pb-2 space-y-0.5">
                        {steps.map(step => (
                            <button
                                key={step.id}
                                onClick={() => !step.done && onNavigate(step.navigateTo)}
                                disabled={step.done}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-right transition-colors ${
                                    step.done
                                        ? 'opacity-40 cursor-default'
                                        : 'hover:bg-dark-card cursor-pointer'
                                }`}
                            >
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    step.done ? 'bg-emerald-500' : 'border border-dark-border bg-dark-card'
                                }`}>
                                    {step.done
                                        ? <i className="fas fa-check text-white text-[8px]" />
                                        : <i className={`fas ${step.icon} text-dark-text-secondary text-[8px]`} />
                                    }
                                </div>
                                <span className={`text-[11px] flex-1 ${step.done ? 'line-through text-dark-text-secondary' : 'text-dark-text'}`}>
                                    {step.label}
                                </span>
                                {!step.done && <i className="fas fa-arrow-left text-[9px] text-dark-text-secondary" />}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
