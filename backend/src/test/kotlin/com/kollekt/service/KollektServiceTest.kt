package com.kollekt.service

import com.kollekt.api.dto.CreateExpenseRequest
import com.kollekt.api.dto.CreateTaskRequest
import com.kollekt.api.dto.DashboardResponse
import com.kollekt.api.dto.LeaderboardResponse
import com.kollekt.api.dto.SettleUpRequest
import com.kollekt.api.dto.WeeklyStatsDto
import com.kollekt.domain.CalendarEvent
import com.kollekt.domain.EventType
import com.kollekt.domain.Expense
import com.kollekt.domain.Member
import com.kollekt.domain.SettlementCheckpoint
import com.kollekt.domain.TaskCategory
import com.kollekt.domain.TaskItem
import com.kollekt.repository.AchievementRepository
import com.kollekt.repository.ChatMessageRepository
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.EventRepository
import com.kollekt.repository.ExpenseRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.PantEntryRepository
import com.kollekt.repository.SettlementCheckpointRepository
import com.kollekt.repository.ShoppingItemRepository
import com.kollekt.repository.TaskRepository
import java.time.LocalDate
import java.time.LocalTime
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertSame
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito.lenient
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.ValueOperations

@ExtendWith(MockitoExtension::class)
class KollektServiceTest {
    @Mock lateinit var memberRepository: MemberRepository
    @Mock lateinit var collectiveRepository: CollectiveRepository
    @Mock lateinit var taskRepository: TaskRepository
    @Mock lateinit var shoppingItemRepository: ShoppingItemRepository
    @Mock lateinit var eventRepository: EventRepository
    @Mock lateinit var chatMessageRepository: ChatMessageRepository
    @Mock lateinit var expenseRepository: ExpenseRepository
    @Mock lateinit var settlementCheckpointRepository: SettlementCheckpointRepository
    @Mock lateinit var pantEntryRepository: PantEntryRepository
    @Mock lateinit var achievementRepository: AchievementRepository
    @Mock lateinit var redisTemplate: RedisTemplate<String, Any>
    @Mock lateinit var eventPublisher: IntegrationEventPublisher
    @Mock lateinit var realtimeUpdateService: RealtimeUpdateService

    private lateinit var valueOps: ValueOperations<String, Any>
    private lateinit var service: KollektService

