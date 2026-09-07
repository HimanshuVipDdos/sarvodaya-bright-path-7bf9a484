-- Add exam_goal column to profiles for student goal selection
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS exam_goal text;