/*
# Village Officials Directory

1. Purpose
   Stores contact details of local government officials (Sarpanch, VRO,
   MRO, ZPTC, MPTC, etc.) so citizens can see who their representatives are
   and call them directly. Public portal — no sign-in, anyone can view.

2. New Table
   - `officials`
     - `id` (serial, primary key)
     - `name` (text, not null) — full name of the official
     - `role` (text, not null) — role key (sarpanch, vro, mro, zptc, mptc, etc.)
     - `role_label` (text, not null) — display label (e.g. "Sarpanch")
     - `phone` (text, not null) — mobile/contact number
     - `photo_url` (text) — optional photo URL
     - `jurisdiction` (text) — area/ward they cover
     - `order_num` (int, default 0) — display sort order
     - `created_at` (timestamptz, default now())

3. Security
   - RLS enabled.
   - SELECT granted to anon + authenticated (public directory).
   - No INSERT/UPDATE/DELETE from the app — officials are managed
     server-side. We still grant those to service_role for seeding.
*/

CREATE TABLE IF NOT EXISTS officials (
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

CREATE INDEX IF NOT EXISTS idx_officials_order ON officials(order_num);

ALTER TABLE officials ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON officials TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON officials TO service_role;
GRANT USAGE ON SEQUENCE officials_id_seq TO service_role;

DROP POLICY IF EXISTS "anon_select_officials" ON officials;
CREATE POLICY "anon_select_officials" ON officials FOR SELECT
  TO anon, authenticated USING (true);

-- =========================================================
-- Seed data: village officials
-- =========================================================
INSERT INTO officials (name, role, role_label, phone, photo_url, jurisdiction, order_num) VALUES
  ('Ramesh Kumar Goud',  'sarpanch', 'Sarpanch',     '9876543210', NULL, 'Gram Panchayat, Rampally',     1),
  ('Suresh Reddy',       'up_sarpanch', 'Upa-Sarpanch', '9876543211', NULL, 'Gram Panchayat, Rampally',   2),
  ('Lakshmi Devi',       'vro',      'Village Revenue Officer', '9876543212', NULL, 'Rampally Village',     3),
  ('Venkat Rao',         'mro',      'Mandal Revenue Officer',   '9876543213', NULL, 'Keesara Mandal',       4),
  ('Narayana Swamy',     'zptc',     'ZPTC Member',   '9876543214', NULL, 'Keesara ZPTC',                5),
  ('Padma Reddy',        'mptc',     'MPTC Member',   '9876543215', NULL, 'Rampally MPTC',               6),
  ('Krishna Murthy',     'mpdo',     'Panchayat Development Officer', '9876543216', NULL, 'Rampally GP', 7)
ON CONFLICT DO NOTHING;