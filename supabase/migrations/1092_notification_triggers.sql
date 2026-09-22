-- Ported from BarrelConnect migration 092_notification_triggers.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- =============================================================================
-- Notification triggers for:
--   1. Post likes
--   2. Post comments (top-level) and comment replies
--   3. Direct messages
--   4. Group messages
--   5. Marketplace listing views
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Post like → notify post owner
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_post_like_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner_id UUID;
  v_liker_name    TEXT;
BEGIN
  SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = NEW.post_id;

  -- Don't notify if the liker IS the post owner
  IF v_post_owner_id IS NULL OR v_post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(name, 'Someone') INTO v_liker_name
    FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications
    (user_id, type, title, body, related_user_id, related_post_id, data)
  VALUES (
    v_post_owner_id,
    'post_like',
    'New Like',
    v_liker_name || ' liked your post',
    NEW.user_id,
    NEW.post_id,
    jsonb_build_object('post_id', NEW.post_id::text)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_like_notification ON public.post_likes;
CREATE TRIGGER trg_post_like_notification
  AFTER INSERT ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_post_like_notification();


-- ---------------------------------------------------------------------------
-- 2. Post comment / reply → notify post owner and/or parent comment owner
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_post_comment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner_id   UUID;
  v_parent_owner_id UUID;
  v_commenter_name  TEXT;
  v_extra_data      JSONB;
BEGIN
  SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = NEW.post_id;

  SELECT COALESCE(name, 'Someone') INTO v_commenter_name
    FROM public.profiles WHERE id = NEW.user_id;

  v_extra_data := jsonb_build_object(
    'post_id',    NEW.post_id::text,
    'comment_id', NEW.id::text
  );

  IF NEW.parent_comment_id IS NULL THEN
    -- ── Top-level comment on a post ──────────────────────────────────────
    IF v_post_owner_id IS NOT NULL AND v_post_owner_id != NEW.user_id THEN
      INSERT INTO public.notifications
        (user_id, type, title, body, related_user_id, related_post_id, data)
      VALUES (
        v_post_owner_id,
        'new_comment',
        'New Comment',
        v_commenter_name || ' commented on your post',
        NEW.user_id,
        NEW.post_id,
        v_extra_data
      );
    END IF;

  ELSE
    -- ── Reply to an existing comment ─────────────────────────────────────
    SELECT user_id INTO v_parent_owner_id
      FROM public.post_comments WHERE id = NEW.parent_comment_id;

    -- Notify the author of the parent comment ("someone replied to your comment")
    IF v_parent_owner_id IS NOT NULL AND v_parent_owner_id != NEW.user_id THEN
      INSERT INTO public.notifications
        (user_id, type, title, body, related_user_id, related_post_id, data)
      VALUES (
        v_parent_owner_id,
        'comment_reply',
        'New Reply',
        v_commenter_name || ' replied to your comment',
        NEW.user_id,
        NEW.post_id,
        v_extra_data
      );
    END IF;

    -- Also notify the post owner ("someone replied on your post"),
    -- but only if they're different from both the commenter and parent comment author
    -- to avoid sending a duplicate notification.
    IF v_post_owner_id IS NOT NULL
       AND v_post_owner_id != NEW.user_id
       AND v_post_owner_id != v_parent_owner_id THEN
      INSERT INTO public.notifications
        (user_id, type, title, body, related_user_id, related_post_id, data)
      VALUES (
        v_post_owner_id,
        'post_reply',
        'New Reply',
        v_commenter_name || ' replied on your post',
        NEW.user_id,
        NEW.post_id,
        v_extra_data
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_comment_notification ON public.post_comments;
CREATE TRIGGER trg_post_comment_notification
  AFTER INSERT ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_post_comment_notification();


-- ---------------------------------------------------------------------------
-- 3. Direct message → notify recipient
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_direct_message_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name TEXT;
BEGIN
  SELECT COALESCE(name, 'Someone') INTO v_sender_name
    FROM public.profiles WHERE id = NEW.sender_id;

  INSERT INTO public.notifications
    (user_id, type, title, body, related_user_id, related_message_id, data)
  VALUES (
    NEW.recipient_id,
    'new_message',
    'New Message',
    v_sender_name || ' sent you a message',
    NEW.sender_id,
    NEW.id,
    jsonb_build_object(
      'chat_id',     NEW.sender_id::text,
      'sender_name', v_sender_name
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_direct_message_notification ON public.messages;
CREATE TRIGGER trg_direct_message_notification
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_direct_message_notification();


-- ---------------------------------------------------------------------------
-- 4. Group message → notify all group members except the sender
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_group_message_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name TEXT;
  v_group_name  TEXT;
  v_member_id   UUID;
BEGIN
  SELECT COALESCE(name, 'Someone') INTO v_sender_name
    FROM public.profiles WHERE id = NEW.sender_id;

  SELECT name INTO v_group_name
    FROM public.group_chats WHERE id = NEW.group_id;

  FOR v_member_id IN
    SELECT user_id
      FROM public.group_chat_members
     WHERE group_id = NEW.group_id
       AND user_id  != NEW.sender_id
  LOOP
    INSERT INTO public.notifications
      (user_id, type, title, body, related_user_id, related_message_id, related_group_id, data)
    VALUES (
      v_member_id,
      'group_message',
      COALESCE(v_group_name, 'Group'),
      v_sender_name || ' sent a message',
      NEW.sender_id,
      NEW.id,
      NEW.group_id,
      jsonb_build_object(
        'group_id',    NEW.group_id::text,
        'group_name',  COALESCE(v_group_name, 'Group'),
        'sender_name', v_sender_name
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_group_message_notification ON public.group_messages;
CREATE TRIGGER trg_group_message_notification
  AFTER INSERT ON public.group_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_group_message_notification();


-- ---------------------------------------------------------------------------
-- 5. Marketplace listing view → notify listing owner
--    Deduplicates: at most one notification per (viewer, listing) per 24 hours.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_marketplace_view_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_owner_id UUID;
  v_listing_title    TEXT;
  v_viewer_name      TEXT;
BEGIN
  -- Only fire for view events with a known (logged-in) viewer
  IF NEW.event_type != 'view' OR NEW.viewer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id, title
    INTO v_listing_owner_id, v_listing_title
    FROM public.marketplace_listings
   WHERE id = NEW.listing_id;

  -- Don't notify if the viewer is the listing owner
  IF v_listing_owner_id IS NULL OR v_listing_owner_id = NEW.viewer_id THEN
    RETURN NEW;
  END IF;

  -- Deduplicate: skip if we already sent a view notification for this
  -- viewer + listing in the last 24 hours
  IF EXISTS (
    SELECT 1 FROM public.notifications
     WHERE user_id = v_listing_owner_id
       AND type    = 'marketplace_view'
       AND data->>'listing_id' = NEW.listing_id::text
       AND data->>'viewer_id'  = NEW.viewer_id::text
       AND created_at > NOW() - INTERVAL '24 hours'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(name, 'Someone') INTO v_viewer_name
    FROM public.profiles WHERE id = NEW.viewer_id;

  INSERT INTO public.notifications
    (user_id, type, title, body, related_user_id, data)
  VALUES (
    v_listing_owner_id,
    'marketplace_view',
    'Listing Viewed',
    v_viewer_name || ' viewed your listing "' || COALESCE(v_listing_title, 'your item') || '"',
    NEW.viewer_id,
    jsonb_build_object(
      'listing_id',    NEW.listing_id::text,
      'listing_title', COALESCE(v_listing_title, ''),
      'viewer_id',     NEW.viewer_id::text
    )
  );

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'listing_analytics'
  ) THEN
    DROP TRIGGER IF EXISTS trg_marketplace_view_notification ON public.listing_analytics;
    CREATE TRIGGER trg_marketplace_view_notification
      AFTER INSERT ON public.listing_analytics
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_marketplace_view_notification();
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 6. New follower → notify the followed user
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_follower_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_follower_name TEXT;
BEGIN
  SELECT COALESCE(name, 'Someone') INTO v_follower_name
    FROM public.profiles WHERE id = NEW.follower_id;

  INSERT INTO public.notifications
    (user_id, type, title, body, related_user_id)
  VALUES (
    NEW.following_id,
    'new_follower',
    'New Follower',
    v_follower_name || ' started following you',
    NEW.follower_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_follower_notification ON public.follows;
CREATE TRIGGER trg_new_follower_notification
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_follower_notification();
