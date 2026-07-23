-- Fix: lectures.source_live_class_id currently blocks deletion of live_classes
-- rows once a recording has been archived. Make it non-blocking (SET NULL),
-- and add source_live_class_id if it's somehow missing on this environment.
ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS source_live_class_id uuid;

DO $$
BEGIN
  ALTER TABLE public.lectures DROP CONSTRAINT IF EXISTS lectures_source_live_class_id_fkey;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.lectures
  ADD CONSTRAINT lectures_source_live_class_id_fkey
  FOREIGN KEY (source_live_class_id) REFERENCES public.live_classes(id) ON DELETE SET NULL;

-- Manual "End Live Class Now" button support — mirrors the existing
-- tick_live_classes() auto-end logic, but runs instantly on admin click
-- instead of waiting for the scheduled end_at / cron tick.
CREATE OR REPLACE FUNCTION public.end_live_class_now(p_class_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Already archived earlier — just make sure it's marked not-live and
  -- return the existing recorded lecture instead of creating a duplicate.
  IF rec.recorded_lecture_id IS NOT NULL THEN
    UPDATE public.live_classes SET is_live = false WHERE id = p_class_id;
    RETURN rec.recorded_lecture_id;
  END IF;

  INSERT INTO public.lectures
    (batch_id, title, description, thumbnail_url, video_url, duration_minutes, is_published, source_live_class_id)
  VALUES
    (rec.batch_id, rec.title, rec.description, rec.thumbnail_url, rec.youtube_url, rec.duration_minutes, true, rec.id)
  RETURNING id INTO new_lecture_id;

  UPDATE public.live_classes
     SET is_live = false,
         recorded_lecture_id = new_lecture_id
   WHERE id = p_class_id;

  RETURN new_lecture_id;
END;
$$;

REVOKE ALL ON FUNCTION public.end_live_class_now(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.end_live_class_now(uuid) TO authenticated;
