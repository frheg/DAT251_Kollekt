-- Add assignment_reason column to tasks table for storing the reason for assignment
ALTER TABLE tasks ADD COLUMN assignment_reason VARCHAR(512);