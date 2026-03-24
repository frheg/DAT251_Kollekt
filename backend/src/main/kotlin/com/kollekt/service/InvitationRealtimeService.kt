package com.kollekt.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Service
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet

@Service
class InvitationRealtimeService(
    private val objectMapper: ObjectMapper,
) {
    private val sessionsByEmail = ConcurrentHashMap<String, MutableSet<WebSocketSession>>()

    fun register(email: String, session: WebSocketSession) {
        sessionsByEmail.computeIfAbsent(email) { CopyOnWriteArraySet() }.add(session)
    }

    fun unregister(email: String, session: WebSocketSession) {
        sessionsByEmail[email]?.remove(session)
        if (sessionsByEmail[email].isNullOrEmpty()) {
            sessionsByEmail.remove(email)
        }
    }

    fun publish(email: String, type: String, payload: Any? = null) {
        val message = objectMapper.writeValueAsString(
            mapOf(
                "type" to type,
                "email" to email,
                "timestamp" to Instant.now().toString(),
                "payload" to payload,
            ),
        )
        sessionsByEmail[email]?.filter { it.isOpen }?.forEach { session ->
            try {
                session.sendMessage(TextMessage(message))
            } catch (_: Exception) {
                unregister(email, session)
            }
        }
    }
}
