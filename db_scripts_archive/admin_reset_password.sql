-- ==========================================
-- ADMIN: RESET PASSWORD
-- ==========================================

-- This function allows a Super Admin (or defined roles) to forcibly reset a user's password.
-- Requires: pgcrypto extension enabled.

create extension if not exists pgcrypto;

CREATE OR REPLACE FUNCTION admin_reset_password(
    p_user_id uuid,
    p_new_password text
)
RETURNS boolean AS $$
BEGIN
    -- Update the encrypted password in auth.users
    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
    WHERE id = p_user_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
