CREATE TABLE task_feedback (
    id          BIGSERIAL PRIMARY KEY,
    task_id     BIGINT        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author      VARCHAR(255)  NOT NULL,
    message     TEXT          NOT NULL,
    anonymous   BOOLEAN       NOT NULL DEFAULT FALSE,
    image_data  TEXT,
    image_mime_type VARCHAR(120),
    created_at  TIMESTAMP     NOT NULL
);
