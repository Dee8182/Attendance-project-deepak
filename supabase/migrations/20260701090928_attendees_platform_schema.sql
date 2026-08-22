/*
# Attendees Multi-Tenant SaaS Platform Schema

## Overview
Complete schema for the Attendees Attendance & Shift Management Platform.
All tables are scoped by company_id for strict multi-tenant data isolation.

## Tables Created

### companies
Stores registered client companies with branding info.
- id (uuid, PK)
- name (text) - Company display name
- logo_url (text) - Optional logo URL
- created_at (timestamp)

### managers
Manager accounts scoped per company. PIN-based login.
- id (uuid, PK)
- company_id (uuid, FK → companies)
- manager_id (text) - Login ID e.g. MGR001
- pin (text) - 4-digit PIN
- name (text)
- email (text)
- created_at (timestamp)

### employees
Employee records with geo-fence work location assignment.
- id (uuid, PK)
- company_id (uuid, FK → companies)
- employee_id (text) - Login ID e.g. EMP001
- pin (text) - 4-digit PIN
- name (text)
- role (text) - Job title/role
- department (text)
- phone (text)
- email (text)
- salary (numeric) - Monthly salary
- avatar_url (text)
- work_location_name (text) - Name of assigned geo-fence location
- work_lat (numeric) - Geo-fence latitude
- work_lng (numeric) - Geo-fence longitude
- work_radius (numeric) - Geo-fence radius in meters
- status (text) - active / inactive
- created_at (timestamp)

### attendance_records
Daily check-in/check-out records per employee.
- id (uuid, PK)
- company_id (uuid, FK → companies)
- employee_id (uuid, FK → employees)
- date (date) - Attendance date
- check_in_time (timestamptz)
- check_out_time (timestamptz)
- status (text) - present / absent / on_leave / late
- notes (text)
- created_at (timestamp)

### leave_requests
Employee leave applications.
- id (uuid, PK)
- company_id (uuid, FK → companies)
- employee_id (uuid, FK → employees)
- leave_type (text) - sick / casual / annual
- start_date (date)
- end_date (date)
- reason (text)
- status (text) - pending / approved / rejected
- created_at (timestamp)

### help_desk_tickets
Employee complaints/help requests.
- id (uuid, PK)
- company_id (uuid, FK → companies)
- employee_id (uuid, FK → employees)
- subject (text)
- message (text)
- status (text) - pending / resolved / rejected
- created_at (timestamp)

### salary_advances
Advance salary requests from employees.
- id (uuid, PK)
- company_id (uuid, FK → companies)
- employee_id (uuid, FK → employees)
- amount (numeric)
- reason (text)
- status (text) - pending / approved / rejected
- created_at (timestamp)

### playlist_songs
Manager-curated music playlist per company.
- id (uuid, PK)
- company_id (uuid, FK → companies)
- title (text)
- artist (text)
- file_name (text)
- file_size (bigint)
- duration (integer) - seconds
- added_by (uuid, FK → managers)
- created_at (timestamp)

### wallet_transactions
Company wallet funding and payment history.
- id (uuid, PK)
- company_id (uuid, FK → companies)
- amount (numeric)
- payment_method (text) - upi / netbanking
- reference_id (text)
- status (text) - success / pending / failed
- note (text)
- created_at (timestamp)

### company_wallet
Single wallet balance record per company.
- id (uuid, PK)
- company_id (uuid, unique, FK → companies)
- balance (numeric, default 0)
- updated_at (timestamp)

## Security
- RLS enabled on all tables
- All policies use TO anon, authenticated (no Supabase auth; PIN-based login)
- Data isolation enforced at application level via company_id
*/

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_companies" ON companies;
CREATE POLICY "anon_select_companies" ON companies FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_companies" ON companies;
CREATE POLICY "anon_insert_companies" ON companies FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_companies" ON companies;
CREATE POLICY "anon_update_companies" ON companies FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Managers table
CREATE TABLE IF NOT EXISTS managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  manager_id text NOT NULL,
  pin text NOT NULL,
  name text NOT NULL,
  email text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, manager_id)
);

ALTER TABLE managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_managers" ON managers;
CREATE POLICY "anon_select_managers" ON managers FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_managers" ON managers;
CREATE POLICY "anon_insert_managers" ON managers FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_managers" ON managers;
CREATE POLICY "anon_update_managers" ON managers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id text NOT NULL,
  pin text NOT NULL DEFAULT '1234',
  name text NOT NULL,
  role text,
  department text,
  phone text,
  email text,
  salary numeric DEFAULT 0,
  avatar_url text,
  work_location_name text,
  work_lat numeric,
  work_lng numeric,
  work_radius numeric DEFAULT 200,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, employee_id)
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_employees" ON employees;
CREATE POLICY "anon_select_employees" ON employees FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_employees" ON employees;
CREATE POLICY "anon_insert_employees" ON employees FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_employees" ON employees;
CREATE POLICY "anon_update_employees" ON employees FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_employees" ON employees;
CREATE POLICY "anon_delete_employees" ON employees FOR DELETE TO anon, authenticated USING (true);

