-- Create function to enqueue welcome message on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_whatsapp()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into notification queue
  INSERT INTO public.whatsapp_notifications (type, recipient_phone, template_vars)
  VALUES (
    'trial_welcome',
    NEW.raw_user_meta_data->>'whatsapp', -- Get WhatsApp from user metadata
    jsonb_build_object(
      'name', COALESCE(NEW.raw_user_meta_data->>'full_name', 'مشترك جديد'),
      'trial_days', 14 -- Default trial period
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users (Supabase handles user creation here)
-- Note: Trigger name must be unique. Drop if exists to be safe.
DROP TRIGGER IF EXISTS on_auth_user_created_whatsapp ON auth.users;

CREATE TRIGGER on_auth_user_created_whatsapp
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_whatsapp();
