package com.kollekt.service

import com.kollekt.api.dto.CreateExpenseRequest
import com.kollekt.api.dto.CreatePantEntryRequest
import com.kollekt.domain.Member
import com.kollekt.domain.PantEntry
import com.kollekt.domain.ShoppingItem
import com.kollekt.repository.AchievementRepository
import com.kollekt.repository.ChatMessageRepository
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.EventRepository
import com.kollekt.repository.ExpenseRepository
import com.kollekt.repository.InvitationRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.PantEntryRepository
import com.kollekt.repository.RoomRepository
import com.kollekt.repository.SettlementCheckpointRepository
import com.kollekt.repository.ShoppingItemRepository
import com.kollekt.repository.TaskRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.ValueOperations
import org.springframework.security.oauth2.jwt.Jwt
import java.time.LocalDate

class KollektServiceCoverageTest {
    private lateinit var invitationRepository: InvitationRepository
    private lateinit var roomRepository: RoomRepository
    private lateinit var memberRepository: MemberRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var taskRepository: TaskRepository
    private lateinit var shoppingItemRepository: ShoppingItemRepository
    private lateinit var eventRepository: EventRepository
    private lateinit var chatMessageRepository: ChatMessageRepository
    private lateinit var expenseRepository: ExpenseRepository
    private lateinit var settlementCheckpointRepository: SettlementCheckpointRepository
    private lateinit var pantEntryRepository: PantEntryRepository
    private lateinit var achievementRepository: AchievementRepository
    private lateinit var redisTemplate: RedisTemplate<String, Any>
    private lateinit var eventPublisher: IntegrationEventPublisher
    private lateinit var realtimeUpdateService: RealtimeUpdateService
    private lateinit var passwordEncoder: org.springframework.security.crypto.password.PasswordEncoder
    private lateinit var tokenService: TokenService
    private lateinit var notificationService: NotificationService
    private lateinit var valueOps: ValueOperations<String, Any>
    private lateinit var service: KollektService

    @BeforeEach
    fun setUp() {
        invitationRepository = mock()
        roomRepository = mock()
        memberRepository = mock()
        collectiveRepository = mock()
        taskRepository = mock()
        shoppingItemRepository = mock()
        eventRepository = mock()
        chatMessageRepository = mock()
        expenseRepository = mock()
        settlementCheckpointRepository = mock()
        pantEntryRepository = mock()
        achievementRepository = mock()
        redisTemplate = mock()
        eventPublisher = mock()
        realtimeUpdateService = mock()
        passwordEncoder = mock()
        tokenService = mock()
        notificationService = mock()
        valueOps = mock()
        doReturn(valueOps).whenever(redisTemplate).opsForValue()

        service =
            KollektService(
                memberRepository,
                collectiveRepository,
                taskRepository,
                shoppingItemRepository,
                eventRepository,
                chatMessageRepository,
                expenseRepository,
                settlementCheckpointRepository,
                pantEntryRepository,
                achievementRepository,
                redisTemplate,
                eventPublisher,
                realtimeUpdateService,
                passwordEncoder,
                tokenService,
                invitationRepository,
                roomRepository,
                notificationService,
            )
    }

