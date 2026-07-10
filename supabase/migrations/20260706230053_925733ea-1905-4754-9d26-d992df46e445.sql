ALTER TABLE public.live_classes 
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS chapter TEXT,
  ADD COLUMN IF NOT EXISTS chapter_order INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS live_classes_batch_chapter_idx ON public.live_classes(batch_id, chapter_order);