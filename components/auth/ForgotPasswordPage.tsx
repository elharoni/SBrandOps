import React, { useState } from 'react';
import { resetPassword } from '../../services/authService';
import { isSupabaseConfigured, supabaseConfigError } from '../../services/supabaseClient';
import { SBrandOpsLogo } from '../SBrandOpsLogo';
import { AuthInput, AuthErrorBanner, AuthConfigWarning, Button } from '../shared/UIComponents';
import { AuthShell, AuthLogoBlock } from './AuthShell';

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
        <AuthShell>
            <div className="w-full max-w-md px-4">
                <AuthLogoBlock />

                <div className="bg-white/95 dark:bg-[#161B33] border border-black/5 dark:border-white/10 rounded-[20px] shadow-[0_16px_50px_rgba(6,182,212,0.10)] p-8">
                    {sent ? (
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <i className="fas fa-envelope-open-text text-green-500 text-2xl" />
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
                                className="w-full py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-sm font-bold text-light-text dark:text-dark-text hover:bg-light-bg dark:hover:bg-white/5 transition"
                            >
                                العودة لتسجيل الدخول
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="mb-6">
                                <h2 className="text-xl font-bold text-light-text dark:text-dark-text">نسيت كلمة المرور؟</h2>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm mt-1">
                                    أدخل بريدك الإلكتروني وسنرسل لك رابط الاستعادة
                                </p>
                            </div>

                            {!isSupabaseConfigured && <AuthConfigWarning error={supabaseConfigError} />}
                            {error && <AuthErrorBanner message={error} />}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <AuthInput
                                    label="البريد الإلكتروني"
                                    icon="fa-envelope"
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                />

                                <Button
                                    type="submit"
                                    disabled={isLoading || !email.trim() || !isSupabaseConfigured}
                                    loading={isLoading}
                                    fullWidth
                                    className="py-3"
                                >
                                    {!isLoading && <i className="fas fa-paper-plane" />}
                                    {isLoading ? 'جاري الإرسال...' : 'إرسال رابط الاستعادة'}
                                </Button>
                            </form>

                            <div className="mt-5 text-center">
                                <button
                                    onClick={onNavigateToLogin}
                                    className="text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary transition flex items-center justify-center gap-2 mx-auto"
                                >
                                    <i className="fas fa-arrow-right text-xs" />
                                    العودة لتسجيل الدخول
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </AuthShell>
    );
};
