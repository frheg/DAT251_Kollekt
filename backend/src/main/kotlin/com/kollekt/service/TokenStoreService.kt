package com.kollekt.service

import com.kollekt.domain.TokenEntry
import com.kollekt.repository.TokenEntryRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant

@Service
class TokenStoreService(
    private val tokenEntryRepository: TokenEntryRepository,
) {
    @Transactional
    fun storeRefreshToken(
        jti: String,
        subject: String,
        ttl: Duration,
    ) {
        purgeExpired()
        tokenEntryRepository.save(
            TokenEntry(
                jti = jti,
                subject = subject,
                tokenType = REFRESH,
                expiresAt = Instant.now().plus(ttl),
            ),
        )
    }

    fun isRefreshTokenActive(
        jti: String,
        subject: String,
    ): Boolean =
        tokenEntryRepository.existsByJtiAndSubjectAndTokenTypeAndExpiresAtAfter(
            jti,
            subject,
            REFRESH,
            Instant.now(),
        )

    @Transactional
    fun revokeRefreshToken(jti: String) {
        tokenEntryRepository.deleteByJtiAndTokenType(jti, REFRESH)
    }

    @Transactional
    fun revokeAccessToken(
        jti: String,
        ttl: Duration,
    ) {
        if (ttl.isNegative || ttl.isZero) return
        purgeExpired()
        tokenEntryRepository.save(
            TokenEntry(
                jti = jti,
                subject = "",
                tokenType = REVOKED_ACCESS,
                expiresAt = Instant.now().plus(ttl),
            ),
        )
    }

    fun isAccessTokenRevoked(jti: String): Boolean =
        tokenEntryRepository.existsByJtiAndTokenTypeAndExpiresAtAfter(
            jti,
            REVOKED_ACCESS,
            Instant.now(),
        )

    private fun purgeExpired() {
        tokenEntryRepository.deleteByExpiresAtBefore(Instant.now())
    }

    private companion object {
        const val REFRESH = "REFRESH"
        const val REVOKED_ACCESS = "REVOKED_ACCESS"
    }
}
