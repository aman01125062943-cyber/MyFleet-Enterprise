-- ==========================================
-- NUCLEAR OPTION: DELETE USER TO RE-REGISTER
-- ==========================================

-- This will delete the user completely from the system.
-- After running this, go to "Register" and create the account again.

DELETE FROM auth.users WHERE email = 'aman01125062943@gmail.com';
DELETE FROM public.profiles WHERE username = 'aman01125062943@gmail.com';

-- Verify deletion (Should return 0 rows)
SELECT * FROM auth.users WHERE email = 'aman01125062943@gmail.com';
