@file:Suppress("ktlint:standard:no-wildcard-imports")

package com.kollekt.service

import com.kollekt.api.dto.*
import com.kollekt.domain.*
import com.kollekt.repository.*
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.time.LocalDate
import java.time.LocalDateTime
import kotlin.random.Random

@Service
class KollektService(
    private val memberRepository: MemberRepository,
    private val collectiveRepository: CollectiveRepository,
    private val taskRepository: TaskRepository,
    private val eventRepository: EventRepository,
    private val expenseRepository: ExpenseRepository,
    private val achievementRepository: AchievementRepository,
    private val redisTemplate: RedisTemplate<String, Any>,
    private val accountOperations: AccountOperations,
    private val memberOperations: MemberOperations,
    private val collectiveOperations: CollectiveOperations,
    private val taskOperations: TaskOperations,
    private val shoppingOperations: ShoppingOperations,
    private val eventOperations: EventOperations,
    private val chatOperations: ChatOperations,
    private val economyOperations: EconomyOperations,
) {
    @Autowired(required = false)
    private lateinit var invitationRealtimeService: InvitationRealtimeService

    @Autowired(required = false)
    private lateinit var googleCalendarService: GoogleCalendarService

    companion object {
        // TODO: Replace with persistent storage (e.g., Friend entity/repository)
        private val friendsMap = mutableMapOf<String, MutableSet<String>>()
    }

    // -------------------------------------------------------------------------
    // Tasks
    // -------------------------------------------------------------------------

    // Configurable reminder offset (in days)
    private val reminderDaysBeforeDue = 1L // Change to config or env if needed

    @Scheduled(cron = "0 0 8 * * *")
    fun notifyUpcomingTaskDeadlines() = taskOperations.notifyUpcomingTaskDeadlines(reminderDaysBeforeDue)

    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    fun deleteExpiredTasks() = taskOperations.deleteExpiredTasks()

    fun getTasks(memberName: String): List<TaskDto> = taskOperations.getTasks(memberName, ::requireCollectiveCodeByMemberName)

    @Transactional
    fun createTask(
        request: CreateTaskRequest,
        actorName: String,
    ): TaskDto = taskOperations.createTask(request, actorName, ::requireCollectiveCodeByMemberName, ::clearTaskCaches)

    @Transactional
    fun deleteTask(
        taskId: Long,
        memberName: String,
    ) = taskOperations.deleteTask(taskId, memberName, ::requireCollectiveCodeByMemberName, ::clearTaskCaches)

    @Transactional
    fun giveTaskFeedback(
        taskId: Long,
        memberName: String,
        feedback: String,
    ): TaskDto = taskOperations.giveTaskFeedback(taskId, memberName, feedback, ::requireCollectiveCodeByMemberName, ::clearTaskCaches)

    @Transactional
    fun updateTask(
        taskId: Long,
        updates: Map<String, Any>,
        memberName: String,
    ): TaskDto = taskOperations.updateTask(taskId, updates, memberName, ::requireCollectiveCodeByMemberName, ::clearTaskCaches)

    @Transactional
    fun toggleTask(
        taskId: Long,
        memberName: String,
    ): TaskDto = taskOperations.toggleTask(taskId, memberName, ::requireCollectiveCodeByMemberName, ::clearTaskCaches)

    @Transactional
    fun regretTask(
        taskId: Long,
        memberName: String,
    ): TaskDto = taskOperations.regretTask(taskId, memberName, ::requireCollectiveCodeByMemberName, ::clearTaskCaches)

    @Transactional
    fun deleteUser(memberName: String) = memberOperations.deleteUser(memberName)

    @Transactional
    fun leaveCollective(memberName: String) = memberOperations.leaveCollective(memberName)

    @Scheduled(cron = "0 0 4 * * *")
    fun penalizeMissedTasks() = taskOperations.penalizeMissedTasks()

    @Transactional
    fun regretMissedTask(
        taskId: Long,
        memberName: String,
    ): TaskDto = taskOperations.regretMissedTask(taskId, memberName, ::clearTaskCaches)

    @Transactional
    fun updateMemberStatus(
        memberName: String,
        newStatus: MemberStatus,
    ) = memberOperations.updateMemberStatus(memberName, newStatus, ::regenerateRecurringTasksForCollective)

    @Transactional
    fun addFriend(
        memberName: String,
        friendName: String,
    ) = memberOperations.addFriend(memberName, friendName, friendsMap)

    @Transactional
    fun removeFriend(
        memberName: String,
        friendName: String,
    ) = memberOperations.removeFriend(memberName, friendName, friendsMap)

    @Transactional
    fun createUser(request: CreateUserRequest): AuthResponse =
        accountOperations.createUser(request, ::clearAllCaches) { member -> member.toUserDto() }

    @Transactional
    fun resetPassword(
        memberName: String?,
        email: String?,
        newPassword: String,
    ) = accountOperations.resetPassword(memberName, email, newPassword)

    fun login(request: LoginRequest): AuthResponse = accountOperations.login(request) { member -> member.toUserDto() }

    fun getUserByName(name: String): UserDto = accountOperations.getUserByName(name) { member -> member.toUserDto() }

    fun refreshToken(request: RefreshTokenRequest): AuthResponse =
        accountOperations.refreshToken(request) { member -> member.toUserDto() }

    fun logout(
        accessTokenJwt: Jwt,
        refreshToken: String?,
    ) = accountOperations.logout(accessTokenJwt, refreshToken)

    // -------------------------------------------------------------------------
    // Collective
    // -------------------------------------------------------------------------

    @Transactional
    fun createCollective(request: CreateCollectiveRequest): CollectiveDto =
        collectiveOperations.createCollective(request, ::clearAllCaches)

    private fun regenerateRecurringTasksForCollective(collectiveCode: String) =
        taskOperations.regenerateRecurringTasksForCollective(collectiveCode, ::clearTaskCaches)

    @Scheduled(cron = "0 0 3 * * MON")
    fun scheduledWeeklyTaskRotation() {
        val allCollectives = collectiveRepository.findAll()
        for (collective in allCollectives) {
            regenerateRecurringTasksForCollective(collective.joinCode)
        }
    }

    @Transactional
    fun joinCollective(request: JoinCollectiveRequest): UserDto =
        collectiveOperations.joinCollective(
            request = request,
            clearCaches = ::clearAllCaches,
            regenerateRecurringTasksForCollective = ::regenerateRecurringTasksForCollective,
        ) { member -> member.toUserDto() }

    fun inviteUserToCollective(
        email: String,
        collectiveCode: String,
        inviterName: String,
    ) {
        val invitation = collectiveOperations.createInvitation(email, collectiveCode, inviterName)

        if (::invitationRealtimeService.isInitialized) {
            try {
                invitationRealtimeService.publish(invitation.email, "INVITATION_CREATED", invitation)
            } catch (_: Exception) {
            }
        }

        println("[INVITE] Sent invite to $email for collective $collectiveCode (invited by ${invitation.invitedBy})")
    }

    fun getCollectiveCodeForUser(userId: Long): CollectiveCodeDto = collectiveOperations.getCollectiveCodeForUser(userId)

    fun getCollectiveMembers(memberName: String): List<UserDto> =
        memberOperations.getCollectiveMembers(memberName) { member -> member.toUserDto() }

    // -------------------------------------------------------------------------
    // Shopping
    // -------------------------------------------------------------------------

    fun getShoppingItems(memberName: String): List<ShoppingItemDto> =
        shoppingOperations.getShoppingItems(memberName, ::requireCollectiveCodeByMemberName)

    @Transactional
    fun createShoppingItem(
        request: CreateShoppingItemRequest,
        actorName: String,
    ): ShoppingItemDto = shoppingOperations.createShoppingItem(request, actorName, ::requireCollectiveCodeByMemberName)

    @Transactional
    fun toggleShoppingItem(
        itemId: Long,
        memberName: String,
    ): ShoppingItemDto = shoppingOperations.toggleShoppingItem(itemId, memberName, ::requireCollectiveCodeByMemberName)

    @Transactional
    fun deleteShoppingItem(
        itemId: Long,
        memberName: String,
    ) = shoppingOperations.deleteShoppingItem(itemId, memberName, ::requireCollectiveCodeByMemberName)

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    fun getEvents(memberName: String): List<EventDto> = eventOperations.getEvents(memberName, ::requireCollectiveCodeByMemberName)

    @Transactional
    fun createEvent(
        request: CreateEventRequest,
        actorName: String,
    ): EventDto =
        eventOperations.createEvent(
            request = request,
            actorName = actorName,
            requireCollectiveCodeByMemberName = ::requireCollectiveCodeByMemberName,
            clearDashboardCache = ::clearDashboardCache,
            createGoogleEvent =
                if (::googleCalendarService.isInitialized) {
                    { member: Member, event: CalendarEvent -> googleCalendarService.createGoogleEvent(member, event) }
                } else {
                    null
                },
        )

    @Transactional
    fun deleteEvent(
        eventId: Long,
        actorName: String,
    ) =
        eventOperations.deleteEvent(
            eventId = eventId,
            actorName = actorName,
            requireCollectiveCodeByMemberName = ::requireCollectiveCodeByMemberName,
            clearDashboardCache = ::clearDashboardCache,
            deleteGoogleEvent =
                if (::googleCalendarService.isInitialized) {
                    { member: Member, googleEventId: String -> googleCalendarService.deleteGoogleEvent(member, googleEventId) }
                } else {
                    null
                },
        )

    fun saveGoogleCalendarTokens(
        memberName: String,
        code: String,
    ) = collectiveOperations.saveGoogleCalendarTokens(memberName, code, googleCalendarService::exchangeCode)

    fun isGoogleCalendarConnected(memberName: String): Boolean {
        if (!::googleCalendarService.isInitialized) return false
        return collectiveOperations.isGoogleCalendarConnected(memberName, googleCalendarService::isConnected)
    }

    fun disconnectGoogleCalendar(memberName: String) = collectiveOperations.disconnectGoogleCalendar(memberName)

    // -------------------------------------------------------------------------
    // Chat
    // -------------------------------------------------------------------------

    fun getMessages(memberName: String): List<MessageDto> = chatOperations.getMessages(memberName, ::requireCollectiveCodeByMemberName)

    @Transactional
    fun createMessage(
        request: CreateMessageRequest,
        actorName: String,
    ): MessageDto = chatOperations.createMessage(request, actorName, ::requireCollectiveCodeByMemberName)

    @Transactional
    fun createImageMessage(
        image: MultipartFile,
        caption: String?,
        actorName: String,
    ): MessageDto = chatOperations.createImageMessage(image, caption, actorName, ::requireCollectiveCodeByMemberName)

    @Transactional
    fun addReaction(
        messageId: Long,
        emoji: String,
        actorName: String,
    ): MessageDto = chatOperations.addReaction(messageId, emoji, actorName, ::requireCollectiveCodeByMemberName)

    @Transactional
    fun removeReaction(
        messageId: Long,
        emoji: String,
        actorName: String,
    ): MessageDto = chatOperations.removeReaction(messageId, emoji, actorName, ::requireCollectiveCodeByMemberName)

    @Transactional
    fun createPoll(
        request: CreatePollRequest,
        actorName: String,
    ): MessageDto = chatOperations.createPoll(request, actorName, ::requireCollectiveCodeByMemberName)

    @Transactional
    fun votePoll(
        messageId: Long,
        optionId: Int,
        actorName: String,
    ): MessageDto = chatOperations.votePoll(messageId, optionId, actorName, ::requireCollectiveCodeByMemberName)

    // -------------------------------------------------------------------------
    // Economy
    // -------------------------------------------------------------------------

    fun getExpenses(memberName: String): List<ExpenseDto> = economyOperations.getExpenses(memberName, ::requireCollectiveCodeByMemberName)

    @Transactional
    fun createExpense(
        request: CreateExpenseRequest,
        actorName: String,
    ): ExpenseDto = economyOperations.createExpense(request, actorName, ::requireCollectiveCodeByMemberName, ::clearAllCaches)

    fun getBalances(memberName: String): List<BalanceDto> = economyOperations.getBalances(memberName, ::requireCollectiveCodeByMemberName)

    fun getPantSummary(
        memberName: String,
        goal: Int = 1000,
    ): PantSummaryDto = economyOperations.getPantSummary(memberName, ::requireCollectiveCodeByMemberName, goal)

    @Transactional
    fun addPantEntry(
        request: CreatePantEntryRequest,
        actorName: String,
    ): PantEntryDto = economyOperations.addPantEntry(request, actorName, ::requireCollectiveCodeByMemberName)

    fun getEconomySummary(memberName: String): EconomySummaryDto =
        economyOperations.getEconomySummary(memberName, ::requireCollectiveCodeByMemberName)

    @Transactional
    fun settleUp(memberName: String): SettleUpResponse = economyOperations.settleUp(memberName, ::requireCollectiveCodeByMemberName)

    // -------------------------------------------------------------------------
    // Leaderboard / Dashboard / Achievements
    // -------------------------------------------------------------------------

    fun getLeaderboard(
        memberName: String,
        period: LeaderboardPeriod = LeaderboardPeriod.OVERALL,
    ): LeaderboardResponse {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val collective =
            collectiveRepository.findByJoinCode(collectiveCode)
                ?: throw IllegalArgumentException("Collective not found")
        val leaderboardKey = "leaderboard:$collectiveCode:$period"
        val cached = redisTemplate.opsForValue().get(leaderboardKey)
        if (cached is LeaderboardResponse) return cached

        val allTasks = taskRepository.findAllByCollectiveCode(collectiveCode)
        val now = LocalDateTime.now()

        // Filter tasks based on period
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
        val top = players.firstOrNull()?.name ?: "N/A"

        val response =
            LeaderboardResponse(
                players = players,
                weeklyStats =
                    WeeklyStatsDto(
                        totalTasks = totalTasks,
                        totalXp = totalXp,
                        avgPerPerson = avgPerPerson,
                        topContributor = top,
                    ),
                monthlyPrize = collective.monthlyPrize,
            )

        redisTemplate.opsForValue().set(leaderboardKey, response)
        return response
    }

    fun getMonthlyPrize(memberName: String): String? {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val collective =
            collectiveRepository.findByJoinCode(collectiveCode)
                ?: throw IllegalArgumentException("Collective not found")
        return collective.monthlyPrize
    }

    fun setMonthlyPrize(
        memberName: String,
        prize: String?,
    ) {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val collective =
            collectiveRepository.findByJoinCode(collectiveCode)
                ?: throw IllegalArgumentException("Collective not found")

        val updatedCollective = collective.copy(monthlyPrize = prize)
        collectiveRepository.save(updatedCollective)

        // Clear leaderboard cache since monthly prize affects leaderboard response
        clearLeaderboardCache()
    }

    fun getAchievements(): List<AchievementDto> = achievementRepository.findAll().map { it.toDto() }

    fun getDashboard(memberName: String): DashboardResponse {
        val key = "dashboard:$memberName"
        val cached = redisTemplate.opsForValue().get(key)
        if (cached is DashboardResponse) return cached

        val user =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")

        val collectiveCode = requireCollectiveCode(user)
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

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private fun clearTaskCaches() {
        clearDashboardCache()
        clearLeaderboardCache()
    }

    private fun clearDashboardCache() {
        val keys = redisTemplate.keys("dashboard:*")
        if (!keys.isNullOrEmpty()) {
            redisTemplate.delete(keys)
        }
    }

    private fun clearLeaderboardCache() {
        val keys = redisTemplate.keys("leaderboard:*")
        if (!keys.isNullOrEmpty()) {
            redisTemplate.delete(keys)
        }
    }

    private fun clearAllCaches() {
        clearTaskCaches()
    }

    private fun requireCollectiveCodeByMemberName(memberName: String): String {
        val member =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")
        return requireCollectiveCode(member)
    }

    private fun requireCollectiveCode(member: Member): String =
        member.collectiveCode
            ?: throw IllegalArgumentException("User '${member.name}' must join a collective first")

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

    // -------------------------------------------------------------------------
    // Extension mappers
    // -------------------------------------------------------------------------

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

    private fun CalendarEvent.toDto() = EventDto(id, title, date, time, type, organizer, attendees, description)

    private fun Member.toUserDto(): UserDto {
        val friends = friendsMap[name]?.map { FriendDto(it) } ?: emptyList()
        return UserDto(
            id = id,
            name = name,
            email = email,
            collectiveCode = collectiveCode,
            status = status,
            friends = friends,
        )
    }

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
