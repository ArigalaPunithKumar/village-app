/*
# Add authenticated profiles and protected government actions

1. New Tables
- `profiles` stores one application profile per Supabase Auth user.
- `profiles.id` links to `auth.users` and is filled automatically.
- `profiles.display_name` stores the user's visible name.
- `profiles.role` stores a server-controlled role: citizen, official, or admin.
- `profiles.created_at` records when the profile was created.

2. Modified Access
- Public visitors may continue reading complaints, status timelines, and officials.
- Signed-in users may create complaints and update their own display name.
- Only official and admin profiles may publish, edit, or remove status updates.
- Only official and admin profiles may make staff-level complaint changes.
- Upvotes use an atomic database function instead of client-side read-then-write updates.

3. Security
- RLS is enabled on `profiles`.
- Profile roles cannot be changed through the browser.
- Anonymous complaint and status-update writes are removed.
- Role checks use server-side profile data and `auth.uid()`.
- The privileged role-check and upvote functions use a fixed search path and have explicit execute grants.

4. Important Notes
- New accounts receive the `citizen` role.
- No administrator account is created automatically.
- An administrator must be assigned through a secure server-side database operation after the first account is created.
- Existing complaint, status, and official records are preserved.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'official', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own_name" ON public.profiles;
CREATE POLICY "profiles_update_own_name" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('official', 'admin')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.complaints FROM anon;
REVOKE UPDATE ON public.complaints FROM authenticated;
GRANT INSERT ON public.complaints TO authenticated;
GRANT UPDATE (upvotes) ON public.complaints TO anon, authenticated;
GRANT UPDATE ON public.complaints TO authenticated;

DROP POLICY IF EXISTS "anon_insert_complaints" ON public.complaints;
CREATE POLICY "authenticated_insert_complaints" ON public.complaints
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_complaints" ON public.complaints;
CREATE POLICY "staff_update_complaints" ON public.complaints
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "anon_delete_complaints" ON public.complaints;
CREATE POLICY "staff_delete_complaints" ON public.complaints
  FOR DELETE TO authenticated
  USING (public.is_staff());

REVOKE INSERT, UPDATE, DELETE ON public.status_updates FROM anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.status_updates TO authenticated;

DROP POLICY IF EXISTS "anon_insert_status_updates" ON public.status_updates;
CREATE POLICY "staff_insert_status_updates" ON public.status_updates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "anon_update_status_updates" ON public.status_updates;
CREATE POLICY "staff_update_status_updates" ON public.status_updates
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "anon_delete_status_updates" ON public.status_updates;
CREATE POLICY "staff_delete_status_updates" ON public.status_updates
  FOR DELETE TO authenticated
  USING (public.is_staff());

CREATE OR REPLACE FUNCTION public.increment_complaint_upvote(p_complaint_id integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  next_count integer;
BEGIN
  UPDATE public.complaints
  SET upvotes = upvotes + 1,
      updated_at = now()
  WHERE id = p_complaint_id
  RETURNING upvotes INTO next_count;

  IF next_count IS NULL THEN
    RAISE EXCEPTION 'Complaint not found';
  END IF;

  RETURN next_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_complaint_upvote(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_complaint_upvote(integer) TO anon, authenticated;
