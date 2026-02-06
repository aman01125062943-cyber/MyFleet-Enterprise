-- إضافة أعمدة الإعلانات إلى جدول الإعدادات العامة
ALTER TABLE public_config
ADD COLUMN IF NOT EXISTS announcement_data jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS show_announcement boolean DEFAULT false;

-- مثال على البيانات:
-- announcement_data = {
--   "title": "تحديث جديد!",
--   "body": "تم إضافة ميزة الأصول...",
--   "date": "2024-01-29",
--   "target_plans": ["pro", "starter"],
--   "version": "1.1"
-- }
