import React, { useState } from 'react';
import { CockpitAdAccount, CockpitKPIs, AutomationPolicy, triggerAdsSync } from '../../../services/cockpitService';
import { NotificationType } from '../../../types';

interface Props {
    brandName:        string;
    adAccount:        CockpitAdAccount | null;
    kpis:             CockpitKPIs;
    policy:           AutomationPolicy | null;
    brandId:          string;
    addNotification:  (type: NotificationType, msg: string) => void;
    onSyncComplete:   () => void;
    onEditCpa:        () => void;
    onEditPolicy:     () => void;
}

const HEALTH_CONFIG = {
    healthy:      { label: 'متصل',         className: 'text-green-600 dark:text-green-400',  icon: 'fa-circle-check' },
    degraded:     { label: 'متدهور',        className: 'text-yellow-600 dark:text-yellow-400', icon: 'fa-triangle-exclamation' },
    disconnected: { label: 'غير متصل',      className: 'text-red-600 dark:text-red-400',       icon: 'fa-circle-xmark' },
};

const MODE_CONFIG = {
    manual: { label: 'يدوي',  className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
    auto:   { label: 'تلقائي', className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
    tiered: { label: 'طبقي',  className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' },
};

function fmt(n: number, decimals = 0): string {
    return n.toLocaleString('ar-EG', { maximumFractionDigits: decimals });
}

const CockpitHeader: React.FC<Props> = ({
    brandName, adAccount, kpis, policy, brandId, addNotification, onSyncComplete, onEditCpa, onEditPolicy,
}) => {
    const [syncing, setSyncing] = useState(false);

    const handleSync = async () => {
        setSyncing(true);
        const result = await triggerAdsSync(brandId);
        setSyncing(false);
        if (result.ok) {
            addNotification(NotificationType.Success, 'تمت المزامنة — سيتم تحديث البيانات خلال لحظات');
            onSyncComplete();
        } else {
            addNotification(NotificationType.Error, result.error ?? 'فشلت المزامنة');
        }
    };

    const healthCfg   = HEALTH_CONFIG[adAccount?.connectionHealth ?? 'disconnected'];
    const modeCfg     = MODE_CONFIG[policy?.mode ?? 'manual'];
    const budgetPct   = kpis.mtdBudget ? (kpis.mtdSpend / kpis.mtdBudget) * 100 : null;

    return (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Brand + account info */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                        <i className="fab fa-facebook text-indigo-600 dark:text-indigo-400 text-lg" />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                            {brandName}
                        </h1>
                        {adAccount ? (
                            <div className="flex items-center gap-1.5 text-xs">
                                <i className={`fa ${healthCfg.icon} text-[10px] ${healthCfg.className}`} />
                                <span className={healthCfg.className}>{healthCfg.label}</span>
                                <span className="text-gray-400">·</span>
                                <span className="text-gray-500 dark:text-gray-400">{adAccount.name}</span>
                            </div>
                        ) : (
                            <span className="text-xs text-red-500">لم يُربط حساب إعلانات</span>
                        )}
                    </div>
                </div>

                {/* KPI strip */}
                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                    {/* MTD Spend */}
                    <div className="text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">الإنفاق من أول الشهر</p>
                        <p className="text-base font-bold text-gray-900 dark:text-white">
                            {fmt(kpis.mtdSpend)} <span className="text-xs font-normal text-gray-500">{kpis.currency}</span>
                        </p>
                        {budgetPct != null && (
                            <div className="mt-1 h-1 w-20 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 70 ? 'bg-yellow-500' : 'bg-indigo-500'}`}
                                    style={{ width: `${Math.min(budgetPct, 100)}%` }}
                                />
                            </div>
                        )}
                    </div>

                    {/* CPA Targets */}
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                            <p className="text-xs text-gray-500 dark:text-gray-400">أهداف CPA</p>
                            <button
                                onClick={onEditCpa}
                                className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                title="تعديل أهداف CPA"
                            >
                                <i className="fa fa-pen text-[10px]" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                            <span title="TOFU">T: {kpis.cpaTofu != null ? fmt(kpis.cpaTofu) : '–'}</span>
                            <span className="text-gray-300 dark:text-gray-600">·</span>
                            <span title="MOFU">M: {kpis.cpaMofu != null ? fmt(kpis.cpaMofu) : '–'}</span>
                            <span className="text-gray-300 dark:text-gray-600">·</span>
                            <span title="BOFU">B: {kpis.cpaBofu != null ? fmt(kpis.cpaBofu) : '–'}</span>
                        </div>
                    </div>

                    {/* Automation mode — clickable */}
                    <div className="text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">الأتمتة</p>
                        <button
                            onClick={onEditPolicy}
                            title="تعديل إعدادات الأتمتة"
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold hover:opacity-80 transition-opacity cursor-pointer ${modeCfg.className}`}
                        >
                            ● {modeCfg.label}
                            <i className="fa fa-pen text-[9px] opacity-70" />
                        </button>
                    </div>

                    {/* Sync button */}
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className={`fa fa-arrows-rotate text-xs ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'جاري...' : 'مزامنة'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CockpitHeader;
