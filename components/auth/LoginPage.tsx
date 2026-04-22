import React, { useState, useEffect } from 'react';
import { signIn, signInWithGoogle } from '../../services/authService';
import { isSupabaseConfigured, supabaseConfigError, supabase } from '../../services/supabaseClient';
import { SBrandOpsLogo } from '../SBrandOpsLogo';
import { AuthInput, AuthErrorBanner, AuthConfigWarning, AuthDivider, AuthSubmitButton } from '../shared/UIComponents';

interface LoginPageProps {
    onSuccess: () => void;
    onNavigateToRegister: () => void;
    onNavigateToForgot?: () => void;
}

const GoogleIcon = () => (
    <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, onNavigateToRegister, onNavigateToForgot }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [needsVerification, setNeedsVerification] = useState(false);
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
        setIsLoading(true);
        try {
            await signIn(email, password);
            onSuccess();
        } catch (err: any) {
            const msg = err?.message || 'فشل تسجيل الدخول';
            if (msg.includes('Invalid login credentials')) {
                setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
            } else if (msg.includes('Email not confirmed')) {
                setNeedsVerification(true);
            } else {
                setError(msg);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError(null);
        setGoogleLoading(true);
        try {
            await signInWithGoogle();
        } catch (err: any) {
            setError(err?.message || 'فشل تسجيل الدخول عبر Google');
            setGoogleLoading(false);
        }
    };

    if (needsVerification) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg p-4">
                <div className="w-full max-w-md text-center">
                    <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-8 shadow-lg">
                        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i className="fas fa-envelope-open-text text-amber-500 text-2xl" />
                        </div>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text mb-2">تفعيل البريد الإلكتروني مطلوب</h2>
                        <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6 text-sm">
                            حسابك موجود لكن يحتاج تفعيل. تحقق من بريدك <strong>{email}</strong> وانقر على رابط التفعيل.
                        </p>
                        <AuthSubmitButton
                            onClick={handleResend}
                            disabled={resendCooldown > 0 || resendStatus === 'sending'}
                            loading={resendStatus === 'sending'}
                            loadingText=" جاري الإرسال..."
                            className="mb-3"
                        >
                            {resendStatus === 'sent'
                                ? <><i className="fas fa-check text-xs" /> تم الإرسال!</>
                                : resendCooldown > 0
                                    ? <>إعادة الإرسال بعد {resendCooldown}ث</>
                                    : <><i className="fas fa-paper-plane text-xs" /> إعادة إرسال رابط التفعيل</>
                            }
                        </AuthSubmitButton>
                        <button
                            onClick={() => setNeedsVerification(false)}
                            className="w-full py-2 px-4 text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary transition-colors"
                        >
                            العودة لتسجيل الدخول
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8 flex flex-col items-center">
                    <SBrandOpsLogo size="lg" layout="stacked" />
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-2">منصة إدارة البراندات الشاملة</p>
                </div>

                <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-8 shadow-lg">
                    <h2 className="text-xl font-bold text-light-text dark:text-dark-text mb-6 text-center">تسجيل الدخول</h2>

                    {!isSupabaseConfigured && <AuthConfigWarning error={supabaseConfigError} />}
                    {error && <AuthErrorBanner message={error} />}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <AuthInput
                            label="البريد الإلكتروني"
                            icon="fa-envelope"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            placeholder="name@company.com"
                            dir="ltr"
                        />

                        <AuthInput
                            label="كلمة المرور"
                            icon="fa-lock"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            minLength={6}
                            placeholder="••••••••"
                            dir="ltr"
                            suffix={
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(p => !p)}
                                    className="text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary transition"
                                >
                                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
                                </button>
                            }
                        />

                        <AuthSubmitButton
                            type="submit"
                            disabled={isLoading || !email || !password || !isSupabaseConfigured}
                            loading={isLoading}
                            loadingText=" جاري تسجيل الدخول..."
                        >
                            <i className="fas fa-sign-in-alt" /> تسجيل الدخول
                        </AuthSubmitButton>
                    </form>

                    <AuthDivider />

                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={googleLoading || !isSupabaseConfigured}
                        className="flex w-full items-center justify-center gap-3 rounded-xl border border-light-border bg-white py-2.5 text-sm font-semibold text-light-text transition-colors hover:bg-light-bg disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-border dark:bg-dark-card dark:text-dark-text dark:hover:bg-dark-bg"
                    >
                        {googleLoading ? <i className="fas fa-circle-notch fa-spin text-sm" /> : <GoogleIcon />}
                        متابعة عبر Google
                    </button>

                    <div className="mt-6 space-y-3 text-center">
                        {onNavigateToForgot && (
                            <button
                                onClick={onNavigateToForgot}
                                className="text-sm text-brand-primary hover:underline"
                            >
                                نسيت كلمة المرور؟
                            </button>
                        )}
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            ليس لديك حساب؟{' '}
                            <button
                                onClick={onNavigateToRegister}
                                className="text-brand-primary hover:underline font-medium"
                            >
                                إنشاء حساب جديد
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
