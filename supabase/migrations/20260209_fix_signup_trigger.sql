-- Secure Trigger Function with Error Handling
CREATE OR REPLACE FUNCTION public.handle_new_user_whatsapp()
RETURNS TRIGGER AS $$
BEGIN
  -- Wrap in a block to catch errors and prevent signup failure
  BEGIN
    INSERT INTO public.whatsapp_notifications (type, recipient_phone, template_vars)
    VALUES (
      'trial_welcome',
      COALESCE(NEW.raw_user_meta_data->>'whatsapp', ''), -- Handle missing number gracefully
      jsonb_build_object(
        'name', COALESCE(NEW.raw_user_meta_data->>'full_name', 'مشترك جديد'),
        'trial_days', 14
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but DO NOT block the signup
    RAISE WARNING 'Failed to create WhatsApp notification for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
