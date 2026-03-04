package com.kollekt.service

import com.kollekt.domain.Member
import java.time.Duration
import java.time.Instant
import java.util.UUID
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtClaimsSet
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.JwtEncoderParameters
import org.springframework.security.oauth2.jwt.JwtException
import org.springframework.stereotype.Service

@Service
class TokenService(
        private val jwtEncoder: JwtEncoder,
        private val jwtDecoder: JwtDecoder,
        private val tokenStoreService: TokenStoreService,
        @Value("\${app.security.token-validity-seconds}") private val tokenValiditySeconds: Long,
        @Value("\${app.security.refresh-token-validity-seconds}")
        private val refreshTokenValiditySeconds: Long,
) {
    fun issueTokenPair(member: Member): TokenResult {
        val access = issueAccessToken(member)
        val refresh = issueRefreshToken(member)
        tokenStoreService.storeRefreshToken(
                refresh.jti,
                member.name,
                Duration.ofSeconds(refreshTokenValiditySeconds),
        )

        return TokenResult(
                accessToken = access.tokenValue,
                refreshToken = refresh.tokenValue,
                tokenType = "Bearer",
                expiresIn = tokenValiditySeconds,
        )
    }

    fun rotateRefreshToken(refreshToken: String): RefreshResult {
        val jwt = decodeRefreshJwt(refreshToken)
        val tokenType = jwt.getClaimAsString("token_type")
        if (tokenType != "refresh") {
            throw IllegalArgumentException("Invalid refresh token")
        }

        val jti = jwt.id ?: throw IllegalArgumentException("Invalid refresh token")
        val subject = jwt.subject
        if (!tokenStoreService.isRefreshTokenActive(jti, subject)) {
            throw IllegalArgumentException("Refresh token is invalid or expired")
        }

        tokenStoreService.revokeRefreshToken(jti)
        return RefreshResult(subject = subject)
    }

    fun revokeAccessToken(jwt: Jwt) {
        val jti = jwt.id ?: return
        val expiresAt = jwt.expiresAt ?: return
        val ttl = Duration.between(Instant.now(), expiresAt)
        tokenStoreService.revokeAccessToken(jti, ttl)
    }

    fun revokeRefreshToken(refreshToken: String) {
        val jwt = decodeRefreshJwt(refreshToken)
        val tokenType = jwt.getClaimAsString("token_type")
        if (tokenType != "refresh") {
            throw IllegalArgumentException("Invalid refresh token")
        }
        val jti = jwt.id ?: throw IllegalArgumentException("Invalid refresh token")
        tokenStoreService.revokeRefreshToken(jti)
    }

    private fun decodeRefreshJwt(token: String): Jwt {
        return try {
            jwtDecoder.decode(token)
        } catch (_: JwtException) {
            throw IllegalArgumentException("Invalid refresh token")
        }
    }

    private fun issueAccessToken(member: Member): SignedToken {
        val issuedAt = Instant.now()
        val expiresAt = issuedAt.plusSeconds(tokenValiditySeconds)
        val jti = UUID.randomUUID().toString()

        val claims =
                JwtClaimsSet.builder()
                        .subject(member.name)
                        .id(jti)
                        .issuedAt(issuedAt)
                        .expiresAt(expiresAt)
                        .claim("uid", member.id)
                        .claim("scope", "USER")
                        .claim("token_type", "access")
                        .build()

        val token = jwtEncoder.encode(JwtEncoderParameters.from(claims)).tokenValue

        return SignedToken(tokenValue = token, jti = jti)
    }

    private fun issueRefreshToken(member: Member): SignedToken {
        val issuedAt = Instant.now()
        val expiresAt = issuedAt.plusSeconds(refreshTokenValiditySeconds)
        val jti = UUID.randomUUID().toString()

        val claims =
                JwtClaimsSet.builder()
                        .subject(member.name)
                        .id(jti)
                        .issuedAt(issuedAt)
                        .expiresAt(expiresAt)
                        .claim("uid", member.id)
                        .claim("token_type", "refresh")
                        .build()

        val token = jwtEncoder.encode(JwtEncoderParameters.from(claims)).tokenValue

        return SignedToken(tokenValue = token, jti = jti)
    }
}

data class TokenResult(
        val accessToken: String,
        val refreshToken: String,
        val tokenType: String,
        val expiresIn: Long,
)

data class RefreshResult(
        val subject: String,
)

private data class SignedToken(
        val tokenValue: String,
        val jti: String,
)
