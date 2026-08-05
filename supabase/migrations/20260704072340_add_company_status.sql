-- Add status column to companies for hold/active control
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Ensure existing companies have active status
UPDATE companies SET status = 'active' WHERE status IS NULL OR status = '';
