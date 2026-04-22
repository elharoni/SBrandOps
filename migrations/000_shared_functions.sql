-- ============================================================
-- Migration 000: Shared Utility Functions
-- دوال مشتركة يجب تشغيلها أولاً قبل أي migration آخر
-- شغّل هذا الملف إذا كانت قاعدة البيانات لا تحتوي على هذه الدوال
-- ============================================================

-- ── دالة تحديث updated_at تلقائياً ──────────────────────────
-- تُستخدم في triggers تحديث الطوابع الزمنية
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$;

-- ── دالة set_updated_at (اسم بديل مستخدم في بعض الـ migrations) ──
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- إذن للمستخدمين المصادق عليهم على القراءة (ليس التنفيذ المباشر)
COMMENT ON FUNCTION public.update_updated_at_column() IS
    'Trigger function: يحدّث حقل updated_at تلقائياً عند كل UPDATE';

COMMENT ON FUNCTION public.set_updated_at() IS
    'Trigger function: بديل لـ update_updated_at_column — نفس الوظيفة';
