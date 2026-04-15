package com.kollekt.service

import com.kollekt.api.dto.LeaderboardPlayerDto
import com.kollekt.api.dto.LeaderboardResponse
import com.kollekt.api.dto.PeriodStatsDto
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
import com.kollekt.repository.TaskRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertSame
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.ValueOperations
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

class StatsServiceTest {
    private lateinit var memberRepository: MemberRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var taskRepository: TaskRepository
    private lateinit var eventRepository: EventRepository
    private lateinit var expenseRepository: ExpenseRepository
    private lateinit var redisTemplate: RedisTemplate<String, Any>
    private lateinit var valueOperations: ValueOperations<String, Any>
    private lateinit var collectiveAccessService: CollectiveAccessService
    private lateinit var statsCacheService: StatsCacheService
    private lateinit var realtimeUpdateService: RealtimeUpdateService
    private lateinit var service: StatsService

    @BeforeEach
    fun setUp() {
        memberRepository = mock()
        collectiveRepository = mock()
        taskRepository = mock()
        eventRepository = mock()
        expenseRepository = mock()
        redisTemplate = mock()
        valueOperations = mock()
        doReturn(valueOperations).whenever(redisTemplate).opsForValue()
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("leaderboard:*")
        collectiveAccessService = CollectiveAccessService(memberRepository, collectiveRepository)
        statsCacheService = StatsCacheService(redisTemplate)
        realtimeUpdateService = mock()
        service =
            StatsService(
                collectiveAccessService = collectiveAccessService,
                memberRepository = memberRepository,
                collectiveRepository = collectiveRepository,
                taskRepository = taskRepository,
                eventRepository = eventRepository,
                expenseRepository = expenseRepository,
                redisTemplate = redisTemplate,
                statsCacheService = statsCacheService,
                realtimeUpdateService = realtimeUpdateService,
            )
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com", xp = 250, level = 2))
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(
            Collective(id = 1, name = "Villa", joinCode = "ABC123", ownerMemberId = 1, monthlyPrize = "Pizza"),
        )
    }

    @Test
    fun `get leaderboard returns collective scoped cached value`() {
        val cached =
            LeaderboardResponse(
                players = listOf(LeaderboardPlayerDto(1, "Kasper", 2, 250, 8, 4, listOf("TOP"))),
                periodStats =
                    PeriodStatsDto(
                        totalTasks = 8,
                        totalXp = 250,
                        avgPerPerson = 125,
                        topContributor = "Kasper",
                        bestStreak = 4,
                        bestStreakHolder = "Kasper",
                        totalPenaltyXp = 0,
                        lateCompletions = 0,
                        lateCompletionsHolder = "N/A",
                        skippedCount = 0,
                        skippedHolder = "N/A",
                    ),
                monthlyPrize = "Pizza",
            )
        whenever(valueOperations.get("leaderboard:ABC123:OVERALL")).thenReturn(cached)

        val result = service.getLeaderboard("Kasper")

        assertSame(cached, result)
        verify(taskRepository, never()).findAllByCollectiveCode("ABC123")
    }

    @Test
    fun `get dashboard aggregates collective scoped data`() {
        whenever(valueOperations.get("dashboard:Kasper")).thenReturn(null)
        whenever(valueOperations.get("leaderboard:ABC123:OVERALL")).thenReturn(null)
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
        verify(valueOperations).set(org.mockito.kotlin.eq("dashboard:Kasper"), any())
    }

    @Test
    fun `set monthly prize updates collective and clears leaderboard cache`() {
        doReturn(setOf("leaderboard:ABC123:OVERALL")).whenever(redisTemplate).keys("leaderboard:*")

        service.setMonthlyPrize("Kasper", "Movie night")

        verify(collectiveRepository).save(
            org.mockito.kotlin.check {
                assertEquals("Movie night", it.monthlyPrize)
            },
        )
        verify(redisTemplate).delete(setOf("leaderboard:ABC123:OVERALL"))
    }

    @Test
    fun `get achievements computes from task data for enabled keys`() {
        whenever(valueOperations.get("achievements:Kasper")).thenReturn(null)
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
    fun `get drinking question builds a question from leaderboard context`() {
        val cached =
            LeaderboardResponse(
                players =
                    listOf(
                        LeaderboardPlayerDto(1, "Emma", 3, 320, 10, 5, listOf("TOP")),
                        LeaderboardPlayerDto(2, "Kasper", 2, 200, 6, 3, listOf()),
                    ),
                periodStats =
                    PeriodStatsDto(
                        totalTasks = 16,
                        totalXp = 520,
                        avgPerPerson = 260,
                        topContributor = "Emma",
                        bestStreak = 5,
                        bestStreakHolder = "Emma",
                        totalPenaltyXp = 10,
                        lateCompletions = 1,
                        lateCompletionsHolder = "Kasper",
                        skippedCount = 0,
                        skippedHolder = "N/A",
                    ),
                monthlyPrize = null,
            )
        whenever(valueOperations.get("leaderboard:ABC123:OVERALL")).thenReturn(cached)

        val result = service.getDrinkingQuestion("Kasper")

        assertTrue(result.text.isNotBlank())
        assertTrue(result.type in setOf("distribute", "drink", "everyone", "vote", "challenge"))
    }

    @Test
    fun `updateAchievementConfig saves enabled keys and publishes realtime event`() {
        val collective = Collective(id = 1, name = "Villa", joinCode = "ABC123", ownerMemberId = 1, monthlyPrize = null)
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(collective)

        service.updateAchievementConfig("Kasper", setOf("clean_streak", "task_master"))

        verify(collectiveRepository).save(collective.copy(enabledAchievementKeys = setOf("clean_streak", "task_master")))
        verify(realtimeUpdateService).publish(eq("ABC123"), eq("ACHIEVEMENT_CONFIG_UPDATED"))
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
