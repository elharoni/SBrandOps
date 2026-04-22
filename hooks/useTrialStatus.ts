/**
 * useTrialStatus — reads the user's tenant trial state.
 *
 * Returns:
 *   isOnTrial          — true if status === 'trial'
 *   daysLeft           — days until trial_ends_at (null if not on trial or no end date)
 *   isExpiringSoon     — true if daysLeft !== null && daysLeft <= 7
 *   isExpired          — true if trial_ends_at is in the past and still on trial status
 */

import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface TrialStatus {
    isOnTrial: boolean;
    daysLeft: number | null;
    isExpiringSoon: boolean;
    isExpired: boolean;
    trialEndsAt: string | null;
}

const DEFAULT: TrialStatus = {
    isOnTrial: false,
    daysLeft: null,
    isExpiringSoon: false,
    isExpired: false,
    trialEndsAt: null,
};

export function useTrialStatus(): TrialStatus {
    const [status, setStatus] = useState<TrialStatus>(DEFAULT);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || cancelled) return;

            const { data: tenant } = await supabase
                .from('tenants')
                .select('status, trial_ends_at')
                .eq('owner_id', user.id)
                .maybeSingle();

            if (!tenant || cancelled) return;

            const isOnTrial = tenant.status === 'trial';
            const trialEndsAt: string | null = tenant.trial_ends_at ?? null;

            let daysLeft: number | null = null;
            let isExpired = false;

            if (trialEndsAt) {
                const msLeft = new Date(trialEndsAt).getTime() - Date.now();
                daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
                isExpired = msLeft < 0;
            }

            setStatus({
                isOnTrial,
                daysLeft,
                isExpiringSoon: daysLeft !== null && daysLeft <= 7 && !isExpired,
                isExpired: isOnTrial && isExpired,
                trialEndsAt,
            });
        }

        load();
        return () => { cancelled = true; };
    }, []);

    return status;
}
