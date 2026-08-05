/*
# Add per-employee PF & ESI flags

Adds two boolean columns to the employees table:
- `is_pf_enabled` (boolean, default true) — whether PF deduction applies to this employee
- `is_esi_enabled` (boolean, default true) — whether ESI deduction applies to this employee

PF/ESI is calculated only when BOTH the company-level `pf_esi_enabled` toggle
AND the employee-level flag are true.
*/

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS is_pf_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_esi_enabled boolean NOT NULL DEFAULT true;
