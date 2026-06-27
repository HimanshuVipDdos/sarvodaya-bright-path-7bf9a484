
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP POLICY IF EXISTS "Anyone submits inquiry" ON public.inquiries;
CREATE POLICY "Anyone submits inquiry" ON public.inquiries
  FOR INSERT
  WITH CHECK (length(trim(full_name)) > 1 AND length(trim(phone)) >= 7);
