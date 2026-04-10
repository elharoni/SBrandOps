import React, { useState } from 'react';

interface ContextualAIChipProps {
    message: string;
    type?: 'insight' | 'warning' | 'opportunity';
    position?: 'top' | 'bottom' | 'left' | 'right';
}

export const ContextualAIChip: React.FC<ContextualAIChipProps> = ({ message, type = 'insight', position = 'top' }) => {
    const [isHovered, setIsHovered] = useState(false);

    const getIcon = () => {
        if (type === 'warning') return 'fa-exclamation-triangle';
        if (type === 'opportunity') return 'fa-rocket';
        return 'fa-sparkles';
    };

    const getColorClass = () => {
        if (type === 'warning') return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
        if (type === 'opportunity') return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
        return 'text-purple-500 bg-purple-500/10 border-purple-500/30';
    };

    const getTypeColorText = () => {
        if (type === 'warning') return 'text-amber-500';
        if (type === 'opportunity') return 'text-emerald-500';
        return 'text-purple-500';
    };

    const getPositionClass = () => {
        switch (position) {
            case 'bottom': return 'top-full left-1/2 -translate-x-1/2 mt-2';
            case 'left': return 'right-full top-1/2 -translate-y-1/2 mr-2';
            case 'right': return 'left-full top-1/2 -translate-y-1/2 ml-2';
            case 'top': default: return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
        }
    };

    return (
        <div className="relative inline-flex items-center" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            <div className={`flex h-6 w-6 cursor-help items-center justify-center rounded-full border border-solid ${getColorClass()} shadow-sm transition-transform duration-300 hover:scale-110`}>
                <i className={`fas ${getIcon()} text-[10px] opacity-80`} />
            </div>

            {isHovered && (
                <div className={`absolute z-50 w-52 rounded-xl border border-light-border/50 bg-light-surface/95 p-3 shadow-2xl backdrop-blur-xl dark:border-dark-border/50 dark:bg-dark-surface/95 ${getPositionClass()} animate-fade-in-up`}>
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                        <i className={`fas ${getIcon()} ${getTypeColorText()}`} />
                        سياق الذكاء الاصطناعي
                    </p>
                    <p className="mt-1.5 text-xs font-medium leading-relaxed text-light-text dark:text-dark-text">
                        {message}
                    </p>
                </div>
            )}
        </div>
    );
};
