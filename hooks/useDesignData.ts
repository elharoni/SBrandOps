// hooks/useDesignData.ts
import { useState, useCallback } from 'react';
import { DesignAsset, DesignWorkflow, DesignJob, NotificationType } from '../types';
import { getDesignAssets }    from '../services/designAssetsService';
import { getDesignWorkflows, seedDefaultWorkflows } from '../services/designWorkflowsService';
import { getDesignJobs }      from '../services/designJobsService';

interface DesignDataState {
    designAssets:    DesignAsset[];
    designWorkflows: DesignWorkflow[];
    recentJobs:      DesignJob[];
    isLoading:       boolean;
}

const initialState: DesignDataState = {
    designAssets:    [],
    designWorkflows: [],
    recentJobs:      [],
    isLoading:       false,
};

export function useDesignData(
    addNotification: (type: NotificationType, message: string) => void
) {
    const [state, setState] = useState<DesignDataState>(initialState);

    const fetchDesignData = useCallback(async (brandId: string) => {
        setState(prev => ({ ...prev, isLoading: true }));
        try {
            // جلب كل البيانات بالتوازي
            const [assets, workflows, jobs] = await Promise.allSettled([
                getDesignAssets(brandId),
                getDesignWorkflows(brandId),
                getDesignJobs(brandId, 20),
            ]);

            let resolvedWorkflows = workflows.status === 'fulfilled' ? workflows.value : [];

            // لو مافيش workflows → seed defaults تلقائياً
            if (resolvedWorkflows.length === 0) {
                try {
                    resolvedWorkflows = await seedDefaultWorkflows(brandId);
                } catch (seedErr) {
                    console.warn('seedDefaultWorkflows failed:', seedErr);
                }
            }

            setState({
                designAssets:    assets.status    === 'fulfilled' ? assets.value    : [],
                designWorkflows: resolvedWorkflows,
                recentJobs:      jobs.status      === 'fulfilled' ? jobs.value      : [],
                isLoading:       false,
            });
        } catch (err) {
            console.error('fetchDesignData error:', err);
            addNotification(NotificationType.Error, 'فشل تحميل بيانات التصميم');
            setState(prev => ({ ...prev, isLoading: false }));
        }
    }, [addNotification]);

    const refreshDesignData = useCallback(
        (brandId: string) => fetchDesignData(brandId),
        [fetchDesignData]
    );

    // Local optimistic updates — بيُحدّث الـ state بدون re-fetch
    const addAssetLocally = useCallback((asset: DesignAsset) => {
        setState(prev => ({ ...prev, designAssets: [asset, ...prev.designAssets] }));
    }, []);

    const addJobLocally = useCallback((job: DesignJob) => {
        setState(prev => ({ ...prev, recentJobs: [job, ...prev.recentJobs] }));
    }, []);

    const updateJobLocally = useCallback((updatedJob: DesignJob) => {
        setState(prev => ({
            ...prev,
            recentJobs: prev.recentJobs.map(j => j.id === updatedJob.id ? updatedJob : j),
        }));
    }, []);

    const removeAssetLocally = useCallback((assetId: string) => {
        setState(prev => ({
            ...prev,
            designAssets: prev.designAssets.filter(a => a.id !== assetId),
        }));
    }, []);

    return {
        ...state,
        fetchDesignData,
        refreshDesignData,
        addAssetLocally,
        addJobLocally,
        updateJobLocally,
        removeAssetLocally,
    };
}
