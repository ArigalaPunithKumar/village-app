-- ============================================================================
-- PALLE NESTHAM (పల్లె నేస్తం) / VILLAGE PROBLEM RECTIFY - COMPLETE MASTER DATABASE SETUP
-- ============================================================================
-- Copy and paste this entire script into your Supabase Dashboard -> SQL Editor -> New Query
-- Click "RUN" to execute. This will set up all tables, triggers, security policies, and seed data.
-- ============================================================================

-- 1. COMPLAINTS TABLE
CREATE TABLE IF NOT EXISTS public.complaints (
  id serial PRIMARY KEY,
  ticket_number text UNIQUE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (
    category IN ('roads','water','electricity','sanitation','street_light','drainage','waste','other')
  ),
  priority text NOT NULL DEFAULT 'medium' CHECK (
    priority IN ('low','medium','high','urgent')
  ),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','under_review','in_progress','resolved','rejected')
  ),
  location text,
  reporter_name text NOT NULL,
  reporter_phone text,
  image_url text,
  upvotes int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON public.complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at DESC);

-- 2. STATUS UPDATES TABLE (TIMELINE)
CREATE TABLE IF NOT EXISTS public.status_updates (
  id serial PRIMARY KEY,
  complaint_id int NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (
    status IN ('pending','under_review','in_progress','resolved','rejected')
  ),
  note text,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_status_updates_complaint_id ON public.status_updates(complaint_id);

-- 3. OFFICIALS TABLE (DIRECTORY)
CREATE TABLE IF NOT EXISTS public.officials (
  id serial PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL,
  role_label text NOT NULL,
  phone text NOT NULL,
  photo_url text,
  jurisdiction text,
  order_num int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_officials_order ON public.officials(order_num);

-- 4. USER PROFILES TABLE (AUTHENTICATION SYNC)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'official', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-generate Ticket Number (e.g. VPR-2026-000001)
CREATE OR REPLACE FUNCTION public.set_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'VPR-' || to_char(now(), 'YYYY') || '-' || lpad((nextval('complaints_id_seq'))::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_ticket_number ON public.complaints;
CREATE TRIGGER trg_auto_ticket_number
  BEFORE INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.set_ticket_number();

-- Auto-sync Complaint Status on new status update
CREATE OR REPLACE FUNCTION public.touch_complaint_on_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.complaints
  SET updated_at = now(),
      status = NEW.status,
      resolved_at = CASE WHEN NEW.status = 'resolved' THEN now() ELSE NULL END
  WHERE id = NEW.complaint_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_complaint ON public.status_updates;
CREATE TRIGGER trg_touch_complaint
  AFTER INSERT ON public.status_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_complaint_on_update();

-- Auto-create profile when user registers via Supabase Auth
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

-- Staff role checker
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

-- Atomic Upvote Function
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

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) & PERMISSIONS
-- ============================================================================

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.officials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON public.complaints TO anon, authenticated;
GRANT INSERT ON public.complaints TO anon, authenticated;
GRANT UPDATE ON public.complaints TO anon, authenticated;
GRANT DELETE ON public.complaints TO authenticated, service_role;

GRANT SELECT ON public.status_updates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.status_updates TO authenticated, service_role;

GRANT SELECT ON public.officials TO anon, authenticated;
GRANT ALL ON public.officials TO service_role;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- Policies: Complaints
DROP POLICY IF EXISTS "public_select_complaints" ON public.complaints;
CREATE POLICY "public_select_complaints" ON public.complaints
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "allow_insert_complaints" ON public.complaints;
CREATE POLICY "allow_insert_complaints" ON public.complaints
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "allow_update_complaints" ON public.complaints;
CREATE POLICY "allow_update_complaints" ON public.complaints
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Policies: Status Updates
DROP POLICY IF EXISTS "public_select_status_updates" ON public.status_updates;
CREATE POLICY "public_select_status_updates" ON public.status_updates
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "staff_manage_status_updates" ON public.status_updates;
CREATE POLICY "staff_manage_status_updates" ON public.status_updates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies: Officials
DROP POLICY IF EXISTS "public_select_officials" ON public.officials;
CREATE POLICY "public_select_officials" ON public.officials
  FOR SELECT TO anon, authenticated USING (true);

-- Policies: Profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Function execution grants
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_complaint_upvote(integer) TO anon, authenticated;

-- ============================================================================
-- SEED DATA (OFFICIALS & SAMPLE GRIEVANCES)
-- ============================================================================

INSERT INTO public.officials (name, role, role_label, phone, photo_url, jurisdiction, order_num) VALUES
  ('Ramesh Kumar Goud',  'sarpanch',    'Sarpanch (సర్పంచ్)',                         '9876543210', NULL, 'గ్రామ పంచాయతీ (Gram Panchayat)', 1),
  ('Suresh Reddy',       'up_sarpanch', 'Upa-Sarpanch (ఉప సర్పంచ్)',                 '9876543211', NULL, 'గ్రామ పంచాయతీ (Gram Panchayat)', 2),
  ('Lakshmi Devi',       'vro',         'Village Revenue Officer (విలేజ్ రెవెన్యూ ఆఫీసర్)', '9876543212', NULL, 'రెవెన్యూ విభాగం (Revenue Division)', 3),
  ('Venkat Rao',         'mro',         'Mandal Revenue Officer (మండల రెవెన్యూ ఆఫీసర్)',   '9876543213', NULL, 'మండల కార్యాలయం (Mandal Office)',   4),
  ('Narayana Swamy',     'zptc',        'ZPTC Member (జెడ్పీటీసీ)',                   '9876543214', NULL, 'మండల పరిషత్ (Mandal Parishad)',  5),
  ('Padma Reddy',        'mptc',        'MPTC Member (ఎంపీటీసీ)',                     '9876543215', NULL, 'వార్డు పరిధి (Ward Area)',        6),
  ('Krishna Murthy',     'mpdo',        'Panchayat Development Officer (పీడీఓ)',      '9876543216', NULL, 'అభివృద్ధి విభాగం (Development)',  7)
ON CONFLICT DO NOTHING;

-- Seed initial test complaints if none exist
INSERT INTO public.complaints (ticket_number, title, description, category, priority, status, location, reporter_name, reporter_phone, upvotes)
VALUES 
  ('VPR-2026-000001', 'Street Lights not working in Main Bazar', 'The 4 street lights near the main junction temple have been out for 3 days. It is dark and unsafe at night.', 'street_light', 'high', 'in_progress', 'Main Bazar, Near Temple Junction', 'Ravi Teja', '9876500001', 12),
  ('VPR-2026-000002', 'Drinking Water Pipeline Leakage', 'Clean drinking water pipe ruptured near Gandhi Statue. Water is being wasted since morning.', 'water', 'urgent', 'under_review', 'Gandhi Statue, Water Tank Road', 'Chenji Nithin kumar', '7893126786', 8),
  ('VPR-2026-000003', 'Road Potholes Repair on School Route', 'Large potholes developed after heavy rain. School buses and auto rickshaws finding it difficult.', 'roads', 'medium', 'pending', 'Zilla Parishad High School Road', 'Chenji Nithin kumar', '7893126786', 5)
ON CONFLICT (ticket_number) DO NOTHING;

-- Seed status updates for timeline
INSERT INTO public.status_updates (complaint_id, status, note, updated_by)
SELECT c.id, 'in_progress', 'Electrician team dispatched with replacement LED fixtures. Work underway.', 'Panchayat Secretary'
FROM public.complaints c WHERE c.ticket_number = 'VPR-2026-000001'
LIMIT 1;
