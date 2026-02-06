-- Enable RLS
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- 1. Allow Users to View Drivers in their Org
CREATE POLICY "Users can view drivers in their org" ON drivers
FOR SELECT USING (
  org_id IN (
    SELECT org_id FROM profiles WHERE id = auth.uid()
  )
);

-- 2. Allow Admins/Owners to INSERT Drivers
CREATE POLICY "Admins can insert drivers" ON drivers
FOR INSERT WITH CHECK (
  org_id IN (
    SELECT org_id FROM profiles WHERE id = auth.uid() AND (role = 'owner' OR role = 'admin')
  )
);

-- 3. Allow Admins/Owners to DELETE Drivers
CREATE POLICY "Admins can delete drivers" ON drivers
FOR DELETE USING (
  org_id IN (
    SELECT org_id FROM profiles WHERE id = auth.uid() AND (role = 'owner' OR role = 'admin')
  )
);
