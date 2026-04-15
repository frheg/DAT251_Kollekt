package com.kollekt.service

import com.kollekt.api.dto.CreateExpenseRequest
import com.kollekt.api.dto.CreatePantEntryRequest
import com.kollekt.api.dto.UpdateExpenseRequest
import com.kollekt.api.dto.UpdatePantEntryRequest
import com.kollekt.domain.Collective
import com.kollekt.domain.Expense
import com.kollekt.domain.Member
import com.kollekt.domain.PantEntry
import com.kollekt.domain.PersonalSettlement
import com.kollekt.domain.SettlementCheckpoint
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.ExpenseRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.PantEntryRepository
import com.kollekt.repository.PersonalSettlementRepository
import com.kollekt.repository.SettlementCheckpointRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.redis.core.RedisTemplate
import java.time.LocalDate
import java.time.LocalDateTime

class EconomyOperationsTest {
    private lateinit var memberRepository: MemberRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var expenseRepository: ExpenseRepository
    private lateinit var settlementCheckpointRepository: SettlementCheckpointRepository
    private lateinit var personalSettlementRepository: PersonalSettlementRepository
    private lateinit var pantEntryRepository: PantEntryRepository
    private lateinit var eventPublisher: IntegrationEventPublisher
    private lateinit var realtimeUpdateService: RealtimeUpdateService
    private lateinit var notificationService: NotificationService
    private lateinit var redisTemplate: RedisTemplate<String, Any>
    private lateinit var collectiveAccessService: CollectiveAccessService
    private lateinit var statsCacheService: StatsCacheService
    private lateinit var operations: EconomyOperations

    @BeforeEach
    fun setUp() {
        memberRepository = mock()
        collectiveRepository = mock()
        expenseRepository = mock()
        settlementCheckpointRepository = mock()
        personalSettlementRepository = mock()
        pantEntryRepository = mock()
        eventPublisher = mock()
        realtimeUpdateService = mock()
        notificationService = mock()
        redisTemplate = mock()
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("leaderboard:*")
        collectiveAccessService = CollectiveAccessService(memberRepository, collectiveRepository)
        statsCacheService = StatsCacheService(redisTemplate)
        operations =
            EconomyOperations(
                memberRepository = memberRepository,
                expenseRepository = expenseRepository,
                settlementCheckpointRepository = settlementCheckpointRepository,
                personalSettlementRepository = personalSettlementRepository,
                pantEntryRepository = pantEntryRepository,
                collectiveRepository = collectiveRepository,
                eventPublisher = eventPublisher,
                realtimeUpdateService = realtimeUpdateService,
                notificationService = notificationService,
                collectiveAccessService = collectiveAccessService,
                statsCacheService = statsCacheService,
            )
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
    }

