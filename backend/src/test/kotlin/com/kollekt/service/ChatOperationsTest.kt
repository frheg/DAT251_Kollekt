package com.kollekt.service

import com.kollekt.api.dto.CreateMessageRequest
import com.kollekt.domain.ChatMessage
import com.kollekt.repository.ChatMessageRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.mock.web.MockMultipartFile
import java.time.LocalDateTime
import java.util.Base64
import java.util.Optional

class ChatOperationsTest {
    private lateinit var chatMessageRepository: ChatMessageRepository
    private lateinit var eventPublisher: IntegrationEventPublisher
    private lateinit var realtimeUpdateService: RealtimeUpdateService
    private lateinit var operations: ChatOperations

    @BeforeEach
    fun setUp() {
        chatMessageRepository = mock()
        eventPublisher = mock()
        realtimeUpdateService = mock()
        operations = ChatOperations(chatMessageRepository, eventPublisher, realtimeUpdateService)
    }

    @Test
    fun `create message trims text and publishes realtime event`() {
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer {
            (it.arguments[0] as ChatMessage).copy(id = 11)
        }

        val result =
            operations.createMessage(
                request = CreateMessageRequest(sender = "Ignored", text = "  Hei kollektiv  "),
                actorName = "Kasper",
            ) { "ABC123" }

        assertEquals("Hei kollektiv", result.text)
        verify(eventPublisher).chatEvent("MESSAGE_CREATED", result)
        verify(realtimeUpdateService).publish("ABC123", "MESSAGE_CREATED", result)
    }

    @Test
    fun `create image message stores base64 payload`() {
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer {
            (it.arguments[0] as ChatMessage).copy(id = 15)
        }
        val image = MockMultipartFile("image", "cleanup.png", "image/png", "img".toByteArray())

        val result = operations.createImageMessage(image, "  Finished  ", "Kasper") { "ABC123" }

        assertEquals("Finished", result.text)
        assertEquals(Base64.getEncoder().encodeToString("img".toByteArray()), result.imageData)
        verify(eventPublisher).chatEvent("MESSAGE_CREATED", result)
    }

    @Test
    fun `add reaction replaces actor previous reaction`() {
        whenever(chatMessageRepository.findById(9)).thenReturn(
            Optional.of(
                ChatMessage(
                    id = 9,
                    sender = "Emma",
                    collectiveCode = "ABC123",
                    text = "Hi",
                    timestamp = LocalDateTime.now(),
                    reactions = """{"❤️":["Kasper"],"👍":["Emma"]}""",
                ),
            ),
        )
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer { it.arguments[0] as ChatMessage }

        val result = operations.addReaction(9, "😂", "Kasper") { "ABC123" }

        assertEquals(listOf("Emma"), result.reactions.single { it.emoji == "👍" }.users)
        assertEquals(listOf("Kasper"), result.reactions.single { it.emoji == "😂" }.users)
        assertNull(result.reactions.find { it.emoji == "❤️" })
    }

    @Test
    fun `vote poll moves actor vote between options`() {
        whenever(chatMessageRepository.findById(15)).thenReturn(
            Optional.of(
                ChatMessage(
                    id = 15,
                    sender = "Emma",
                    collectiveCode = "ABC123",
                    text = "Poll",
                    timestamp = LocalDateTime.now(),
                    poll =
                        """
                        {"question":"Favorite snack?","options":[
                          {"id":0,"text":"Chips","users":["Emma","Kasper"]},
                          {"id":1,"text":"Soda","users":[]}
                        ]}
                        """.trimIndent(),
                ),
            ),
        )
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer { it.arguments[0] as ChatMessage }

        val result = operations.votePoll(15, 1, "Kasper") { "ABC123" }

        assertTrue(result.poll!!.options.single { it.id == 0 }.users.none { it == "Kasper" })
        assertEquals(listOf("Kasper"), result.poll!!.options.single { it.id == 1 }.users)
        verify(realtimeUpdateService).publish("ABC123", "MESSAGE_POLL_UPDATED", result)
    }
}
