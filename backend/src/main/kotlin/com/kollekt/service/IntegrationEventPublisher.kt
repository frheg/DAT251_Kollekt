package com.kollekt.service

import java.time.Instant
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Service

@Service
class IntegrationEventPublisher(
        private val kafkaTemplate: KafkaTemplate<String, Any>,
        @Value("\${app.topics.task-events}") private val taskTopic: String,
        @Value("\${app.topics.chat-events}") private val chatTopic: String,
        @Value("\${app.topics.economy-events}") private val economyTopic: String,
) {
    fun taskEvent(action: String, payload: Any) {
        kafkaTemplate.send(
                taskTopic,
                mapOf(
                        "action" to action,
                        "payload" to payload,
                        "timestamp" to Instant.now().toString()
                )
        )
    }

    fun chatEvent(action: String, payload: Any) {
        kafkaTemplate.send(
                chatTopic,
                mapOf(
                        "action" to action,
                        "payload" to payload,
                        "timestamp" to Instant.now().toString()
                )
        )
    }

    fun economyEvent(action: String, payload: Any) {
        kafkaTemplate.send(
                economyTopic,
                mapOf(
                        "action" to action,
                        "payload" to payload,
                        "timestamp" to Instant.now().toString()
                )
        )
    }
}
