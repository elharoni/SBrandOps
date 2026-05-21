/**
 * AdsMediaBuyerCockpit — Route: /brands/:brandId/ads-cockpit
 *
 * M1: real campaign data grouped by funnel layer, 7-day CPA sparklines, MTD KPIs, sync.
 * M2: BMB chat panel (البيير) + CPA targets CRUD editor.
 * M4-B: Automation mode editor (semi-auto / full-auto with pg_cron scheduling).
 */

import React, { useEffect, useState, useCallback } from 'react';
import { NotificationType } from '../../types';
import {
    CockpitCampaign,
    CockpitKPIs,
    CockpitAdAccount,
    AutomationPolicy,
    getCockpitCampaigns,
    getCockpitKPIs,
    getCockpitAdAccount,
    getAutomationPolicy,
} from '../../services/cockpitService';
import CockpitHeader          from '../ads/cockpit/CockpitHeader';
import CampaignsBoard         from '../ads/cockpit/CampaignsBoard';
import DecisionsPanel         from '../ads/cockpit/DecisionsPanel';
import BMBPanel               from '../ads/cockpit/BMBPanel';
import CPATargetsEditor       from '../ads/cockpit/CPATargetsEditor';
import AutomationPolicyEditor from '../ads/cockpit/AutomationPolicyEditor';
import MediaPlannerPanel      from '../ads/cockpit/MediaPlannerPanel';

interface Props {
    brandId:         string;
    brandName:       string;
    addNotification: (type: NotificationType, msg: string) => void;
}

const AdsMediaBuyerCockpit: React.FC<Props> = ({ brandId, brandName, addNotification }) => {
    const [campaigns,    setCampaigns]    = useState<CockpitCampaign[]>([]);
    const [kpis,         setKpis]         = useState<CockpitKPIs>({ mtdSpend: 0, mtdBudget: null, cpaTofu: null, cpaMofu: null, cpaBofu: null, currency: 'EGP' });
    const [adAccount,    setAdAccount]    = useState<CockpitAdAccount | null>(null);
    const [policy,       setPolicy]       = useState<AutomationPolicy | null>(null);
    const [loading,         setLoading]         = useState(true);
    const [showCpaEditor,   setShowCpaEditor]   = useState(false);
    const [showPolicyEditor, setShowPolicyEditor] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [camps, kpisData, account, pol] = await Promise.all([
                getCockpitCampaigns(brandId),
                getCockpitKPIs(brandId),
                getCockpitAdAccount(brandId),
                getAutomationPolicy(brandId),
            ]);
            setCampaigns(camps);
            setKpis(kpisData);
            setAdAccount(account);
            setPolicy(pol);
        } catch (e) {
            console.error('[Cockpit] loadData error:', e);
            addNotification(NotificationType.Error, 'فشل تحميل بيانات الكوكبت');
        } finally {
            setLoading(false);
        }
    }, [brandId, addNotification]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleCpaSaved = (next: { tofu: number | null; mofu: number | null; bofu: number | null }) => {
        setKpis(prev => ({
            ...prev,
            cpaTofu: next.tofu,
            cpaMofu: next.mofu,
            cpaBofu: next.bofu,
        }));
    };

    return (
        <div className="flex flex-col h-full min-h-screen bg-gray-50 dark:bg-gray-950">
            {/* Header */}
            <CockpitHeader
                brandName={brandName}
                adAccount={adAccount}
                kpis={kpis}
                policy={policy}
                brandId={brandId}
                addNotification={addNotification}
                onSyncComplete={loadData}
                onEditCpa={() => setShowCpaEditor(true)}
                onEditPolicy={() => setShowPolicyEditor(true)}
            />

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                    {/* Ad account missing warning */}
                    {!loading && !adAccount && (
                        <div className="mb-6 flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                            <i className="fa fa-triangle-exclamation text-yellow-500 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                                    لم يُربط حساب Meta Ads بعد
                                </p>
                                <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
                                    اذهب إلى إعدادات التكامل وارتبط بحسابك الإعلاني لتظهر الحملات هنا.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Campaigns board */}
                    <CampaignsBoard
                        campaigns={campaigns}
                        kpis={kpis}
                        loading={loading}
                    />

                    {/* Decisions Engine Panel */}
                    <DecisionsPanel
                        brandId={brandId}
                        currency={kpis.currency}
                        addNotification={addNotification}
                    />

                    {/* BMB Chat Panel */}
                    <BMBPanel
                        brandId={brandId}
                        addNotification={addNotification}
                    />

                    {/* Media Plan Generator */}
                    <MediaPlannerPanel
                        brandId={brandId}
                        currency={kpis.currency}
                        addNotification={addNotification}
                    />
                </div>
            </div>

            {/* CPA Targets Editor modal */}
            {showCpaEditor && (
                <CPATargetsEditor
                    brandId={brandId}
                    currency={kpis.currency}
                    initial={{ tofu: kpis.cpaTofu, mofu: kpis.cpaMofu, bofu: kpis.cpaBofu }}
                    onSaved={handleCpaSaved}
                    onClose={() => setShowCpaEditor(false)}
                    addNotification={addNotification}
                />
            )}

            {/* Automation Policy Editor modal */}
            {showPolicyEditor && (
                <AutomationPolicyEditor
                    brandId={brandId}
                    currency={kpis.currency}
                    initial={policy}
                    onSaved={setPolicy}
                    onClose={() => setShowPolicyEditor(false)}
                    addNotification={addNotification}
                />
            )}
        </div>
    );
};

export default AdsMediaBuyerCockpit;
