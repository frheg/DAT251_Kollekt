package com.kollekt.service

import com.kollekt.domain.CalendarEvent
import com.kollekt.domain.Collective
import com.kollekt.domain.EventType
import com.kollekt.domain.Expense
import com.kollekt.domain.Member
import com.kollekt.domain.TaskCategory
import com.kollekt.domain.TaskItem
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.EventRepository
import com.kollekt.repository.ExpenseRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.ShoppingItemRepository
import com.kollekt.repository.TaskRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

class StatsServiceTest {
    private lateinit var memberRepository: MemberRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var taskRepository: TaskRepository
    private lateinit var eventRepository: EventRepository
    private lateinit var expenseRepository: ExpenseRepository
    private lateinit var collectiveAccessService: CollectiveAccessService
    private lateinit var realtimeUpdateService: RealtimeUpdateService
    private lateinit var economyOperations: EconomyOperations
    private lateinit var shoppingItemRepository: ShoppingItemRepository
    private lateinit var service: StatsService

    @BeforeEach
    fun setUp() {
        memberRepository = mock()
        collectiveRepository = mock()
        taskRepository = mock()
        eventRepository = mock()
        expenseRepository = mock()
        collectiveAccessService = CollectiveAccessService(memberRepository, collectiveRepository)
        realtimeUpdateService = mock()
        economyOperations = mock()
        shoppingItemRepository = mock()
        service =
            StatsService(
                collectiveAccessService = collectiveAccessService,
                memberRepository = memberRepository,
                collectiveRepository = collectiveRepository,
                taskRepository = taskRepository,
                eventRepository = eventRepository,
                expenseRepository = expenseRepository,
                realtimeUpdateService = realtimeUpdateService,
                economyOperations = economyOperations,
                shoppingItemRepository = shoppingItemRepository,
            )
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com", xp = 250, level = 2))
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(
            Collective(id = 1, name = "Villa", joinCode = "ABC123", ownerMemberId = 1, monthlyPrize = "Pizza"),
        )
    }

    @Test
    fun `get dashboard aggregates collective scoped data`() {
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                task(
                    id = 1,
                    title = "Trash",
                    assignee = "Kasper",
                    completed = true,
                    completedAt = LocalDateTime.now().minusDays(1),
                    xp = 20,
                ),
                task(id = 2, title = "Dishes", assignee = "Emma", dueDate = LocalDate.now().plusDays(1), xp = 15),
                task(id = 3, title = "Floors", assignee = "Kasper", dueDate = LocalDate.now().plusDays(2), xp = 25),
            ),
        )
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Kasper", "kasper@example.com", xp = 250, level = 2),
                member("Emma", "emma@example.com", id = 2, xp = 150, level = 1),
            ),
        )
        whenever(eventRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                CalendarEvent(
                    id = 5,
                    title = "Movie night",
                    collectiveCode = "ABC123",
                    date = LocalDate.now().plusDays(1),
                    time = LocalTime.NOON,
                    type = EventType.MOVIE,
                    organizer = "Kasper",
                    attendees = 4,
                    description = "Snacks",
                ),
            ),
        )
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                Expense(
                    id = 7,
                    description = "Pizza",
                    amount = 200,
                    paidBy = "Kasper",
                    collectiveCode = "ABC123",
                    category = "Food",
                    date = LocalDate.now(),
                    participantNames = setOf("Kasper", "Emma"),
                ),
            ),
        )

        val result = service.getDashboard("Kasper")

        assertEquals("Kasper", result.currentUserName)
        assertEquals(1, result.currentUserRank)
        assertEquals(listOf("Dishes", "Floors"), result.upcomingTasks.map { it.title })
        assertEquals(listOf("Movie night"), result.upcomingEvents.map { it.title })
        assertEquals(listOf("Pizza"), result.recentExpenses.map { it.description })
    }

    @Test
    fun `set monthly prize updates collective`() {
        service.setMonthlyPrize("Kasper", "Movie night")

        verify(collectiveRepository).save(
            org.mockito.kotlin.check {
                assertEquals("Movie night", it.monthlyPrize)
            },
        )
    }

    @Test
    fun `get achievements computes from task data for enabled keys`() {
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                task(
                    id = 1,
                    title = "Trash",
                    assignee = "Kasper",
                    completed = true,
                    completedAt = LocalDateTime.now().minusDays(1),
                    xp = 20,
                ),
                task(id = 2, title = "Dishes", assignee = "Kasper", completed = true, completedAt = LocalDateTime.now(), xp = 15),
            ),
        )

        val result = service.getAchievements("Kasper")

        assertTrue(result.isNotEmpty())
        val firstStep = result.find { it.title == "First Step" }
        assertTrue(firstStep != null && firstStep.unlocked)
    }

    @Test
    fun `get achievements catalog returns all definitions with enabled flags`() {
        val result = service.getAchievementsCatalog("Kasper")

        assertTrue(result.isNotEmpty())
        assertTrue(result.any { it.key == "TASK_1" && it.enabled })
        assertTrue(result.any { it.key == "TASK_5" && !it.enabled })
    }

    @Test
    fun `getMemberStats returns stats for target member`() {
        whenever(memberRepository.findByName("Emma")).thenReturn(member("Emma", "emma@example.com", id = 2, xp = 150, level = 1))
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                task(id = 1, title = "Trash", assignee = "Emma", completed = true, completedAt = LocalDateTime.now().minusDays(1), xp = 20),
                task(id = 2, title = "Dishes", assignee = "Emma", completed = false, dueDate = LocalDate.now().minusDays(1), xp = 10),
                task(
                    id = 3,
                    title = "Floors",
                    assignee = "Kasper",
                    completed = true,
                    completedAt = LocalDateTime.now().minusDays(2),
                    xp = 25,
                ),
            ),
        )
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Kasper", "kasper@example.com", xp = 250, level = 2),
                member("Emma", "emma@example.com", id = 2, xp = 150, level = 1),
            ),
        )

        val result = service.getMemberStats(viewerName = "Kasper", targetName = "Emma")

        assertEquals("Emma", result.name)
        assertEquals(150, result.xp)
        assertEquals(1, result.tasksCompleted)
        assertEquals(1, result.skippedTasks)
    }

    @Test
    fun `updateAchievementConfig saves enabled keys and publishes realtime event`() {
        val collective = Collective(id = 1, name = "Villa", joinCode = "ABC123", ownerMemberId = 1, monthlyPrize = null)
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(collective)

        service.updateAchievementConfig("Kasper", setOf("clean_streak", "task_master"))

        verify(collectiveRepository).save(collective.copy(enabledAchievementKeys = setOf("clean_streak", "task_master")))
        verify(realtimeUpdateService).publish(eq("ABC123"), eq("ACHIEVEMENT_CONFIG_UPDATED"), isNull())
    }

    private fun member(
        name: String,
        email: String,
        id: Long = 1,
        collectiveCode: String? = "ABC123",
        xp: Int = 0,
        level: Int = 1,
    ) = Member(
        id = id,
        name = name,
        email = email,
        collectiveCode = collectiveCode,
        xp = xp,
        level = level,
    )

    private fun task(
        id: Long,
        title: String,
        assignee: String,
        dueDate: LocalDate = LocalDate.now(),
        completed: Boolean = false,
        completedAt: LocalDateTime? = null,
        xp: Int = 10,
    ) = TaskItem(
        id = id,
        title = title,
        assignee = assignee,
        collectiveCode = "ABC123",
        dueDate = dueDate,
        category = TaskCategory.CLEANING,
        completed = completed,
        completedAt = completedAt,
        xp = xp,
    )
}
