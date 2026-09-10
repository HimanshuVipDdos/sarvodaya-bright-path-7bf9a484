-- Ensure study_materials grants allow insert/update/delete for authenticated users under RLS policies
GRANT ALL ON public.study_materials TO authenticated;
GRANT ALL ON public.study_materials TO service_role;

-- Update has_role function to recognize designated owner emails even if user_roles record is missing
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  ) OR (
    _role = 'admin' AND EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = _user_id AND LOWER(u.email) IN ('hr152830@gmail.com', 'info@sarvodayaadhyeta.in')
    )
  );
$$;

-- Self-heal user_roles for owner emails if they currently exist in auth.users
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE LOWER(u.email) IN ('hr152830@gmail.com', 'info@sarvodayaadhyeta.in')
ON CONFLICT (user_id, role) DO NOTHING;

-- Trigger to auto-assign admin role when owner account signs up or signs in
CREATE OR REPLACE FUNCTION public.auto_assign_owner_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF LOWER(NEW.email) IN ('hr152830@gmail.com', 'info@sarvodayaadhyeta.in') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_owner_check ON auth.users;
CREATE TRIGGER on_auth_user_created_owner_check
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_owner_role();
