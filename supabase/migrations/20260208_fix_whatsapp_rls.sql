-- ============================================================================
-- إصلاح سياسات RLS لجدول whatsapp_sessions
-- السماح لـ super_admin بجميع العمليات (بما فيها الحذف)
-- تنفيذ: Supabase Dashboard > SQL Editor
-- ============================================================================

-- إضافة سياسة جديدة لـ super_admin للتحكم الكامل
CREATE POLICY "Super admins can manage all sessions"
    ON whatsapp_sessions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );
