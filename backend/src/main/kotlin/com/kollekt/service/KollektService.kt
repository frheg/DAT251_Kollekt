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
        private val taskRepository: TaskRepository,
        private val shoppingItemRepository: ShoppingItemRepository,
        private val eventRepository: EventRepository,
        private val chatMessageRepository: ChatMessageRepository,
        private val expenseRepository: ExpenseRepository,
        private val pantEntryRepository: PantEntryRepository,
        private val achievementRepository: AchievementRepository,
        private val redisTemplate: RedisTemplate<String, Any>,
        private val eventPublisher: IntegrationEventPublisher,
) {
    private val leaderboardKey = "leaderboard:global"

    fun getTasks(): List<TaskDto> =
            taskRepository.findAll().sortedBy { it.dueDate }.map { it.toDto() }

    @Transactional
    fun createTask(request: CreateTaskRequest): TaskDto {
        val saved =
                taskRepository.save(
                        TaskItem(
                                title = request.title,
                                assignee = request.assignee,
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
    fun toggleTask(taskId: Long): TaskDto {
        val task =
                taskRepository.findById(taskId).orElseThrow {
                    IllegalArgumentException("Task $taskId not found")
                }
        val updated = taskRepository.save(task.copy(completed = !task.completed))
        clearDashboardCache()
        clearLeaderboardCache()
        eventPublisher.taskEvent("TASK_TOGGLED", updated.toDto())
        return updated.toDto()
    }

    fun getShoppingItems(): List<ShoppingItemDto> =
            shoppingItemRepository.findAll().map { it.toDto() }

    @Transactional
    fun createShoppingItem(request: CreateShoppingItemRequest): ShoppingItemDto {
        val saved =
                shoppingItemRepository.save(
                        ShoppingItem(item = request.item, addedBy = request.addedBy)
                )
        eventPublisher.taskEvent("SHOPPING_ITEM_CREATED", saved.toDto())
        return saved.toDto()
    }

    @Transactional
    fun toggleShoppingItem(itemId: Long): ShoppingItemDto {
        val item =
                shoppingItemRepository.findById(itemId).orElseThrow {
                    IllegalArgumentException("Shopping item $itemId not found")
                }
        val updated = shoppingItemRepository.save(item.copy(completed = !item.completed))
        eventPublisher.taskEvent("SHOPPING_ITEM_TOGGLED", updated.toDto())
        return updated.toDto()
    }

    @Transactional
    fun deleteShoppingItem(itemId: Long) {
        shoppingItemRepository.deleteById(itemId)
        eventPublisher.taskEvent("SHOPPING_ITEM_DELETED", mapOf("id" to itemId))
    }

    fun getEvents(): List<EventDto> =
            eventRepository.findAll().sortedBy { it.date }.map { it.toDto() }

    @Transactional
    fun createEvent(request: CreateEventRequest): EventDto {
        val saved =
                eventRepository.save(
                        CalendarEvent(
                                title = request.title,
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

    fun getMessages(): List<MessageDto> =
            chatMessageRepository.findAll().sortedBy { it.timestamp }.map { it.toDto() }

    @Transactional
    fun createMessage(request: CreateMessageRequest): MessageDto {
        val saved =
                chatMessageRepository.save(
                        ChatMessage(
                                sender = request.sender,
                                text = request.text,
                                timestamp = LocalDateTime.now(),
                        ),
                )
        eventPublisher.chatEvent("MESSAGE_CREATED", saved.toDto())
        return saved.toDto()
    }

    fun getExpenses(): List<ExpenseDto> =
            expenseRepository.findAll().sortedByDescending { it.date }.map { it.toDto() }

    @Transactional
    fun createExpense(request: CreateExpenseRequest): ExpenseDto {
        val saved =
                expenseRepository.save(
                        Expense(
                                description = request.description,
                                amount = request.amount,
                                paidBy = request.paidBy,
                                category = request.category,
                                date = request.date,
                                splitBetween = request.splitBetween,
                        ),
                )
        clearDashboardCache()
        clearLeaderboardCache()
        eventPublisher.economyEvent("EXPENSE_CREATED", saved.toDto())
        return saved.toDto()
    }

    fun getBalances(): List<BalanceDto> {
        val expenses = expenseRepository.findAll()
        if (expenses.isEmpty()) return emptyList()

        val members = memberRepository.findAll().map { it.name }
        val perMember = mutableMapOf<String, Double>()
        members.forEach { perMember[it] = 0.0 }

        expenses.forEach { expense ->
            val split = expense.amount.toDouble() / expense.splitBetween.toDouble()
            members.take(expense.splitBetween).forEach { member ->
                perMember[member] = perMember.getValue(member) - split
            }
            perMember[expense.paidBy] =
                    perMember.getOrDefault(expense.paidBy, 0.0) + expense.amount.toDouble()
        }

        return perMember
                .map { (name, amount) -> BalanceDto(name = name, amount = amount.roundToInt()) }
                .sortedByDescending { it.amount }
    }

    fun getPantSummary(goal: Int = 1000): PantSummaryDto {
        val entries =
                pantEntryRepository.findAll().sortedByDescending { it.date }.map { it.toDto() }
        val current = entries.sumOf { it.amount }
        return PantSummaryDto(currentAmount = current, goalAmount = goal, entries = entries)
    }

    @Transactional
    fun addPantEntry(request: CreatePantEntryRequest): PantEntryDto {
        val saved =
                pantEntryRepository.save(
                        PantEntry(
                                bottles = request.bottles,
                                amount = request.amount,
                                addedBy = request.addedBy,
                                date = request.date,
                        ),
                )
        eventPublisher.economyEvent("PANT_ADDED", saved.toDto())
        return saved.toDto()
    }

    fun getEconomySummary(): EconomySummaryDto {
        return EconomySummaryDto(
                expenses = getExpenses(),
                balances = getBalances(),
                pantSummary = getPantSummary(),
        )
    }

    fun getLeaderboard(): LeaderboardResponse {
        val cached = redisTemplate.opsForValue().get(leaderboardKey)
        if (cached is LeaderboardResponse) return cached

        val tasks = taskRepository.findAll()
        val players =
                memberRepository.findAll().sortedByDescending { it.xp }.mapIndexed { index, member
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

        val user =
                memberRepository.findByName(memberName)
                        ?: memberRepository.findAll().firstOrNull()
                                ?: throw IllegalStateException("No members found")

        val leaderboard = getLeaderboard()
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
                                        .findAll()
                                        .filter { !it.completed }
                                        .sortedBy { it.dueDate }
                                        .take(3)
                                        .map { it.toDto() },
                        upcomingEvents =
                                eventRepository
                                        .findAll()
                                        .filter { it.date >= LocalDate.now() }
                                        .sortedBy { it.date }
                                        .take(3)
                                        .map { it.toDto() },
                        recentExpenses =
                                expenseRepository
                                        .findAll()
                                        .sortedByDescending { it.date }
                                        .take(3)
                                        .map { it.toDto() },
                )

        redisTemplate.opsForValue().set(key, response)
        return response
    }

    fun getDrinkingQuestion(): DrinkingQuestionDto {
        val leaderboard = getLeaderboard().players
        val topPlayer = leaderboard.firstOrNull()?.name ?: "Emma"
        val bottomPlayer = leaderboard.lastOrNull()?.name ?: "Kasper"

        val questions =
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

        return questions[Random.nextInt(questions.size)]
    }

    private fun clearDashboardCache() {
        val keys = redisTemplate.keys("dashboard:*")
        if (!keys.isNullOrEmpty()) {
            redisTemplate.delete(keys)
        }
    }

    private fun clearLeaderboardCache() {
        redisTemplate.delete(leaderboardKey)
    }

    private fun TaskItem.toDto() =
            TaskDto(id, title, assignee, dueDate, category, completed, xp, recurring)
    private fun ShoppingItem.toDto() = ShoppingItemDto(id, item, addedBy, completed)
    private fun CalendarEvent.toDto() =
            EventDto(id, title, date, time, type, organizer, attendees, description)
    private fun ChatMessage.toDto() = MessageDto(id, sender, text, timestamp)
    private fun Expense.toDto() =
            ExpenseDto(id, description, amount, paidBy, category, date, splitBetween)
    private fun PantEntry.toDto() = PantEntryDto(id, bottles, amount, addedBy, date)
    private fun Achievement.toDto() =
            AchievementDto(id, title, description, icon, unlocked, progress, total)
}
