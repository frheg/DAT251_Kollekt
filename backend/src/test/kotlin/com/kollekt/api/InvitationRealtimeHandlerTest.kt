package com.kollekt.api

import com.kollekt.service.InvitationRealtimeService
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistration
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry
import java.net.URI

class InvitationRealtimeHandlerTest {
    private val service: InvitationRealtimeService = mock()
    private val session: WebSocketSession = mock()
    private val handler = InvitationRealtimeHandler(service)

    @Test
    fun `afterConnectionEstablished registers email from query string`() {
        whenever(session.uri).thenReturn(URI("ws://localhost/ws/invitations?email=kasper@example.com"))

        handler.afterConnectionEstablished(session)

        verify(service).register("kasper@example.com", session)
    }

    @Test
    fun `afterConnectionEstablished ignores missing email`() {
        whenever(session.uri).thenReturn(URI("ws://localhost/ws/invitations"))

        handler.afterConnectionEstablished(session)

        verifyNoInteractions(service)
    }

    @Test
    fun `afterConnectionClosed unregisters email from query string`() {
        whenever(session.uri).thenReturn(URI("ws://localhost/ws/invitations?email=kasper@example.com"))

        handler.afterConnectionClosed(session, CloseStatus.NORMAL)

        verify(service).unregister("kasper@example.com", session)
    }

    @Test
    fun `websocket config registers invitation handler with wildcard origin`() {
        val registry: WebSocketHandlerRegistry = mock()
        val registration: WebSocketHandlerRegistration = mock()
        whenever(registry.addHandler(handler, "/ws/invitations")).thenReturn(registration)
        whenever(registration.setAllowedOrigins("*")).thenReturn(registration)

        InvitationWebSocketConfig(handler).registerWebSocketHandlers(registry)

        verify(registry).addHandler(handler, "/ws/invitations")
        verify(registration).setAllowedOrigins("*")
    }
}
