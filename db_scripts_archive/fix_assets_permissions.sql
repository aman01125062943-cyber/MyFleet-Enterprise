-- تحديث صلاحيات جميع المستخدمين الحاليين (Admin/Owner) ليشملوا قسم الأصول
UPDATE profiles
SET permissions = jsonb_set(
    permissions,
    '{assets}',
    '{"view": true, "add": true, "edit": true, "delete": true}'::jsonb
)
WHERE role IN ('owner', 'admin');

-- للصفوف الأخرى (Supervisor) يمكن إعطاؤهم صلاحية العرض فقط
UPDATE profiles
SET permissions = jsonb_set(
    permissions,
    '{assets}',
    '{"view": true, "add": false, "edit": false, "delete": false}'::jsonb
)
WHERE role = 'supervisor';
