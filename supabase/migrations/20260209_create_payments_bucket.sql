-- إنشاء سلة payments لرفع إيصالات الدفع
-- Migration: 20260209_create_payments_bucket

-- إنشاء السلة
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payments',
  'payments',
  false,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- سياسات الأمان (RLS)

-- السماح بالقراءة للموثقين فقط
CREATE POLICY "Authenticated users can view payments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'payments');

-- السماح بالرفع للموثقين
CREATE POLICY "Authenticated users can upload payments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payments');

-- السماح بالتحديث للمالك فقط
CREATE POLICY "Users can update their own payments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'payments' AND auth.uid()::text = (storage.foldername(name))[0]);

-- السماح بالحذف للمالك فقط
CREATE POLICY "Users can delete their own payments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'payments' AND auth.uid()::text = (storage.foldername(name))[0]);

-- منع الحذف بعد الموافقة على الطلب
CREATE POLICY "Prevent deletion of approved payment receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payments' AND
  NOT EXISTS (
    SELECT 1 FROM payment_requests
    WHERE receipt_url = storage.prefix_id(name, 0)
    AND status IN ('approved', 'paid')
  )
);