    @BeforeEach
    fun setUp() {
        valueOps = mock()
        lenient().`when`(redisTemplate.opsForValue()).thenReturn(valueOps)
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
            )
    }

    @Test
    fun `getTasks sorts by dueDate within collective`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper"))
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                TaskItem(id = 1, title = "A", assignee = "Kasper", collectiveCode = "ABC123", dueDate = LocalDate.parse("2026-03-10"), category = TaskCategory.OTHER),
                TaskItem(id = 2, title = "B", assignee = "Kasper", collectiveCode = "ABC123", dueDate = LocalDate.parse("2026-03-01"), category = TaskCategory.OTHER),
            ),
        )

        val result = service.getTasks("Kasper")

        assertEquals(listOf(2L, 1L), result.map { it.id })
    }

    @Test
    fun `createTask resolves collective from assignee`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper"))
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("leaderboard:*")

        val taskCaptor = argumentCaptor<TaskItem>()
        whenever(taskRepository.save(taskCaptor.capture())).thenAnswer { taskCaptor.firstValue.copy(id = 10) }

        service.createTask(
            CreateTaskRequest(
                title = "Vask",
                assignee = "Kasper",
                dueDate = LocalDate.parse("2026-03-05"),
                category = TaskCategory.CLEANING,
            ),
        )

        assertEquals("ABC123", taskCaptor.firstValue.collectiveCode)
        verify(eventPublisher).taskEvent(eq("TASK_CREATED"), any())
    }

    @Test
    fun `toggleTask enforces collective scope`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper"))
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(99, "ABC123")).thenReturn(null)

        assertThrows<IllegalArgumentException> { service.toggleTask(99, "Kasper") }
    }

    @Test
    fun `toggleTask awards XP only once to completing user`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", xp = 100, level = 1))
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(11, "ABC123")).thenReturn(
            TaskItem(
                id = 11,
                title = "Task",
                assignee = "Emma",
                collectiveCode = "ABC123",
                dueDate = LocalDate.parse("2026-03-01"),
                category = TaskCategory.OTHER,
                completed = false,
                xp = 25,
            ),
        )
        whenever(memberRepository.findByNameAndCollectiveCodeForUpdate("Kasper", "ABC123")).thenReturn(member("Kasper", xp = 100, level = 1))
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("leaderboard:*")

        val result = service.toggleTask(11, "Kasper", true)

        assertTrue(result.completed)
        val memberCaptor = argumentCaptor<Member>()
        verify(memberRepository).save(memberCaptor.capture())
        assertEquals(125, memberCaptor.firstValue.xp)
    }

    @Test
    fun `toggleTask with completed true is idempotent after XP awarded`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", xp = 125, level = 1))
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(11, "ABC123")).thenReturn(
            TaskItem(
                id = 11,
                title = "Task",
                assignee = "Emma",
                collectiveCode = "ABC123",
                dueDate = LocalDate.parse("2026-03-01"),
                category = TaskCategory.OTHER,
                completed = true,
                xpAwarded = true,
                xp = 25,
            ),
        )

        val result = service.toggleTask(11, "Kasper", true)

        assertTrue(result.completed)
        verify(memberRepository, never()).findByNameAndCollectiveCodeForUpdate(any(), any())
    }

    @Test
    fun `createExpense defaults participants to all collective members`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper"))
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("Kasper"), member("Emma", id = 2)),
        )
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("leaderboard:*")

        val expenseCaptor = argumentCaptor<Expense>()
        whenever(expenseRepository.save(expenseCaptor.capture())).thenAnswer { expenseCaptor.firstValue.copy(id = 1) }

        val result = service.createExpense(
            CreateExpenseRequest(
                description = "Pizza",
                amount = 200,
                paidBy = "Kasper",
                category = "Mat",
                date = LocalDate.parse("2026-03-01"),
                participantNames = emptyList(),
            ),
        )

        assertEquals(setOf("Kasper", "Emma"), expenseCaptor.firstValue.participantNames)
        assertEquals(listOf("Emma", "Kasper"), result.participantNames)
    }

    @Test
    fun `createExpense rejects participants outside collective`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper"))
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("Kasper"), member("Emma", id = 2)),
        )

        assertThrows<IllegalArgumentException> {
            service.createExpense(
                CreateExpenseRequest(
                    description = "Taxi",
                    amount = 300,
                    paidBy = "Kasper",
                    category = "Transport",
                    date = LocalDate.parse("2026-03-01"),
                    participantNames = listOf("Kasper", "Ola"),
                ),
            )
        }
    }

    @Test
    fun `getBalances uses explicit expense participants`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper"))
        whenever(settlementCheckpointRepository.findTopByCollectiveCodeOrderByIdDesc("ABC123")).thenReturn(null)
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("A", id = 1), member("B", id = 2), member("C", id = 3)),
        )
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                Expense(
                    id = 1,
                    description = "Test",
                    amount = 100,
                    paidBy = "A",
                    collectiveCode = "ABC123",
                    category = "Any",
                    date = LocalDate.parse("2026-03-01"),
                    participantNames = setOf("A", "B"),
                ),
            ),
        )

        val result = service.getBalances("Kasper")
        val map = result.associateBy { it.name }

        assertEquals(50, map.getValue("A").amount)
        assertEquals(-50, map.getValue("B").amount)
        assertEquals(0, map.getValue("C").amount)
    }

    @Test
    fun `getExpenses maps and sorts participant names`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper"))
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                Expense(
                    id = 1,
                    description = "Old",
                    amount = 10,
                    paidBy = "Kasper",
                    collectiveCode = "ABC123",
                    category = "Any",
                    date = LocalDate.parse("2026-03-01"),
                    participantNames = setOf("Kasper", "Emma"),
                ),
                Expense(
                    id = 2,
                    description = "New",
                    amount = 20,
                    paidBy = "Emma",
                    collectiveCode = "ABC123",
                    category = "Any",
                    date = LocalDate.parse("2026-03-02"),
                    participantNames = setOf("Emma", "Kasper"),
                ),
            ),
        )

        val result = service.getExpenses("Kasper")

        assertEquals(listOf(2L, 1L), result.map { it.id })
        assertEquals(listOf("Emma", "Kasper"), result.first().participantNames)
    }

    @Test
    fun `getBalances ignores expenses before latest settle up checkpoint`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper"))
        whenever(settlementCheckpointRepository.findTopByCollectiveCodeOrderByIdDesc("ABC123")).thenReturn(
            SettlementCheckpoint(id = 10, collectiveCode = "ABC123", settledBy = "Kasper", lastExpenseId = 2),
        )
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("A", id = 1), member("B", id = 2)),
        )
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                Expense(
                    id = 1,
                    description = "Before",
                    amount = 100,
                    paidBy = "A",
                    collectiveCode = "ABC123",
                    category = "Any",
                    date = LocalDate.parse("2026-03-01"),
                    participantNames = setOf("A", "B"),
                ),
                Expense(
                    id = 3,
                    description = "After",
                    amount = 60,
                    paidBy = "B",
                    collectiveCode = "ABC123",
                    category = "Any",
                    date = LocalDate.parse("2026-03-02"),
                    participantNames = setOf("A", "B"),
                ),
            ),
        )

        val result = service.getBalances("Kasper")
        val map = result.associateBy { it.name }

        assertEquals(-30, map.getValue("A").amount)
        assertEquals(30, map.getValue("B").amount)
    }

    @Test
    fun `settle up creates checkpoint at latest expense id`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper"))
        whenever(expenseRepository.findTopByCollectiveCodeOrderByIdDesc("ABC123")).thenReturn(
            Expense(
                id = 7,
                description = "Latest",
                amount = 1,
                paidBy = "Kasper",
                collectiveCode = "ABC123",
                category = "Any",
                date = LocalDate.parse("2026-03-01"),
                participantNames = setOf("Kasper"),
            ),
        )

        val checkpointCaptor = argumentCaptor<SettlementCheckpoint>()
        whenever(settlementCheckpointRepository.save(checkpointCaptor.capture())).thenAnswer { checkpointCaptor.firstValue.copy(id = 5) }

        val result = service.settleUp(SettleUpRequest(memberName = "Kasper"))

        assertEquals("ABC123", checkpointCaptor.firstValue.collectiveCode)
        assertEquals("Kasper", checkpointCaptor.firstValue.settledBy)
        assertEquals(7, checkpointCaptor.firstValue.lastExpenseId)
        assertEquals(7, result.lastExpenseId)
        verify(eventPublisher).economyEvent(eq("BALANCES_SETTLED"), any())
    }

    @Test
    fun `getLeaderboard returns collective scoped cached value`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper"))
        val cached =
            LeaderboardResponse(
                players = emptyList(),
                weeklyStats = WeeklyStatsDto(totalTasks = 0, totalXp = 0, avgPerPerson = 0, topContributor = "N/A"),
            )
        whenever(valueOps.get("leaderboard:ABC123")).thenReturn(cached)

        val result = service.getLeaderboard("Kasper")

        assertSame(cached, result)
        verify(taskRepository, never()).findAllByCollectiveCode(any())
        verify(memberRepository, never()).findAllByCollectiveCode(any())
    }

    @Test
    fun `getDashboard returns cached value`() {
        val cached =
            DashboardResponse(
                currentUserName = "Kasper",
                currentUserXp = 1,
                currentUserLevel = 1,
                currentUserRank = 1,
                upcomingTasks = emptyList(),
                upcomingEvents = emptyList(),
                recentExpenses = emptyList(),
            )
        whenever(valueOps.get("dashboard:Kasper")).thenReturn(cached)

        val result = service.getDashboard("Kasper")

        assertSame(cached, result)
        verifyNoInteractions(memberRepository, taskRepository, eventRepository, expenseRepository)
    }

    @Test
    fun `getDashboard aggregates collective scoped data`() {
        whenever(valueOps.get(any())).thenReturn(null)
        val now = LocalDate.now()

        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", xp = 10, level = 2))
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("Kasper", xp = 10, level = 2), member("Emma", id = 2, xp = 20, level = 3)),
        )
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                TaskItem(id = 1, title = "Done", assignee = "Kasper", collectiveCode = "ABC123", dueDate = now.plusDays(1), category = TaskCategory.OTHER, completed = true),
                TaskItem(id = 2, title = "Todo", assignee = "Kasper", collectiveCode = "ABC123", dueDate = now.plusDays(2), category = TaskCategory.OTHER, completed = false),
            ),
        )
        whenever(eventRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                CalendarEvent(id = 1, title = "Past", collectiveCode = "ABC123", date = now.minusDays(1), time = LocalTime.NOON, type = EventType.OTHER, organizer = "Kasper", attendees = 1),
                CalendarEvent(id = 2, title = "Next", collectiveCode = "ABC123", date = now.plusDays(1), time = LocalTime.NOON, type = EventType.OTHER, organizer = "Kasper", attendees = 1),
            ),
        )
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                Expense(
                    id = 1,
                    description = "E",
                    amount = 1,
                    paidBy = "Kasper",
                    collectiveCode = "ABC123",
                    category = "Any",
                    date = now,
                    participantNames = setOf("Kasper", "Emma"),
                ),
            ),
        )

        val result = service.getDashboard("Kasper")

        assertEquals("Kasper", result.currentUserName)
        assertEquals(listOf(2L), result.upcomingTasks.map { it.id })
        assertEquals(listOf(2L), result.upcomingEvents.map { it.id })
        assertEquals(listOf(1L), result.recentExpenses.map { it.id })
    }

    @Test
    fun `getDrinkingQuestion uses scoped leaderboard`() {
        whenever(valueOps.get(any())).thenReturn(null)
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper"))
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("Top", xp = 10), member("Bottom", id = 2, xp = 0)),
        )
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(emptyList())

        val result = service.getDrinkingQuestion("Kasper")

        val texts = listOf("Top", "Bottom", "søppel", "handle", "Rock, paper, scissors")
        assertTrue(texts.any { result.text.contains(it) })
    }

    private fun member(
        name: String,
        id: Long = 1,
        collectiveCode: String = "ABC123",
        level: Int = 1,
        xp: Int = 0,
    ) = Member(id = id, name = name, collectiveCode = collectiveCode, level = level, xp = xp)
}
