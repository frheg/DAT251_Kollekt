package com.kollekt.service

import com.fasterxml.jackson.databind.ObjectMapper
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet
import org.springframework.stereotype.Service
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession

@Service
class RealtimeUpdateService(
        private val objectMapper: ObjectMapper,
) {
    private val sessionsByCollective = ConcurrentHashMap<String, MutableSet<WebSocketSession>>()

    fun register(collectiveCode: String, session: WebSocketSession) {
        sessionsByCollective.computeIfAbsent(collectiveCode) { CopyOnWriteArraySet() }.add(session)
    }

    fun unregister(collectiveCode: String, session: WebSocketSession) {
        sessionsByCollective[collectiveCode]?.remove(session)
        if (sessionsByCollective[collectiveCode].isNullOrEmpty()) {
            sessionsByCollective.remove(collectiveCode)
        }
    }

    fun publish(collectiveCode: String, type: String, payload: Any? = null) {
        val message =
                objectMapper.writeValueAsString(
                        mapOf(
                                "type" to type,
                                "collectiveCode" to collectiveCode,
                                "timestamp" to Instant.now().toString(),
                                "payload" to payload,
                        ),
                )
        sessionsByCollective[collectiveCode]
                ?.filter { it.isOpen }
                ?.forEach { session ->
                    try {
                        session.sendMessage(TextMessage(message))
                    } catch (_: Exception) {
                        unregister(collectiveCode, session)
                    }
                }
    }
}
