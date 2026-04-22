import React from 'react';

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

export const ProgressRing: React.FC<ProgressRingProps> = ({ steps, isCollapsed, onNavigate }) => {
    const total = steps.length;
    const done = steps.filter(s => s.done).length;
    const pct = Math.round((done / total) * 100);

    const r = 20;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;

    const color = pct === 100 ? '#10b981' : pct >= 50 ? '#6366f1' : '#f59e0b';

    if (isCollapsed) {
        return (
            <div className="flex justify-center py-3">
                <div className="relative w-10 h-10">
                    <svg viewBox="0 0 48 48" className="w-10 h-10 -rotate-90">
                        <circle cx="24" cy="24" r={r} fill="none" stroke="#2a2d3e" strokeWidth="5" />
                        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="5"
                            strokeDasharray={circ} strokeDashoffset={offset}
                            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-dark-text">
                        {pct}%
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-3 mb-3 rounded-2xl border border-dark-border bg-dark-bg/50 p-3">
            <div className="flex items-center gap-3 mb-3">
                {/* Ring */}
                <div className="relative w-12 h-12 flex-shrink-0">
                    <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
                        <circle cx="24" cy="24" r={r} fill="none" stroke="#2a2d3e" strokeWidth="5" />
                        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="5"
                            strokeDasharray={circ} strokeDashoffset={offset}
                            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-dark-text">
                        {pct}%
                    </span>
                </div>
                <div>
                    <p className="text-xs font-bold text-dark-text">
                        {pct === 100 ? '🎉 حسابك مكتمل!' : 'اكتمال الحساب'}
                    </p>
                    <p className="text-[11px] text-dark-text-secondary">{done} من {total} خطوات</p>
                </div>
            </div>

            <div className="space-y-1.5">
                {steps.map(step => (
                    <button key={step.id} onClick={() => !step.done && onNavigate(step.navigateTo)}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-right transition-colors ${
                            step.done
                                ? 'opacity-50 cursor-default'
                                : 'hover:bg-dark-card cursor-pointer'
                        }`}>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            step.done ? 'bg-emerald-500' : 'border border-dark-border bg-dark-card'
                        }`}>
                            {step.done
                                ? <i className="fas fa-check text-white text-[9px]" />
                                : <i className={`fas ${step.icon} text-dark-text-secondary text-[9px]`} />
                            }
                        </div>
                        <span className={`text-[11px] ${step.done ? 'line-through text-dark-text-secondary' : 'text-dark-text'}`}>
                            {step.label}
                        </span>
                        {!step.done && <i className="fas fa-arrow-left text-[9px] text-dark-text-secondary mr-auto" />}
                    </button>
                ))}
            </div>
        </div>
    );
};
