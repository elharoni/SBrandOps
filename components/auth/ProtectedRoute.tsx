import React, { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
    children: ReactNode;
    /** Component to show while auth state is loading */
    loadingFallback?: ReactNode;
    /** Component to show when not authenticated */
    unauthenticatedFallback?: ReactNode;
}

/**
 * ProtectedRoute — wraps any content that requires authentication.
 *
 * Usage:
 *   <ProtectedRoute>
 *     <SensitivePage />
 *   </ProtectedRoute>
 *
 * If the user is not authenticated, renders unauthenticatedFallback (default: null).
 * If auth state is still loading, renders loadingFallback (default: spinner).
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    loadingFallback,
    unauthenticatedFallback = null,
}) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <>
                {loadingFallback ?? (
                    <div className="flex items-center justify-center h-full min-h-[200px]">
                        <i className="fas fa-circle-notch fa-spin text-brand-primary text-2xl"></i>
                    </div>
                )}
            </>
        );
    }

    if (!isAuthenticated) {
        return <>{unauthenticatedFallback}</>;
    }

    return <>{children}</>;
};
