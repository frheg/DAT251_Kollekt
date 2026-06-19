package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/**
 * Refresh and revoked-access tokens, persisted in PostgreSQL (previously held in
 * Redis with a TTL). Expiry is enforced at query time via [expiresAt].
 */
@Entity
@Table(name = "auth_tokens")
data class TokenEntry(
    @Id @Column(name = "jti") val jti: String = "",
    @Column(name = "subject", nullable = false) val subject: String = "",
    @Column(name = "token_type", nullable = false) val tokenType: String = "",
    @Column(name = "expires_at", nullable = false) val expiresAt: Instant = Instant.EPOCH,
)
