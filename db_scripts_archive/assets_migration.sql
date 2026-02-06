-- ==========================================
-- 1. إنشاء جدول الأصول (Assets)
-- ==========================================
CREATE TABLE IF NOT EXISTS assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    car_id uuid REFERENCES cars(id) ON DELETE SET NULL, -- اختياري: لربط الأصل بسيارة
    asset_type text CHECK (asset_type IN ('car', 'equipment', 'property', 'other')),
    name text,
    purchase_price numeric DEFAULT 0,
    purchase_date date DEFAULT CURRENT_DATE,
    current_value numeric DEFAULT 0,
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'sold')),
    assigned_driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
    sale_price numeric DEFAULT 0,
    sale_date date,
    notes text,
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 2. إنشاء جدول الأقساط (Asset Installments)
-- ==========================================
CREATE TABLE IF NOT EXISTS asset_installments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id uuid REFERENCES assets(id) ON DELETE CASCADE,
    amount numeric NOT NULL,
    due_date date NOT NULL,
    paid_date date,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 3. تفعيل الأمان (RLS)
-- ==========================================
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_installments ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان للأصول
DROP POLICY IF EXISTS "Assets access for org members" ON assets;
CREATE POLICY "Assets access for org members" ON assets
    FOR ALL
    USING (org_id IN (
        SELECT org_id FROM profiles 
        WHERE id = auth.uid() 
        AND (role IN ('owner', 'admin', 'supervisor') OR (permissions->'assets'->>'view')::boolean = true)
    ))
    WITH CHECK (org_id IN (
        SELECT org_id FROM profiles 
        WHERE id = auth.uid() 
        AND (role IN ('owner', 'admin') OR (permissions->'assets'->>'add')::boolean = true)
    ));

-- سياسات الأمان للأقساط (تتبع الأصول)
DROP POLICY IF EXISTS "Installments access via asset" ON asset_installments;
CREATE POLICY "Installments access via asset" ON asset_installments
    FOR ALL
    USING (asset_id IN (
        SELECT id FROM assets 
        WHERE org_id IN (
            SELECT org_id FROM profiles 
            WHERE id = auth.uid()
        )
    ))
    WITH CHECK (asset_id IN (
        SELECT id FROM assets 
        WHERE org_id IN (
            SELECT org_id FROM profiles 
            WHERE id = auth.uid() 
            AND (role IN ('owner', 'admin') OR (permissions->'assets'->>'edit')::boolean = true)
        )
    ));
