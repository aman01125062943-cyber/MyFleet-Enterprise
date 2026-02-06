-- Enable RLS on profiles if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy for Super Admins (Owner/Admin with no org_id) to VIEW ALL profiles
CREATE POLICY "Super Admins can view all profiles" 
ON profiles FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND (role = 'owner' OR role = 'admin') 
    AND org_id IS NULL
  )
);

-- Policy for Super Admins to UPDATE ALL profiles (e.g. disable users)
CREATE POLICY "Super Admins can update all profiles" 
ON profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND (role = 'owner' OR role = 'admin') 
    AND org_id IS NULL
  )
);

-- Policy for Super Admins to DELETE ALL profiles
CREATE POLICY "Super Admins can delete all profiles" 
ON profiles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND (role = 'owner' OR role = 'admin') 
    AND org_id IS NULL
  )
);
