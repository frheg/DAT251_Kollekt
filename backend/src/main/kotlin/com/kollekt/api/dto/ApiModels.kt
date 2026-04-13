package com.kollekt.api.dto

import com.kollekt.domain.EventType
import com.kollekt.domain.MemberStatus
import com.kollekt.domain.TaskCategory
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

data class TaskFeedbackDto(
    val id: Long,
    val author: String?,
    val message: String,
    val anonymous: Boolean,
    val imageData: String?,
    val imageMimeType: String?,
    val createdAt: LocalDateTime,
)

data class GiveTaskFeedbackRequest(
    val message: String = "",
    val anonymous: Boolean = false,
    val imageData: String? = null,
    val imageMimeType: String? = null,
)

enum class LeaderboardPeriod {
    OVERALL,
    YEAR,
    MONTH,
}

data class TaskDto(
    val id: Long,
    val title: String,
    val assignee: String,
    val dueDate: LocalDate,
    val category: TaskCategory,
    val completed: Boolean,
    val xp: Int,
    val recurrenceRule: String? = null,
    val penaltyXp: Int = 0,
    val feedbacks: List<TaskFeedbackDto> = emptyList(),
)

data class CreateTaskRequest(
    val title: String,
    val assignee: String,
    val dueDate: LocalDate,
    val category: TaskCategory = TaskCategory.OTHER,
    val xp: Int = 10,
    val recurrenceRule: String? = null,
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

data class UpdateShoppingItemRequest(
    val item: String,
)

data class MarkSupplyBoughtRequest(
    val amount: Int,
    val paidBy: String,
    val participantNames: List<String> = emptyList(),
    val date: LocalDate,
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
    val syncToGoogle: Boolean = false,
)

data class MessageDto(
    val id: Long,
    val sender: String,
    val text: String,
    val imageData: String? = null,
    val imageMimeType: String? = null,
    val imageFileName: String? = null,
    val timestamp: LocalDateTime,
    val reactions: List<ReactionDto> = emptyList(),
    val poll: PollDto? = null,
)

data class PollDto(
    val question: String,
    val options: List<PollOptionDto>,
)

data class PollOptionDto(
    val id: Int,
    val text: String,
    val users: List<String>,
)

data class CreatePollRequest(
    val question: String,
    val options: List<String>,
)

data class VotePollRequest(
    val optionId: Int,
)

data class CreateMessageRequest(
    val sender: String,
    val text: String,
)

data class UserDto(
    val id: Long,
    val name: String,
    val email: String = "",
    val collectiveCode: String?,
    val status: MemberStatus = MemberStatus.ACTIVE,
    val friends: List<FriendDto> = emptyList(),
)

data class FriendDto(
    val name: String,
)

data class CreateUserRequest(
    val name: String,
    val email: String,
    val password: String,
)

data class LoginRequest(
    val name: String,
    val password: String,
)

data class AuthResponse(
    val accessToken: String,
    val refreshToken: String,
    val tokenType: String,
    val expiresIn: Long,
    val user: UserDto,
)

data class RefreshTokenRequest(
    val refreshToken: String,
)

data class LogoutRequest(
    val refreshToken: String? = null,
)

data class CollectiveDto(
    val id: Long,
    val name: String,
    val joinCode: String,
)

data class CreateCollectiveRequest(
    val name: String,
    val ownerUserId: Long,
    val numRooms: Int,
    val residents: List<String>,
    val rooms: List<RoomRequest>,
)

data class RoomRequest(
    val name: String,
    val minutes: Int,
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
    val participantNames: List<String>,
)

data class CreateExpenseRequest(
    val description: String,
    val amount: Int,
    val paidBy: String,
    val category: String,
    val date: LocalDate,
    val participantNames: List<String> = emptyList(),
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
    val monthlyPrize: String? = null,
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

data class SettleUpRequest(
    val memberName: String,
)

data class SettleUpResponse(
    val collectiveCode: String,
    val settledBy: String,
    val lastExpenseId: Long,
    val settledAt: LocalDateTime,
)

data class DrinkingQuestionDto(
    val text: String,
    val type: String,
    val targetedPlayer: String?,
)

data class MonthlyPrizeRequest(
    val prize: String?,
)

data class ReactionDto(
    val emoji: String,
    val users: List<String>,
)

data class AddReactionRequest(
    val emoji: String,
)

data class RemoveReactionRequest(
    val emoji: String,
)
