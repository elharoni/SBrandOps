import React, { ReactNode } from 'react';
import { usePermissions } from '../../context/PermissionContext';
import { AccessDenied } from './AccessDenied';

interface PermissionGuardProps {
    /** Permission key that must be present (e.g. 'content.publish.brand') */
    permission?: string;
    /** Plan feature key that must be truthy (e.g. 'crm_enabled') */
    planFeature?: string;
    /** Plan name shown in the upgrade prompt when plan-locked */
    requiredPlan?: string;
    /** Human-readable feature name shown in the upgrade prompt */
    featureName?: string;
    /**
     * What to render when access is denied.
     * - `null` (default): render nothing
     * - `true`: render the full <AccessDenied> screen
     * - ReactNode: render the provided fallback
     */
    fallback?: ReactNode | true;
    /** Called when user clicks "Upgrade" in the plan-locked screen */
    onUpgrade?: () => void;
    /** Called when user clicks "Go Back" in the denied screen */
    onNavigateBack?: () => void;
    children: ReactNode;
}

/**
 * Wraps UI that requires a specific permission or plan feature.
 *
 * Usage (inline button hide):
 *   <PermissionGuard permission="content.publish.brand">
 *     <PublishButton />
 *   </PermissionGuard>
 *
 * Usage (full page guard with denied screen):
 *   <PermissionGuard
 *     permission="workspace.billing.view.own"
 *     fallback={true}
 *     onNavigateBack={() => onNavigate('dashboard')}
 *   >
 *     <BillingPage />
 *   </PermissionGuard>
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
    permission,
    planFeature,
    requiredPlan,
    featureName,
    fallback = null,
    onUpgrade,
    onNavigateBack,
    children,
}) => {
    const { hasPermission, hasPlanFeature, isLoading } = usePermissions();

    // While loading, show nothing to avoid permission flash
    if (isLoading) return null;

    if (planFeature && !hasPlanFeature(planFeature)) {
        if (fallback === true) {
            return (
                <AccessDenied
                    reason="plan_locked"
                    requiredPlan={requiredPlan}
                    featureName={featureName}
                    onUpgrade={onUpgrade}
                    onNavigateBack={onNavigateBack}
                />
            );
        }
        return <>{fallback}</>;
    }

    if (permission && !hasPermission(permission)) {
        if (fallback === true) {
            return (
                <AccessDenied
                    reason="no_permission"
                    onNavigateBack={onNavigateBack}
                />
            );
        }
        return <>{fallback}</>;
    }

    return <>{children}</>;
};
