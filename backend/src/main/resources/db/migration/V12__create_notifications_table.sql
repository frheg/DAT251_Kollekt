-- Create notifications table for persistent user notifications
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(64) NOT NULL DEFAULT 'TASK_ASSIGNED',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    read BOOLEAN NOT NULL DEFAULT FALSE
);