    @Test
    fun `get shopping items maps collective scoped items`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(shoppingItemRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                ShoppingItem(id = 1, item = "Milk", addedBy = "Emma", collectiveCode = "ABC123", completed = false),
                ShoppingItem(id = 2, item = "Soap", addedBy = "Kasper", collectiveCode = "ABC123", completed = true),
            ),
        )

        val result = service.getShoppingItems("Kasper")

        assertEquals(listOf("Milk", "Soap"), result.map { it.item })
        assertEquals(listOf(false, true), result.map { it.completed })
    }

    @Test
    fun `toggle shopping item flips completion and publishes task event`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(shoppingItemRepository.findByIdAndCollectiveCode(9, "ABC123")).thenReturn(
            ShoppingItem(id = 9, item = "Milk", addedBy = "Emma", collectiveCode = "ABC123", completed = false),
        )
        whenever(shoppingItemRepository.save(any<ShoppingItem>())).thenAnswer { it.arguments[0] as ShoppingItem }

        val result = service.toggleShoppingItem(9, "Kasper")

        assertTrue(result.completed)
        verify(eventPublisher).taskEvent("SHOPPING_ITEM_TOGGLED", result)
    }

    @Test
    fun `delete shopping item removes the scoped item and publishes deletion event`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(shoppingItemRepository.findByIdAndCollectiveCode(9, "ABC123")).thenReturn(
            ShoppingItem(id = 9, item = "Soap", addedBy = "Emma", collectiveCode = "ABC123", completed = false),
        )

        service.deleteShoppingItem(9, "Kasper")

        verify(shoppingItemRepository).deleteById(9)
        verify(eventPublisher).taskEvent("SHOPPING_ITEM_DELETED", mapOf("id" to 9L))
    }

    @Test
    fun `create expense rejects collectives without members`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(emptyList())

        assertThrows<IllegalArgumentException> {
            service.createExpense(
                CreateExpenseRequest(
                    description = "Pizza",
                    amount = 200,
                    paidBy = "Kasper",
                    category = "Food",
                    date = LocalDate.parse("2026-03-01"),
                    participantNames = emptyList(),
                ),
                "Kasper",
            )
        }
    }

    @Test
    fun `get balances returns empty when there are no unsettled expenses`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(settlementCheckpointRepository.findTopByCollectiveCodeOrderByIdDesc("ABC123")).thenReturn(null)
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(emptyList())

        val result = service.getBalances("Kasper")

        assertTrue(result.isEmpty())
        verify(memberRepository, never()).findAllByCollectiveCode("ABC123")
    }

    @Test
    fun `get pant summary uses default goal and sorts newest entries first`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(pantEntryRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                PantEntry(
                    id = 1,
                    bottles = 10,
                    amount = 30,
                    addedBy = "Emma",
                    collectiveCode = "ABC123",
                    date = LocalDate.parse("2026-03-01"),
                ),
                PantEntry(
                    id = 2,
                    bottles = 12,
                    amount = 36,
                    addedBy = "Kasper",
                    collectiveCode = "ABC123",
                    date = LocalDate.parse("2026-03-05"),
                ),
            ),
        )

        val result = service.getPantSummary("Kasper")

        assertEquals(1000, result.goalAmount)
        assertEquals(66, result.currentAmount)
        assertEquals(listOf(2L, 1L), result.entries.map { it.id })
    }

    @Test
    fun `add pant entry uses actor name and publishes economy event`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(pantEntryRepository.save(any<PantEntry>())).thenAnswer {
            (it.arguments[0] as PantEntry).copy(id = 5)
        }

        val result =
            service.addPantEntry(
                CreatePantEntryRequest(
                    bottles = 18,
                    amount = 54,
                    addedBy = "Ignored by service",
                    date = LocalDate.parse("2026-03-10"),
                ),
                "Kasper",
            )

        assertEquals("Kasper", result.addedBy)
        verify(eventPublisher).economyEvent("PANT_ADDED", result)
    }

    @Test
    fun `get economy summary combines expenses balances and pant summary`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                com.kollekt.domain.Expense(
                    id = 1,
                    description = "Pizza",
                    amount = 200,
                    paidBy = "Kasper",
                    collectiveCode = "ABC123",
                    category = "Food",
                    date = LocalDate.parse("2026-03-01"),
                    participantNames = setOf("Kasper", "Emma"),
                ),
            ),
        )
        whenever(settlementCheckpointRepository.findTopByCollectiveCodeOrderByIdDesc("ABC123")).thenReturn(null)
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Kasper", "kasper@example.com"),
                member("Emma", "emma@example.com", id = 2),
            ),
        )
        whenever(pantEntryRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                PantEntry(
                    id = 2,
                    bottles = 8,
                    amount = 24,
                    addedBy = "Emma",
                    collectiveCode = "ABC123",
                    date = LocalDate.parse("2026-03-02"),
                ),
            ),
        )

        val result = service.getEconomySummary("Kasper")

        assertEquals(1, result.expenses.size)
        assertEquals(2, result.balances.size)
        assertEquals(24, result.pantSummary.currentAmount)
    }

    @Test
    fun `logout revokes both access and refresh tokens when refresh token is present`() {
        val jwt =
            Jwt
                .withTokenValue("token")
                .header("alg", "none")
                .subject("Kasper")
                .build()

        service.logout(jwt, "refresh-token")

        verify(tokenService).revokeAccessToken(jwt)
        verify(tokenService).revokeRefreshToken("refresh-token")
    }

    private fun member(
        name: String,
        email: String,
        id: Long = 1,
        collectiveCode: String = "ABC123",
    ) = Member(
        id = id,
        name = name,
        email = email,
        collectiveCode = collectiveCode,
    )
}
