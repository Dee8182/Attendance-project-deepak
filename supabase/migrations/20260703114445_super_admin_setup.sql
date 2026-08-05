-- Super admin exception and activity logs
CREATE TABLE IF NOT EXISTS super_admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  details text,
  context text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE super_admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_super_logs" ON super_admin_logs;
CREATE POLICY "anon_select_super_logs" ON super_admin_logs FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_super_logs" ON super_admin_logs;
CREATE POLICY "anon_insert_super_logs" ON super_admin_logs FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Add manager response column to help_desk_tickets
ALTER TABLE help_desk_tickets
  ADD COLUMN IF NOT EXISTS response text,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;
