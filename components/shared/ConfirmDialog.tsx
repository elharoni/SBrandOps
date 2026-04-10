/**
 * ConfirmDialog — نافذة تأكيد الإجراءات الحساسة
 * يستخدم أزرار بأسماء الإجراء بدلاً من "موافق / إلغاء" الجنريك
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;           // "حذف 3 عناصر؟"
    description?: string;    // "لن تتمكن من استردادها بعد الحذف"
    confirmLabel: string;    // "احذف العناصر"
    cancelLabel?: string;    // "احتفظ بها"
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'warning' | 'info';
    icon?: string;           // Font Awesome class
}

const VARIANT_STYLES = {
    danger: {
        iconBg: 'bg-red-500/10',
        iconColor: 'text-red-500',
        icon: 'fa-trash-can',
        confirmBtn: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white',
    },
    warning: {
        iconBg: 'bg-amber-500/10',
        iconColor: 'text-amber-500',
        icon: 'fa-triangle-exclamation',
        confirmBtn: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white',
    },
    info: {
        iconBg: 'bg-brand-primary/10',
        iconColor: 'text-brand-primary',
        icon: 'fa-circle-question',
        confirmBtn: 'bg-brand-primary hover:bg-brand-secondary focus:ring-brand-primary text-white',
    },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    description,
    confirmLabel,
    cancelLabel = 'تراجع',
    onConfirm,
    onCancel,
    variant = 'danger',
    icon,
}) => {
    const confirmRef = useRef<HTMLButtonElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);
    const styles = VARIANT_STYLES[variant];

    // Focus cancel button on open (safer default)
    useEffect(() => {
        if (isOpen) {
            cancelRef.current?.focus();
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* Dialog */}
            <div className="relative bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-[1.75rem] shadow-2xl max-w-sm w-full p-6 animate-scale-in">
                {/* Icon */}
                <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${styles.iconBg}`}>
                    <i className={`fas ${icon || styles.icon} text-xl ${styles.iconColor}`} />
                </div>

                {/* Text */}
                <h3
                    id="confirm-dialog-title"
                    className="text-center text-lg font-bold text-light-text dark:text-dark-text leading-tight"
                >
                    {title}
                </h3>
                {description && (
                    <p className="mt-2 text-center text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                        {description}
                    </p>
                )}

                {/* Actions */}
                <div className="mt-6 flex flex-col gap-2">
                    <button
                        ref={confirmRef}
                        onClick={onConfirm}
                        className={`w-full rounded-xl py-3 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.confirmBtn}`}
                    >
                        {confirmLabel}
                    </button>
                    <button
                        ref={cancelRef}
                        onClick={onCancel}
                        className="w-full rounded-xl py-3 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text hover:bg-light-bg dark:hover:bg-dark-bg transition-all focus:outline-none"
                    >
                        {cancelLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
