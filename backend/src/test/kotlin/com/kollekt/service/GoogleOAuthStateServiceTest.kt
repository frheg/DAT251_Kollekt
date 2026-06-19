package com.kollekt.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest
import org.springframework.context.annotation.Import
import org.springframework.test.context.ActiveProfiles

@DataJpaTest
@Import(GoogleOAuthStateService::class)
@ActiveProfiles("test")
class GoogleOAuthStateServiceTest {
    @Autowired lateinit var service: GoogleOAuthStateService

    @Test
    fun `state is single use and preserves the bound return url`() {
        val state = service.issueState("Kasper", "no.kollekt.app://google-calendar-connected")

        val result = service.consumeState(state)

        assertEquals("Kasper", result.memberName)
        assertEquals("no.kollekt.app://google-calendar-connected", result.returnUrl)
        assertThrows(IllegalArgumentException::class.java) { service.consumeState(state) }
    }
}
