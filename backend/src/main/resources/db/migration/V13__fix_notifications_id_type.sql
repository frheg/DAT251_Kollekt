-- Fix notifications.id to match Kotlin entity (bigint)
ALTER TABLE notifications ALTER COLUMN id TYPE BIGINT;
