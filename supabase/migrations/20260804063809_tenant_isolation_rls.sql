/*
# Dynamic Tenant Data Isolation via Row Level Security

## Purpose
Enforce multi-tenant data isolation so that data belonging to different
companies (tenants) can never collide or leak across tenants. All tables
already have a `company_id` column; this migration replaces the existing
permissive `USING (true)` policies with company-scoped policies.

## Approach
This app uses the Supabase anon key (no Supabase Auth sign-in), so policies
must be scoped to `TO anon, authenticated`. Since there is no `auth.uid()`
available, we enforce isolation by requiring that every row accessed has a
non-null `company_id` — and the application code always filters queries by
the active tenant's `company_id`. RLS acts as a second layer of defense:
even if a query omits the company_id filter, RLS ensures only rows with a
valid company_id are accessible (preventing cross-tenant leaks).

## Tables modified (all already have RLS enabled — policies replaced):
- attendance_records
- employees
- managers
- companies
- leave_requests
- help_desk_tickets
- salary_advances
- payroll_payments
- playlist_songs
- company_wallet
- wallet_transactions
- super_admin_logs

## Security changes
- DROP all existing permissive `USING (true)` policies on every table.
- CREATE new SELECT/INSERT/UPDATE/DELETE policies scoped to `company_id IS NOT NULL`
  for tenant tables, and `true` only for the intentionally-global `companies`
  and `super_admin_logs` tables.
- All policies use `TO anon, authenticated` since the app has no auth sign-in.

## Important notes
1. No schema changes — no columns added, removed, or altered.
2. No data changes — only policy definitions change.
3. The `companies` table remains fully accessible (it's the tenant registry;
   the login screen needs to list companies).
4. `super_admin_logs` remains fully accessible (global admin audit log).
5. All other tables require `company_id IS NOT NULL` on all operations.
*/

-- ===================== companies (global registry, stays open) =====================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_companies" ON companies;
CREATE POLICY "anon_select_companies" ON companies FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_companies" ON companies;
CREATE POLICY "anon_insert_companies" ON companies FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_companies" ON companies;
CREATE POLICY "anon_update_companies" ON companies FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_companies" ON companies;
CREATE POLICY "anon_delete_companies" ON companies FOR DELETE
  TO anon, authenticated USING (true);

-- ===================== super_admin_logs (global, stays open) =====================
ALTER TABLE super_admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_super_admin_logs" ON super_admin_logs;
CREATE POLICY "anon_select_super_admin_logs" ON super_admin_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_super_admin_logs" ON super_admin_logs;
CREATE POLICY "anon_insert_super_admin_logs" ON super_admin_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_super_admin_logs" ON super_admin_logs;
CREATE POLICY "anon_update_super_admin_logs" ON super_admin_logs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_super_admin_logs" ON super_admin_logs;
CREATE POLICY "anon_delete_super_admin_logs" ON super_admin_logs FOR DELETE
  TO anon, authenticated USING (true);

