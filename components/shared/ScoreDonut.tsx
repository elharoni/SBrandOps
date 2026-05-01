import React from 'react';

interface ScoreDonutProps {
    score: number;
    labelAr?: string;
    labelEn?: string;
    size?: number;
    strokeWidth?: number;
}

export const ScoreDonut: React.FC<ScoreDonutProps> = ({
    score,
    labelAr = 'درجة الاتساق',
    labelEn,
    size = 48,
    strokeWidth = 10,
}) => {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    const color =
        score >= 85 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';

    return (
        <div className={`relative mx-auto`} style={{ width: size * 4, height: size * 4 }}>
            <svg
                className="w-full h-full transform -rotate-90"
                viewBox="0 0 100 100"
            >
                <circle
                    className="text-light-bg dark:text-dark-bg"
                    cx="50" cy="50" r={radius}
                    fill="none" stroke="currentColor"
                    strokeWidth={strokeWidth}
                />
                <circle
                    className={color}
                    cx="50" cy="50" r={radius}
                    fill="none" stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    {labelEn ?? labelAr}
                </span>
                <span className={`text-5xl font-bold ${color}`}>{score}</span>
            </div>
        </div>
    );
};
