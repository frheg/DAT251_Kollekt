package com.kollekt.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Configuration
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry

@Configuration
@EnableWebSocket
class WebSocketConfig(
        private val collectiveWebSocketHandler: CollectiveWebSocketHandler,
        @Value("\${app.cors.allowed-origins}") private val allowedOrigins: String,
) : WebSocketConfigurer {
    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry.addHandler(collectiveWebSocketHandler, "/ws/collective")
                .setAllowedOrigins(*allowedOrigins.split(',').map { it.trim() }.toTypedArray())
    }
}
