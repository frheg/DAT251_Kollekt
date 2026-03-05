package com.kollekt.service

import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

/**
 * Unit tests for IntegrationEventConsumer.
 * The listener methods only log — we verify they run without throwing.
 */
class IntegrationEventConsumerTest {
    private lateinit var consumer: IntegrationEventConsumer

    @BeforeEach
    fun setUp() {
        consumer =
            IntegrationEventConsumer(
                taskTopic = "task-events",
                chatTopic = "chat-events",
                economyTopic = "economy-events",
            )
    }

    @Test
    fun `consumeTaskEvents processes event without error`() {
        consumer.consumeTaskEvents("""{"type":"TASK_CREATED","taskId":1}""")
    }

    @Test
    fun `consumeChatEvents processes event without error`() {
        consumer.consumeChatEvents("""{"type":"MESSAGE_SENT","message":"hello"}""")
    }

    @Test
    fun `consumeEconomyEvents processes event without error`() {
        consumer.consumeEconomyEvents("""{"type":"EXPENSE_ADDED","amount":42.0}""")
    }
}
