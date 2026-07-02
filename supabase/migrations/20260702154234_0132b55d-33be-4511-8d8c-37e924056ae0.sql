
-- Restore has_role to SECURITY DEFINER so RLS policies work for anon & authenticated users
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated, service_role;

-- Storage policies for batch-covers bucket (private, admins manage, anyone can read since signed URLs are used)
DROP POLICY IF EXISTS "Admins upload batch covers" ON storage.objects;
DROP POLICY IF EXISTS "Admins update batch covers" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete batch covers" ON storage.objects;
DROP POLICY IF EXISTS "Anyone reads batch covers" ON storage.objects;

CREATE POLICY "Admins upload batch covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'batch-covers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update batch covers" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'batch-covers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete batch covers" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'batch-covers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone reads batch covers" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'batch-covers');
