/*
# Create LISTTA tables for real-time sync

1. New Tables
- `schools`: stores schools with name and timestamps
  - id (uuid, primary key)
  - name (text, not null)
  - created_at (timestamptz)
  - updated_at (timestamptz)
  - deleted (boolean, default false — soft delete for sync)
- `people`: stores attendances linked to schools
  - id (uuid, primary key)
  - school_id (uuid, foreign key to schools)
  - name (text, not null)
  - note (text)
  - status (text: nao_chegou, atendido, faltou, foi_embora)
  - date (date)
  - shift (text: manha, tarde)
  - doctor (text)
  - created_at (timestamptz)
  - updated_at (timestamptz)
  - deleted (boolean, default false)

2. Security
- RLS enabled on both tables.
- Anon + authenticated CRUD (single-tenant, no auth, shared data).
- Policies allow all CRUD to anon and authenticated.

3. Notes
- Soft delete via `deleted` flag preserves sync integrity (deletions propagate).
- `updated_at` used for last-write-wins conflict resolution.
- No user_id columns — app has no sign-in, data is intentionally shared.
*/

CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_schools" ON schools;
CREATE POLICY "anon_select_schools" ON schools FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_schools" ON schools;
CREATE POLICY "anon_insert_schools" ON schools FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_schools" ON schools;
CREATE POLICY "anon_update_schools" ON schools FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_schools" ON schools;
CREATE POLICY "anon_delete_schools" ON schools FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  note text DEFAULT '',
  status text NOT NULL DEFAULT 'nao_chegou',
  date date DEFAULT CURRENT_DATE,
  shift text NOT NULL DEFAULT 'manha',
  doctor text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE people ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_people" ON people;
CREATE POLICY "anon_select_people" ON people FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_people" ON people;
CREATE POLICY "anon_insert_people" ON people FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_people" ON people;
CREATE POLICY "anon_update_people" ON people FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_people" ON people;
CREATE POLICY "anon_delete_people" ON people FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_people_school_id ON people(school_id);
CREATE INDEX IF NOT EXISTS idx_people_date ON people(date);
CREATE INDEX IF NOT EXISTS idx_schools_deleted ON schools(deleted);
CREATE INDEX IF NOT EXISTS idx_people_deleted ON people(deleted);
