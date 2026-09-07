-- ============================================================
-- Migration: Daily Streak tracking for students
-- Run this in Supabase Dashboard -> SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak int NOT NULL DEFAULT 0,
  longest_streak int NOT NULL DEFAULT 0,
  last_activity_date date NOT NULL DEFAULT CURRENT_DATE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user reads own streak" ON public.user_streaks;
CREATE POLICY "user reads own streak" ON public.user_streaks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user updates own streak" ON public.user_streaks;
CREATE POLICY "user updates own streak" ON public.user_streaks
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin reads all streaks" ON public.user_streaks;
CREATE POLICY "admin reads all streaks" ON public.user_streaks
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.record_daily_activity()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rec RECORD;
  today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  new_streak int;
  new_longest int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO rec FROM public.user_streaks WHERE user_id = uid;

  IF rec IS NULL THEN
    INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_activity_date)
    VALUES (uid, 1, 1, today);
    RETURN jsonb_build_object('current_streak', 1, 'longest_streak', 1, 'is_new_day', true);
  END IF;

  IF rec.last_activity_date = today THEN
    RETURN jsonb_build_object(
      'current_streak', rec.current_streak,
      'longest_streak', rec.longest_streak,
      'is_new_day', false
    );
  ELSIF rec.last_activity_date = today - INTERVAL '1 day' THEN
    new_streak := rec.current_streak + 1;
    new_longest := GREATEST(new_streak, rec.longest_streak);
    UPDATE public.user_streaks
      SET current_streak = new_streak,
          longest_streak = new_longest,
          last_activity_date = today,
          updated_at = now()
    WHERE user_id = uid;
    RETURN jsonb_build_object(
      'current_streak', new_streak,
      'longest_streak', new_longest,
      'is_new_day', true
    );
  ELSE
    UPDATE public.user_streaks
      SET current_streak = 1,
          last_activity_date = today,
          updated_at = now()
    WHERE user_id = uid;
    RETURN jsonb_build_object(
      'current_streak', 1,
      'longest_streak', rec.longest_streak,
      'is_new_day', true,
      'streak_broken', true
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_daily_activity() FROM public;
GRANT EXECUTE ON FUNCTION public.record_daily_activity() TO authenticated;