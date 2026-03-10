
-- أضف هذا الكود في محرر SQL في Supabase (SQL Editor) ثم اضغط Run
-- هذا الكود يضيف العمود المفقود الذي يسبب الخطأ في لوحة التحكم

ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS manual_extension_end TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- تحديث وصف الحقل للتوثيق
COMMENT ON COLUMN public.organizations.manual_extension_end IS 'تاريخ انتهاء التمديد اليدوي (Override) الذي يحدده الأدمن';
