package com.kollekt.service

import com.kollekt.api.dto.CreateExpenseRequest
import com.kollekt.api.dto.CreatePantEntryRequest
import com.kollekt.domain.Expense
import com.kollekt.domain.Member
import com.kollekt.domain.PantEntry
import com.kollekt.domain.SettlementCheckpoint
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.ExpenseRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.PantEntryRepository
import com.kollekt.repository.SettlementCheckpointRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
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
    private lateinit var pantEntryRepository: PantEntryRepository
    private lateinit var eventPublisher: IntegrationEventPublisher
    private lateinit var realtimeUpdateService: RealtimeUpdateService
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
        pantEntryRepository = mock()
        eventPublisher = mock()
        realtimeUpdateService = mock()
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
                pantEntryRepository = pantEntryRepository,
                eventPublisher = eventPublisher,
                realtimeUpdateService = realtimeUpdateService,
                notificationService = mock(),
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
    fun `settle up stores checkpoint and emits balance settled event`() {
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
        verify(eventPublisher).economyEvent(eq("BALANCES_SETTLED"), any<Map<String, Any>>())
        verify(realtimeUpdateService).publish(eq("ABC123"), eq("BALANCES_SETTLED"), any<Map<String, Any>>())
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
