-- Faculty admin UI edits a `qualification` field; add the column to match.
ALTER TABLE public.faculty ADD COLUMN IF NOT EXISTS qualification TEXT;
