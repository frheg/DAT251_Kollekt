package com.kollekt.config

import com.kollekt.service.TokenStoreService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.security.oauth2.jwt.Jwt

class RevokedTokenValidatorTest {
    private val tokenStoreService: TokenStoreService = mock()
    private val validator = RevokedTokenValidator(tokenStoreService)

    @Test
    fun `validate succeeds when token has no jti`() {
        val jwt = Jwt.withTokenValue("token").header("alg", "none").subject("Kasper").build()

        val result = validator.validate(jwt)

        assertTrue(result.errors.isEmpty())
    }

    @Test
    fun `validate succeeds when token is not revoked`() {
        whenever(tokenStoreService.isAccessTokenRevoked("jti-1")).thenReturn(false)
        val jwt = Jwt.withTokenValue("token").header("alg", "none").subject("Kasper").jti("jti-1").build()

        val result = validator.validate(jwt)

        assertTrue(result.errors.isEmpty())
    }

    @Test
    fun `validate fails when token is revoked`() {
        whenever(tokenStoreService.isAccessTokenRevoked("jti-2")).thenReturn(true)
        val jwt = Jwt.withTokenValue("token").header("alg", "none").subject("Kasper").jti("jti-2").build()

        val result = validator.validate(jwt)

        assertEquals(1, result.errors.size)
        assertEquals("invalid_token", result.errors.first().errorCode)
        assertEquals("Token has been revoked", result.errors.first().description)
    }
}
