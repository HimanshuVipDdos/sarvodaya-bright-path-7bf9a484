
-- Columns for scheduling automation
ALTER TABLE public.live_classes
  ADD COLUMN IF NOT EXISTS auto_start boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_end boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS end_at timestamptz,
  ADD COLUMN IF NOT EXISTS recorded_lecture_id uuid REFERENCES public.lectures(id) ON DELETE SET NULL;

-- Keep end_at in sync with scheduled_at + duration_minutes
CREATE OR REPLACE FUNCTION public.live_classes_sync_end_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.scheduled_at IS NOT NULL AND NEW.duration_minutes IS NOT NULL THEN
    NEW.end_at := NEW.scheduled_at + make_interval(mins => NEW.duration_minutes);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_live_classes_sync_end_at ON public.live_classes;
CREATE TRIGGER trg_live_classes_sync_end_at
BEFORE INSERT OR UPDATE ON public.live_classes
FOR EACH ROW EXECUTE FUNCTION public.live_classes_sync_end_at();

-- Backfill end_at for existing rows
UPDATE public.live_classes
   SET end_at = scheduled_at + make_interval(mins => COALESCE(duration_minutes, 60))
 WHERE end_at IS NULL;

-- Scheduler: flip is_live on/off and create the recorded lecture on end
CREATE OR REPLACE FUNCTION public.tick_live_classes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  new_lecture_id uuid;
BEGIN
  -- Auto-start: scheduled time reached, not yet live, no end yet
  UPDATE public.live_classes
     SET is_live = true
   WHERE auto_start = true
     AND is_live = false
     AND scheduled_at <= now()
     AND (end_at IS NULL OR end_at > now())
     AND recorded_lecture_id IS NULL;

  -- Auto-end: duration elapsed, currently live, archive to lectures
  FOR rec IN
    SELECT * FROM public.live_classes
     WHERE auto_end = true
       AND is_live = true
       AND end_at IS NOT NULL
       AND end_at <= now()
       AND recorded_lecture_id IS NULL
  LOOP
    INSERT INTO public.lectures (batch_id, title, description, thumbnail_url, video_url, duration_minutes, is_published)
    VALUES (rec.batch_id, rec.title, rec.description, rec.thumbnail_url, rec.youtube_url, rec.duration_minutes, true)
    RETURNING id INTO new_lecture_id;

    UPDATE public.live_classes
       SET is_live = false,
           recorded_lecture_id = new_lecture_id
     WHERE id = rec.id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.tick_live_classes() FROM public;
GRANT EXECUTE ON FUNCTION public.tick_live_classes() TO service_role;

-- Schedule via pg_cron (every minute)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('tick-live-classes');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('tick-live-classes', '* * * * *', $$SELECT public.tick_live_classes();$$);
