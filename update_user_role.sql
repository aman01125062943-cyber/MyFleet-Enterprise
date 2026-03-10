-- Update user role to super_admin
UPDATE profiles 
SET role = 'super_admin'
WHERE email = 'aman01125062943@gmail.com';

-- Verify the update
SELECT id, email, role, full_name 
FROM profiles 
WHERE email = 'aman01125062943@gmail.com';
