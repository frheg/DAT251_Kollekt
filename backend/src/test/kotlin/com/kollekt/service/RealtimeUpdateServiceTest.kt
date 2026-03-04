package com.kollekt.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession

@ExtendWith(MockitoExtension::class)
class RealtimeUpdateServiceTest {

    @Mock lateinit var session: WebSocketSession

    private lateinit var service: RealtimeUpdateService

    @BeforeEach
    fun setUp() {
        service = RealtimeUpdateService(ObjectMapper())
    }

    @Test
    fun `register adds session to collective`() {
        whenever(session.isOpen).thenReturn(true)
        service.register("ABC", session)
        // Publish should reach the registered session
        service.publish("ABC", "TEST_EVENT")
        verify(session).sendMessage(any<TextMessage>())
    }

    @Test
    fun `unregister removes session so publish no longer reaches it`() {
        service.register("ABC", session)
        service.unregister("ABC", session)
        service.publish("ABC", "TEST_EVENT")
        verify(session, never()).sendMessage(any<TextMessage>())
    }

    @Test
    fun `publish does nothing when no sessions are registered for collective`() {
        // No sessions registered — should not throw
        assertDoesNotThrow { service.publish("UNKNOWN", "TEST_EVENT") }
    }

    @Test
    fun `publish skips closed sessions`() {
        whenever(session.isOpen).thenReturn(false)
        service.register("ABC", session)
        service.publish("ABC", "TEST_EVENT")
        verify(session, never()).sendMessage(any<TextMessage>())
    }

    @Test
    fun `publish unregisters session when sendMessage throws`() {
        whenever(session.isOpen).thenReturn(true)
        whenever(session.sendMessage(any<TextMessage>())).thenThrow(RuntimeException("broken pipe"))
        service.register("ABC", session)

        // Should not propagate the exception
        assertDoesNotThrow { service.publish("ABC", "TEST_EVENT") }

        // Session removed — second publish must not attempt to send again
        service.publish("ABC", "TEST_EVENT")
        verify(session).sendMessage(any<TextMessage>()) // called exactly once total
    }

    @Test
    fun `publish includes type and collectiveCode in message`() {
        whenever(session.isOpen).thenReturn(true)
        service.register("XYZ", session)

        val captor = org.mockito.kotlin.argumentCaptor<TextMessage>()
        service.publish("XYZ", "TASK_UPDATED", mapOf("taskId" to 42))
        verify(session).sendMessage(captor.capture())

        val body = captor.firstValue.payload
        assert(body.contains("TASK_UPDATED")) { "Expected type in payload: $body" }
        assert(body.contains("XYZ")) { "Expected collectiveCode in payload: $body" }
    }
}