    @Test
    fun `create expense rejects participants outside collective`() {
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Kasper", "kasper@example.com"),
                member("Emma", "emma@example.com", id = 2),
            ),
        )

        assertThrows<IllegalArgumentException> {
            operations.createExpense(
                CreateExpenseRequest(
                    description = "Pizza",
                    amount = 200,
                    paidBy = "Ignored",
                    category = "Food",
                    date = LocalDate.parse("2026-03-01"),
                    participantNames = listOf("Kasper", "Ola"),
                ),
                "Kasper",
            )
        }
    }

    @Test
    fun `get pay options returns empty list when no expenses`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(emptyList())

        val result = operations.getPayOptions("Kasper")

        assertTrue(result.isEmpty())
    }

    @Test
    fun `notify upcoming expense deadlines sends notification to debtors`() {
        val tomorrow = LocalDate.now().plusDays(1)
        val expense =
            Expense(
                id = 1,
                description = "Rent",
                amount = 1000,
                paidBy = "Kasper",
                collectiveCode = "ABC123",
                category = "Housing",
                date = LocalDate.now(),
                deadlineDate = tomorrow,
                participantNames = setOf("Kasper", "Emma"),
            )
        whenever(expenseRepository.findAllByDeadlineDate(tomorrow)).thenReturn(listOf(expense))

        operations.notifyUpcomingExpenseDeadlines()

        verify(notificationService).createParameterizedNotification(
            eq("Emma"),
            eq("EXPENSE_DEADLINE_SOON"),
            any(),
        )
    }

    @Test
    fun `notify expired expense deadlines sends notification to debtors`() {
        val today = LocalDate.now()
        val expense =
            Expense(
                id = 2,
                description = "Utilities",
                amount = 500,
                paidBy = "Kasper",
                collectiveCode = "ABC123",
                category = "Bills",
                date = LocalDate.now(),
                deadlineDate = today,
                participantNames = setOf("Kasper", "Emma"),
            )
        whenever(expenseRepository.findAllByDeadlineDate(today)).thenReturn(listOf(expense))

        operations.notifyExpiredExpenseDeadlines()

        verify(notificationService).createParameterizedNotification(
            eq("Emma"),
            eq("EXPENSE_OVERDUE"),
            any(),
        )
    }

    @Test
    fun `get balances returns empty when there are no unsettled expenses`() {
        whenever(settlementCheckpointRepository.findTopByCollectiveCodeOrderByIdDesc("ABC123")).thenReturn(null)
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(emptyList())

        val result = operations.getBalances("Kasper")

        assertTrue(result.isEmpty())
        verify(memberRepository, never()).findAllByCollectiveCode("ABC123")
    }

    @Test
    fun `add pant entry uses actor name and publishes event`() {
        whenever(pantEntryRepository.save(any<PantEntry>())).thenAnswer {
            (it.arguments[0] as PantEntry).copy(id = 5)
        }

        val result =
            operations.addPantEntry(
                CreatePantEntryRequest(
                    bottles = 18,
                    amount = 54,
                    addedBy = "Ignored",
                    date = LocalDate.parse("2026-03-10"),
                ),
                "Kasper",
            )

        assertEquals("Kasper", result.addedBy)
        verify(eventPublisher).economyEvent("PANT_ADDED", result)
        verify(realtimeUpdateService).publish("ABC123", "PANT_ADDED", result)
    }

    @Test
    fun `settle up stores checkpoint, clears personal settlements and emits event`() {
        whenever(expenseRepository.findTopByCollectiveCodeOrderByIdDesc("ABC123")).thenReturn(
            Expense(
                id = 9,
                description = "Pizza",
                amount = 200,
                paidBy = "Kasper",
                collectiveCode = "ABC123",
                category = "Food",
                date = LocalDate.parse("2026-03-01"),
                participantNames = setOf("Kasper", "Emma"),
            ),
        )
        whenever(settlementCheckpointRepository.save(any<SettlementCheckpoint>())).thenAnswer {
            (it.arguments[0] as SettlementCheckpoint).copy(createdAt = LocalDateTime.parse("2026-03-10T12:00:00"))
        }

        val result = operations.settleUp("Kasper")

        assertEquals(9L, result.lastExpenseId)
        verify(personalSettlementRepository).deleteAllByCollectiveCodeAndPaidBy("ABC123", "Kasper")
        verify(eventPublisher).economyEvent(eq("BALANCES_SETTLED"), any<Map<String, Any>>())
        verify(realtimeUpdateService).publish(eq("ABC123"), eq("BALANCES_SETTLED"), any<Map<String, Any>>())
    }

    @Test
    fun `settleWith records personal settlement for bilateral debt`() {
        whenever(memberRepository.findByName("Emma")).thenReturn(member("Emma", "emma@example.com", id = 2))
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("Kasper", "kasper@example.com"), member("Emma", "emma@example.com", id = 2)),
        )
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                Expense(
                    id = 1,
                    description = "Groceries",
                    amount = 200,
                    paidBy = "Kasper",
                    collectiveCode = "ABC123",
                    category = "Food",
                    date = LocalDate.parse("2026-03-01"),
                    participantNames = setOf("Kasper", "Emma"),
                ),
            ),
        )
        whenever(settlementCheckpointRepository.findTopByCollectiveCodeAndSettledByOrderByIdDesc("ABC123", "Emma"))
            .thenReturn(null)
        whenever(settlementCheckpointRepository.findTopByCollectiveCodeAndSettledByOrderByIdDesc("ABC123", "Kasper"))
            .thenReturn(null)
        whenever(personalSettlementRepository.findAllByCollectiveCodeAndPaidByAndPaidTo("ABC123", "Emma", "Kasper"))
            .thenReturn(emptyList())
        whenever(personalSettlementRepository.findAllByCollectiveCodeAndPaidByAndPaidTo("ABC123", "Kasper", "Emma"))
            .thenReturn(emptyList())
        whenever(personalSettlementRepository.save(any<PersonalSettlement>())).thenAnswer { it.arguments[0] }

        operations.settleWith("Emma", "Kasper")

        val captor = argumentCaptor<PersonalSettlement>()
        verify(personalSettlementRepository).save(captor.capture())
        assertEquals("Emma", captor.firstValue.paidBy)
        assertEquals("Kasper", captor.firstValue.paidTo)
        assertEquals(100, captor.firstValue.amount)
        verify(realtimeUpdateService).publish(eq("ABC123"), eq("BALANCES_SETTLED"), any<Map<String, Any>>())
    }

    @Test
    fun `settleWith accounts for cross-direction expenses when computing bilateral debt`() {
        whenever(memberRepository.findByName("Emma")).thenReturn(member("Emma", "emma@example.com", id = 2))
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("Kasper", "kasper@example.com"), member("Emma", "emma@example.com", id = 2)),
        )
        // Kasper paid 200 split with Emma → Emma owes Kasper 100
        // Emma paid 100 split with Kasper → Kasper owes Emma 50
        // Net: Emma owes Kasper 50
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                Expense(
                    id = 1,
                    description = "Dinner",
                    amount = 200,
                    paidBy = "Kasper",
                    collectiveCode = "ABC123",
                    category = "Food",
                    date = LocalDate.parse("2026-03-01"),
                    participantNames = setOf("Kasper", "Emma"),
                ),
                Expense(
                    id = 2,
                    description = "Coffee",
                    amount = 100,
                    paidBy = "Emma",
                    collectiveCode = "ABC123",
                    category = "Food",
                    date = LocalDate.parse("2026-03-02"),
                    participantNames = setOf("Kasper", "Emma"),
                ),
            ),
        )
        whenever(settlementCheckpointRepository.findTopByCollectiveCodeAndSettledByOrderByIdDesc(any(), any()))
            .thenReturn(null)
        whenever(personalSettlementRepository.findAllByCollectiveCodeAndPaidByAndPaidTo(any(), any(), any()))
            .thenReturn(emptyList())
        whenever(personalSettlementRepository.save(any<PersonalSettlement>())).thenAnswer { it.arguments[0] }

        operations.settleWith("Emma", "Kasper")

        val captor = argumentCaptor<PersonalSettlement>()
        verify(personalSettlementRepository).save(captor.capture())
        assertEquals(50, captor.firstValue.amount)
    }

    @Test
    fun `settleWith does nothing when debtor owes nothing to creditor`() {
        whenever(memberRepository.findByName("Emma")).thenReturn(member("Emma", "emma@example.com", id = 2))
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("Kasper", "kasper@example.com"), member("Emma", "emma@example.com", id = 2)),
        )
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(emptyList())
        whenever(settlementCheckpointRepository.findTopByCollectiveCodeAndSettledByOrderByIdDesc(any(), any()))
            .thenReturn(null)
        whenever(personalSettlementRepository.findAllByCollectiveCodeAndPaidByAndPaidTo(any(), any(), any()))
            .thenReturn(emptyList())

        operations.settleWith("Emma", "Kasper")

        verify(personalSettlementRepository, never()).save(any<PersonalSettlement>())
        verify(realtimeUpdateService, never()).publish(any(), any(), any())
    }

    @Test
    fun `getBalances applies personal settlement offsets`() {
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("Kasper", "kasper@example.com"), member("Emma", "emma@example.com", id = 2)),
        )
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                Expense(
                    id = 1,
                    description = "Groceries",
                    amount = 200,
                    paidBy = "Kasper",
                    collectiveCode = "ABC123",
                    category = "Food",
                    date = LocalDate.parse("2026-03-01"),
                    participantNames = setOf("Kasper", "Emma"),
                ),
            ),
        )
        whenever(settlementCheckpointRepository.findTopByCollectiveCodeAndSettledByOrderByIdDesc(any(), any()))
            .thenReturn(null)
        whenever(personalSettlementRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(PersonalSettlement(id = 1, collectiveCode = "ABC123", paidBy = "Emma", paidTo = "Kasper", amount = 100)),
        )

        val result = operations.getBalances("Kasper")

        val kasper = result.find { it.name == "Kasper" }!!
        val emma = result.find { it.name == "Emma" }!!
        assertEquals(0, kasper.amount)
        assertEquals(0, emma.amount)
    }

    @Test
    fun `delete expense removes it and publishes event`() {
        val expense =
            Expense(
                id = 1,
                description = "Pizza",
                amount = 200,
                paidBy = "Kasper",
                collectiveCode = "ABC123",
                category = "Food",
                date = LocalDate.parse("2026-03-01"),
                participantNames = setOf("Kasper"),
            )
        whenever(expenseRepository.findById(1L)).thenReturn(java.util.Optional.of(expense))

        operations.deleteExpense(1L, "Kasper")

        verify(expenseRepository).delete(expense)
        verify(realtimeUpdateService).publish("ABC123", "EXPENSE_DELETED", mapOf("id" to 1L))
    }

    @Test
    fun `update expense saves changes and publishes event`() {
        val expense =
            Expense(
                id = 1,
                description = "Pizza",
                amount = 200,
                paidBy = "Kasper",
                collectiveCode = "ABC123",
                category = "Food",
                date = LocalDate.parse("2026-03-01"),
                participantNames = setOf("Kasper"),
            )
        whenever(expenseRepository.findById(1L)).thenReturn(java.util.Optional.of(expense))
        whenever(expenseRepository.save(any<Expense>())).thenAnswer { it.arguments[0] }

        val result = operations.updateExpense(1L, UpdateExpenseRequest("Sushi", 300, "Food"), "Kasper")

        assertEquals("Sushi", result.description)
        assertEquals(300, result.amount)
        verify(realtimeUpdateService).publish(eq("ABC123"), eq("EXPENSE_UPDATED"), any())
    }

    @Test
    fun `update pant goal persists new goal on collective`() {
        val collective = Collective(id = 1, name = "TestCo", joinCode = "ABC123", ownerMemberId = 1, pantGoal = 500)
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(collective)
        whenever(collectiveRepository.save(any<Collective>())).thenAnswer { it.arguments[0] }

        operations.updatePantGoal("Kasper", 1000)

        verify(collectiveRepository).save(collective.copy(pantGoal = 1000))
    }

    @Test
    fun `delete pant entry removes it and publishes event`() {
        val entry =
            com.kollekt.domain.PantEntry(
                id = 3,
                bottles = 10,
                amount = 30,
                addedBy = "Kasper",
                collectiveCode = "ABC123",
                date = LocalDate.parse("2026-03-01"),
            )
        whenever(pantEntryRepository.findById(3L)).thenReturn(java.util.Optional.of(entry))

        operations.deletePantEntry(3L, "Kasper")

        verify(pantEntryRepository).delete(entry)
        verify(realtimeUpdateService).publish("ABC123", "PANT_DELETED", mapOf("id" to 3L))
    }

    @Test
    fun `update pant entry saves changes and publishes event`() {
        val entry =
            com.kollekt.domain.PantEntry(
                id = 3,
                bottles = 10,
                amount = 30,
                addedBy = "Kasper",
                collectiveCode = "ABC123",
                date = LocalDate.parse("2026-03-01"),
            )
        whenever(pantEntryRepository.findById(3L)).thenReturn(java.util.Optional.of(entry))
        whenever(pantEntryRepository.save(any<PantEntry>())).thenAnswer { it.arguments[0] }

        val result = operations.updatePantEntry(3L, UpdatePantEntryRequest(bottles = 20, amount = 60), "Kasper")

        assertEquals(20, result.bottles)
        assertEquals(60, result.amount)
        verify(realtimeUpdateService).publish(eq("ABC123"), eq("PANT_UPDATED"), any())
    }

    @Test
    fun `get expenses returns sorted list by date and id`() {
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                Expense(
                    id = 1,
                    description = "Pizza",
                    amount = 200,
                    paidBy = "Kasper",
                    collectiveCode = "ABC123",
                    category = "Food",
                    date = LocalDate.parse("2026-03-01"),
                    participantNames = setOf("Kasper", "Emma"),
                ),
                Expense(
                    id = 2,
                    description = "Coffee",
                    amount = 50,
                    paidBy = "Emma",
                    collectiveCode = "ABC123",
                    category = "Drinks",
                    date = LocalDate.parse("2026-03-02"),
                    participantNames = setOf("Kasper", "Emma"),
                ),
            ),
        )

        val result = operations.getExpenses("Kasper")

        assertEquals(2, result.size)
        assertEquals("Coffee", result[0].description)
        assertEquals("Pizza", result[1].description)
    }

    @Test
    fun `get pant summary returns entries and goal`() {
        val collective = Collective(id = 1, name = "TestCo", joinCode = "ABC123", ownerMemberId = 1, pantGoal = 2000)
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(collective)
        whenever(pantEntryRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                PantEntry(
                    id = 1,
                    bottles = 12,
                    amount = 36,
                    addedBy = "Kasper",
                    collectiveCode = "ABC123",
                    date = LocalDate.parse("2026-03-01"),
                ),
                PantEntry(
                    id = 2,
                    bottles = 18,
                    amount = 54,
                    addedBy = "Emma",
                    collectiveCode = "ABC123",
                    date = LocalDate.parse("2026-03-02"),
                ),
            ),
        )

        val result = operations.getPantSummary("Kasper")

        assertEquals(2000, result.goalAmount)
        assertEquals(90, result.currentAmount)
        assertEquals(2, result.entries.size)
    }

    @Test
    fun `get economy summary aggregates expenses balances and pant`() {
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                Expense(
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
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("Kasper", "kasper@example.com"), member("Emma", "emma@example.com", id = 2)),
        )
        whenever(settlementCheckpointRepository.findTopByCollectiveCodeOrderByIdDesc("ABC123")).thenReturn(null)
        whenever(settlementCheckpointRepository.findTopByCollectiveCodeAndSettledByOrderByIdDesc(any(), any())).thenReturn(null)
        whenever(personalSettlementRepository.findAllByCollectiveCode("ABC123")).thenReturn(emptyList())
        val collective = Collective(id = 1, name = "TestCo", joinCode = "ABC123", ownerMemberId = 1, pantGoal = 1000)
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(collective)
        whenever(pantEntryRepository.findAllByCollectiveCode("ABC123")).thenReturn(emptyList())

        val result = operations.getEconomySummary("Kasper")

        assertEquals(1, result.expenses.size)
        assertEquals(2, result.balances.size)
        assertEquals(1000, result.pantSummary.goalAmount)
    }

    @Test
    fun `create expense success path persists with all members when no participants specified`() {
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Kasper", "kasper@example.com"),
                member("Emma", "emma@example.com", id = 2),
            ),
        )
        whenever(expenseRepository.save(any<Expense>())).thenAnswer {
            (it.arguments[0] as Expense).copy(id = 10)
        }

        val result =
            operations.createExpense(
                CreateExpenseRequest(
                    description = "Pizza",
                    amount = 200,
                    paidBy = "Ignored",
                    category = "Food",
                    date = LocalDate.parse("2026-03-01"),
                    participantNames = emptyList(),
                ),
                "Kasper",
            )

        assertEquals("Pizza", result.description)
        assertEquals(200, result.amount)
        verify(eventPublisher).economyEvent("EXPENSE_CREATED", result)
        verify(realtimeUpdateService).publish("ABC123", "EXPENSE_CREATED", result)
        verify(notificationService, times(1)).createParameterizedNotification(eq("Emma"), any(), any())
    }

    @Test
    fun `get pay options with actual bilateral debt calculation`() {
        whenever(memberRepository.findByName("Emma")).thenReturn(member("Emma", "emma@example.com", id = 2))
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("Kasper", "kasper@example.com"), member("Emma", "emma@example.com", id = 2)),
        )
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                Expense(
                    id = 1,
                    description = "Dinner",
                    amount = 200,
                    paidBy = "Kasper",
                    collectiveCode = "ABC123",
                    category = "Food",
                    date = LocalDate.parse("2026-03-01"),
                    participantNames = setOf("Kasper", "Emma"),
                ),
            ),
        )
        whenever(settlementCheckpointRepository.findTopByCollectiveCodeAndSettledByOrderByIdDesc(any(), any())).thenReturn(null)
        whenever(personalSettlementRepository.findAllByCollectiveCode("ABC123")).thenReturn(emptyList())

        val result = operations.getPayOptions("Emma")

        assertEquals(1, result.size)
        assertEquals("Kasper", result[0].name)
        assertEquals(100, result[0].amount)
    }

    @Test
    fun `delete expense fails when actor is not payer`() {
        val expense =
            Expense(
                id = 1,
                description = "Pizza",
                amount = 200,
                paidBy = "Kasper",
                collectiveCode = "ABC123",
                category = "Food",
                date = LocalDate.parse("2026-03-01"),
                participantNames = setOf("Kasper", "Emma"),
            )
        whenever(expenseRepository.findById(1L)).thenReturn(java.util.Optional.of(expense))

        assertThrows<IllegalArgumentException> {
            operations.deleteExpense(1L, "Emma")
        }

        verify(expenseRepository, never()).delete(any())
    }

    @Test
    fun `update expense fails when actor is not payer`() {
        val expense =
            Expense(
                id = 1,
                description = "Pizza",
                amount = 200,
                paidBy = "Kasper",
                collectiveCode = "ABC123",
                category = "Food",
                date = LocalDate.parse("2026-03-01"),
                participantNames = setOf("Kasper", "Emma"),
            )
        whenever(expenseRepository.findById(1L)).thenReturn(java.util.Optional.of(expense))

        assertThrows<IllegalArgumentException> {
            operations.updateExpense(1L, UpdateExpenseRequest("Sushi", 300, "Food"), "Emma")
        }

        verify(expenseRepository, never()).save(any())
    }

    @Test
    fun `delete pant entry fails when actor did not add it`() {
        val entry =
            com.kollekt.domain.PantEntry(
                id = 3,
                bottles = 10,
                amount = 30,
                addedBy = "Kasper",
                collectiveCode = "ABC123",
                date = LocalDate.parse("2026-03-01"),
            )
        whenever(pantEntryRepository.findById(3L)).thenReturn(java.util.Optional.of(entry))

        assertThrows<IllegalArgumentException> {
            operations.deletePantEntry(3L, "Emma")
        }

        verify(pantEntryRepository, never()).delete(any())
    }

    @Test
    fun `update pant entry fails when actor did not add it`() {
        val entry =
            com.kollekt.domain.PantEntry(
                id = 3,
                bottles = 10,
                amount = 30,
                addedBy = "Kasper",
                collectiveCode = "ABC123",
                date = LocalDate.parse("2026-03-01"),
            )
        whenever(pantEntryRepository.findById(3L)).thenReturn(java.util.Optional.of(entry))

        assertThrows<IllegalArgumentException> {
            operations.updatePantEntry(3L, UpdatePantEntryRequest(bottles = 20, amount = 60), "Emma")
        }

        verify(pantEntryRepository, never()).save(any())
    }

    private fun member(
        name: String,
        email: String,
        id: Long = 1,
        collectiveCode: String? = "ABC123",
    ) = Member(
        id = id,
        name = name,
        email = email,
        collectiveCode = collectiveCode,
    )
}
