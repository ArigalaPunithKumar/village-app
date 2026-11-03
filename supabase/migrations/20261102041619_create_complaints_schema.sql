/*
# Village Problem Rectify - Complaints Schema

1. Purpose
   A public grievance management system where citizens report village-level
   problems (roads, water, electricity, sanitation, street lights, drainage,
   waste management, etc.) and government officials track them through to
   resolution. No sign-in screen — anyone can submit and view complaints,
   and officials update statuses.

2. New Tables
   - `complaints` — core grievance records (title, description, category,
     priority, status, location, reporter info, optional image, upvotes,
     timestamps, unique ticket number).
   - `status_updates` — timeline entries for each complaint (status, note,
     who updated, timestamp).

3. Indexes on status, category, created_at, and complaint_id FK.

4. Triggers
   - `set_ticket_number` (BEFORE INSERT) — auto-generates VPR-YYYY-000001.
   - `touch_complaint_on_update` (AFTER INSERT on status_updates) — syncs
     complaint status, updated_at, and resolved_at.

5. Security
   - RLS enabled on both tables.
   - CRUD granted to anon + authenticated (public portal, no sign-in).
   - Policies use true predicates intentionally (public shared data).
*/

-- =========================================================
-- complaints table
-- =========================================================
CREATE TABLE IF NOT EXISTS complaints (
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

CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at DESC);

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON complaints TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_complaints" ON complaints;
CREATE POLICY "anon_select_complaints" ON complaints FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_complaints" ON complaints;
CREATE POLICY "anon_insert_complaints" ON complaints FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_complaints" ON complaints;
CREATE POLICY "anon_update_complaints" ON complaints FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_complaints" ON complaints;
CREATE POLICY "anon_delete_complaints" ON complaints FOR DELETE
  TO anon, authenticated USING (true);

GRANT USAGE ON SEQUENCE complaints_id_seq TO anon, authenticated;

-- =========================================================
-- status_updates table
-- =========================================================
CREATE TABLE IF NOT EXISTS status_updates (
  id serial PRIMARY KEY,
  complaint_id int NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (
    status IN ('pending','under_review','in_progress','resolved','rejected')
  ),
  note text,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_status_updates_complaint_id ON status_updates(complaint_id);

ALTER TABLE status_updates ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON status_updates TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_status_updates" ON status_updates;
CREATE POLICY "anon_select_status_updates" ON status_updates FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_status_updates" ON status_updates;
CREATE POLICY "anon_insert_status_updates" ON status_updates FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_status_updates" ON status_updates;
CREATE POLICY "anon_update_status_updates" ON status_updates FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_status_updates" ON status_updates;
CREATE POLICY "anon_delete_status_updates" ON status_updates FOR DELETE
  TO anon, authenticated USING (true);

GRANT USAGE ON SEQUENCE status_updates_id_seq TO anon, authenticated;

-- =========================================================
-- Trigger: auto-generate ticket number before insert
-- =========================================================
CREATE OR REPLACE FUNCTION set_ticket_number()
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

DROP TRIGGER IF EXISTS trg_auto_ticket_number ON complaints;
CREATE TRIGGER trg_auto_ticket_number
  BEFORE INSERT ON complaints
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_number();

-- =========================================================
-- Trigger: sync complaint status when status_update is inserted
-- =========================================================
CREATE OR REPLACE FUNCTION touch_complaint_on_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE complaints
  SET updated_at = now(),
      status = NEW.status,
      resolved_at = CASE WHEN NEW.status = 'resolved' THEN now() ELSE NULL END
  WHERE id = NEW.complaint_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_complaint ON status_updates;
CREATE TRIGGER trg_touch_complaint
  AFTER INSERT ON status_updates
  FOR EACH ROW
  EXECUTE FUNCTION touch_complaint_on_update();