-- Add dashboard_layout column to locations table
ALTER TABLE locations ADD COLUMN dashboard_layout TEXT NOT NULL DEFAULT 'classic';

-- Add dashboard_layout column to arls table
ALTER TABLE arls ADD COLUMN dashboard_layout TEXT NOT NULL DEFAULT 'classic';
