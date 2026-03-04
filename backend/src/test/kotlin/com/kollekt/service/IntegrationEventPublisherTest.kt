package com.kollekt.service

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import org.springframework.kafka.core.KafkaTemplate

@ExtendWith(MockitoExtension::class)
class IntegrationEventPublisherTest {
    @Mock lateinit var kafkaTemplate: KafkaTemplate<String, Any>

    private val taskTopic = "task-events"
    private val chatTopic = "chat-events"
    private val economyTopic = "economy-events"

    @Test
    fun `taskEvent sends message with required fields`() {
        val publisher = IntegrationEventPublisher(kafkaTemplate, taskTopic, chatTopic, economyTopic)

        publisher.taskEvent("TASK_CREATED", mapOf("id" to 1))

        val mapCaptor = argumentCaptor<Map<String, Any>>()
        verify(kafkaTemplate).send(eq(taskTopic), mapCaptor.capture())

        val msg = mapCaptor.firstValue
        assertEquals("TASK_CREATED", msg["action"])
        assertEquals(mapOf("id" to 1), msg["payload"])
        assertNotNull(msg["timestamp"])
        assertTrue((msg["timestamp"] as String).isNotBlank())
    }

    @Test
    fun `chatEvent sends to chat topic`() {
        val publisher = IntegrationEventPublisher(kafkaTemplate, taskTopic, chatTopic, economyTopic)

        publisher.chatEvent("MESSAGE_CREATED", "hello")

        val mapCaptor = argumentCaptor<Map<String, Any>>()
        verify(kafkaTemplate).send(eq(chatTopic), mapCaptor.capture())
        assertEquals("MESSAGE_CREATED", mapCaptor.firstValue["action"])
    }

    @Test
    fun `economyEvent sends to economy topic`() {
        val publisher = IntegrationEventPublisher(kafkaTemplate, taskTopic, chatTopic, economyTopic)

        publisher.economyEvent("EXPENSE_CREATED", 123)

        val mapCaptor = argumentCaptor<Map<String, Any>>()
        verify(kafkaTemplate).send(eq(economyTopic), mapCaptor.capture())
        assertEquals("EXPENSE_CREATED", mapCaptor.firstValue["action"])
    }
}
