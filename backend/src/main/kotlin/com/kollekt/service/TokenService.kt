package com.kollekt.service

import com.kollekt.domain.Member
import java.time.Instant
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.oauth2.jwt.JwtClaimsSet
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.JwtEncoderParameters
import org.springframework.stereotype.Service

@Service
class TokenService(
        private val jwtEncoder: JwtEncoder,
        @Value("\${app.security.token-validity-seconds}") private val tokenValiditySeconds: Long,
) {
    fun issueAccessToken(member: Member): TokenResult {
        val issuedAt = Instant.now()
        val expiresAt = issuedAt.plusSeconds(tokenValiditySeconds)

        val claims =
                JwtClaimsSet.builder()
                        .subject(member.name)
                        .issuedAt(issuedAt)
                        .expiresAt(expiresAt)
                        .claim("uid", member.id)
                        .claim("scope", "USER")
                        .build()

        val token = jwtEncoder.encode(JwtEncoderParameters.from(claims)).tokenValue

        return TokenResult(
                accessToken = token,
                tokenType = "Bearer",
                expiresIn = tokenValiditySeconds,
        )
    }
}

data class TokenResult(
        val accessToken: String,
        val tokenType: String,
        val expiresIn: Long,
)
