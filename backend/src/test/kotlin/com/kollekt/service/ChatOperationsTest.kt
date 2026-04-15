package com.kollekt.service

import com.kollekt.api.dto.CreateMessageRequest
import com.kollekt.domain.ChatMessage
import com.kollekt.domain.Member
import com.kollekt.repository.ChatMessageRepository
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.MemberRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
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
    private lateinit var memberRepository: MemberRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var eventPublisher: IntegrationEventPublisher
    private lateinit var realtimeUpdateService: RealtimeUpdateService
    private lateinit var notificationService: NotificationService
    private lateinit var collectiveAccessService: CollectiveAccessService
    private lateinit var operations: ChatOperations

    @BeforeEach
    fun setUp() {
        chatMessageRepository = mock()
        memberRepository = mock()
        collectiveRepository = mock()
        eventPublisher = mock()
        realtimeUpdateService = mock()
        notificationService = mock()
        collectiveAccessService = CollectiveAccessService(memberRepository, collectiveRepository)
        operations =
            ChatOperations(
                chatMessageRepository,
                memberRepository,
                eventPublisher,
                realtimeUpdateService,
                notificationService,
                collectiveAccessService,
            )
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
    }

    @Test
    fun `create message trims text and publishes realtime event`() {
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer {
            (it.arguments[0] as ChatMessage).copy(id = 11)
        }

        val result = operations.createMessage(CreateMessageRequest(sender = "Ignored", text = "  Hei kollektiv  "), "Kasper")

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

        val result = operations.createImageMessage(image, "  Finished  ", "Kasper")

        assertEquals("Finished", result.text)
        assertEquals(Base64.getEncoder().encodeToString("img".toByteArray()), result.imageData)
        verify(eventPublisher).chatEvent("MESSAGE_CREATED", result)
    }

    @Test
    fun `create message allows replying to a reply`() {
        whenever(chatMessageRepository.findById(7)).thenReturn(
            Optional.of(
                ChatMessage(
                    id = 7,
                    sender = "Emma",
                    collectiveCode = "ABC123",
                    text = "Reply",
                    timestamp = LocalDateTime.now(),
                    replyToMessageId = 3,
                ),
            ),
        )
        whenever(chatMessageRepository.existsByReplyToMessageId(7)).thenReturn(false)
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer {
            (it.arguments[0] as ChatMessage).copy(id = 12)
        }

        val result =
            operations.createMessage(
                CreateMessageRequest(sender = "Ignored", text = "Nested reply", replyToMessageId = 7),
                "Kasper",
            )

        assertEquals(7, result.replyToMessageId)
    }

    @Test
    fun `create message rejects second direct reply to same message`() {
        whenever(chatMessageRepository.findById(5)).thenReturn(
            Optional.of(
                ChatMessage(
                    id = 5,
                    sender = "Emma",
                    collectiveCode = "ABC123",
                    text = "Original",
                    timestamp = LocalDateTime.now(),
                ),
            ),
        )
        whenever(chatMessageRepository.existsByReplyToMessageId(5)).thenReturn(true)

        val error =
            assertThrows(IllegalArgumentException::class.java) {
                operations.createMessage(
                    CreateMessageRequest(sender = "Ignored", text = "Another reply", replyToMessageId = 5),
                    "Kasper",
                )
            }

        assertEquals("Message already has a reply", error.message)
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

        val result = operations.addReaction(9, "😂", "Kasper")

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

        val result = operations.votePoll(15, 1, "Kasper")

        assertTrue(
            result.poll!!
                .options
                .single { it.id == 0 }
                .users
                .none { it == "Kasper" },
        )
        assertEquals(
            listOf("Kasper"),
            result.poll!!
                .options
                .single { it.id == 1 }
                .users,
        )
        verify(realtimeUpdateService).publish("ABC123", "MESSAGE_POLL_UPDATED", result)
    }

    private fun member(
        name: String,
        email: String,
        collectiveCode: String? = "ABC123",
    ) = Member(
        name = name,
        email = email,
        collectiveCode = collectiveCode,
    )
}
