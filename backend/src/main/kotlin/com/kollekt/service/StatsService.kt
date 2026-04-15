package com.kollekt.service

import com.kollekt.api.dto.AchievementCatalogItemDto
import com.kollekt.api.dto.AchievementDto
import com.kollekt.api.dto.DashboardResponse
import com.kollekt.api.dto.DrinkingQuestionDto
import com.kollekt.api.dto.EventDto
import com.kollekt.api.dto.ExpenseDto
import com.kollekt.api.dto.LeaderboardPeriod
import com.kollekt.api.dto.LeaderboardPlayerDto
import com.kollekt.api.dto.LeaderboardResponse
import com.kollekt.api.dto.MemberStatsDto
import com.kollekt.api.dto.PeriodStatsDto
import com.kollekt.api.dto.ShoppingItemDto
import com.kollekt.api.dto.TaskDto
import com.kollekt.domain.CalendarEvent
import com.kollekt.domain.Expense
import com.kollekt.domain.Member
import com.kollekt.domain.TaskItem
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

private data class AchievementDefinition(
    val key: String,
    val title: String,
    val description: String,
    val icon: String,
    val total: Int,
    val compute: (tasks: List<TaskItem>, member: Member, streak: Int) -> Int,
)

private val ACHIEVEMENT_DEFINITIONS: List<AchievementDefinition> =
    listOf(
        AchievementDefinition("TASK_1", "First Step", "Complete your first task", "check", 1) { t, _, _ ->
            t.count { it.completed }.coerceAtMost(1)
        },
        AchievementDefinition("TASK_5", "Getting Going", "Complete 5 tasks", "star", 5) { t, _, _ ->
            t.count { it.completed }.coerceAtMost(5)
        },
        AchievementDefinition("TASK_10", "Ten Done", "Complete 10 tasks", "star-half", 10) { t, _, _ ->
            t.count { it.completed }.coerceAtMost(10)
        },
        AchievementDefinition("TASK_25", "Household Hero", "Complete 25 tasks", "home", 25) { t, _, _ ->
            t.count { it.completed }.coerceAtMost(25)
        },
        AchievementDefinition("STREAK_3", "On a Roll", "Complete tasks 3 days in a row", "flame", 3) { _, _, streak ->
            streak.coerceAtMost(3)
        },
        AchievementDefinition("STREAK_7", "Week Warrior", "Complete tasks 7 days in a row", "zap", 7) { _, _, streak ->
            streak.coerceAtMost(7)
        },
        AchievementDefinition("EARLY_BIRD", "Early Bird", "Complete 3 tasks before the due date", "sunrise", 3) { t, _, _ ->
            t.count { it.completed && it.completedAt != null && it.completedAt.toLocalDate() < it.dueDate }.coerceAtMost(3)
        },
        AchievementDefinition("NO_PENALTY", "Clean Record", "Complete 5 tasks without any penalty", "shield", 5) { t, _, _ ->
            t.count { it.completed && it.penaltyXp == 0 }.coerceAtMost(5)
        },
        AchievementDefinition("CLEANING_5", "Clean House", "Complete 5 cleaning tasks", "sparkles", 5) { t, _, _ ->
            t.count { it.completed && it.category == com.kollekt.domain.TaskCategory.CLEANING }.coerceAtMost(5)
        },
        AchievementDefinition("LEVEL_2", "Level Up", "Reach level 2", "trending-up", 2) { _, m, _ ->
            m.level.coerceAtMost(2)
        },
        AchievementDefinition("XP_100", "Century", "Earn 100 XP", "award", 100) { _, m, _ ->
            m.xp.coerceAtMost(100)
        },
        AchievementDefinition("XP_500", "XP Grinder", "Earn 500 XP", "trophy", 500) { _, m, _ ->
            m.xp.coerceAtMost(500)
        },
    )

private val DEFAULT_ENABLED_KEYS: Set<String> =
    setOf(
        "TASK_1",
        "TASK_10",
        "STREAK_3",
        "LEVEL_2",
    )

