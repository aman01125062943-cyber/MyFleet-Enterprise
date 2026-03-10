
-- أضف هذا الكود في محرر SQL في Supabase (SQL Editor) ثم اضغط Run
-- هذا الكود يضمن حفظ الصلاحيات المخصصة بشكل صحيح عند التعديل من صفحة الفريق

CREATE OR REPLACE FUNCTION public.update_permissions(
    p_target_user_id UUID,
    p_new_permissions JSONB,
    p_new_role TEXT,
    p_admin_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- يمكن إضافة تحقق إضافي هنا للتأكد من أن p_admin_id لديه صلاحية (اختياري)
  
  -- تحديث الدور والصلاحيات للمستخدم المستهدف
  UPDATE public.profiles
  SET 
    role = p_new_role,
    permissions = p_new_permissions
  WHERE id = p_target_user_id;

  -- تسجيل العملية في سجل التدقيق (اختياري، إذا كان الجدول موجوداً)
  -- INSERT INTO public.audit_logs ...
END;
$$;
