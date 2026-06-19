package com.kollekt.repository

import com.kollekt.domain.TokenEntry
import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant

interface TokenEntryRepository : JpaRepository<TokenEntry, String> {
    fun existsByJtiAndSubjectAndTokenTypeAndExpiresAtAfter(
        jti: String,
        subject: String,
        tokenType: String,
        now: Instant,
    ): Boolean

    fun existsByJtiAndTokenTypeAndExpiresAtAfter(
        jti: String,
        tokenType: String,
        now: Instant,
    ): Boolean

    fun deleteByJtiAndTokenType(
        jti: String,
        tokenType: String,
    )

    fun deleteByExpiresAtBefore(now: Instant)
}
