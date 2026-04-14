package com.kollekt.service

import com.kollekt.api.dto.AchievementDto
import com.kollekt.api.dto.DashboardResponse
import com.kollekt.api.dto.DrinkingQuestionDto
import com.kollekt.api.dto.EventDto
import com.kollekt.api.dto.ExpenseDto
import com.kollekt.api.dto.LeaderboardPeriod
import com.kollekt.api.dto.LeaderboardPlayerDto
import com.kollekt.api.dto.LeaderboardResponse
import com.kollekt.api.dto.TaskDto
import com.kollekt.api.dto.WeeklyStatsDto
import com.kollekt.domain.Achievement
import com.kollekt.domain.CalendarEvent
import com.kollekt.domain.Expense
import com.kollekt.domain.TaskItem
import com.kollekt.repository.AchievementRepository
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.EventRepository
import com.kollekt.repository.ExpenseRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.TaskRepository
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.LocalDateTime
import kotlin.random.Random

@Service
class StatsService(
    private val collectiveAccessService: CollectiveAccessService,
    private val memberRepository: MemberRepository,
    private val collectiveRepository: CollectiveRepository,
    private val taskRepository: TaskRepository,
    private val eventRepository: EventRepository,
    private val expenseRepository: ExpenseRepository,
    private val achievementRepository: AchievementRepository,
    private val redisTemplate: RedisTemplate<String, Any>,
    private val statsCacheService: StatsCacheService,
) {
    fun getLeaderboard(
        memberName: String,
        period: LeaderboardPeriod = LeaderboardPeriod.OVERALL,
    ): LeaderboardResponse {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val collective =
            collectiveRepository.findByJoinCode(collectiveCode)
                ?: throw IllegalArgumentException("Collective not found")
        val leaderboardKey = "leaderboard:$collectiveCode:$period"
        val cached = redisTemplate.opsForValue().get(leaderboardKey)
        if (cached is LeaderboardResponse) return cached

        val allTasks = taskRepository.findAllByCollectiveCode(collectiveCode)
        val now = LocalDateTime.now()
        val filteredTasks =
            when (period) {
                LeaderboardPeriod.OVERALL -> {
                    allTasks.filter { it.completed }
                }

                LeaderboardPeriod.YEAR -> {
                    allTasks.filter {
                        it.completed && it.completedAt?.year == now.year
                    }
                }

                LeaderboardPeriod.MONTH -> {
                    allTasks.filter {
                        it.completed &&
                            it.completedAt?.year == now.year &&
                            it.completedAt?.month == now.month
                    }
                }
            }

        val players =
            memberRepository
                .findAllByCollectiveCode(collectiveCode)
                .sortedByDescending { it.xp }
                .mapIndexed { index, member ->
                    val completedCount = filteredTasks.count { it.assignee == member.name }

                    LeaderboardPlayerDto(
                        rank = index + 1,
                        name = member.name,
                        level = member.level,
                        xp = member.xp,
                        tasksCompleted = completedCount,
                        streak = (completedCount / 2).coerceAtMost(30),
                        badges =
                            when {
                                index == 0 -> listOf("TOP", "STREAK", "PRO")
                                index < 3 -> listOf("STREAK", "PRO")
                                else -> listOf("PRO")
                            },
                    )
                }

        val totalTasks = filteredTasks.size
        val totalXp = filteredTasks.sumOf { it.xp }
        val avgPerPerson = if (players.isNotEmpty()) totalXp / players.size else 0
        val topContributor = players.firstOrNull()?.name ?: "N/A"
        val response =
            LeaderboardResponse(
                players = players,
                weeklyStats =
                    WeeklyStatsDto(
                        totalTasks = totalTasks,
                        totalXp = totalXp,
                        avgPerPerson = avgPerPerson,
                        topContributor = topContributor,
                    ),
                monthlyPrize = collective.monthlyPrize,
            )

        redisTemplate.opsForValue().set(leaderboardKey, response)
        return response
    }

    fun getMonthlyPrize(memberName: String): String? {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val collective =
            collectiveRepository.findByJoinCode(collectiveCode)
                ?: throw IllegalArgumentException("Collective not found")
        return collective.monthlyPrize
    }

    @Transactional
    fun setMonthlyPrize(
        memberName: String,
        prize: String?,
    ) {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val collective =
            collectiveRepository.findByJoinCode(collectiveCode)
                ?: throw IllegalArgumentException("Collective not found")

        collectiveRepository.save(collective.copy(monthlyPrize = prize))
        statsCacheService.clearLeaderboardCache()
    }

    fun getAchievements(): List<AchievementDto> = achievementRepository.findAll().map { it.toDto() }

    fun getDashboard(memberName: String): DashboardResponse {
        val key = "dashboard:$memberName"
        val cached = redisTemplate.opsForValue().get(key)
        if (cached is DashboardResponse) return cached

        val user = collectiveAccessService.requireMember(memberName)
        val collectiveCode = collectiveAccessService.requireCollectiveCode(user)
        val leaderboard = getLeaderboard(memberName)
        val rank =
            leaderboard.players.firstOrNull { it.name == user.name }?.rank
                ?: leaderboard.players.size

        val response =
            DashboardResponse(
                currentUserName = user.name,
                currentUserXp = user.xp,
                currentUserLevel = user.level,
                currentUserRank = rank,
                upcomingTasks =
                    taskRepository
                        .findAllByCollectiveCode(collectiveCode)
                        .filter { !it.completed }
                        .sortedBy { it.dueDate }
                        .take(3)
                        .map { it.toDto() },
                upcomingEvents =
                    eventRepository
                        .findAllByCollectiveCode(collectiveCode)
                        .filter { it.date >= LocalDate.now() }
                        .sortedBy { it.date }
                        .take(3)
                        .map { it.toDto() },
                recentExpenses =
                    expenseRepository
                        .findAllByCollectiveCode(collectiveCode)
                        .sortedByDescending { it.date }
                        .take(3)
                        .map { it.toDto() },
            )

        redisTemplate.opsForValue().set(key, response)
        return response
    }

    fun getDrinkingQuestion(memberName: String): DrinkingQuestionDto {
        val leaderboard = getLeaderboard(memberName).players
        val topPlayer = leaderboard.firstOrNull()?.name ?: "Emma"
        val bottomPlayer = leaderboard.lastOrNull()?.name ?: "Kasper"
        val questions = buildDrinkingQuestions(topPlayer, bottomPlayer)
        return questions[Random.nextInt(questions.size)]
    }

    private fun buildDrinkingQuestions(
        topPlayer: String,
        bottomPlayer: String,
    ): List<DrinkingQuestionDto> =
        listOf(
            DrinkingQuestionDto("$topPlayer, som leaderboard-leder, del ut 3 slurker!", "distribute", topPlayer),
            DrinkingQuestionDto("$bottomPlayer, du er sist på leaderboardet. Drikk 2!", "drink", bottomPlayer),
            DrinkingQuestionDto("Alle som har glemt å tømme søppel denne uken drikker 2!", "everyone", null),
            DrinkingQuestionDto("Pek på hvem som mest sannsynlig glemmer å handle. De drikker 1!", "vote", null),
            DrinkingQuestionDto("Rock, paper, scissors mellom topp 2 på leaderboard. Taper drikker 3!", "challenge", null),
        )

    private fun TaskItem.toDto() =
        TaskDto(
            id = id,
            title = title,
            assignee = assignee,
            dueDate = dueDate,
            category = category,
            completed = completed,
            xp = xp,
            recurrenceRule = recurrenceRule,
            penaltyXp = penaltyXp,
        )

    private fun CalendarEvent.toDto() = EventDto(id, title, date, time, endTime, type, organizer, attendees, description)

    private fun Expense.toDto() =
        ExpenseDto(
            id = id,
            description = description,
            amount = amount,
            paidBy = paidBy,
            category = category,
            date = date,
            participantNames = participantNames.sorted(),
        )

    private fun Achievement.toDto() = AchievementDto(id, title, description, icon, unlocked, progress, total)
}