-- Attendance records
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in_time timestamptz,
  check_out_time timestamptz,
  status text NOT NULL DEFAULT 'absent',
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, employee_id, date)
);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_attendance" ON attendance_records;
CREATE POLICY "anon_select_attendance" ON attendance_records FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_attendance" ON attendance_records;
CREATE POLICY "anon_insert_attendance" ON attendance_records FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_attendance" ON attendance_records;
CREATE POLICY "anon_update_attendance" ON attendance_records FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_attendance" ON attendance_records;
CREATE POLICY "anon_delete_attendance" ON attendance_records FOR DELETE TO anon, authenticated USING (true);

-- Leave requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type text NOT NULL DEFAULT 'casual',
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_leave" ON leave_requests;
CREATE POLICY "anon_select_leave" ON leave_requests FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_leave" ON leave_requests;
CREATE POLICY "anon_insert_leave" ON leave_requests FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_leave" ON leave_requests;
CREATE POLICY "anon_update_leave" ON leave_requests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_leave" ON leave_requests;
CREATE POLICY "anon_delete_leave" ON leave_requests FOR DELETE TO anon, authenticated USING (true);

-- Help desk tickets
CREATE TABLE IF NOT EXISTS help_desk_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE help_desk_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_helpdesk" ON help_desk_tickets;
CREATE POLICY "anon_select_helpdesk" ON help_desk_tickets FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_helpdesk" ON help_desk_tickets;
CREATE POLICY "anon_insert_helpdesk" ON help_desk_tickets FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_helpdesk" ON help_desk_tickets;
CREATE POLICY "anon_update_helpdesk" ON help_desk_tickets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_helpdesk" ON help_desk_tickets;
CREATE POLICY "anon_delete_helpdesk" ON help_desk_tickets FOR DELETE TO anon, authenticated USING (true);

-- Salary advances
CREATE TABLE IF NOT EXISTS salary_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE salary_advances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_advances" ON salary_advances;
CREATE POLICY "anon_select_advances" ON salary_advances FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_advances" ON salary_advances;
CREATE POLICY "anon_insert_advances" ON salary_advances FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_advances" ON salary_advances;
CREATE POLICY "anon_update_advances" ON salary_advances FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_advances" ON salary_advances;
CREATE POLICY "anon_delete_advances" ON salary_advances FOR DELETE TO anon, authenticated USING (true);

-- Playlist songs
CREATE TABLE IF NOT EXISTS playlist_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  artist text DEFAULT 'Unknown Artist',
  file_name text,
  file_size bigint,
  duration integer DEFAULT 0,
  added_by uuid REFERENCES managers(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE playlist_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_playlist" ON playlist_songs;
CREATE POLICY "anon_select_playlist" ON playlist_songs FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_playlist" ON playlist_songs;
CREATE POLICY "anon_insert_playlist" ON playlist_songs FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_playlist" ON playlist_songs;
CREATE POLICY "anon_update_playlist" ON playlist_songs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_playlist" ON playlist_songs;
CREATE POLICY "anon_delete_playlist" ON playlist_songs FOR DELETE TO anon, authenticated USING (true);

-- Wallet transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_method text NOT NULL DEFAULT 'upi',
  reference_id text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_wallet_tx" ON wallet_transactions;
CREATE POLICY "anon_select_wallet_tx" ON wallet_transactions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_wallet_tx" ON wallet_transactions;
CREATE POLICY "anon_insert_wallet_tx" ON wallet_transactions FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Company wallet
CREATE TABLE IF NOT EXISTS company_wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_wallet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_wallet" ON company_wallet;
CREATE POLICY "anon_select_wallet" ON company_wallet FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_wallet" ON company_wallet;
CREATE POLICY "anon_insert_wallet" ON company_wallet FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_wallet" ON company_wallet;
CREATE POLICY "anon_update_wallet" ON company_wallet FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_managers_company ON managers(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_attendance_company_date ON attendance_records(company_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_company ON leave_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_company ON help_desk_tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_employee ON help_desk_tickets(employee_id);
CREATE INDEX IF NOT EXISTS idx_advances_company ON salary_advances(company_id);
CREATE INDEX IF NOT EXISTS idx_playlist_company ON playlist_songs(company_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_company ON wallet_transactions(company_id);

-- Seed demo company
INSERT INTO companies (id, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Attendees Demo Company')
ON CONFLICT DO NOTHING;

-- Seed demo manager (MGR001 / 1234)
INSERT INTO managers (company_id, manager_id, pin, name, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'MGR001', '1234', 'Admin Manager', 'manager@attendees.com')
ON CONFLICT DO NOTHING;

-- Seed demo wallet
INSERT INTO company_wallet (company_id, balance)
VALUES ('00000000-0000-0000-0000-000000000001', 125000)
ON CONFLICT DO NOTHING;

-- Seed demo employees
INSERT INTO employees (company_id, employee_id, pin, name, role, department, phone, salary, work_location_name, work_lat, work_lng, work_radius)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'EMP001', '1234', 'Ajay Kumar', 'Security Guard', 'Operations', '9876543210', 25000, 'Office Premises, Block A', 28.6139, 77.2090, 200),
  ('00000000-0000-0000-0000-000000000001', 'EMP002', '1234', 'Priya Sharma', 'Receptionist', 'Admin', '9876543211', 22000, 'Office Premises, Block B', 28.6140, 77.2091, 200),
  ('00000000-0000-0000-0000-000000000001', 'EMP003', '1234', 'Rahul Singh', 'Technician', 'IT', '9876543212', 30000, 'Office Premises, Block C', 28.6141, 77.2092, 200)
ON CONFLICT DO NOTHING;
