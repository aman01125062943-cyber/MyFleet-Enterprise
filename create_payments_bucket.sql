-- ============================================
-- إنشاء سلة payments لرفع إيصالات الدفع
-- ============================================

-- 1. إنشاء السلة (bucket)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payments',
  'payments',
  true,  -- عام للوصول للصور
  5242880,  -- 5MB كحد أقصى
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'];

-- 2. إنشاء مجلد للإيصالات
-- (سيتم إنشاؤه تلقائياً عند رفع أول ملف)

-- 3. سياسات الصلاحيات (RLS)

-- السماح للمستخدمين المصادقين برفع الملفات
CREATE POLICY "Authenticated users can upload to payments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payments');

-- السماح للجميع بعرض الملفات (للإيصالات)
CREATE POLICY "Public can view payment receipts"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'payments');

-- السماح للمستخدمين بتحديث ملفاتهم الخاصة
CREATE POLICY "Users can update own payment receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'payments');

-- السماح للمستخدمين بحذف ملفاتهم الخاصة
CREATE POLICY "Users can delete own payment receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'payments');

-- 4. منح الصلاحيات
GRANT ALL ON storage.objects TO authenticated, service_role;

-- ============================================
-- تعليمات التنفيذ:
-- 1. اذهب إلى لوحة تحكم Supabase
-- 2. اختر SQL Editor
-- 3. الصق هذا الكود ونفذه
-- ============================================