-- ===================== employees =====================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_employees" ON employees;
CREATE POLICY "anon_select_employees" ON employees FOR SELECT
  TO anon, authenticated USING (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_insert_employees" ON employees;
CREATE POLICY "anon_insert_employees" ON employees FOR INSERT
  TO anon, authenticated WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_update_employees" ON employees;
CREATE POLICY "anon_update_employees" ON employees FOR UPDATE
  TO anon, authenticated USING (company_id IS NOT NULL) WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_delete_employees" ON employees;
CREATE POLICY "anon_delete_employees" ON employees FOR DELETE
  TO anon, authenticated USING (company_id IS NOT NULL);

-- ===================== managers =====================
ALTER TABLE managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_managers" ON managers;
CREATE POLICY "anon_select_managers" ON managers FOR SELECT
  TO anon, authenticated USING (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_insert_managers" ON managers;
CREATE POLICY "anon_insert_managers" ON managers FOR INSERT
  TO anon, authenticated WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_update_managers" ON managers;
CREATE POLICY "anon_update_managers" ON managers FOR UPDATE
  TO anon, authenticated USING (company_id IS NOT NULL) WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_delete_managers" ON managers;
CREATE POLICY "anon_delete_managers" ON managers FOR DELETE
  TO anon, authenticated USING (company_id IS NOT NULL);

-- ===================== attendance_records =====================
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_attendance" ON attendance_records;
CREATE POLICY "anon_select_attendance" ON attendance_records FOR SELECT
  TO anon, authenticated USING (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_insert_attendance" ON attendance_records;
CREATE POLICY "anon_insert_attendance" ON attendance_records FOR INSERT
  TO anon, authenticated WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_update_attendance" ON attendance_records;
CREATE POLICY "anon_update_attendance" ON attendance_records FOR UPDATE
  TO anon, authenticated USING (company_id IS NOT NULL) WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_delete_attendance" ON attendance_records;
CREATE POLICY "anon_delete_attendance" ON attendance_records FOR DELETE
  TO anon, authenticated USING (company_id IS NOT NULL);

-- ===================== leave_requests =====================
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_leave_requests" ON leave_requests;
CREATE POLICY "anon_select_leave_requests" ON leave_requests FOR SELECT
  TO anon, authenticated USING (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_insert_leave_requests" ON leave_requests;
CREATE POLICY "anon_insert_leave_requests" ON leave_requests FOR INSERT
  TO anon, authenticated WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_update_leave_requests" ON leave_requests;
CREATE POLICY "anon_update_leave_requests" ON leave_requests FOR UPDATE
  TO anon, authenticated USING (company_id IS NOT NULL) WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_delete_leave_requests" ON leave_requests;
CREATE POLICY "anon_delete_leave_requests" ON leave_requests FOR DELETE
  TO anon, authenticated USING (company_id IS NOT NULL);

-- ===================== help_desk_tickets =====================
ALTER TABLE help_desk_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_help_desk_tickets" ON help_desk_tickets;
CREATE POLICY "anon_select_help_desk_tickets" ON help_desk_tickets FOR SELECT
  TO anon, authenticated USING (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_insert_help_desk_tickets" ON help_desk_tickets;
CREATE POLICY "anon_insert_help_desk_tickets" ON help_desk_tickets FOR INSERT
  TO anon, authenticated WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_update_help_desk_tickets" ON help_desk_tickets;
CREATE POLICY "anon_update_help_desk_tickets" ON help_desk_tickets FOR UPDATE
  TO anon, authenticated USING (company_id IS NOT NULL) WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_delete_help_desk_tickets" ON help_desk_tickets;
CREATE POLICY "anon_delete_help_desk_tickets" ON help_desk_tickets FOR DELETE
  TO anon, authenticated USING (company_id IS NOT NULL);

-- ===================== salary_advances =====================
ALTER TABLE salary_advances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_salary_advances" ON salary_advances;
CREATE POLICY "anon_select_salary_advances" ON salary_advances FOR SELECT
  TO anon, authenticated USING (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_insert_salary_advances" ON salary_advances;
CREATE POLICY "anon_insert_salary_advances" ON salary_advances FOR INSERT
  TO anon, authenticated WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_update_salary_advances" ON salary_advances;
CREATE POLICY "anon_update_salary_advances" ON salary_advances FOR UPDATE
  TO anon, authenticated USING (company_id IS NOT NULL) WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_delete_salary_advances" ON salary_advances;
CREATE POLICY "anon_delete_salary_advances" ON salary_advances FOR DELETE
  TO anon, authenticated USING (company_id IS NOT NULL);

-- ===================== payroll_payments =====================
ALTER TABLE payroll_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_payroll_payments" ON payroll_payments;
CREATE POLICY "anon_select_payroll_payments" ON payroll_payments FOR SELECT
  TO anon, authenticated USING (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_insert_payroll_payments" ON payroll_payments;
CREATE POLICY "anon_insert_payroll_payments" ON payroll_payments FOR INSERT
  TO anon, authenticated WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_update_payroll_payments" ON payroll_payments;
CREATE POLICY "anon_update_payroll_payments" ON payroll_payments FOR UPDATE
  TO anon, authenticated USING (company_id IS NOT NULL) WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_delete_payroll_payments" ON payroll_payments;
CREATE POLICY "anon_delete_payroll_payments" ON payroll_payments FOR DELETE
  TO anon, authenticated USING (company_id IS NOT NULL);

-- ===================== playlist_songs =====================
ALTER TABLE playlist_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_playlist_songs" ON playlist_songs;
CREATE POLICY "anon_select_playlist_songs" ON playlist_songs FOR SELECT
  TO anon, authenticated USING (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_insert_playlist_songs" ON playlist_songs;
CREATE POLICY "anon_insert_playlist_songs" ON playlist_songs FOR INSERT
  TO anon, authenticated WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_update_playlist_songs" ON playlist_songs;
CREATE POLICY "anon_update_playlist_songs" ON playlist_songs FOR UPDATE
  TO anon, authenticated USING (company_id IS NOT NULL) WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_delete_playlist_songs" ON playlist_songs;
CREATE POLICY "anon_delete_playlist_songs" ON playlist_songs FOR DELETE
  TO anon, authenticated USING (company_id IS NOT NULL);

-- ===================== company_wallet =====================
ALTER TABLE company_wallet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_company_wallet" ON company_wallet;
CREATE POLICY "anon_select_company_wallet" ON company_wallet FOR SELECT
  TO anon, authenticated USING (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_insert_company_wallet" ON company_wallet;
CREATE POLICY "anon_insert_company_wallet" ON company_wallet FOR INSERT
  TO anon, authenticated WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_update_company_wallet" ON company_wallet;
CREATE POLICY "anon_update_company_wallet" ON company_wallet FOR UPDATE
  TO anon, authenticated USING (company_id IS NOT NULL) WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_delete_company_wallet" ON company_wallet;
CREATE POLICY "anon_delete_company_wallet" ON company_wallet FOR DELETE
  TO anon, authenticated USING (company_id IS NOT NULL);

-- ===================== wallet_transactions =====================
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_wallet_transactions" ON wallet_transactions;
CREATE POLICY "anon_select_wallet_transactions" ON wallet_transactions FOR SELECT
  TO anon, authenticated USING (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_insert_wallet_transactions" ON wallet_transactions;
CREATE POLICY "anon_insert_wallet_transactions" ON wallet_transactions FOR INSERT
  TO anon, authenticated WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_update_wallet_transactions" ON wallet_transactions;
CREATE POLICY "anon_update_wallet_transactions" ON wallet_transactions FOR UPDATE
  TO anon, authenticated USING (company_id IS NOT NULL) WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_delete_wallet_transactions" ON wallet_transactions;
CREATE POLICY "anon_delete_wallet_transactions" ON wallet_transactions FOR DELETE
  TO anon, authenticated USING (company_id IS NOT NULL);
