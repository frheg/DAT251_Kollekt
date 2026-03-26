-- Add penalty_xp column to tasks for tracking negative XP for missed deadlines
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS penalty_xp INTEGER DEFAULT 0;