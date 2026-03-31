package com.kollekt.api

import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt

class AuthVerificationTest {
    @Test
    fun `requireTokenSubject accepts matching subject`() {
        val jwt = Jwt.withTokenValue("token").header("alg", "none").subject("Kasper").build()

        assertDoesNotThrow {
            requireTokenSubject(jwt, "Kasper")
        }
    }

    @Test
    fun `requireTokenSubject rejects mismatched subject`() {
        val jwt = Jwt.withTokenValue("token").header("alg", "none").subject("Kasper").build()

        assertThrows<AccessDeniedException> {
            requireTokenSubject(jwt, "Emma")
        }
    }
}
