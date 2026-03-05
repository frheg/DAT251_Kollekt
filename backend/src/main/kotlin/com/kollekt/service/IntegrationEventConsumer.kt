package com.kollekt.service

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
class IntegrationEventConsumer(
    @Value("\${app.topics.task-events}") private val taskTopic: String,
    @Value("\${app.topics.chat-events}") private val chatTopic: String,
    @Value("\${app.topics.economy-events}") private val economyTopic: String,
) {
    private val logger = LoggerFactory.getLogger(javaClass)

    @KafkaListener(topics = ["\${app.topics.task-events}"])
    fun consumeTaskEvents(event: String) {
        logger.info("Task event consumed from {}: {}", taskTopic, event)
    }

    @KafkaListener(topics = ["\${app.topics.chat-events}"])
    fun consumeChatEvents(event: String) {
        logger.info("Chat event consumed from {}: {}", chatTopic, event)
    }

    @KafkaListener(topics = ["\${app.topics.economy-events}"])
    fun consumeEconomyEvents(event: String) {
        logger.info("Economy event consumed from {}: {}", economyTopic, event)
    }
}
