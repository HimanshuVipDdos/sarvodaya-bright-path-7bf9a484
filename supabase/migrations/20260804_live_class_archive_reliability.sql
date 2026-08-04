-- Keep automatic archiving identical to the manual “End now” path and preserve its source link.
CREATE OR REPLACE FUNCTION public.tick_live_classes()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec RECORD; new_lecture_id uuid;
BEGIN
  UPDATE public.live_classes SET is_live = true
   WHERE auto_start = true AND is_live = false AND scheduled_at <= now()
     AND (end_at IS NULL OR end_at > now()) AND recorded_lecture_id IS NULL;
  FOR rec IN SELECT * FROM public.live_classes
    WHERE auto_end = true AND is_live = true AND end_at IS NOT NULL
      AND end_at <= now() AND recorded_lecture_id IS NULL
  LOOP
    INSERT INTO public.lectures (batch_id, title, description, thumbnail_url, video_url, duration_minutes, is_published, source_live_class_id)
    VALUES (rec.batch_id, rec.title, rec.description, rec.thumbnail_url, rec.youtube_url, rec.duration_minutes, true, rec.id)
    RETURNING id INTO new_lecture_id;
    UPDATE public.live_classes SET is_live = false, recorded_lecture_id = new_lecture_id WHERE id = rec.id;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.tick_live_classes() FROM public;
GRANT EXECUTE ON FUNCTION public.tick_live_classes() TO service_role;
