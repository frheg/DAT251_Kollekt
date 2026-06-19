package com.kollekt.service

import com.kollekt.domain.TokenEntry
import com.kollekt.repository.TokenEntryRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

data class GoogleOAuthState(
    val memberName: String,
    val returnUrl: String,
)

@Service
class GoogleOAuthStateService(
    private val tokenEntryRepository: TokenEntryRepository,
) {
    @Transactional
    fun issueState(
        memberName: String,
        returnUrl: String,
    ): String {
        require(!memberName.contains('\n') && !returnUrl.contains('\n'))
        val state = UUID.randomUUID().toString()
        tokenEntryRepository.deleteByExpiresAtBefore(Instant.now())
        tokenEntryRepository.save(
            TokenEntry(
                jti = state,
                subject = "$memberName\n$returnUrl",
                tokenType = GOOGLE_OAUTH_STATE,
                expiresAt = Instant.now().plus(10, ChronoUnit.MINUTES),
            ),
        )
        return state
    }

    @Transactional
    fun consumeState(state: String): GoogleOAuthState {
        val entry =
            tokenEntryRepository.findByJtiAndTokenTypeAndExpiresAtAfter(
                state,
                GOOGLE_OAUTH_STATE,
                Instant.now(),
            ) ?: throw IllegalArgumentException("Invalid or expired OAuth state")
        tokenEntryRepository.delete(entry)
        val parts = entry.subject.split('\n', limit = 2)
        require(parts.size == 2) { "Invalid OAuth state" }
        return GoogleOAuthState(parts[0], parts[1])
    }

    private companion object {
        const val GOOGLE_OAUTH_STATE = "GOOGLE_OAUTH_STATE"
    }
}
