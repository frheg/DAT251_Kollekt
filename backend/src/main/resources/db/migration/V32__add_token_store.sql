-- Persist refresh and revoked-access tokens in PostgreSQL (replaces Redis).
-- Expiry is enforced at query time and expired rows are purged on write.
CREATE TABLE auth_tokens (
    jti VARCHAR(255) PRIMARY KEY,
    subject VARCHAR(255) NOT NULL,
    token_type VARCHAR(32) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_auth_tokens_expires_at ON auth_tokens (expires_at);
