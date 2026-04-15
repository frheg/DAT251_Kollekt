package com.kollekt.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Service
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet

@Service
class RealtimeUpdateService(
    private val objectMapper: ObjectMapper,
) {
    private val sessionsByCollective = ConcurrentHashMap<String, MutableSet<WebSocketSession>>()

    fun register(
        collectiveCode: String,
        session: WebSocketSession,
    ) {
        sessionsByCollective.computeIfAbsent(collectiveCode) { CopyOnWriteArraySet() }.add(session)
    }

    fun unregister(
        collectiveCode: String,
        session: WebSocketSession,
    ) {
        sessionsByCollective[collectiveCode]?.remove(session)
        if (sessionsByCollective[collectiveCode].isNullOrEmpty()) {
            sessionsByCollective.remove(collectiveCode)
        }
    }

    fun getOnlineCount(collectiveCode: String): Int =
        sessionsByCollective[collectiveCode]
            ?.filter { it.isOpen }
            ?.mapNotNull { it.attributes["memberName"] as? String }
            ?.distinct()
            ?.count() ?: 0

    fun sendTo(
        session: WebSocketSession,
        type: String,
        payload: Any? = null,
    ) {
        val message =
            objectMapper.writeValueAsString(
                mapOf(
                    "type" to type,
                    "timestamp" to Instant.now().toString(),
                    "payload" to payload,
                ),
            )
        try {
            session.sendMessage(TextMessage(message))
        } catch (_: Exception) {
            // ignore — session may have closed immediately
        }
    }

    fun publish(
        collectiveCode: String,
        type: String,
        payload: Any? = null,
    ) = publishExcluding(collectiveCode, null, type, payload)

    fun publishExcluding(
        collectiveCode: String,
        exclude: WebSocketSession?,
        type: String,
        payload: Any? = null,
    ) {
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
            ?.filter { it.isOpen && it !== exclude }
            ?.forEach { session ->
                try {
                    session.sendMessage(TextMessage(message))
                } catch (_: Exception) {
                    unregister(collectiveCode, session)
                }
            }
    }
}
