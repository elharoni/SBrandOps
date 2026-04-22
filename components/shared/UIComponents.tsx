/**
 * Reusable UI Components
 * مكونات واجهة المستخدم القابلة لإعادة الاستخدام
 */

import React from 'react';

/* ==================== Button Component ==================== */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    loadingText?: string;
    icon?: string;
    iconPosition?: 'left' | 'right';
    fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    loadingText,
    icon,
    iconPosition = 'left',
    fullWidth = false,
    className = '',
    disabled,
    ...props
}) => {
    const baseClasses = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

    const variantClasses = {
        primary: 'bg-brand-primary hover:bg-brand-primary/90 text-white focus:ring-brand-primary disabled:opacity-50',
        secondary: 'bg-dark-card hover:bg-dark-bg border border-dark-border text-dark-text focus:ring-brand-primary',
        danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
        ghost: 'bg-transparent hover:bg-dark-card text-dark-text-secondary hover:text-dark-text',
        success: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500',
    };

    const sizeClasses = {
        sm: 'text-sm px-3 py-1.5',
        md: 'text-sm px-4 py-2',
        lg: 'text-base px-6 py-3',
    };

    const widthClass = fullWidth ? 'w-full' : '';

    return (
        <button
            className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
            disabled={disabled || loading}
            {...props}
        >
            {loading && <i className="fas fa-circle-notch fa-spin" />}
            {loading && loadingText ? loadingText : null}
            {!loading && icon && iconPosition === 'left' && <i className={icon} />}
            {!loading && children}
            {!loading && icon && iconPosition === 'right' && <i className={icon} />}
        </button>
    );
};

/* ==================== Card Component ==================== */
export interface CardProps {
    children: React.ReactNode;
    className?: string;
    hover?: boolean;
    onClick?: () => void;
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    hover = false,
    onClick,
    padding = 'md',
}) => {
    const baseClasses = 'bg-dark-card border border-dark-border rounded-lg transition-all duration-200';
    const hoverClasses = hover ? 'hover:bg-dark-bg hover:border-dark-border-hover hover:shadow-lg cursor-pointer' : '';
    const paddingClasses = {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
    };

    return (
        <div
            className={`${baseClasses} ${hoverClasses} ${paddingClasses[padding]} ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    );
};

/* ==================== Badge Component ==================== */
export interface BadgeProps {
    children: React.ReactNode;
    variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
    size?: 'sm' | 'md';
    className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'default',
    size = 'md',
    className = '',
}) => {
    const baseClasses = 'inline-flex items-center font-semibold rounded-full whitespace-nowrap';

    const variantClasses = {
        success: 'bg-green-500/10 text-green-500',
        warning: 'bg-yellow-500/10 text-yellow-500',
        danger: 'bg-red-500/10 text-red-500',
        info: 'bg-blue-500/10 text-blue-500',
        default: 'bg-dark-bg text-dark-text-secondary',
    };

    const sizeClasses = {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-3 py-1',
    };

    return (
        <span className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}>
            {children}
        </span>
    );
};

/* ==================== Input Component ==================== */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: string;
    iconPosition?: 'left' | 'right';
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    icon,
    iconPosition = 'left',
    className = '',
    ...props
}) => {
    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-semibold text-dark-text-secondary">
                    {label}
                </label>
            )}
            <div className="relative">
                {icon && iconPosition === 'left' && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <i className={`${icon} text-dark-text-secondary`} />
                    </div>
                )}
                <input
                    className={`w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder-dark-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all ${icon && iconPosition === 'left' ? 'pl-10' : ''} ${icon && iconPosition === 'right' ? 'pr-10' : ''} ${error ? 'border-red-500' : ''} ${className}`}
                    {...props}
                />
                {icon && iconPosition === 'right' && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <i className={`${icon} text-dark-text-secondary`} />
                    </div>
                )}
            </div>
            {error && (
                <p className="text-sm text-red-500 animate-fade-in-down">{error}</p>
            )}
        </div>
    );
};

/* ==================== Textarea Component ==================== */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
    label,
    error,
    className = '',
    ...props
}) => {
    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-semibold text-dark-text-secondary">
                    {label}
                </label>
            )}
            <textarea
                className={`w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder-dark-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all resize-vertical ${error ? 'border-red-500' : ''} ${className}`}
                {...props}
            />
            {error && (
                <p className="text-sm text-red-500 animate-fade-in-down">{error}</p>
            )}
        </div>
    );
};

/* ==================== Loading Spinner ==================== */
export interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
    size = 'md',
    className = '',
}) => {
    const sizeClasses = {
        sm: 'text-lg',
        md: 'text-2xl',
        lg: 'text-4xl',
    };

    return (
        <i className={`fas fa-circle-notch fa-spin ${sizeClasses[size]} text-brand-primary ${className}`} />
    );
};

/* ==================== Empty State ==================== */
export interface EmptyStateProps {
    icon?: string;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon = 'fas fa-inbox',
    title,
    description,
    action,
}) => {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in-up">
            <div className="w-16 h-16 bg-dark-bg rounded-full flex items-center justify-center mb-4">
                <i className={`${icon} text-3xl text-dark-text-secondary`} />
            </div>
            <h3 className="text-lg font-bold text-dark-text mb-2">{title}</h3>
            {description && (
                <p className="text-sm text-dark-text-secondary mb-6 max-w-md">
                    {description}
                </p>
            )}
            {action && (
                <Button onClick={action.onClick} variant="primary">
                    {action.label}
                </Button>
            )}
        </div>
    );
};

/* ==================== Skeleton Loader ==================== */
export interface SkeletonProps {
    width?: string;
    height?: string;
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({
    width = '100%',
    height = '1rem',
    className = '',
    variant = 'rectangular',
}) => {
    const variantClasses = {
        text: 'rounded',
        circular: 'rounded-full',
        rectangular: 'rounded-lg',
    };

    return (
        <div
            className={`skeleton ${variantClasses[variant]} ${className}`}
            style={{ width, height }}
        />
    );
};

/* ==================== Divider ==================== */
export interface DividerProps {
    className?: string;
    orientation?: 'horizontal' | 'vertical';
}

export const Divider: React.FC<DividerProps> = ({
    className = '',
    orientation = 'horizontal',
}) => {
    const orientationClasses = orientation === 'horizontal'
        ? 'w-full h-px'
        : 'h-full w-px';

    return (
        <div className={`bg-dark-border ${orientationClasses} ${className}`} />
    );
};

/* ==================== Avatar ==================== */
export interface AvatarProps {
    src?: string;
    alt?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    fallback?: string;
    className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
    src,
    alt = 'Avatar',
    size = 'md',
    fallback,
    className = '',
}) => {
    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base',
        xl: 'w-16 h-16 text-lg',
    };

    return (
        <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-dark-bg flex items-center justify-center font-semibold text-dark-text-secondary ${className}`}>
            {src ? (
                <img src={src} alt={alt} className="w-full h-full object-cover" />
            ) : (
                <span>{fallback || alt.charAt(0).toUpperCase()}</span>
            )}
        </div>
    );
};

