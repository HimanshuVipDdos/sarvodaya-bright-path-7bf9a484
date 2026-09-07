ALTER TABLE public.study_materials
  ADD COLUMN IF NOT EXISTS lecture_id uuid REFERENCES public.lectures(id) ON DELETE SET NULL;
