package com.kollekt.repository

import com.kollekt.domain.TokenEntry
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
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

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    fun findByJtiAndTokenTypeAndExpiresAtAfter(
        jti: String,
        tokenType: String,
        now: Instant,
    ): TokenEntry?

    fun deleteByJtiAndTokenType(
        jti: String,
        tokenType: String,
    )

    fun deleteByExpiresAtBefore(now: Instant)
}
