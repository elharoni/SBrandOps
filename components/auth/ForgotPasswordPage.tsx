import React, { useState } from 'react';
import { resetPassword } from '../../services/authService';
import { isSupabaseConfigured, supabaseConfigError } from '../../services/supabaseClient';

interface ForgotPasswordPageProps {
    onNavigateToLogin: () => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onNavigateToLogin }) => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) { setError('البريد الإلكتروني مطلوب'); return; }

        setIsLoading(true);
        setError(null);
        try {
            await resetPassword(email.trim());
            setSent(true);
        } catch (err: any) {
            setError(err.message || 'حدث خطأ، يرجى المحاولة مرة أخرى');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg px-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-primary mb-4">
                        <i className="fas fa-layer-group text-white text-2xl"></i>
                    </div>
                    <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">SBrandOps</h1>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm mt-1">استعادة كلمة المرور</p>
                </div>

                <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-xl border border-light-border dark:border-dark-border p-8">
                    {sent ? (
                        /* Success state */
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <i className="fas fa-envelope-open-text text-green-500 text-2xl"></i>
                            </div>
                            <h2 className="text-xl font-bold text-light-text dark:text-dark-text mb-2">تم إرسال رابط الاستعادة</h2>
                            <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm mb-6 leading-relaxed">
                                تفقد بريدك الإلكتروني <strong className="text-light-text dark:text-dark-text">{email}</strong> وانقر على الرابط لاستعادة كلمة المرور.
                            </p>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-6">
                                لم يصلك الإيميل؟ تحقق من Spam/Junk أو
                                <button onClick={() => setSent(false)} className="text-brand-primary hover:underline ms-1">
                                    أعد الإرسال
                                </button>
                            </p>
                            <button
                                onClick={onNavigateToLogin}
                                className="w-full py-2.5 rounded-xl border border-light-border dark:border-dark-border text-sm font-bold text-light-text dark:text-dark-text hover:bg-light-bg dark:hover:bg-dark-bg transition"
                            >
                                العودة لتسجيل الدخول
                            </button>
                        </div>
                    ) : (
                        /* Form */
                        <>
                            <div className="mb-6">
                                <h2 className="text-xl font-bold text-light-text dark:text-dark-text">نسيت كلمة المرور؟</h2>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm mt-1">
                                    أدخل بريدك الإلكتروني وسنرسل لك رابط الاستعادة
                                </p>
                            </div>

                            {!isSupabaseConfigured && (
                                <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
                                    <div className="flex items-start gap-2">
                                        <i className="fas fa-triangle-exclamation mt-0.5 text-amber-500 text-sm flex-shrink-0"></i>
                                        <div>
                                            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">التطبيق غير مهيأ بعد</p>
                                            <p className="mt-1 text-xs leading-5 text-amber-700/90 dark:text-amber-200/90">
                                                {supabaseConfigError}. أضف القيم إلى ملف <code className="font-mono">.env</code> ثم أعد تشغيل التطبيق.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 mb-4">
                                    <i className="fas fa-exclamation-circle text-red-500 text-sm flex-shrink-0"></i>
                                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-light-text dark:text-dark-text mb-1.5">
                                        البريد الإلكتروني
                                    </label>
                                    <div className="relative">
                                        <i className="fas fa-envelope absolute top-1/2 -translate-y-1/2 right-4 text-light-text-secondary dark:text-dark-text-secondary text-sm pointer-events-none"></i>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            autoComplete="email"
                                            className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl ps-10 pe-4 py-3 text-light-text dark:text-dark-text text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading || !email.trim() || !isSupabaseConfigured}
                                    className="w-full py-3 rounded-xl bg-brand-primary text-white font-bold text-sm hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                                >
                                    {isLoading
                                        ? <><i className="fas fa-circle-notch fa-spin"></i> جاري الإرسال...</>
                                        : <><i className="fas fa-paper-plane"></i> إرسال رابط الاستعادة</>
                                    }
                                </button>
                            </form>

                            <div className="mt-5 text-center">
                                <button
                                    onClick={onNavigateToLogin}
                                    className="text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary transition flex items-center justify-center gap-2 mx-auto"
                                >
                                    <i className="fas fa-arrow-right text-xs"></i>
                                    العودة لتسجيل الدخول
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
