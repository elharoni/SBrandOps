
import React, { useState } from 'react';
import { SocialPlatform, PLATFORM_ASSETS, SocialAsset } from '../types';
import { getPlatformAssets } from '../services/socialAccountService';
import { useModalClose } from '../hooks/useModalClose';

interface ConnectAccountModalProps {
    onClose: () => void;
    onConnect: (platform: SocialPlatform, username: string) => Promise<void>;
}

export const ConnectAccountModal: React.FC<ConnectAccountModalProps> = ({ onClose, onConnect }) => {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | null>(null);
    const [fetchedAssets, setFetchedAssets] = useState<SocialAsset[]>([]);
    const [selectedAsset, setSelectedAsset] = useState<SocialAsset | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useModalClose(onClose);

    const handlePlatformSelect = (platform: SocialPlatform) => {
        setSelectedPlatform(platform);
        setStep(2);
    };

    const handleLogin = async () => {
        if (!selectedPlatform) return;
        setIsLoading(true);
        setError(null);
        try {
            // Simulate the OAuth popup window flow
            const assets = await getPlatformAssets(selectedPlatform);
            setFetchedAssets(assets);
            if (assets.length > 0) {
                setSelectedAsset(assets[0]); // Auto select first
            }
            setStep(3);
        } catch (err) {
            setError('فشل الاتصال بالمنصة. يرجى المحاولة مرة أخرى.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinalConnect = async () => {
        if (!selectedPlatform || !selectedAsset) return;

        setIsLoading(true);
        try {
            // We pass the asset name as the "username" for now
            await onConnect(selectedPlatform, selectedAsset.name);
            onClose();
        } catch (error) {
            console.error("Connection failed", error);
            setError('حدث خطأ أثناء حفظ الحساب.');
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-light-card dark:bg-dark-card rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-5 border-b border-light-border dark:border-dark-border flex justify-between items-center bg-light-bg/50 dark:bg-dark-bg/50">
                    <div>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">
                            {step === 1 ? 'إضافة قناة جديدة' : step === 2 ? 'المصادقة' : 'اختيار الصفحة'}
                        </h2>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                            {step === 1 ? 'اختر المنصة التي تريد ربطها' : step === 2 ? `تسجيل الدخول إلى ${selectedPlatform}` : 'اختر الصفحة أو الحساب لإدارته'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text transition-colors">
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto min-h-[300px] flex flex-col">
                    {step === 1 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 animate-fade-in">
                             <style>{`
                                @keyframes fade-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
                                .animate-fade-in { animation: fade-in 0.3s ease-out; }
                            `}</style>
                            {Object.values(SocialPlatform).map(platform => {
                                const asset = PLATFORM_ASSETS[platform];
                                return (
                                    <button
                                        key={platform}
                                        onClick={() => handlePlatformSelect(platform)}
                                        className="flex flex-col items-center justify-center p-4 rounded-xl border border-light-border dark:border-dark-border hover:border-brand-primary hover:bg-brand-primary/5 transition-all group"
                                    >
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-3 transition-transform group-hover:scale-110 ${asset.color} text-white shadow-lg`}>
                                            <i className={asset.icon}></i>
                                        </div>
                                        <span className="font-semibold text-light-text dark:text-dark-text">{platform}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {step === 2 && selectedPlatform && (
                        <div className="flex flex-col items-center justify-center flex-grow space-y-6 animate-fade-in text-center">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl ${PLATFORM_ASSETS[selectedPlatform].color} text-white shadow-2xl`}>
                                <i className={PLATFORM_ASSETS[selectedPlatform].icon}></i>
                            </div>
                            
                            <div className="space-y-2">
                                <h3 className="text-lg font-bold text-light-text dark:text-dark-text">ربط حساب {selectedPlatform}</h3>
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary max-w-xs mx-auto">
                                    سيتم توجيهك إلى نافذة منبثقة آمنة لتسجيل الدخول ومنح الصلاحيات اللازمة.
                                </p>
                            </div>

                            {isLoading ? (
                                <div className="flex flex-col items-center text-brand-primary">
                                    <i className="fas fa-circle-notch fa-spin text-3xl mb-2"></i>
                                    <span className="text-sm font-semibold">جارٍ الاتصال بـ {selectedPlatform}...</span>
                                </div>
                            ) : (
                                <button 
                                    onClick={handleLogin}
                                    className={`flex items-center gap-3 px-6 py-3 rounded-lg text-white font-bold shadow-lg hover:opacity-90 transition-transform hover:scale-105 ${PLATFORM_ASSETS[selectedPlatform].color}`}
                                >
                                    <i className={PLATFORM_ASSETS[selectedPlatform].icon}></i>
                                    <span>المتابعة باستخدام {selectedPlatform}</span>
                                </button>
                            )}
                             {error && <p className="text-red-400 text-sm bg-red-400/10 p-2 rounded-md">{error}</p>}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="flex flex-col h-full animate-fade-in">
                             <h3 className="font-bold text-light-text dark:text-dark-text mb-4">الصفحات المتوفرة ({fetchedAssets.length})</h3>
                             <div className="space-y-2 overflow-y-auto max-h-60 flex-grow">
                                {fetchedAssets.map(asset => (
                                    <label 
                                        key={asset.id} 
                                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                                            selectedAsset?.id === asset.id 
                                            ? 'border-brand-primary bg-brand-primary/10 ring-1 ring-brand-primary' 
                                            : 'border-light-border dark:border-dark-border hover:bg-light-bg dark:hover:bg-dark-bg'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <img src={asset.avatarUrl} alt={asset.name} className="w-10 h-10 rounded-full object-cover" />
                                            <div className="text-right">
                                                <p className="font-bold text-light-text dark:text-dark-text text-sm">{asset.name}</p>
                                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                    {asset.category} • {asset.followers.toLocaleString()} متابع
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                            selectedAsset?.id === asset.id ? 'border-brand-primary' : 'border-gray-400'
                                        }`}>
                                            {selectedAsset?.id === asset.id && <div className="w-2.5 h-2.5 rounded-full bg-brand-primary"></div>}
                                        </div>
                                        <input 
                                            type="radio" 
                                            name="socialAsset" 
                                            className="hidden" 
                                            onChange={() => setSelectedAsset(asset)} 
                                            checked={selectedAsset?.id === asset.id}
                                        />
                                    </label>
                                ))}
                             </div>
                             <div className="mt-4 pt-4 border-t border-light-border dark:border-dark-border flex justify-end gap-3">
                                <button 
                                    onClick={() => setStep(2)}
                                    className="px-4 py-2 text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text"
                                >
                                    رجوع
                                </button>
                                <button 
                                    onClick={handleFinalConnect}
                                    disabled={isLoading || !selectedAsset}
                                    className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-6 rounded-lg shadow disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? <i className="fas fa-spinner fa-spin"></i> : 'تأكيد الربط'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
