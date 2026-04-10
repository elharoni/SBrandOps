// components/ContentScoreBadge.tsx
// AI Content Score Badge — يظهر على كل كارت محتوى
// يعرض الـ score مع لون ديناميكي + تفاصيل عند الضغط

import React, { useState } from 'react';
import type { ContentScoreResult } from '../services/contentScoringService';

// ── Score Color Logic ─────────────────────────────────────────────────────

export function getScoreColor(score: number): {
  text: string;
  bg: string;
  ring: string;
  bar: string;
  label: string;
} {
  if (score >= 80) return {
    text: 'text-green-500',
    bg: 'bg-green-500/10',
    ring: 'ring-green-500/30',
    bar: 'bg-green-500',
    label: 'ممتاز',
  };
  if (score >= 65) return {
    text: 'text-blue-400',
    bg: 'bg-blue-400/10',
    ring: 'ring-blue-400/30',
    bar: 'bg-blue-400',
    label: 'جيد',
  };
  if (score >= 50) return {
    text: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    ring: 'ring-yellow-400/30',
    bar: 'bg-yellow-400',
    label: 'مقبول',
  };
  return {
    text: 'text-red-400',
    bg: 'bg-red-400/10',
    ring: 'ring-red-400/30',
    bar: 'bg-red-400',
    label: 'ضعيف',
  };
}

// ── Mini Badge (on card) ──────────────────────────────────────────────────

interface ContentScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export const ContentScoreBadge: React.FC<ContentScoreBadgeProps> = ({
  score,
  size = 'sm',
  showLabel = false,
}) => {
  const colors = getScoreColor(score);
  const isSmall = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold border
        ${colors.bg} ${colors.text}
        ${isSmall
          ? 'text-[10px] px-1.5 py-0.5 border-transparent'
          : 'text-xs px-2 py-1 border-current/20'
        }`}
      title={`Content Score: ${score}/100`}
    >
      <i className="fas fa-star-half-stroke text-[9px]" />
      {score}
      {showLabel && <span className="font-normal opacity-80">/ 100 · {colors.label}</span>}
    </span>
  );
};

// ── Score Circle (large — for modal) ─────────────────────────────────────

interface ScoreCircleProps {
  score: number;
}

export const ScoreCircle: React.FC<ScoreCircleProps> = ({ score }) => {
  const colors = getScoreColor(score);
  const circumference = 2 * Math.PI * 15.9155;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor"
          className="text-dark-bg" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor"
          className={colors.text}
          strokeWidth="3"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-black ${colors.text}`}>{score}</span>
        <span className="text-[9px] text-dark-text-secondary font-medium">/ 100</span>
      </div>
    </div>
  );
};

// ── Score Dimension Bar ───────────────────────────────────────────────────

interface DimensionBarProps {
  label: string;
  score: number;
  weight: string;
  feedback: string;
}

const DimensionBar: React.FC<DimensionBarProps> = ({ label, score, weight, feedback }) => {
  const colors = getScoreColor(score);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-dark-text">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-dark-text-secondary opacity-70">{weight}</span>
          <span className={`text-xs font-bold ${colors.text}`}>{score}</span>
        </div>
      </div>
      <div className="w-full bg-dark-bg h-1.5 rounded-full overflow-hidden">
        <div
          className={`${colors.bar} h-1.5 rounded-full transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-[11px] text-dark-text-secondary leading-relaxed">{feedback}</p>
    </div>
  );
};

// ── Full Score Panel (in modal / drawer) ─────────────────────────────────

interface ContentScorePanelProps {
  result: ContentScoreResult;
  isLoading?: boolean;
  onRescore?: () => void;
}

export const ContentScorePanel: React.FC<ContentScorePanelProps> = ({
  result,
  isLoading = false,
  onRescore,
}) => {
  const [expanded, setExpanded] = useState(false);
  const colors = getScoreColor(result.totalScore);

  const ctrConfig = {
    low: { label: 'CTR منخفض', icon: 'fa-arrow-trend-down', color: 'text-red-400' },
    medium: { label: 'CTR متوسط', icon: 'fa-minus', color: 'text-yellow-400' },
    high: { label: 'CTR عالي', icon: 'fa-arrow-trend-up', color: 'text-green-400' },
  };
  const ctr = ctrConfig[result.predictedCtr];

  if (isLoading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 flex items-center gap-3">
        <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-dark-text">جاري تقييم المحتوى...</p>
          <p className="text-xs text-dark-text-secondary">يحلل الـ AI هوية البراند والأداء التاريخي</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-xl overflow-hidden ${colors.ring} ring-1`} dir="rtl">
      {/* Header */}
      <div className={`${colors.bg} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <ScoreCircle score={result.totalScore} />
          <div>
            <p className="text-xs text-dark-text-secondary font-medium">AI Content Score</p>
            <p className={`text-lg font-black ${colors.text}`}>{colors.label}</p>
            <div className={`flex items-center gap-1 mt-0.5 text-xs ${ctr.color}`}>
              <i className={`fas ${ctr.icon} text-[10px]`} />
              <span>{ctr.label} متوقع</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {onRescore && (
            <button
              onClick={onRescore}
              className="text-[11px] text-dark-text-secondary hover:text-brand-primary transition-colors flex items-center gap-1"
            >
              <i className="fas fa-rotate-right text-[10px]" />
              إعادة التقييم
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-dark-text-secondary hover:text-brand-primary transition-colors flex items-center gap-1"
          >
            <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} text-[10px]`} />
            {expanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
          </button>
        </div>
      </div>

      {/* Top Improvement (always visible) */}
      <div className="px-4 py-3 bg-dark-card border-t border-dark-border flex items-start gap-2.5">
        <div className="w-5 h-5 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <i className="fas fa-lightbulb text-brand-primary text-[10px]" />
        </div>
        <p className="text-xs text-dark-text leading-relaxed">
          <span className="font-bold text-brand-primary">أهم تحسين: </span>
          {result.topImprovement}
        </p>
      </div>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="px-4 py-4 bg-dark-card border-t border-dark-border space-y-4">
          <DimensionBar
            label="تطابق الـ Brand DNA"
            score={result.breakdown.dnaMatch.score}
            weight="40%"
            feedback={result.breakdown.dnaMatch.feedback}
          />
          <DimensionBar
            label="الأداء التاريخي"
            score={result.breakdown.historicalPerformance.score}
            weight="35%"
            feedback={result.breakdown.historicalPerformance.feedback}
          />
          <DimensionBar
            label="Cross-Brand Benchmark"
            score={result.breakdown.crossBrandBenchmark.score}
            weight="25%"
            feedback={result.breakdown.crossBrandBenchmark.feedback}
          />
        </div>
      )}
    </div>
  );
};
