import React, { useState } from 'react';
import { CockpitCampaign, CockpitKPIs } from '../../../services/cockpitService';
import CampaignCard from './CampaignCard';

interface Props {
    campaigns: CockpitCampaign[];
    kpis:      CockpitKPIs;
    loading:   boolean;
}

type FunnelFilter = 'all' | 'tofu' | 'mofu' | 'bofu';

const FUNNEL_LABELS: Record<string, { ar: string; color: string; bg: string }> = {
    tofu: { ar: 'TOFU — توعية',   color: 'text-blue-700 dark:text-blue-300',   bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
    mofu: { ar: 'MOFU — مشاركة',  color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
    bofu: { ar: 'BOFU — تحويل',  color: 'text-green-700 dark:text-green-300',  bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
};

const CPA_BY_LAYER = {
    tofu: (kpis: CockpitKPIs) => kpis.cpaTofu,
    mofu: (kpis: CockpitKPIs) => kpis.cpaMofu,
    bofu: (kpis: CockpitKPIs) => kpis.cpaBofu,
};

const CampaignsBoard: React.FC<Props> = ({ campaigns, kpis, loading }) => {
    const [filter, setFilter] = useState<FunnelFilter>('all');

    const filters: FunnelFilter[] = ['all', 'tofu', 'mofu', 'bofu'];

    const grouped = {
        tofu: campaigns.filter(c => c.funnelLayer === 'tofu'),
        mofu: campaigns.filter(c => c.funnelLayer === 'mofu'),
        bofu: campaigns.filter(c => c.funnelLayer === 'bofu'),
    };

    const layers = filter === 'all'
        ? (['tofu', 'mofu', 'bofu'] as const)
        : ([filter] as const);

    if (loading) {
        return (
            <div className="flex flex-col gap-4 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-xl" />
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Filter tabs */}
            <div className="flex items-center gap-2 flex-wrap">
                {filters.map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            filter === f
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        {f === 'all' ? 'الكل' : f.toUpperCase()}
                        <span className="ml-1.5 opacity-70">
                            ({f === 'all' ? campaigns.length : grouped[f as 'tofu' | 'mofu' | 'bofu'].length})
                        </span>
                    </button>
                ))}
            </div>

            {/* Funnel sections */}
            {layers.map(layer => {
                const layerCampaigns = grouped[layer];
                const cfg            = FUNNEL_LABELS[layer];
                const targetCpa      = CPA_BY_LAYER[layer](kpis);

                return (
                    <div key={layer}>
                        <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border ${cfg.bg}`}>
                            <span className={`text-xs font-bold uppercase tracking-wide ${cfg.color}`}>
                                {cfg.ar}
                            </span>
                            {targetCpa != null && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    هدف CPA: <span className="font-semibold">{targetCpa.toLocaleString('ar-EG')} {kpis.currency}</span>
                                </span>
                            )}
                        </div>

                        {layerCampaigns.length === 0 ? (
                            <div className="border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg px-4 py-6 text-center text-sm text-gray-400">
                                لا توجد حملات في هذا المستوى
                            </div>
                        ) : (
                            <div className="border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {layerCampaigns.map(c => (
                                    <CampaignCard
                                        key={c.id}
                                        campaign={c}
                                        targetCpa={targetCpa}
                                        currency={kpis.currency}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}

            {campaigns.length === 0 && !loading && (
                <div className="text-center py-16 text-gray-400 dark:text-gray-600">
                    <i className="fa fa-bullhorn text-4xl mb-3 opacity-30" />
                    <p className="text-sm">لا توجد حملات — قم بالمزامنة أو اربط حساب Meta Ads أولاً</p>
                </div>
            )}
        </div>
    );
};

export default CampaignsBoard;
