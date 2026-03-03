package com.kollekt.api.dto

import com.kollekt.domain.EventType
import com.kollekt.domain.TaskCategory
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

data class TaskDto(
        val id: Long,
        val title: String,
        val assignee: String,
        val dueDate: LocalDate,
        val category: TaskCategory,
        val completed: Boolean,
        val xp: Int,
        val recurring: Boolean,
)

data class CreateTaskRequest(
        val title: String,
        val assignee: String,
        val dueDate: LocalDate,
        val category: TaskCategory = TaskCategory.OTHER,
        val xp: Int = 10,
        val recurring: Boolean = false,
)

data class ShoppingItemDto(
        val id: Long,
        val item: String,
        val addedBy: String,
        val completed: Boolean,
)

data class CreateShoppingItemRequest(
        val item: String,
        val addedBy: String,
)

data class EventDto(
        val id: Long,
        val title: String,
        val date: LocalDate,
        val time: LocalTime,
        val type: EventType,
        val organizer: String,
        val attendees: Int,
        val description: String?,
)

data class CreateEventRequest(
        val title: String,
        val date: LocalDate,
        val time: LocalTime,
        val type: EventType = EventType.OTHER,
        val organizer: String,
        val attendees: Int = 1,
        val description: String? = null,
)

data class MessageDto(
        val id: Long,
        val sender: String,
        val text: String,
        val timestamp: LocalDateTime,
)

data class CreateMessageRequest(
        val sender: String,
        val text: String,
)

data class UserDto(
        val id: Long,
        val name: String,
        val collectiveCode: String?,
)

data class CreateUserRequest(
        val name: String,
)

data class LoginRequest(
        val name: String,
)

data class CollectiveDto(
        val id: Long,
        val name: String,
        val joinCode: String,
)

data class CreateCollectiveRequest(
        val name: String,
        val ownerUserId: Long,
)

data class JoinCollectiveRequest(
        val userId: Long,
        val joinCode: String,
)

data class CollectiveCodeDto(
        val joinCode: String,
)

data class ExpenseDto(
        val id: Long,
        val description: String,
        val amount: Int,
        val paidBy: String,
        val category: String,
        val date: LocalDate,
        val splitBetween: Int,
)

data class CreateExpenseRequest(
        val description: String,
        val amount: Int,
        val paidBy: String,
        val category: String,
        val date: LocalDate,
        val splitBetween: Int,
)

data class PantEntryDto(
        val id: Long,
        val bottles: Int,
        val amount: Int,
        val addedBy: String,
        val date: LocalDate,
)

data class CreatePantEntryRequest(
        val bottles: Int,
        val amount: Int,
        val addedBy: String,
        val date: LocalDate,
)

data class BalanceDto(
        val name: String,
        val amount: Int,
)

data class LeaderboardPlayerDto(
        val rank: Int,
        val name: String,
        val level: Int,
        val xp: Int,
        val tasksCompleted: Int,
        val streak: Int,
        val badges: List<String>,
)

data class AchievementDto(
        val id: Long,
        val title: String,
        val description: String,
        val icon: String,
        val unlocked: Boolean,
        val progress: Int?,
        val total: Int?,
)

data class DashboardResponse(
        val currentUserName: String,
        val currentUserXp: Int,
        val currentUserLevel: Int,
        val currentUserRank: Int,
        val upcomingTasks: List<TaskDto>,
        val upcomingEvents: List<EventDto>,
        val recentExpenses: List<ExpenseDto>,
)

data class WeeklyStatsDto(
        val totalTasks: Int,
        val totalXp: Int,
        val avgPerPerson: Int,
        val topContributor: String,
)

data class LeaderboardResponse(
        val players: List<LeaderboardPlayerDto>,
        val weeklyStats: WeeklyStatsDto,
)

data class PantSummaryDto(
        val currentAmount: Int,
        val goalAmount: Int,
        val entries: List<PantEntryDto>,
)

data class EconomySummaryDto(
        val expenses: List<ExpenseDto>,
        val balances: List<BalanceDto>,
        val pantSummary: PantSummaryDto,
)

data class DrinkingQuestionDto(
        val text: String,
        val type: String,
        val targetedPlayer: String?,
)
