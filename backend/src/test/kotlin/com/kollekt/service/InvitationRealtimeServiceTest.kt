package com.kollekt.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession

@ExtendWith(MockitoExtension::class)
class InvitationRealtimeServiceTest {
    @Mock lateinit var session: WebSocketSession

    @Test
    fun `register adds session and publish reaches matching email`() {
        whenever(session.isOpen).thenReturn(true)
        val service = InvitationRealtimeService(ObjectMapper())

        service.register("kasper@example.com", session)
        service.publish("kasper@example.com", "INVITATION_CREATED")

        verify(session).sendMessage(any<TextMessage>())
    }

    @Test
    fun `unregister removes session so later publishes are ignored`() {
        val service = InvitationRealtimeService(ObjectMapper())

        service.register("kasper@example.com", session)
        service.unregister("kasper@example.com", session)
        service.publish("kasper@example.com", "INVITATION_CREATED")

        verify(session, never()).sendMessage(any<TextMessage>())
    }

    @Test
    fun `publish skips closed sessions`() {
        whenever(session.isOpen).thenReturn(false)
        val service = InvitationRealtimeService(ObjectMapper())

        service.register("kasper@example.com", session)
        service.publish("kasper@example.com", "INVITATION_CREATED")

        verify(session, never()).sendMessage(any<TextMessage>())
    }

    @Test
    fun `publish unregisters broken sessions after send failure`() {
        whenever(session.isOpen).thenReturn(true)
        whenever(session.sendMessage(any<TextMessage>())).thenThrow(RuntimeException("broken pipe"))
        val service = InvitationRealtimeService(ObjectMapper())

        service.register("kasper@example.com", session)

        assertDoesNotThrow { service.publish("kasper@example.com", "INVITATION_CREATED") }
        service.publish("kasper@example.com", "INVITATION_CREATED")

        verify(session).sendMessage(any<TextMessage>())
    }

    @Test
    fun `publish includes type email and payload in message body`() {
        whenever(session.isOpen).thenReturn(true)
        val service = InvitationRealtimeService(ObjectMapper())
        val messageCaptor = argumentCaptor<TextMessage>()

        service.register("kasper@example.com", session)
        service.publish("kasper@example.com", "INVITATION_ACCEPTED", mapOf("invitationId" to 42))

        verify(session).sendMessage(messageCaptor.capture())
        val payload = messageCaptor.firstValue.payload
        assert(payload.contains("INVITATION_ACCEPTED")) { "Expected type in payload: $payload" }
        assert(payload.contains("kasper@example.com")) { "Expected email in payload: $payload" }
        assert(payload.contains("invitationId")) { "Expected nested payload in payload: $payload" }
    }
}
