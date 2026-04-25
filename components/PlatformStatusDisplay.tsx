import React from 'react';
import { SocialPlatform, PlatformStatus, PLATFORM_ASSETS, PlatformPostStatus } from '../types';

interface PlatformStatusDisplayProps {
    statuses: Map<SocialPlatform, PlatformStatus>;
    onRetry: (platform: SocialPlatform) => void;
    onCreateNewPost: () => void;
    onEditPost: () => void;
    onNotifyFailure: (platform: SocialPlatform, error: string | null | undefined) => void;
    onConnectAccount?: (platform: SocialPlatform) => void;
    onClose?: () => void;
}

const StatusIndicator: React.FC<{ status: PlatformPostStatus }> = ({ status }) => {
    switch (status) {
        case PlatformPostStatus.Publishing:
            return <i className="fas fa-spinner fa-spin text-blue-400"></i>;
        case PlatformPostStatus.Published:
            return <i className="fas fa-check-circle"></i>;
        case PlatformPostStatus.Failed:
            return <i className="fas fa-exclamation-circle"></i>;
        default:
            return null;
    }
};

const getStatusText = (status: PlatformPostStatus) => {
    switch (status) {
        case PlatformPostStatus.Publishing: return "جاري النشر...";
        case PlatformPostStatus.Published: return "تم النشر بنجاح";
        case PlatformPostStatus.Failed: return "فشل";
        default: return "";
    }
}

const getStatusTextColor = (status: PlatformPostStatus): string => {
    switch (status) {
        case PlatformPostStatus.Published:
            return 'text-green-400';
        case PlatformPostStatus.Failed:
            return 'text-red-400';
        default:
            return 'text-dark-text-secondary';
    }
};


const getStatusStyling = (status: PlatformPostStatus): string => {
    switch (status) {
        case PlatformPostStatus.Publishing:
            return 'bg-blue-500/10 border-blue-500';
        case PlatformPostStatus.Published:
            return 'bg-green-500/10 border-green-500';
        case PlatformPostStatus.Failed:
            return 'bg-red-500/10 border-red-500';
        default:
            return 'bg-dark-bg border-dark-border';
    }
};

export const PlatformStatusDisplay: React.FC<PlatformStatusDisplayProps> = ({ statuses, onRetry, onCreateNewPost, onEditPost, onNotifyFailure, onConnectAccount, onClose }) => {
    
    const total = statuses.size;
    const publishedCount = [...statuses.values()].filter(s => s.status === PlatformPostStatus.Published).length;
    const failedCount = [...statuses.values()].filter(s => s.status === PlatformPostStatus.Failed).length;
    const isProcessComplete = (publishedCount + failedCount) === total && total > 0;

    return (
        <div className="space-y-3">
            <h3 className="text-base font-bold text-white">حالة النشر</h3>

             {isProcessComplete && (
                <div className="bg-dark-bg p-3 rounded-lg border border-dark-border">
                    <p className="text-sm font-semibold text-white">
                        <i className={`fas ${failedCount > 0 ? 'fa-exclamation-triangle text-yellow-400' : 'fa-check-circle text-green-400'} me-2`}></i>
                        اكتمل النشر: {publishedCount} نجح / {failedCount} فشل
                    </p>
                    {failedCount > 0 && (
                        <div className="mt-3 flex items-center gap-3">
                            <p className="text-xs text-dark-text-secondary flex-1">
                                يمكنك إعادة محاولة المنشورات الفاشلة بشكل فردي، أو تعديل المنشور الأصلي لإصلاح الأخطاء.
                            </p>
                            <button onClick={onEditPost} className="bg-yellow-500/80 hover:bg-yellow-500/60 text-white font-bold py-1 px-3 rounded-lg text-sm flex-shrink-0">
                                <i className="fas fa-pencil-alt me-2"></i>
                                تعديل المنشور
                            </button>
                        </div>
                    )}
                    {failedCount === 0 && (
                        <div className="mt-3 flex gap-2">
                            {onClose && (
                                <button onClick={onClose} className="flex-1 bg-dark-border hover:bg-dark-border/70 text-dark-text font-bold py-2 rounded-lg">
                                    إغلاق
                                </button>
                            )}
                            <button onClick={onCreateNewPost} className="flex-1 bg-brand-secondary hover:bg-brand-secondary/80 text-white font-bold py-2 rounded-lg">
                                <i className="fas fa-plus me-2"></i>
                                إنشاء منشور جديد
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-2 max-h-48 overflow-y-auto p-1">
            {[...statuses.entries()].map(([platform, platformStatus]: [SocialPlatform, PlatformStatus]) => {
                const platformInfo = PLATFORM_ASSETS[platform];
                const statusStyles = getStatusStyling(platformStatus.status);
                
                return (
                    <div key={platform} className={`flex items-start justify-between p-3 rounded-lg border-l-4 transition-colors duration-300 ${statusStyles}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${platformInfo.color} flex-shrink-0`}>
                                <i className={platformInfo.icon}></i>
                            </div>
                            <span className="font-semibold text-sm text-dark-text">{platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
                        </div>
                        <div className="text-sm text-end">
                            <div className={`flex items-center justify-end gap-2 font-semibold ${getStatusTextColor(platformStatus.status)}`}>
                                <StatusIndicator status={platformStatus.status} />
                                <span>{getStatusText(platformStatus.status)}</span>
                            </div>
                            {platformStatus.status === PlatformPostStatus.Failed && (
                                <>
                                    {platformStatus.error && (
                                        <p className="text-xs text-red-400/90 mt-1" title={platformStatus.error}>{platformStatus.error}</p>
                                    )}
                                    <div className="flex items-center justify-end gap-3 mt-2">
                                        <button onClick={() => onNotifyFailure(platform, platformStatus.error)} className="text-xs font-bold text-yellow-400 hover:underline">
                                            إعلام
                                        </button>
                                        {platformStatus.error === 'No connected account' && onConnectAccount ? (
                                            <button onClick={() => onConnectAccount(platform)} className="text-xs font-bold text-emerald-400 hover:underline">
                                                ربط الحساب
                                            </button>
                                        ) : (
                                            <button onClick={() => onRetry(platform)} className="text-xs font-bold text-brand-primary hover:underline">
                                                إعادة المحاولة
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            })}
             </div>
        </div>
    );
};