@Service
class StatsService(
    private val collectiveAccessService: CollectiveAccessService,
    private val memberRepository: MemberRepository,
    private val collectiveRepository: CollectiveRepository,
    private val taskRepository: TaskRepository,
    private val eventRepository: EventRepository,
    private val expenseRepository: ExpenseRepository,
    private val redisTemplate: RedisTemplate<String, Any>,
    private val statsCacheService: StatsCacheService,
    private val realtimeUpdateService: RealtimeUpdateService,
    private val economyOperations: EconomyOperations,
    private val shoppingItemRepository: com.kollekt.repository.ShoppingItemRepository,
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
        val completedTasks =
            when (period) {
                LeaderboardPeriod.OVERALL -> {
                    allTasks.filter { it.completed }
                }

                LeaderboardPeriod.YEAR -> {
                    allTasks.filter { it.completed && it.completedAt?.year == now.year }
                }

                LeaderboardPeriod.MONTH -> {
                    allTasks.filter {
                        it.completed && it.completedAt?.year == now.year && it.completedAt?.month == now.month
                    }
                }
            }

        val members = memberRepository.findAllByCollectiveCode(collectiveCode).sortedByDescending { it.xp }

        val players =
            members.mapIndexed { index, member ->
                val memberTasks = completedTasks.filter { it.assignee == member.name }
                val streak = computeStreak(allTasks.filter { it.assignee == member.name })
                LeaderboardPlayerDto(
                    rank = index + 1,
                    name = member.name,
                    level = member.level,
                    xp = member.xp,
                    tasksCompleted = memberTasks.size,
                    streak = streak,
                    badges = buildBadges(index + 1, streak, member.level, memberTasks.size),
                )
            }

        val periodStats = buildPeriodStats(players, completedTasks, allTasks, members)

        val response =
            LeaderboardResponse(
                players = players,
                periodStats = periodStats,
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

    fun getAchievements(memberName: String): List<AchievementDto> {
        val cacheKey = "achievements:$memberName"
        val cached = redisTemplate.opsForValue().get(cacheKey)
        if (cached is List<*> && cached.all { it is AchievementDto }) {
            @Suppress("UNCHECKED_CAST")
            return cached as List<AchievementDto>
        }

        val member = collectiveAccessService.requireMember(memberName)
        val collectiveCode = collectiveAccessService.requireCollectiveCode(member)
        val collective =
            collectiveRepository.findByJoinCode(collectiveCode)
                ?: throw IllegalArgumentException("Collective not found")
        val enabledKeys = collective.enabledAchievementKeys.ifEmpty { DEFAULT_ENABLED_KEYS }

        val memberTasks = taskRepository.findAllByCollectiveCode(collectiveCode).filter { it.assignee == memberName }
        val streak = computeStreak(memberTasks)

        val result =
            ACHIEVEMENT_DEFINITIONS
                .filter { it.key in enabledKeys }
                .mapIndexed { index, def ->
                    val progress = def.compute(memberTasks, member, streak)
                    AchievementDto(
                        id = index.toLong() + 1,
                        key = def.key,
                        title = def.title,
                        description = def.description,
                        icon = def.icon,
                        unlocked = progress >= def.total,
                        progress = progress,
                        total = def.total,
                    )
                }

        redisTemplate.opsForValue().set(cacheKey, result)
        return result
    }

    fun getAchievementsCatalog(memberName: String): List<AchievementCatalogItemDto> {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val collective =
            collectiveRepository.findByJoinCode(collectiveCode)
                ?: throw IllegalArgumentException("Collective not found")
        val enabledKeys = collective.enabledAchievementKeys.ifEmpty { DEFAULT_ENABLED_KEYS }

        return ACHIEVEMENT_DEFINITIONS.map { def ->
            AchievementCatalogItemDto(
                key = def.key,
                title = def.title,
                description = def.description,
                icon = def.icon,
                enabled = def.key in enabledKeys,
            )
        }
    }

    @Transactional
    fun updateAchievementConfig(
        memberName: String,
        enabledKeys: Set<String>,
    ) {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val collective =
            collectiveRepository.findByJoinCode(collectiveCode)
                ?: throw IllegalArgumentException("Collective not found")
        collectiveRepository.save(collective.copy(enabledAchievementKeys = enabledKeys))
        statsCacheService.clearAchievementsCache()
        realtimeUpdateService.publish(collectiveCode, "ACHIEVEMENT_CONFIG_UPDATED")
    }

    fun getMemberStats(
        viewerName: String,
        targetName: String,
    ): MemberStatsDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(viewerName)
        val target =
            memberRepository.findByName(targetName)
                ?: throw IllegalArgumentException("Member not found")

        val allTasks = taskRepository.findAllByCollectiveCode(collectiveCode)
        val memberTasks = allTasks.filter { it.assignee == targetName }
        val streak = computeStreak(memberTasks)
        val tasksCompleted = memberTasks.count { it.completed }
        val lateCompletions = memberTasks.count { it.completed && it.penaltyXp > 0 }
        val skippedTasks = memberTasks.count { !it.completed && it.dueDate < LocalDate.now() }

        val leaderboard = getLeaderboard(viewerName)
        val rank = leaderboard.players.firstOrNull { it.name == targetName }?.rank ?: leaderboard.players.size

        val achievements = getAchievements(targetName)

        return MemberStatsDto(
            name = target.name,
            level = target.level,
            xp = target.xp,
            rank = rank,
            streak = streak,
            tasksCompleted = tasksCompleted,
            lateCompletions = lateCompletions,
            skippedTasks = skippedTasks,
            achievementsUnlocked = achievements.count { it.unlocked },
            achievementsTotal = achievements.size,
        )
    }

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

        val userBalance =
            economyOperations.getBalances(memberName)
                .firstOrNull { it.name == user.name }?.amount ?: 0

        val response =
            DashboardResponse(
                currentUserName = user.name,
                currentUserXp = user.xp,
                currentUserLevel = user.level,
                currentUserRank = rank,
                currentUserBalance = userBalance,
                completedTasksCount =
                    taskRepository
                        .findAllByCollectiveCode(collectiveCode)
                        .count { it.completed && it.assignee == user.name },
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
                pendingShoppingItems =
                    shoppingItemRepository
                        .findAllByCollectiveCode(collectiveCode)
                        .filter { !it.completed }
                        .take(3)
                        .map { ShoppingItemDto(it.id, it.item, it.addedBy, it.completed) },
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

    private fun buildPeriodStats(
        players: List<LeaderboardPlayerDto>,
        completedTasks: List<TaskItem>,
        allTasks: List<TaskItem>,
        members: List<Member>,
    ): PeriodStatsDto {
        val totalTasks = completedTasks.size
        val totalXp = completedTasks.sumOf { it.xp }
        val avgPerPerson = if (members.isNotEmpty()) totalXp / members.size else 0
        val topContributor = players.firstOrNull()?.name ?: "N/A"

        val bestStreakEntry = players.maxByOrNull { it.streak }
        val bestStreak = bestStreakEntry?.streak ?: 0
        val bestStreakHolder = bestStreakEntry?.name ?: "N/A"

        val totalPenaltyXp = completedTasks.sumOf { it.penaltyXp }

        val lateByMember =
            members.associateWith { m ->
                completedTasks.count { it.assignee == m.name && it.penaltyXp > 0 }
            }
        val mostLateEntry = lateByMember.maxByOrNull { it.value }
        val lateCompletions = mostLateEntry?.value ?: 0
        val lateCompletionsHolder = if (lateCompletions > 0) mostLateEntry?.key?.name ?: "N/A" else "N/A"

        val skippedByMember =
            members.associateWith { m ->
                allTasks.count { it.assignee == m.name && !it.completed && it.dueDate < LocalDate.now() }
            }
        val mostSkippedEntry = skippedByMember.maxByOrNull { it.value }
        val skippedCount = mostSkippedEntry?.value ?: 0
        val skippedHolder = if (skippedCount > 0) mostSkippedEntry?.key?.name ?: "N/A" else "N/A"

        return PeriodStatsDto(
            totalTasks = totalTasks,
            totalXp = totalXp,
            avgPerPerson = avgPerPerson,
            topContributor = topContributor,
            bestStreak = bestStreak,
            bestStreakHolder = bestStreakHolder,
            totalPenaltyXp = totalPenaltyXp,
            lateCompletions = lateCompletions,
            lateCompletionsHolder = lateCompletionsHolder,
            skippedCount = skippedCount,
            skippedHolder = skippedHolder,
        )
    }

    private fun computeStreak(memberTasks: List<TaskItem>): Int {
        val completionDates =
            memberTasks
                .filter { it.completed && it.completedAt != null }
                .map { it.completedAt!!.toLocalDate() }
                .toSortedSet()

        if (completionDates.isEmpty()) return 0

        var current = LocalDate.now()
        if (!completionDates.contains(current)) {
            current = current.minusDays(1)
        }
        if (!completionDates.contains(current)) return 0

        var streak = 0
        while (completionDates.contains(current)) {
            streak++
            current = current.minusDays(1)
        }
        return streak
    }

    private fun buildBadges(
        rank: Int,
        streak: Int,
        level: Int,
        tasksCompleted: Int,
    ): List<String> =
        buildList {
            if (rank == 1) add("TOP")
            if (streak >= 7) add("STREAK")
            if (level >= 5) add("PRO")
            if (tasksCompleted >= 25) add("HERO")
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
}
