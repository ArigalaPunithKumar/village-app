-- Secure public grievance access, move evidence to private storage, and
-- persist staff access requests in the database.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';

ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS reporter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.status_updates
  ADD COLUMN IF NOT EXISTS updated_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.profiles p
SET email = COALESCE(u.email, ''),
    phone = COALESCE(NULLIF(p.phone, ''), u.raw_user_meta_data ->> 'phone', u.phone, '')
FROM auth.users u
WHERE u.id = p.id;

-- Remove the repository's old demo directory entries. They contain placeholder
-- phone numbers and belong to Rampally rather than Thandlam.
DELETE FROM public.officials
WHERE (name, phone) IN (
  ('Ramesh Kumar Goud', '9876543210'),
  ('Suresh Reddy', '9876543211'),
  ('Lakshmi Devi', '9876543212'),
  ('Venkat Rao', '9876543213'),
  ('Narayana Swamy', '9876543214'),
  ('Padma Reddy', '9876543215'),
  ('Krishna Murthy', '9876543216')
);

CREATE TABLE IF NOT EXISTS public.complaint_upvotes (
  complaint_id integer NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (complaint_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.admin_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('official', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone, ''),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_complaint_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.reporter_user_id := auth.uid();
  NEW.status := 'pending';
  NEW.upvotes := 0;
  NEW.updated_at := now();
  NEW.resolved_at := NULL;

  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'VPR-' || to_char(now(), 'YYYY') || '-' || lpad(NEW.id::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_ticket_number ON public.complaints;
DROP TRIGGER IF EXISTS trg_secure_complaint_insert ON public.complaints;
CREATE TRIGGER trg_secure_complaint_insert
  BEFORE INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.set_complaint_ticket_number();

CREATE OR REPLACE FUNCTION public.set_status_update_actor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_by_user_id := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_status_update_actor ON public.status_updates;
CREATE TRIGGER trg_set_status_update_actor
  BEFORE INSERT ON public.status_updates
  FOR EACH ROW EXECUTE FUNCTION public.set_status_update_actor();

CREATE OR REPLACE FUNCTION public.request_admin_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before requesting administrator access';
  END IF;

  INSERT INTO public.admin_access_requests (user_id, display_name, phone, email, requested_at, status)
  SELECT requester_id, p.display_name, p.phone, COALESCE(u.email, ''), now(), 'pending'
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = requester_id
  ON CONFLICT (user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        requested_at = now(),
        status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.review_admin_access_request(p_user_id uuid, p_approve boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can review access requests';
  END IF;

  UPDATE public.admin_access_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END
  WHERE user_id = p_user_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending administrator request was found';
  END IF;

  IF p_approve THEN
    UPDATE public.profiles SET role = 'admin' WHERE id = p_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_user_id uuid,
  p_display_name text,
  p_phone text,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can edit user access';
  END IF;
  IF p_role NOT IN ('citizen', 'official', 'admin') THEN
    RAISE EXCEPTION 'Invalid account role';
  END IF;

  UPDATE public.profiles
  SET display_name = COALESCE(p_display_name, display_name),
      phone = COALESCE(p_phone, phone),
      role = p_role
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_complaint_status(
  p_complaint_id integer,
  p_status text,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_name text;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Only village officials can update complaint status';
  END IF;
  IF p_status NOT IN ('pending', 'under_review', 'in_progress', 'resolved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid complaint status';
  END IF;

  SELECT display_name INTO actor_name
  FROM public.profiles
  WHERE id = auth.uid();

  INSERT INTO public.status_updates (complaint_id, status, note, updated_by)
  VALUES (p_complaint_id, p_status, NULLIF(trim(p_note), ''), COALESCE(NULLIF(trim(actor_name), ''), 'Village official'));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Complaint not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_complaint_upvote(p_complaint_id integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  voter_id uuid := auth.uid();
  next_count integer;
BEGIN
  IF voter_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before supporting a report';
  END IF;

  INSERT INTO public.complaint_upvotes (complaint_id, user_id)
  VALUES (p_complaint_id, voter_id)
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You have already supported this report';
  END IF;

  UPDATE public.complaints
  SET upvotes = upvotes + 1, updated_at = now()
  WHERE id = p_complaint_id
  RETURNING upvotes INTO next_count;

  IF next_count IS NULL THEN
    RAISE EXCEPTION 'Complaint not found';
  END IF;

  RETURN next_count;
END;
$$;

-- Remove permissive legacy policies before installing the scoped policies.
DO $$
DECLARE
  policy record;
BEGIN
  FOR policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('complaints', 'status_updates', 'profiles', 'complaint_upvotes', 'admin_access_requests')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', policy.policyname, policy.schemaname, policy.tablename);
  END LOOP;
END;
$$;

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_access_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.complaints FROM anon, authenticated;
GRANT SELECT ON public.complaints TO authenticated;
GRANT INSERT (title, description, category, priority, location, reporter_name, reporter_phone, image_url)
  ON public.complaints TO authenticated;
GRANT DELETE ON public.complaints TO authenticated;
GRANT USAGE ON SEQUENCE public.complaints_id_seq TO authenticated;

CREATE POLICY complaints_select_owner_or_admin ON public.complaints
  FOR SELECT TO authenticated
  USING (reporter_user_id = auth.uid() OR public.is_admin());
CREATE POLICY complaints_insert_authenticated ON public.complaints
  FOR INSERT TO authenticated
  WITH CHECK (reporter_user_id = auth.uid());
CREATE POLICY complaints_delete_admin ON public.complaints
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE VIEW public.complaints_public
WITH (security_barrier = true)
AS
  SELECT
    id,
    ticket_number,
    title,
    description,
    category,
    priority,
    status,
    CASE
      WHEN location ~ '[-+]?[0-9]{1,3}[.][0-9]+\s*,\s*[-+]?[0-9]{1,3}[.][0-9]+'
        THEN 'Thandlam village'
      ELSE location
    END AS location,
    upvotes,
    created_at,
    updated_at,
    resolved_at
  FROM public.complaints;

GRANT SELECT ON public.complaints_public TO anon, authenticated;

REVOKE ALL ON public.status_updates FROM anon, authenticated;
GRANT SELECT (id, complaint_id, status, note, updated_by, created_at)
  ON public.status_updates TO anon, authenticated;
CREATE POLICY status_updates_public_read ON public.status_updates
  FOR SELECT TO anon, authenticated USING (true);

REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name, phone) ON public.profiles TO authenticated;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_admin());
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

REVOKE ALL ON public.complaint_upvotes FROM anon, authenticated;
GRANT SELECT ON public.complaint_upvotes TO authenticated;
CREATE POLICY complaint_upvotes_select_own ON public.complaint_upvotes
  FOR SELECT TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.admin_access_requests FROM anon, authenticated;
GRANT SELECT ON public.admin_access_requests TO authenticated;
CREATE POLICY admin_access_requests_select_own_or_admin ON public.admin_access_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.officials FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.officials TO authenticated;
GRANT USAGE ON SEQUENCE public.officials_id_seq TO authenticated;
DROP POLICY IF EXISTS officials_select_public ON public.officials;
CREATE POLICY officials_select_public ON public.officials
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY officials_insert_admin ON public.officials
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY officials_update_admin ON public.officials
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY officials_delete_admin ON public.officials
  FOR DELETE TO authenticated USING (public.is_admin());

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_admin_access() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_admin_access_request(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_complaint_status(integer, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_complaint_upvote(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_admin_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_admin_access_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_complaint_status(integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_complaint_upvote(integer) TO authenticated;

-- Evidence is private; object names start with the submitting user's UUID.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('complaint-evidence', 'complaint-evidence', false, 5242880, ARRAY['image/jpeg']::text[])
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg']::text[];

DROP POLICY IF EXISTS complaint_evidence_upload_owner ON storage.objects;
CREATE POLICY complaint_evidence_upload_owner ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'complaint-evidence'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS complaint_evidence_read_owner_or_staff ON storage.objects;
CREATE POLICY complaint_evidence_read_owner_or_staff ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'complaint-evidence'
    AND (split_part(name, '/', 1) = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS complaint_evidence_delete_owner_or_staff ON storage.objects;
CREATE POLICY complaint_evidence_delete_owner_or_staff ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'complaint-evidence'
    AND (split_part(name, '/', 1) = auth.uid()::text OR public.is_admin())
  );
