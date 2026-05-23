// components/shared/ShiftModeManager.tsx
// ─────────────────────────────────────────────────────────────────────────────
// مدير الشيفتات — زر استلام/تسليم الشيفت + Banner واضح
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import { NotificationType } from '../../types';
import {
    BrandAgentConfig, BrandAgentShiftMode,
    startShift, endShift,
} from '../../services/brandAgentService';

interface ShiftModeManagerProps {
    config: BrandAgentConfig;
    onConfigChange: (updated: BrandAgentConfig) => void;
    addNotification: (type: NotificationType, msg: string) => void;
    compact?: boolean;
}

export const ShiftModeManager: React.FC<ShiftModeManagerProps> = ({
    config, onConfigChange, addNotification, compact = false,
}) => {
    const [showModal, setShowModal]           = useState(false);
    const [moderatorName, setModeratorName]   = useState('');
    const [loading, setLoading]               = useState(false);
    const [liveTimer, setLiveTimer]           = useState('');
    const timerRef                            = useRef<ReturnType<typeof setInterval> | null>(null);

    const isHumanShift = config.shiftMode === 'human';

    // ── Live timer ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (!isHumanShift || !config.shiftStartedAt) { setLiveTimer(''); return; }

        const tick = () => {
            const diff = Date.now() - new Date(config.shiftStartedAt!).getTime();
            const totalSecs = Math.floor(diff / 1000);
            const h = Math.floor(totalSecs / 3600);
            const m = Math.floor((totalSecs % 3600) / 60);
            const s = totalSecs % 60;
            setLiveTimer([h > 0 ? String(h).padStart(2, '0') : null, String(m).padStart(2, '0'), String(s).padStart(2, '0')].filter(Boolean).join(':'));
        };
        tick();
        timerRef.current = setInterval(tick, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isHumanShift, config.shiftStartedAt]);

    const handleStartShift = async () => {
        if (!moderatorName.trim()) return;
        setLoading(true);
        try {
            const updated = await startShift(config.brandId, moderatorName.trim());
            onConfigChange(updated);
            addNotification(NotificationType.Info, `👤 ${moderatorName} استلم الشيفت — البوت في وضع المساعد`);
            setShowModal(false);
            setModeratorName('');
        } catch {
            addNotification(NotificationType.Error, 'فشل استلام الشيفت');
        } finally {
            setLoading(false);
        }
    };

    const handleEndShift = async () => {
        setLoading(true);
        try {
            const updated = await endShift(config.brandId);
            onConfigChange(updated);
            addNotification(NotificationType.Success, '🤖 تم تسليم الشيفت — البوت عاد للعمل التلقائي');
        } catch {
            addNotification(NotificationType.Error, 'فشل تسليم الشيفت');
        } finally {
            setLoading(false);
        }
    };

    if (compact) {
        return (
            <button
                onClick={() => isHumanShift ? handleEndShift() : setShowModal(true)}
                disabled={loading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50
                    ${isHumanShift
                        ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700 hover:bg-orange-200 dark:hover:bg-orange-900/40'
                        : 'bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary border border-light-border dark:border-dark-border hover:border-brand-primary/30 hover:text-brand-primary'
                    }`}
            >
                <i className={`fas ${isHumanShift ? 'fa-robot' : 'fa-user-shield'} text-[10px]`} />
                {loading ? '...' : isHumanShift ? 'تسليم الشيفت' : 'استلام الشيفت'}
            </button>
        );
    }

    return (
        <>
            {/* Shift Banner */}
            {isHumanShift && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800 flex-shrink-0">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Pulsing dot */}
                        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-orange-700 dark:text-orange-300">
                                وضع المساعد نشط
                                {liveTimer && (
                                    <span className="ms-2 font-mono bg-orange-100 dark:bg-orange-900/40 px-1.5 py-0.5 rounded text-[10px]">
                                        {liveTimer}
                                    </span>
                                )}
                            </p>
                            <p className="text-[10px] text-orange-600 dark:text-orange-400 truncate">
                                {config.shiftModeratorName} يتابع المحادثات
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleEndShift}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800/40 disabled:opacity-50 transition flex-shrink-0 border border-orange-200 dark:border-orange-700"
                    >
                        <i className="fas fa-robot text-[9px]" />
                        {loading ? '...' : 'تسليم الشيفت'}
                    </button>
                </div>
            )}

            {/* Start Shift Button (when bot mode) */}
            {!isHumanShift && (
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary border border-light-border dark:border-dark-border hover:border-brand-primary/30 hover:text-brand-primary transition"
                >
                    <i className="fas fa-user-shield text-[10px]" />
                    استلام الشيفت
                </button>
            )}

            {/* Start Shift Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-2xl border border-light-border dark:border-dark-border w-full max-w-sm mx-4 overflow-hidden">
                        <div className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                    <i className="fas fa-user-shield text-orange-600 dark:text-orange-300 text-lg" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-light-text dark:text-dark-text">استلام الشيفت</h3>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                        البوت سيتحول لوضع المساعد فقط
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                        اسم المودريتور
                                    </label>
                                    <input
                                        value={moderatorName}
                                        onChange={e => setModeratorName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleStartShift()}
                                        placeholder="مثال: أحمد المودريتور"
                                        autoFocus
                                        className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-light-text dark:text-dark-text"
                                    />
                                </div>

                                <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-xs text-orange-700 dark:text-orange-300 space-y-1">
                                    <p className="font-semibold">ما الذي سيحدث:</p>
                                    <p>• البوت يتوقف عن الرد التلقائي</p>
                                    <p>• يستمر في اقتراح ردود لمساعدتك</p>
                                    <p>• يظهر شريط تنبيه للجميع</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 p-4 border-t border-light-border dark:border-dark-border">
                            <button
                                onClick={() => { setShowModal(false); setModeratorName(''); }}
                                className="flex-1 py-2 rounded-xl border border-light-border dark:border-dark-border text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleStartShift}
                                disabled={!moderatorName.trim() || loading}
                                className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-50 transition"
                            >
                                {loading ? <i className="fas fa-spinner fa-spin" /> : 'استلام الشيفت'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

function getShiftDuration(startedAt: string): string {
    const diff = Date.now() - new Date(startedAt).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    return `${hours} ساعة`;
}
