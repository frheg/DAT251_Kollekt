package com.kollekt.service

import com.kollekt.api.dto.*
import com.kollekt.domain.*
import com.kollekt.repository.*
import java.time.LocalDate
import java.time.LocalDateTime
import kotlin.math.roundToInt
import kotlin.random.Random
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class KollektService(
        private val memberRepository: MemberRepository,
        private val collectiveRepository: CollectiveRepository,
        private val taskRepository: TaskRepository,
        private val shoppingItemRepository: ShoppingItemRepository,
        private val eventRepository: EventRepository,
        private val chatMessageRepository: ChatMessageRepository,
        private val expenseRepository: ExpenseRepository,
        private val settlementCheckpointRepository: SettlementCheckpointRepository,
        private val pantEntryRepository: PantEntryRepository,
        private val achievementRepository: AchievementRepository,
        private val redisTemplate: RedisTemplate<String, Any>,
        private val eventPublisher: IntegrationEventPublisher,
) {
    private val joinCodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

    fun getTasks(memberName: String): List<TaskDto> {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        return taskRepository.findAllByCollectiveCode(collectiveCode).sortedBy { it.dueDate }.map { it.toDto() }
    }

    @Transactional
    fun createTask(request: CreateTaskRequest): TaskDto {
        val collectiveCode = requireCollectiveCodeByMemberName(request.assignee)
        val saved =
                taskRepository.save(
                        TaskItem(
                                title = request.title,
                                assignee = request.assignee,
                                collectiveCode = collectiveCode,
                                dueDate = request.dueDate,
                                category = request.category,
                                xp = request.xp,
                                recurring = request.recurring,
                        ),
                )
        clearDashboardCache()
        clearLeaderboardCache()
        eventPublisher.taskEvent("TASK_CREATED", saved.toDto())
        return saved.toDto()
    }

    @Transactional
    fun toggleTask(taskId: Long, memberName: String): TaskDto {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val task = taskRepository.findByIdAndCollectiveCode(taskId, collectiveCode)
                ?: throw IllegalArgumentException("Task $taskId not found")
        val updated = taskRepository.save(task.copy(completed = !task.completed))
        clearDashboardCache()
        clearLeaderboardCache()
        eventPublisher.taskEvent("TASK_TOGGLED", updated.toDto())
        return updated.toDto()
    }

    fun getShoppingItems(memberName: String): List<ShoppingItemDto> {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        return shoppingItemRepository.findAllByCollectiveCode(collectiveCode).map { it.toDto() }
    }

    @Transactional
    fun createShoppingItem(request: CreateShoppingItemRequest): ShoppingItemDto {
        val collectiveCode = requireCollectiveCodeByMemberName(request.addedBy)
        val saved =
                shoppingItemRepository.save(
                        ShoppingItem(
                                item = request.item,
                                addedBy = request.addedBy,
                                collectiveCode = collectiveCode,
                        )
                )
        eventPublisher.taskEvent("SHOPPING_ITEM_CREATED", saved.toDto())
        return saved.toDto()
    }

    @Transactional
    fun toggleShoppingItem(itemId: Long, memberName: String): ShoppingItemDto {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val item = shoppingItemRepository.findByIdAndCollectiveCode(itemId, collectiveCode)
                ?: throw IllegalArgumentException("Shopping item $itemId not found")
        val updated = shoppingItemRepository.save(item.copy(completed = !item.completed))
        eventPublisher.taskEvent("SHOPPING_ITEM_TOGGLED", updated.toDto())
        return updated.toDto()
    }

    @Transactional
    fun deleteShoppingItem(itemId: Long, memberName: String) {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val item = shoppingItemRepository.findByIdAndCollectiveCode(itemId, collectiveCode)
                ?: throw IllegalArgumentException("Shopping item $itemId not found")
        shoppingItemRepository.deleteById(item.id)
        eventPublisher.taskEvent("SHOPPING_ITEM_DELETED", mapOf("id" to itemId))
    }

    fun getEvents(memberName: String): List<EventDto> {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        return eventRepository.findAllByCollectiveCode(collectiveCode).sortedBy { it.date }.map { it.toDto() }
    }

    @Transactional
    fun createEvent(request: CreateEventRequest): EventDto {
        val collectiveCode = requireCollectiveCodeByMemberName(request.organizer)
        val saved =
                eventRepository.save(
                        CalendarEvent(
                                title = request.title,
                                collectiveCode = collectiveCode,
                                date = request.date,
                                time = request.time,
                                type = request.type,
                                organizer = request.organizer,
                                attendees = request.attendees,
                                description = request.description,
                        ),
                )
        clearDashboardCache()
        eventPublisher.chatEvent("EVENT_CREATED", saved.toDto())
        return saved.toDto()
    }

    fun getMessages(memberName: String): List<MessageDto> {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        return chatMessageRepository.findAllByCollectiveCode(collectiveCode).sortedBy { it.timestamp }.map { it.toDto() }
    }

    @Transactional
    fun createMessage(request: CreateMessageRequest): MessageDto {
        val collectiveCode = requireCollectiveCodeByMemberName(request.sender)
        val saved =
                chatMessageRepository.save(
                        ChatMessage(
                                sender = request.sender,
                                collectiveCode = collectiveCode,
                                text = request.text,
                                timestamp = LocalDateTime.now(),
                        ),
                )
        eventPublisher.chatEvent("MESSAGE_CREATED", saved.toDto())
        return saved.toDto()
    }

    @Transactional
    fun createUser(request: CreateUserRequest): UserDto {
        val name = request.name.trim()
        if (name.isBlank()) throw IllegalArgumentException("Name is required")
        if (memberRepository.findByName(name) != null) {
            throw IllegalArgumentException("User with name '$name' already exists")
        }

        val saved = memberRepository.save(Member(name = name))
        clearDashboardCache()
        clearLeaderboardCache()
        return saved.toUserDto()
    }

    fun login(request: LoginRequest): UserDto {
        val name = request.name.trim()
        if (name.isBlank()) throw IllegalArgumentException("Name is required")
        val user = memberRepository.findByName(name) ?: throw IllegalArgumentException("User '$name' not found")
        return user.toUserDto()
    }

    @Transactional
    fun createCollective(request: CreateCollectiveRequest): CollectiveDto {
        val collectiveName = request.name.trim()
        if (collectiveName.isBlank()) throw IllegalArgumentException("Collective name is required")

        val owner =
                memberRepository.findById(request.ownerUserId).orElseThrow {
                    IllegalArgumentException("User ${request.ownerUserId} not found")
                }

        if (owner.collectiveCode != null) {
            throw IllegalArgumentException("User ${owner.id} is already in a collective")
        }

        val joinCode = generateUniqueJoinCode()
        val collective =
                collectiveRepository.save(
                        Collective(
                                name = collectiveName,
                                joinCode = joinCode,
                                ownerMemberId = owner.id,
                        ),
                )

        memberRepository.save(owner.copy(collectiveCode = joinCode))
        clearDashboardCache()
        clearLeaderboardCache()
        return collective.toDto()
    }

    @Transactional
    fun joinCollective(request: JoinCollectiveRequest): UserDto {
        val joinCode = request.joinCode.trim().uppercase()
        if (joinCode.isBlank()) throw IllegalArgumentException("Join code is required")

        val collective =
                collectiveRepository.findByJoinCode(joinCode)
                        ?: throw IllegalArgumentException("Collective code '$joinCode' not found")

        val user =
                memberRepository.findById(request.userId).orElseThrow {
                    IllegalArgumentException("User ${request.userId} not found")
                }

        if (user.collectiveCode != null) {
            throw IllegalArgumentException("User ${user.id} is already in a collective")
        }

        val updated = memberRepository.save(user.copy(collectiveCode = collective.joinCode))
        clearDashboardCache()
        clearLeaderboardCache()
        return updated.toUserDto()
    }

    fun getCollectiveCodeForUser(userId: Long): CollectiveCodeDto {
        val user =
                memberRepository.findById(userId).orElseThrow {
                    IllegalArgumentException("User $userId not found")
                }
        val code =
                user.collectiveCode
                        ?: throw IllegalArgumentException("User $userId is not in a collective")
        return CollectiveCodeDto(code)
    }

    fun getCollectiveMembers(memberName: String): List<UserDto> {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        return memberRepository.findAllByCollectiveCode(collectiveCode).sortedBy { it.name }.map { it.toUserDto() }
    }

    fun getExpenses(memberName: String): List<ExpenseDto> {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        return expenseRepository.findAllByCollectiveCode(collectiveCode).sortedByDescending { it.date }.map { it.toDto() }
    }

    @Transactional
    fun createExpense(request: CreateExpenseRequest): ExpenseDto {
        val collectiveCode = requireCollectiveCodeByMemberName(request.paidBy)
        val collectiveMembers = memberRepository.findAllByCollectiveCode(collectiveCode).map { it.name }.toSet()
        if (collectiveMembers.isEmpty()) {
            throw IllegalArgumentException("Collective '$collectiveCode' has no members")
        }

        val requestedParticipants = request.participantNames.map { it.trim() }.filter { it.isNotBlank() }.toSet()
        val participants = if (requestedParticipants.isEmpty()) collectiveMembers else requestedParticipants
        val invalidParticipants = participants - collectiveMembers
        if (invalidParticipants.isNotEmpty()) {
            throw IllegalArgumentException("Participants not in collective: ${invalidParticipants.joinToString(", ")}")
        }

        val saved =
                expenseRepository.save(
                        Expense(
                                description = request.description,
                                amount = request.amount,
                                paidBy = request.paidBy,
                                collectiveCode = collectiveCode,
                                category = request.category,
                                date = request.date,
                                participantNames = participants,
                        ),
                )
        clearDashboardCache()
        clearLeaderboardCache()
        eventPublisher.economyEvent("EXPENSE_CREATED", saved.toDto())
        return saved.toDto()
    }

    fun getBalances(memberName: String): List<BalanceDto> {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val checkpointExpenseId = latestSettledExpenseId(collectiveCode)
        val expenses =
                expenseRepository
                        .findAllByCollectiveCode(collectiveCode)
                        .filter { it.id > checkpointExpenseId }
        if (expenses.isEmpty()) return emptyList()

        val members = memberRepository.findAllByCollectiveCode(collectiveCode).map { it.name }
        return calculateBalances(expenses, members)
    }

    fun getPantSummary(memberName: String, goal: Int = 1000): PantSummaryDto {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val entries =
                pantEntryRepository.findAllByCollectiveCode(collectiveCode).sortedByDescending { it.date }.map { it.toDto() }
        val current = entries.sumOf { it.amount }
        return PantSummaryDto(currentAmount = current, goalAmount = goal, entries = entries)
    }

    @Transactional
    fun addPantEntry(request: CreatePantEntryRequest): PantEntryDto {
        val collectiveCode = requireCollectiveCodeByMemberName(request.addedBy)
        val saved =
                pantEntryRepository.save(
                        PantEntry(
                                bottles = request.bottles,
                                amount = request.amount,
                                addedBy = request.addedBy,
                                collectiveCode = collectiveCode,
                                date = request.date,
                        ),
                )
        eventPublisher.economyEvent("PANT_ADDED", saved.toDto())
        return saved.toDto()
    }

    fun getEconomySummary(memberName: String): EconomySummaryDto {
        return EconomySummaryDto(
                expenses = getExpenses(memberName),
                balances = getBalances(memberName),
                pantSummary = getPantSummary(memberName),
        )
    }

    @Transactional
    fun settleUp(request: SettleUpRequest): SettleUpResponse {
        val collectiveCode = requireCollectiveCodeByMemberName(request.memberName)
        val lastExpenseId = expenseRepository.findTopByCollectiveCodeOrderByIdDesc(collectiveCode)?.id ?: 0L
        val checkpoint =
                settlementCheckpointRepository.save(
                        SettlementCheckpoint(
                                collectiveCode = collectiveCode,
                                settledBy = request.memberName,
                                lastExpenseId = lastExpenseId,
                        ),
                )
        eventPublisher.economyEvent(
                "BALANCES_SETTLED",
                mapOf(
                        "collectiveCode" to collectiveCode,
                        "settledBy" to request.memberName,
                        "lastExpenseId" to lastExpenseId,
                        "settledAt" to checkpoint.createdAt.toString(),
                ),
        )
        return SettleUpResponse(
                collectiveCode = collectiveCode,
                settledBy = request.memberName,
                lastExpenseId = lastExpenseId,
                settledAt = checkpoint.createdAt,
        )
    }

    fun getLeaderboard(memberName: String): LeaderboardResponse {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val leaderboardKey = "leaderboard:$collectiveCode"
        val cached = redisTemplate.opsForValue().get(leaderboardKey)
        if (cached is LeaderboardResponse) return cached

        val tasks = taskRepository.findAllByCollectiveCode(collectiveCode)
        val players =
                memberRepository.findAllByCollectiveCode(collectiveCode).sortedByDescending { it.xp }.mapIndexed { index, member
                    ->
                    val completedCount = tasks.count { it.assignee == member.name && it.completed }
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

        val totalTasks = tasks.count { it.completed }
        val totalXp = players.sumOf { it.xp }
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
                )

        redisTemplate.opsForValue().set(leaderboardKey, response)
        return response
    }

    fun getAchievements(): List<AchievementDto> = achievementRepository.findAll().map { it.toDto() }

    fun getDashboard(memberName: String): DashboardResponse {
        val key = "dashboard:$memberName"
        val cached = redisTemplate.opsForValue().get(key)
        if (cached is DashboardResponse) return cached

        val user = memberRepository.findByName(memberName)
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

    private fun generateUniqueJoinCode(length: Int = 6): String {
        repeat(20) {
            val code = (1..length).map { joinCodeChars.random() }.joinToString("")
            if (!collectiveRepository.existsByJoinCode(code)) return code
        }
        throw IllegalStateException("Unable to generate unique collective code")
    }

    private fun requireCollectiveCodeByMemberName(memberName: String): String {
        val member = memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")
        return requireCollectiveCode(member)
    }

    private fun requireCollectiveCode(member: Member): String {
        return member.collectiveCode
                ?: throw IllegalArgumentException("User '${member.name}' must join a collective first")
    }

    private fun latestSettledExpenseId(collectiveCode: String): Long {
        return settlementCheckpointRepository.findTopByCollectiveCodeOrderByIdDesc(collectiveCode)?.lastExpenseId ?: 0L
    }

    private fun calculateBalances(expenses: List<Expense>, members: List<String>): List<BalanceDto> {
        if (members.isEmpty()) return emptyList()
        val perMember = members.associateWith { 0.0 }.toMutableMap()
        val memberSet = members.toSet()

        expenses.forEach { expense ->
            val participants = (if (expense.participantNames.isEmpty()) memberSet else expense.participantNames).intersect(memberSet)
            if (participants.isEmpty()) return@forEach

            val split = expense.amount.toDouble() / participants.size.toDouble()
            participants.forEach { member ->
                perMember[member] = perMember.getValue(member) - split
            }
            perMember[expense.paidBy] =
                    perMember.getOrDefault(expense.paidBy, 0.0) + expense.amount.toDouble()
        }

        return perMember
                .map { (name, amount) -> BalanceDto(name = name, amount = amount.roundToInt()) }
                .sortedByDescending { it.amount }
    }

    private fun buildDrinkingQuestions(
            topPlayer: String,
            bottomPlayer: String,
    ): List<DrinkingQuestionDto> =
            listOf(
                    DrinkingQuestionDto(
                            "$topPlayer, som leaderboard-leder, del ut 3 slurker!",
                            "distribute",
                            topPlayer
                    ),
                    DrinkingQuestionDto(
                            "$bottomPlayer, du er sist på leaderboardet. Drikk 2!",
                            "drink",
                            bottomPlayer
                    ),
                    DrinkingQuestionDto(
                            "Alle som har glemt å tømme søppel denne uken drikker 2!",
                            "everyone",
                            null
                    ),
                    DrinkingQuestionDto(
                            "Pek på hvem som mest sannsynlig glemmer å handle. De drikker 1!",
                            "vote",
                            null
                    ),
                    DrinkingQuestionDto(
                            "Rock, paper, scissors mellom topp 2 på leaderboard. Taper drikker 3!",
                            "challenge",
                            null
                    ),
            )

    private fun TaskItem.toDto() =
            TaskDto(id, title, assignee, dueDate, category, completed, xp, recurring)
    private fun ShoppingItem.toDto() = ShoppingItemDto(id, item, addedBy, completed)
    private fun CalendarEvent.toDto() =
            EventDto(id, title, date, time, type, organizer, attendees, description)
    private fun ChatMessage.toDto() = MessageDto(id, sender, text, timestamp)
    private fun Member.toUserDto() = UserDto(id, name, collectiveCode)
    private fun Collective.toDto() = CollectiveDto(id, name, joinCode)
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
    private fun PantEntry.toDto() = PantEntryDto(id, bottles, amount, addedBy, date)
    private fun Achievement.toDto() =
            AchievementDto(id, title, description, icon, unlocked, progress, total)
}
