
import React, { useState } from 'react';
import { SocialAsset, SocialPlatform } from '../types';

interface AssetSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (selectedAssets: SocialAsset[]) => void;
    assets: SocialAsset[];
    platform: SocialPlatform;
    isLoading: boolean;
}

export const AssetSelectionModal: React.FC<AssetSelectionModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    assets,
    platform,
    isLoading
}) => {
    const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

    if (!isOpen) return null;

    const toggleAsset = (id: string) => {
        setSelectedAssetIds(prev =>
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        );
    };

    const handleConfirm = () => {
        const selected = assets.filter(a => selectedAssetIds.includes(a.id));
        onConfirm(selected);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-light-card dark:bg-dark-card rounded-xl shadow-2xl w-full max-w-md p-6 border border-light-border dark:border-dark-border animate-fade-in">
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">
                    Select {platform} Accounts
                </h3>

                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
                    We found the following accounts linked to your profile. Select the ones you want to manage in SBrandOps.
                </p>

                <div className="space-y-3 max-h-60 overflow-y-auto mb-6">
                    {assets.map(asset => (
                        <div
                            key={asset.id}
                            onClick={() => toggleAsset(asset.id)}
                            className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${selectedAssetIds.includes(asset.id)
                                    ? 'border-brand-primary bg-brand-primary/10'
                                    : 'border-light-border dark:border-dark-border hover:bg-light-bg dark:hover:bg-dark-bg'
                                }`}
                        >
                            <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 ${selectedAssetIds.includes(asset.id) ? 'bg-brand-primary border-brand-primary' : 'border-gray-400'
                                }`}>
                                {selectedAssetIds.includes(asset.id) && <i className="fas fa-check text-white text-xs"></i>}
                            </div>

                            <img src={asset.avatarUrl} alt={asset.name} className="w-10 h-10 rounded-full mr-3" />

                            <div>
                                <p className="font-medium text-light-text dark:text-dark-text">{asset.name}</p>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                    {asset.category} • {asset.followers.toLocaleString()} followers
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isLoading || selectedAssetIds.length === 0}
                        className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                        {isLoading ? <i className="fas fa-spinner fa-spin mr-2"></i> : null}
                        Connect {selectedAssetIds.length} Accounts
                    </button>
                </div>
            </div>
        </div>
    );
};
