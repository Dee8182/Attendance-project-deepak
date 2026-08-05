/*
# Attendees SaaS Upgrades Migration

## Changes

### companies table — new branding & compliance columns
- `theme_primary` (text, default '#f59e0b') — CSS hex color for primary brand
- `theme_secondary` (text, default '#1e293b') — CSS hex color for secondary brand
- `pf_esi_enabled` (boolean, default false) — Master toggle for PF/ESI compliance display

### payroll_payments table — Quick Pay tracking
New table to track monthly salary payment status per employee.
- `id` (uuid, PK)
- `company_id` (uuid, FK → companies)
- `employee_id` (uuid, FK → employees)
- `month` (text) — e.g. '2026-07'
- `base_salary` (numeric)
- `pf_deduction` (numeric, default 0)
- `esi_deduction` (numeric, default 0)
- `net_salary` (numeric)
- `status` (text) — pending / paid
- `paid_at` (timestamptz)
- `reference_id` (text)
- `created_at` (timestamptz)

## Security
All new policies use TO anon, authenticated (no Supabase auth, PIN-based).
*/

-- Add branding and compliance columns to companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS theme_primary text DEFAULT '#f59e0b',
  ADD COLUMN IF NOT EXISTS theme_secondary text DEFAULT '#1e293b',
  ADD COLUMN IF NOT EXISTS pf_esi_enabled boolean DEFAULT false;

-- Payroll payments table
CREATE TABLE IF NOT EXISTS payroll_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month text NOT NULL,
  base_salary numeric NOT NULL DEFAULT 0,
  pf_deduction numeric NOT NULL DEFAULT 0,
  esi_deduction numeric NOT NULL DEFAULT 0,
  net_salary numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  reference_id text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, employee_id, month)
);

ALTER TABLE payroll_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_payroll" ON payroll_payments;
CREATE POLICY "anon_select_payroll" ON payroll_payments FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_payroll" ON payroll_payments;
CREATE POLICY "anon_insert_payroll" ON payroll_payments FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_payroll" ON payroll_payments;
CREATE POLICY "anon_update_payroll" ON payroll_payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_payroll" ON payroll_payments;
CREATE POLICY "anon_delete_payroll" ON payroll_payments FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_payroll_company_month ON payroll_payments(company_id, month);
CREATE INDEX IF NOT EXISTS idx_payroll_employee ON payroll_payments(employee_id);
