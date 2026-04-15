CREATE TABLE IF NOT EXISTS collective_enabled_achievements (
    collective_id BIGINT NOT NULL REFERENCES collectives(id) ON DELETE CASCADE,
    achievement_key VARCHAR(50) NOT NULL,
    PRIMARY KEY (collective_id, achievement_key)
);
