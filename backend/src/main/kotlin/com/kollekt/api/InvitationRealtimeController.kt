package com.kollekt.api

import com.kollekt.service.InvitationRealtimeService
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler
import org.springframework.web.socket.server.support.DefaultHandshakeHandler
import org.springframework.web.socket.server.HandshakeInterceptor
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.server.support.WebSocketHandlerMapping
import org.springframework.context.annotation.Configuration
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry
import org.springframework.stereotype.Component
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.web.socket.CloseStatus

@Configuration
@EnableWebSocket
class InvitationWebSocketConfig(
    @Autowired private val invitationRealtimeHandler: InvitationRealtimeHandler
) : WebSocketConfigurer {
    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry.addHandler(invitationRealtimeHandler, "/ws/invitations").setAllowedOrigins("*")
    }
}

@Component
class InvitationRealtimeHandler @Autowired constructor(
    private val invitationRealtimeService: com.kollekt.service.InvitationRealtimeService
) : TextWebSocketHandler() {
    override fun afterConnectionEstablished(session: WebSocketSession) {
        val email = session.uri?.query?.split("email=")?.getOrNull(1)?.split("&")?.getOrNull(0)
        if (email != null) {
            invitationRealtimeService.register(email, session)
        }
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        val email = session.uri?.query?.split("email=")?.getOrNull(1)?.split("&")?.getOrNull(0)
        if (email != null) {
            invitationRealtimeService.unregister(email, session)
        }
    }
}
