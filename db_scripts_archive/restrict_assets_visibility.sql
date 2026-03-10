-- 1. إضافة عمود لربط الأصل بالمستخدم (الموظف)
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. تحديث سياسات الأمان (RLS)
DROP POLICY IF EXISTS "Assets access for org members" ON assets;

CREATE POLICY "Assets access for org members" ON assets
    FOR ALL
    USING (
        org_id IN (
            SELECT org_id FROM profiles WHERE id = auth.uid()
        )
        AND (
            -- 1. المالك والأدمن يرون كل شيء
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() 
                AND role IN ('owner', 'admin')
            )
            OR 
            -- 2. المستخدم العادي يرى فقط الأصول المسندة إليه
            assigned_user_id = auth.uid()
            OR
            -- 3. أو إذا كان هو من أنشأ الأصل (اختياري، لكن مفيد)
            assigned_user_id IS NULL -- (مؤقتاً: الأصول غير المسندة تظهر للجميع أو يمكن تغيير هذا الشرط)
        )
    );

-- تحديث السياسة لتكون أكثر صرامة (السابق كان يسمح برؤية الكل إذا لم يكن مسند)
-- النسخة الصارمة:
DROP POLICY IF EXISTS "Strict assets visibility" ON assets;
CREATE POLICY "Strict assets visibility" ON assets
    FOR ALL
    USING (
        org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
        AND (
            (SELECT role FROM profiles WHERE id = auth.uid()) IN ('owner', 'admin')
            OR
            assigned_user_id = auth.uid()
        )
    )
    WITH CHECK (
        org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
        AND (
            (SELECT role FROM profiles WHERE id = auth.uid()) IN ('owner', 'admin')
        )
    );
