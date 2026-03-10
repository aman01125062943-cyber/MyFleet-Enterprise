-- استبدل البريد الإلكتروني أدناه ببريدك الإلكتروني المستخدم في الدخول
UPDATE profiles
SET role = 'super_admin'
WHERE email = 'YOUR_EMAIL@HERE';

-- أو إذا كنت تريد ترقية جميع الـ Owners (للتسهيل في البيئة التجريبية)
-- UPDATE profiles SET role = 'super_admin' WHERE role = 'owner';
