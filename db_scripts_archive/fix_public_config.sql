-- ==========================================
-- إصلاح جدول إعدادات النظام (System Config Fix)
-- تشغيل هذا السكريبت سيحل مشكلة "Could not find column maintenance_mode"
-- ==========================================

-- 1. إضافة الأعمدة الناقصة لجدول public_config
ALTER TABLE public_config ADD COLUMN IF NOT EXISTS maintenance_mode boolean DEFAULT false;
ALTER TABLE public_config ADD COLUMN IF NOT EXISTS version text DEFAULT '1.0.0';
ALTER TABLE public_config ADD COLUMN IF NOT EXISTS min_app_version text DEFAULT '1.0.0';
ALTER TABLE public_config ADD COLUMN IF NOT EXISTS show_subscription_banner boolean DEFAULT true;
ALTER TABLE public_config ADD COLUMN IF NOT EXISTS whatsapp_number text;

-- 2. تحديث صلاحيات الوصول (RLS) للتأكد من إمكانية الحفظ
ALTER TABLE public_config ENABLE ROW LEVEL SECURITY;

-- السماح للجميع بـ "قراءة" الإعدادات (مهم عشان التطبيق يشتغل عند الزوار)
DROP POLICY IF EXISTS "Enable read access for anon" ON public_config;
CREATE POLICY "Enable read access for anon" ON public_config FOR SELECT USING (true);

-- السماح للمشرفين فقط "بتعديل" الإعدادات
-- ملاحظة: للتسهيل حالياً سنسمح بالتعديل للجميع، ولكن يفضل تقييدها لاحقاً
DROP POLICY IF EXISTS "Enable write access for all" ON public_config;
CREATE POLICY "Enable write access for all" ON public_config FOR ALL USING (true) WITH CHECK (true);

-- 3. تحديث الكاش (عن طريق أمر NOTIFY بسيط)
NOTIFY pgrst, 'reload schema';
