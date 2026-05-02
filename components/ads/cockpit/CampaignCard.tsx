import React from 'react';
import { CockpitCampaign } from '../../../services/cockpitService';
import CampaignSparkline from './CampaignSparkline';

interface Props {
    campaign:  CockpitCampaign;
    targetCpa: number | null;
    currency:  string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
    live:             { label: 'نشطة',      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',  dot: 'bg-green-500' },
    paused:           { label: 'موقوفة',    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', dot: 'bg-yellow-500' },
    draft:            { label: 'مسودة',     className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',          dot: 'bg-gray-400' },
    pending_approval: { label: 'بانتظار اعتماد', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', dot: 'bg-blue-500' },
    submitted:        { label: 'مرسلة',     className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',       dot: 'bg-blue-400' },
    error:            { label: 'خطأ',       className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',           dot: 'bg-red-500' },
    killed:           { label: 'محذوفة',    className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',          dot: 'bg-gray-500' },
};

function fmt(n: number | null, decimals = 0): string {
    if (n == null) return '–';
    return n.toLocaleString('ar-EG', { maximumFractionDigits: decimals });
}

function cpaColor(cpa: number | null, target: number | null): string {
    if (cpa == null || target == null) return 'text-gray-700 dark:text-gray-300';
    if (cpa <= target)       return 'text-green-600 dark:text-green-400';
    if (cpa <= target * 1.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
}

const CampaignCard: React.FC<Props> = ({ campaign, targetCpa, currency }) => {
    const statusCfg = STATUS_CONFIG[campaign.internalStatus] ?? STATUS_CONFIG['live'];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={campaign.name}>
                        {campaign.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 capitalize">
                        {campaign.provider}
                    </p>
                </div>
                {/* Status chip */}
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusCfg.className}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                    {statusCfg.label}
                </span>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">الإنفاق 7 أيام</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {fmt(campaign.spend7d, 0)} <span className="text-xs font-normal text-gray-500">{currency}</span>
                    </p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">CPA</p>
                    <p className={`text-sm font-semibold ${cpaColor(campaign.cpa7d, targetCpa)}`}>
                        {fmt(campaign.cpa7d, 0)}
                        {campaign.cpa7d != null && <span className="text-xs font-normal text-gray-500 ml-0.5">{currency}</span>}
                    </p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">ميزانية يومية</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {fmt(campaign.budgetDaily, 0)}
                        {campaign.budgetDaily != null && <span className="text-xs font-normal text-gray-500 ml-0.5">{currency}</span>}
                    </p>
                </div>
            </div>

            {/* 7-day CPA sparkline */}
            <CampaignSparkline
                data={campaign.sparkline}
                targetCpa={targetCpa}
                height={40}
            />
        </div>
    );
};

export default CampaignCard;
