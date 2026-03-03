package com.kollekt.service

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Captor
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import org.springframework.kafka.core.KafkaTemplate

@ExtendWith(MockitoExtension::class)
class IntegrationEventPublisherTest {
    @Mock lateinit var kafkaTemplate: KafkaTemplate<String, Any>

    @Captor lateinit var payloadCaptor: ArgumentCaptor<Any>

    @Test
    fun `taskEvent sends message with required fields`() {
        val publisher = IntegrationEventPublisher(kafkaTemplate, "task-topic", "chat-topic", "economy-topic")

        publisher.taskEvent("TASK_CREATED", mapOf("id" to 1))

        val mapCaptor: ArgumentCaptor<Map<String, Any>> = ArgumentCaptor.forClass(Map::class.java) as ArgumentCaptor<Map<String, Any>>
        verify(kafkaTemplate).send(eq("task-topic"), mapCaptor.capture())

        val msg = mapCaptor.value
        assertEquals("TASK_CREATED", msg["action"])
        assertEquals(mapOf("id" to 1), msg["payload"])
        assertNotNull(msg["timestamp"])
        assertTrue((msg["timestamp"] as String).isNotBlank())
    }

    @Test
    fun `chatEvent sends to chat topic`() {
        val publisher = IntegrationEventPublisher(kafkaTemplate, "task-topic", "chat-topic", "economy-topic")

        publisher.chatEvent("MESSAGE_CREATED", "hello")

        val mapCaptor: ArgumentCaptor<Map<String, Any>> = ArgumentCaptor.forClass(Map::class.java) as ArgumentCaptor<Map<String, Any>>
        verify(kafkaTemplate).send(eq("chat-topic"), mapCaptor.capture())
        assertEquals("MESSAGE_CREATED", mapCaptor.value["action"])
    }

    @Test
    fun `economyEvent sends to economy topic`() {
        val publisher = IntegrationEventPublisher(kafkaTemplate, "task-topic", "chat-topic", "economy-topic")

        publisher.economyEvent("EXPENSE_CREATED", 123)

        val mapCaptor: ArgumentCaptor<Map<String, Any>> = ArgumentCaptor.forClass(Map::class.java) as ArgumentCaptor<Map<String, Any>>
        verify(kafkaTemplate).send(eq("economy-topic"), mapCaptor.capture())
        assertEquals("EXPENSE_CREATED", mapCaptor.value["action"])
    }
}
