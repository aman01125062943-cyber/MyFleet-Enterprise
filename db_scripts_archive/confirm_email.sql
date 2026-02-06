-- ==========================================
-- FORCE EMAIL CONFIRMATION
-- ==========================================

-- This script manually verifies the email address so you can login immediately.

UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'aman01125062943@gmail.com';

-- Check if it worked
SELECT email, email_confirmed_at FROM auth.users WHERE email = 'aman01125062943@gmail.com';
