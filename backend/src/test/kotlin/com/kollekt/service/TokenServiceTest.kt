package com.kollekt.service

import com.kollekt.domain.Member
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.junit.jupiter.MockitoSettings
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.mockito.quality.Strictness
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.JwtEncoderParameters
import org.springframework.security.oauth2.jwt.JwtException
import java.time.Duration
import java.time.Instant

@ExtendWith(MockitoExtension::class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TokenServiceTest {
    @Mock lateinit var jwtEncoder: JwtEncoder

    @Mock lateinit var jwtDecoder: JwtDecoder

    @Mock lateinit var tokenStoreService: TokenStoreService

    private lateinit var tokenService: TokenService

    private val tokenValiditySeconds = 3600L
    private val refreshTokenValiditySeconds = 1209600L

    private val member = Member(id = 1L, name = "Kasper", email = "kasper@example.com", level = 1, xp = 0)

    /** Returns a fake signed Jwt that mirrors the claims set passed to the encoder. */
    private fun stubEncoder() {
        whenever(jwtEncoder.encode(any<JwtEncoderParameters>())).doAnswer { invocation ->
            val params = invocation.getArgument<JwtEncoderParameters>(0)
            val subject = params.claims.subject ?: "unknown"
            val jti = params.claims.id ?: "jti"
            val now = Instant.now()
            Jwt.withTokenValue("signed.$subject.$jti")
                .header("alg", MacAlgorithm.HS256.name)
                .subject(subject)
                .jti(jti)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .claim("token_type", params.claims.getClaim("token_type") ?: "access")
                .build()
        }
    }

    @BeforeEach
    fun setUp() {
        stubEncoder()

        tokenService =
            TokenService(
                jwtEncoder,
                jwtDecoder,
                tokenStoreService,
                tokenValiditySeconds,
                refreshTokenValiditySeconds,
            )
    }

    // ── issueTokenPair ────────────────────────────────────────────────────────

    @Test
    fun `issueTokenPair returns access and refresh tokens`() {
        val result = tokenService.issueTokenPair(member)

        assertNotNull(result.accessToken)
        assertNotNull(result.refreshToken)
        assertEquals("Bearer", result.tokenType)
        assertEquals(tokenValiditySeconds, result.expiresIn)
    }

    @Test
    fun `issueTokenPair stores refresh token in token store`() {
        tokenService.issueTokenPair(member)

        val jtiCaptor = argumentCaptor<String>()
        verify(tokenStoreService).storeRefreshToken(
            jtiCaptor.capture(),
            eq(member.name),
            eq(Duration.ofSeconds(refreshTokenValiditySeconds)),
        )
        assertNotNull(jtiCaptor.firstValue)
    }

    // ── rotateRefreshToken ────────────────────────────────────────────────────

    @Test
    fun `rotateRefreshToken returns subject when token is valid`() {
        val now = Instant.now()
        val refreshJwt =
            Jwt.withTokenValue("refresh-token")
                .header("alg", MacAlgorithm.HS256.name)
                .subject("Kasper")
                .jti("jti-123")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .claim("token_type", "refresh")
                .build()

        whenever(jwtDecoder.decode("refresh-token")).doReturn(refreshJwt)
        whenever(tokenStoreService.isRefreshTokenActive("jti-123", "Kasper")).doReturn(true)

        val result = tokenService.rotateRefreshToken("refresh-token")

        assertEquals("Kasper", result.subject)
        verify(tokenStoreService).revokeRefreshToken("jti-123")
    }

    @Test
    fun `rotateRefreshToken throws when token_type is not refresh`() {
        val now = Instant.now()
        val accessJwt =
            Jwt.withTokenValue("access-token")
                .header("alg", MacAlgorithm.HS256.name)
                .subject("Kasper")
                .jti("jti-abc")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .claim("token_type", "access")
                .build()

        whenever(jwtDecoder.decode("access-token")).doReturn(accessJwt)

        assertThrows<IllegalArgumentException> {
            tokenService.rotateRefreshToken("access-token")
        }
    }

    @Test
    fun `rotateRefreshToken throws when token is not active in store`() {
        val now = Instant.now()
        val refreshJwt =
            Jwt.withTokenValue("refresh-token")
                .header("alg", MacAlgorithm.HS256.name)
                .subject("Kasper")
                .jti("jti-456")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .claim("token_type", "refresh")
                .build()

        whenever(jwtDecoder.decode("refresh-token")).doReturn(refreshJwt)
        whenever(tokenStoreService.isRefreshTokenActive("jti-456", "Kasper")).doReturn(false)

        assertThrows<IllegalArgumentException> {
            tokenService.rotateRefreshToken("refresh-token")
        }
    }

    @Test
    fun `rotateRefreshToken throws when jwt decode fails`() {
        whenever(jwtDecoder.decode(any())).doAnswer { throw JwtException("bad token") }

        assertThrows<IllegalArgumentException> {
            tokenService.rotateRefreshToken("garbage")
        }
    }

    // ── revokeAccessToken ─────────────────────────────────────────────────────

    @Test
    fun `revokeAccessToken stores jti with remaining ttl`() {
        val now = Instant.now()
        val jwt =
            Jwt.withTokenValue("access-token")
                .header("alg", MacAlgorithm.HS256.name)
                .subject("Kasper")
                .jti("jti-789")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .build()

        tokenService.revokeAccessToken(jwt)

        verify(tokenStoreService).revokeAccessToken(eq("jti-789"), any<Duration>())
    }

    @Test
    fun `revokeAccessToken does nothing when jti is null`() {
        val now = Instant.now()
        // Build a JWT without an id claim — Jwt.Builder requires id() but we
        // can fake it with an empty string then intercept; easiest is to mock.
        val jwt =
            Jwt.withTokenValue("no-jti-token")
                .header("alg", MacAlgorithm.HS256.name)
                .subject("Kasper")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .build()

        // id() defaults to null when not set — calling revokeAccessToken should
        // be a no-op (no interaction with tokenStoreService).
        tokenService.revokeAccessToken(jwt)
        // Verify no revocation call was made
        org.mockito.Mockito.verifyNoInteractions(tokenStoreService)
    }

    // ── revokeRefreshToken ────────────────────────────────────────────────────

    @Test
    fun `revokeRefreshToken calls store revoke when token is valid`() {
        val now = Instant.now()
        val refreshJwt =
            Jwt.withTokenValue("refresh-token")
                .header("alg", MacAlgorithm.HS256.name)
                .subject("Kasper")
                .jti("jti-r1")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .claim("token_type", "refresh")
                .build()

        whenever(jwtDecoder.decode("refresh-token")).doReturn(refreshJwt)

        tokenService.revokeRefreshToken("refresh-token")

        verify(tokenStoreService).revokeRefreshToken("jti-r1")
    }

    @Test
    fun `revokeRefreshToken throws when token_type is not refresh`() {
        val now = Instant.now()
        val accessJwt =
            Jwt.withTokenValue("access-token")
                .header("alg", MacAlgorithm.HS256.name)
                .subject("Kasper")
                .jti("jti-a1")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .claim("token_type", "access")
                .build()

        whenever(jwtDecoder.decode("access-token")).doReturn(accessJwt)

        assertThrows<IllegalArgumentException> {
            tokenService.revokeRefreshToken("access-token")
        }
    }
}
