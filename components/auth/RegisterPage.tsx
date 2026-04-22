import React, { useState, useEffect } from 'react';
import { signUp } from '../../services/authService';
import { isSupabaseConfigured, supabaseConfigError, supabase } from '../../services/supabaseClient';

interface RegisterPageProps {
    onSuccess: () => void;
    onNavigateToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSuccess, onNavigateToLogin }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [resendCooldown]);

    const handleResend = async () => {
        setResendStatus('sending');
        await supabase.auth.resend({ type: 'signup', email });
        setResendStatus('sent');
        setResendCooldown(60);
        setTimeout(() => setResendStatus('idle'), 3000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('كلمتا المرور غير متطابقتين');
            return;
        }
        if (password.length < 6) {
            setError('يجب أن تكون كلمة المرور 6 أحرف على الأقل');
            return;
        }

        setIsLoading(true);
        try {
            await signUp(email, password, name);
            setSuccess(true);
        } catch (err: any) {
            const msg = err?.message || 'فشل إنشاء الحساب';
            if (msg.includes('User already registered')) {
                setError('هذا البريد الإلكتروني مسجل بالفعل');
            } else {
                setError(msg);
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg p-4">
                <div className="w-full max-w-md text-center">
                    <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-8 shadow-lg">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i className="fas fa-envelope-open-text text-green-500 text-2xl"></i>
                        </div>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text mb-2">تحقق من بريدك الإلكتروني</h2>
                        <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6 text-sm">
                            أرسلنا رابط تأكيد إلى <strong>{email}</strong>. يرجى النقر على الرابط لتفعيل حسابك.
                        </p>
                        <button
                            onClick={onNavigateToLogin}
                            className="w-full py-2.5 px-4 bg-brand-primary hover:bg-brand-secondary text-white font-semibold rounded-lg transition-colors text-sm"
                        >
                            العودة لتسجيل الدخول
                        </button>
                        <div className="mt-4 pt-4 border-t border-light-border dark:border-dark-border">
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-2">لم يصلك البريد؟</p>
                            <button
                                onClick={handleResend}
                                disabled={resendCooldown > 0 || resendStatus === 'sending'}
                                className="w-full py-2 px-4 border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary hover:border-brand-primary disabled:opacity-50 disabled:cursor-not-allowed font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                            >
                                {resendStatus === 'sending' ? (
                                    <><i className="fas fa-circle-notch fa-spin text-xs"></i> جاري الإرسال...</>
                                ) : resendStatus === 'sent' ? (
                                    <><i className="fas fa-check text-green-500 text-xs"></i> تم الإرسال!</>
                                ) : resendCooldown > 0 ? (
                                    <>إعادة الإرسال بعد {resendCooldown}ث</>
                                ) : (
                                    <><i className="fas fa-paper-plane text-xs"></i> إعادة إرسال رابط التفعيل</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-primary mb-4">
                        <i className="fas fa-layer-group text-white text-2xl"></i>
                    </div>
                    <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">SBrandOps</h1>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">منصة إدارة البراندات الشاملة</p>
                </div>

                <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-8 shadow-lg">
                    <h2 className="text-xl font-bold text-light-text dark:text-dark-text mb-6 text-center">إنشاء حساب جديد</h2>

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
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                            <i className="fas fa-exclamation-circle text-red-500 text-sm flex-shrink-0"></i>
                            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">الاسم الكامل</label>
                            <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary">
                                    <i className="fas fa-user text-sm"></i>
                                </span>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                    className="w-full pr-10 pl-4 py-2.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg text-light-text dark:text-dark-text placeholder-light-text-secondary dark:placeholder-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition text-sm"
                                    placeholder="عبدالرحمن الحاروني"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">البريد الإلكتروني</label>
                            <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary">
                                    <i className="fas fa-envelope text-sm"></i>
                                </span>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    className="w-full pr-10 pl-4 py-2.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg text-light-text dark:text-dark-text placeholder-light-text-secondary dark:placeholder-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition text-sm"
                                    placeholder="name@company.com"
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">كلمة المرور</label>
                            <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary">
                                    <i className="fas fa-lock text-sm"></i>
                                </span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="w-full pr-10 pl-10 py-2.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg text-light-text dark:text-dark-text placeholder-light-text-secondary dark:placeholder-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition text-sm"
                                    placeholder="6 أحرف على الأقل"
                                    dir="ltr"
                                />
                                <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary transition">
                                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">تأكيد كلمة المرور</label>
                            <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary">
                                    <i className="fas fa-lock text-sm"></i>
                                </span>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                    className="w-full pr-10 pl-4 py-2.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg text-light-text dark:text-dark-text placeholder-light-text-secondary dark:placeholder-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition text-sm"
                                    placeholder="••••••••"
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !email || !password || !name || !isSupabaseConfigured}
                            className="w-full py-2.5 px-4 bg-brand-primary hover:bg-brand-secondary disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <><i className="fas fa-circle-notch fa-spin"></i> جاري الإنشاء...</>
                            ) : (
                                <><i className="fas fa-user-plus"></i> إنشاء الحساب</>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            لديك حساب بالفعل؟{' '}
                            <button onClick={onNavigateToLogin} className="text-brand-primary hover:underline font-medium">
                                تسجيل الدخول
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