/* ==================== Auth Shared Components ==================== */

export interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    icon: string;
    suffix?: React.ReactNode;
}

export const AuthInput: React.FC<AuthInputProps> = ({ label, icon, suffix, className = '', ...props }) => (
    <div>
        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
            {label}
        </label>
        <div className="relative">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none">
                <i className={`fas ${icon} text-sm`} />
            </span>
            <input
                className={`w-full pr-10 ${suffix ? 'pl-10' : 'pl-4'} py-2.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text placeholder-light-text-secondary dark:placeholder-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition text-sm ${className}`}
                {...props}
            />
            {suffix && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    {suffix}
                </div>
            )}
        </div>
    </div>
);

export const AuthErrorBanner: React.FC<{ message: string }> = ({ message }) => (
    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2">
        <i className="fas fa-exclamation-circle text-red-500 text-sm flex-shrink-0" />
        <p className="text-red-600 dark:text-red-400 text-sm">{message}</p>
    </div>
);

export const AuthConfigWarning: React.FC<{ error: string }> = ({ error }) => (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
        <div className="flex items-start gap-2">
            <i className="fas fa-triangle-exclamation mt-0.5 text-amber-500 text-sm flex-shrink-0" />
            <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">التطبيق غير مهيأ بعد</p>
                <p className="mt-1 text-xs leading-5 text-amber-700/90 dark:text-amber-200/90">
                    {error}. أضف القيم إلى ملف <code className="font-mono">.env</code> ثم أعد تشغيل التطبيق.
                </p>
            </div>
        </div>
    </div>
);

export const AuthDivider: React.FC = () => (
    <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-light-border dark:border-dark-border" />
        </div>
        <div className="relative flex justify-center text-xs">
            <span className="bg-light-card dark:bg-dark-card px-3 text-light-text-secondary dark:text-dark-text-secondary">أو</span>
        </div>
    </div>
);

export const AuthSubmitButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    loadingText?: string;
}> = ({ loading, loadingText = 'جاري...', children, className = '', disabled, ...props }) => (
    <button
        className={`w-full py-2.5 px-4 bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2 ${className}`}
        disabled={disabled || loading}
        {...props}
    >
        {loading ? <><i className="fas fa-circle-notch fa-spin" />{loadingText}</> : children}
    </button>
);
