-- Ported from BarrelConnect migration 091_notifications_fcm_trigger.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- pg_net is pre-installed by Supabase in the `net` schema — no extension install needed.
-- Secrets are stored in Supabase Vault. Run once in SQL Editor before applying this migration:
--
--   SELECT vault.create_secret('https://<project-ref>.supabase.co', 'supabase_url');
--   SELECT vault.create_secret('<your-service-role-key>', 'service_role_key');
--
CREATE OR REPLACE FUNCTION public.handle_new_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_role_key TEXT;
  v_supabase_url     TEXT;
BEGIN
  SELECT decrypted_secret INTO v_service_role_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  SELECT decrypted_secret INTO v_supabase_url
    FROM vault.decrypted_secrets WHERE name = 'supabase_url';

  -- Skip silently if the secrets haven't been configured yet
  IF v_service_role_key IS NULL OR v_supabase_url IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body    := jsonb_build_object(
      'user_id', NEW.user_id,
      'title',   NEW.title,
      'body',    NEW.body,
      'data',    COALESCE(NEW.data, '{}'::jsonb) || jsonb_build_object(
        'type',               NEW.type,
        'related_post_id',    COALESCE(NEW.related_post_id::text,    ''),
        'related_user_id',    COALESCE(NEW.related_user_id::text,    ''),
        'related_message_id', COALESCE(NEW.related_message_id::text, ''),
        'related_group_id',   COALESCE(NEW.related_group_id::text,   '')
      )
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_send_fcm_on_notification ON public.notifications;
CREATE TRIGGER trg_send_fcm_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_notification();
