import React, { useState, useEffect } from 'react';
import { signUp, signInWithGoogle } from '../../services/authService';
import { isSupabaseConfigured, supabaseConfigError, supabase } from '../../services/supabaseClient';
import { SBrandOpsLogo } from '../SBrandOpsLogo';
import { AuthInput, AuthErrorBanner, AuthConfigWarning, AuthDivider, AuthSubmitButton } from '../shared/UIComponents';

interface RegisterPageProps {
    onSuccess: () => void;
    onNavigateToLogin: () => void;
}

const GoogleIcon = () => (
    <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSuccess, onNavigateToLogin }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [showSurvey, setShowSurvey] = useState(false);
    const [surveyGoal, setSurveyGoal] = useState('');

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
            setShowSurvey(true);
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

    const handleGoogleSignIn = async () => {
        setError(null);
        setGoogleLoading(true);
        try {
            await signInWithGoogle();
        } catch (err: any) {
            setError(err?.message || 'فشل التسجيل عبر Google');
            setGoogleLoading(false);
        }
    };

    const surveyOptions = [
        { value: 'social',    icon: 'fa-heart',     color: 'from-pink-500 to-rose-500',      label: 'محتوى سوشيال ميديا' },
        { value: 'seo',       icon: 'fa-search',    color: 'from-blue-500 to-cyan-500',      label: 'تحسين محركات البحث SEO' },
        { value: 'ads',       icon: 'fa-bullhorn',  color: 'from-amber-500 to-orange-500',   label: 'إدارة الإعلانات المدفوعة' },
        { value: 'branding',  icon: 'fa-star',      color: 'from-violet-500 to-indigo-500',  label: 'بناء هوية البراند' },
        { value: 'analytics', icon: 'fa-chart-bar', color: 'from-emerald-500 to-teal-500',   label: 'تحليل الأداء والمنافسين' },
        { value: 'all',       icon: 'fa-rocket',    color: 'from-gray-500 to-slate-600',     label: 'كل ما سبق!' },
    ];

    if (showSurvey && !success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg p-4">
                <div className="w-full max-w-md">
                    <div className="text-center mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto mb-3">
                            <i className="fas fa-hand-wave text-brand-primary text-2xl" />
                        </div>
                        <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">أهلاً {name.split(' ')[0]}!</h2>
                        <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm mt-1">
                            سؤال سريع يساعدنا نخصّص تجربتك
                        </p>
                    </div>
                    <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-6 shadow-xl">
                        <p className="text-sm font-semibold text-light-text dark:text-dark-text mb-4 text-center">ما هو هدفك الرئيسي من SBrandOps؟</p>
                        <div className="grid grid-cols-2 gap-3 mb-5">
                            {surveyOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setSurveyGoal(opt.value)}
                                    className={`relative p-4 rounded-xl border-2 text-right transition-all ${
                                        surveyGoal === opt.value
                                            ? 'border-brand-primary bg-brand-primary/10'
                                            : 'border-light-border dark:border-dark-border hover:border-brand-primary/50'
                                    }`}
                                >
                                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${opt.color} flex items-center justify-center mb-2`}>
                                        <i className={`fas ${opt.icon} text-white text-xs`} />
                                    </div>
                                    <span className="text-xs font-medium text-light-text dark:text-dark-text leading-tight block">{opt.label}</span>
                                    {surveyGoal === opt.value && (
                                        <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-brand-primary flex items-center justify-center">
                                            <i className="fas fa-check text-white text-xs" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => { if (surveyGoal) localStorage.setItem('userGoal', surveyGoal); setSuccess(true); }}
                            disabled={!surveyGoal}
                            className="w-full py-3 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-indigo-500/25"
                        >
                            متابعة <i className="fas fa-arrow-left ms-2 text-xs" />
                        </button>
                        <button onClick={() => setSuccess(true)} className="w-full mt-2 py-2 text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary transition-colors">
                            تخطّى هذه الخطوة
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (success) {
        const steps = [
            { icon: 'fa-layer-group', color: 'text-violet-400',  label: 'أنشئ براندك الأول' },
            { icon: 'fa-robot',       color: 'text-cyan-400',    label: 'اكتب بالذكاء الاصطناعي' },
            { icon: 'fa-chart-line',  color: 'text-emerald-400', label: 'تابع التحليلات' },
        ];
        return (
            <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg p-4">
                <div className="w-full max-w-md">
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 mb-4 shadow-lg shadow-indigo-500/30">
                            <i className="fas fa-envelope-open-text text-white text-2xl" />
                        </div>
                        <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">تحقق من بريدك!</h2>
                        <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm mt-1">
                            أرسلنا رابط التفعيل إلى <strong className="text-brand-primary">{email}</strong>
                        </p>
                    </div>

                    <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl overflow-hidden shadow-xl">
                        <div className="p-6 border-b border-light-border dark:border-dark-border">
                            <p className="text-xs font-semibold text-brand-primary uppercase tracking-widest mb-4">بعد التفعيل ستتمكن من</p>
                            <div className="space-y-3">
                                {steps.map((s, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-dark-bg/50 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                                            <i className={`fas ${s.icon} ${s.color} text-sm`} />
                                        </div>
                                        <span className="text-sm text-light-text dark:text-dark-text font-medium">{s.label}</span>
                                        <i className="fas fa-check text-emerald-500 text-xs mr-auto" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
                            <i className="fas fa-gift text-amber-400 text-sm" />
                            <span className="text-amber-400 text-xs font-semibold">تجربة مجانية 14 يوماً — لا بطاقة ائتمانية</span>
                        </div>

                        <div className="p-6 space-y-3">
                            <button
                                onClick={handleResend}
                                disabled={resendCooldown > 0 || resendStatus === 'sending'}
                                className="w-full py-3 px-4 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
                            >
                                {resendStatus === 'sending'
                                    ? <><i className="fas fa-circle-notch fa-spin" /> جاري الإرسال...</>
                                    : resendStatus === 'sent'
                                        ? <><i className="fas fa-check" /> تم الإرسال بنجاح!</>
                                        : resendCooldown > 0
                                            ? <>⏳ إعادة الإرسال بعد {resendCooldown}ث</>
                                            : <><i className="fas fa-paper-plane" /> إعادة إرسال رابط التفعيل</>
                                }
                            </button>
                            <button
                                onClick={onNavigateToLogin}
                                className="w-full py-2.5 px-4 border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text rounded-xl transition-colors text-sm"
                            >
                                العودة لتسجيل الدخول
                            </button>
                        </div>

                        <div className="px-6 pb-5">
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary text-center">
                                <i className="fas fa-info-circle ml-1 text-blue-400" />
                                لم يصلك الإيميل؟ تحقق من مجلد <strong>Spam</strong> أو أضف <strong>noreply@supabase.io</strong> لجهات اتصالك
                            </p>
                        </div>
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
                    <h2 className="text-xl font-bold text-light-text dark:text-dark-text mb-6 text-center">إنشاء حساب جديد</h2>

                    {!isSupabaseConfigured && <AuthConfigWarning error={supabaseConfigError} />}
                    {error && <AuthErrorBanner message={error} />}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <AuthInput
                            label="الاسم الكامل"
                            icon="fa-user"
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            placeholder="عبدالرحمن الحاروني"
                        />

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
                            placeholder="6 أحرف على الأقل"
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

                        <AuthInput
                            label="تأكيد كلمة المرور"
                            icon="fa-lock"
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            dir="ltr"
                        />

                        <AuthSubmitButton
                            type="submit"
                            disabled={isLoading || !email || !password || !name || !isSupabaseConfigured}
                            loading={isLoading}
                            loadingText=" جاري الإنشاء..."
                        >
                            <i className="fas fa-user-plus" /> إنشاء الحساب
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
                        التسجيل عبر Google
                    </button>

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
