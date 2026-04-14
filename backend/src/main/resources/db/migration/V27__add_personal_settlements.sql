CREATE TABLE personal_settlements (
    id BIGSERIAL PRIMARY KEY,
    collective_code VARCHAR(255) NOT NULL,
    paid_by VARCHAR(255) NOT NULL,
    paid_to VARCHAR(255) NOT NULL,
    amount INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
