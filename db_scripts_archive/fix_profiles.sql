-- Link orphans from auth.users to public.profiles
-- This script ensures every user in the authentication system has a profile record

INSERT INTO public.profiles (id, username, full_name, role, status, created_at)
SELECT 
    au.id,
    au.email, -- Use email as default username
    COALESCE(au.raw_user_meta_data->>'full_name', 'User'), -- Try to get name from metadata or default
    COALESCE(au.raw_user_meta_data->>'role', 'staff'), -- Default role
    'active',
    NOW()
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = au.id
);

-- Ensure RLS allows users to read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Ensure RLS allows users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE
    USING (auth.uid() = id);
