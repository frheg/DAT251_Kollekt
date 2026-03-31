-- Add recurrenceRule column to tasks table for recurrence rules (e.g., NONE, DAILY, WEEKLY, RFC 5545)
ALTER TABLE tasks ADD COLUMN recurrence_rule VARCHAR(128);