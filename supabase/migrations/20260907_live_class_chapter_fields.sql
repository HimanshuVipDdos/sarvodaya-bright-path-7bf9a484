-- ============================================================
-- Migration: Add subject / chapter / lecture_number to live_classes
-- Run this once in Supabase Dashboard -> SQL Editor
-- ============================================================

ALTER TABLE public.live_classes
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS chapter TEXT,
  ADD COLUMN IF NOT EXISTS lecture_number INT;

-- Update manual "End Live Class Now" to forward the new fields
CREATE OR REPLACE FUNCTION public.end_live_class_now(p_class_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  rec RECORD;
  new_lecture_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can end a live class';
  END IF;

  SELECT * INTO rec FROM public.live_classes WHERE id = p_class_id;
  IF rec IS NULL THEN
    RAISE EXCEPTION 'Live class not found';
  END IF;

  IF rec.recorded_lecture_id IS NOT NULL THEN
    UPDATE public.live_classes SET is_live = false WHERE id = p_class_id;
    RETURN rec.recorded_lecture_id;
  END IF;

  INSERT INTO public.lectures
    (batch_id, title, description, thumbnail_url, video_url, duration_minutes,
     is_published, source_live_class_id, subject, chapter, lecture_number)
  VALUES
    (rec.batch_id, rec.title, rec.description, rec.thumbnail_url, rec.youtube_url,
     rec.duration_minutes, true, rec.id, rec.subject, rec.chapter, rec.lecture_number)
  RETURNING id INTO new_lecture_id;

  UPDATE public.live_classes
     SET is_live = false,
         recorded_lecture_id = new_lecture_id
   WHERE id = p_class_id;

  RETURN new_lecture_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.end_live_class_now(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.end_live_class_now(uuid) TO authenticated;

-- Update auto tick function to forward new fields too
CREATE OR REPLACE FUNCTION public.tick_live_classes()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE rec RECORD; new_lecture_id uuid;
BEGIN
  UPDATE public.live_classes SET is_live = true
   WHERE auto_start = true AND is_live = false AND scheduled_at <= now()
     AND (end_at IS NULL OR end_at > now()) AND recorded_lecture_id IS NULL;

  FOR rec IN SELECT * FROM public.live_classes
    WHERE auto_end = true AND is_live = true AND end_at IS NOT NULL
      AND end_at <= now() AND recorded_lecture_id IS NULL
  LOOP
    INSERT INTO public.lectures
      (batch_id, title, description, thumbnail_url, video_url, duration_minutes,
       is_published, source_live_class_id, subject, chapter, lecture_number)
    VALUES
      (rec.batch_id, rec.title, rec.description, rec.thumbnail_url, rec.youtube_url,
       rec.duration_minutes, true, rec.id, rec.subject, rec.chapter, rec.lecture_number)
    RETURNING id INTO new_lecture_id;

    UPDATE public.live_classes
       SET is_live = false,
           recorded_lecture_id = new_lecture_id
     WHERE id = rec.id;
  END LOOP;
END;
$func$;

REVOKE ALL ON FUNCTION public.tick_live_classes() FROM public;
GRANT EXECUTE ON FUNCTION public.tick_live_classes() TO service_role;

