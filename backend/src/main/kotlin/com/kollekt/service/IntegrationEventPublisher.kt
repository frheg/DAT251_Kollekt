package com.kollekt.service

import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Service
import java.time.Instant

@Service
class IntegrationEventPublisher(
    private val kafkaTemplate: KafkaTemplate<String, Any>,
    @Value("\${app.topics.task-events}") private val taskTopic: String,
    @Value("\${app.topics.chat-events}") private val chatTopic: String,
    @Value("\${app.topics.economy-events}") private val economyTopic: String,
) {
    fun taskEvent(
        action: String,
        payload: Any,
    ) {
        publish(taskTopic, action, payload)
    }

    fun chatEvent(
        action: String,
        payload: Any,
    ) {
        publish(chatTopic, action, payload)
    }

    fun economyEvent(
        action: String,
        payload: Any,
    ) {
        publish(economyTopic, action, payload)
    }

    private fun publish(
        topic: String,
        action: String,
        payload: Any,
    ) {
        kafkaTemplate.send(
            topic,
            mapOf(
                "action" to action,
                "payload" to payload,
                "timestamp" to Instant.now().toString(),
            ),
        )
    }
}
