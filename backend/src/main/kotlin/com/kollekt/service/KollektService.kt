@file:Suppress("ktlint:standard:no-wildcard-imports")

package com.kollekt.service

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.kollekt.api.dto.*
import com.kollekt.domain.*
import com.kollekt.repository.*
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.Base64
import kotlin.math.roundToInt
import kotlin.random.Random

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
    private val realtimeUpdateService: RealtimeUpdateService,
    private val passwordEncoder: PasswordEncoder,
    private val tokenService: TokenService,
    private val invitationRepository: InvitationRepository,
    private val roomRepository: RoomRepository,
    private val notificationService: NotificationService,
) {
    private val objectMapper = jacksonObjectMapper()
    private val allowedReactionEmojis = setOf("👍", "❤️", "😂", "🎉", "😮")
    private val maxChatImageBytes = 5 * 1024 * 1024L
    private val joinCodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

    @Autowired(required = false)
    private lateinit var invitationRealtimeService: InvitationRealtimeService

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
    fun notifyUpcomingTaskDeadlines() {
        val reminderDate = LocalDate.now().plusDays(reminderDaysBeforeDue)
        val tasksDueSoon =
            taskRepository.findAll()
                .filter { !it.completed && it.dueDate == reminderDate }
        for (task in tasksDueSoon) {
            // Send notification to assignee (real-time and persistent)
            realtimeUpdateService.publish(
                task.collectiveCode ?: "",
                "TASK_DEADLINE_SOON",
                mapOf(
                    "assignee" to task.assignee,
                    "taskId" to task.id,
                    "title" to task.title,
                    "dueDate" to task.dueDate.toString(),
                ),
            )
            notificationService.createCustomNotification(
                userName = task.assignee,
                message = "Your task '${task.title}' is due in $reminderDaysBeforeDue day(s).",
                type = "TASK_DEADLINE_SOON",
            )
        }
    }

    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    fun deleteExpiredTasks() {
        val thresholdDate = LocalDate.now().minusDays(5)
        val expiredTasks =
            taskRepository.findAll()
                .filter { !it.completed && it.dueDate.isBefore(thresholdDate) }
        if (expiredTasks.isNotEmpty()) {
            taskRepository.deleteAll(expiredTasks)
        }
    }

    fun getTasks(memberName: String): List<TaskDto> {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        return taskRepository.findAllByCollectiveCode(collectiveCode)
            .sortedBy { it.dueDate }
            .map { it.toDto() }
    }

    @Transactional
    fun createTask(
        request: CreateTaskRequest,
        actorName: String,
    ): TaskDto {
        val collectiveCode = requireCollectiveCodeByMemberName(actorName)

        if (memberRepository.findByNameAndCollectiveCode(request.assignee, collectiveCode) == null) {
            throw IllegalArgumentException("Assignee '${request.assignee}' is not in your collective")
        }

        val normalizedRule = normalizeRecurrenceRule(request.recurrenceRule)

        val saved =
            taskRepository.save(
                TaskItem(
                    title = request.title,
                    assignee = request.assignee,
                    collectiveCode = collectiveCode,
                    dueDate = request.dueDate,
                    category = request.category,
                    xp = request.xp,
                    recurrenceRule = normalizedRule,
                    recurring = isRecurringTask(normalizedRule),
                ),
            )

        // Create notification for assignee
        notificationService.createTaskAssignedNotification(request.assignee, request.title)

        clearDashboardCache()
        clearLeaderboardCache()
        eventPublisher.taskEvent("TASK_CREATED", saved.toDto())
        realtimeUpdateService.publish(collectiveCode, "TASK_CREATED", saved.toDto())

        return saved.toDto()
    }

    @Transactional
    fun deleteTask(
        taskId: Long,
        memberName: String,
    ) {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        taskRepository.findByIdAndCollectiveCodeForUpdate(taskId, collectiveCode)
            ?: throw IllegalArgumentException("Task $taskId not found")

        taskRepository.deleteById(taskId)
        clearDashboardCache()
        clearLeaderboardCache()
        eventPublisher.taskEvent("TASK_DELETED", mapOf("id" to taskId))
        realtimeUpdateService.publish(collectiveCode, "TASK_DELETED", mapOf("id" to taskId))
    }

    @Transactional
    fun giveTaskFeedback(
        taskId: Long,
        memberName: String,
        feedback: String,
    ): TaskDto {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val task =
            taskRepository.findByIdAndCollectiveCodeForUpdate(taskId, collectiveCode)
                ?: throw IllegalArgumentException("Task $taskId not found")

        val updated = task.copy(assignmentFeedback = feedback)
        val saved = taskRepository.save(updated)

        clearDashboardCache()
        clearLeaderboardCache()
        eventPublisher.taskEvent("TASK_FEEDBACK_UPDATED", saved.toDto())
        realtimeUpdateService.publish(collectiveCode, "TASK_FEEDBACK_UPDATED", saved.toDto())

        return saved.toDto()
    }

    @Transactional
    fun updateTask(
        taskId: Long,
        updates: Map<String, Any>,
        memberName: String,
    ): TaskDto {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val task =
            taskRepository.findByIdAndCollectiveCodeForUpdate(taskId, collectiveCode)
                ?: throw IllegalArgumentException("Task $taskId not found")

        val newTitle = updates["title"] as? String ?: task.title
        val newAssignee = updates["assignee"] as? String ?: task.assignee
        val newDueDate = (updates["dueDate"] as? String)?.let { LocalDate.parse(it) } ?: task.dueDate

        val newCategory =
            (updates["category"] as? String)?.let {
                try {
                    TaskCategory.valueOf(it.uppercase())
                } catch (_: Exception) {
                    task.category
                }
            } ?: task.category

        val newXp = (updates["xp"] as? Number)?.toInt() ?: task.xp

        val recurringExplicit = updates["recurring"] as? Boolean
        val recurrenceRuleExplicit = updates["recurrenceRule"] as? String

        val newRecurrenceRule =
            when {
                recurrenceRuleExplicit != null ->
                    normalizeRecurrenceRule(recurrenceRuleExplicit)

                recurringExplicit == false ->
                    null

                recurringExplicit == true ->
                    normalizeRecurrenceRule(task.recurrenceRule, recurringFallback = true)

                else ->
                    normalizeRecurrenceRule(task.recurrenceRule)
            }

        val newRecurring = isRecurringTask(newRecurrenceRule)

        if (memberRepository.findByNameAndCollectiveCode(newAssignee, collectiveCode) == null) {
            throw IllegalArgumentException("Assignee '$newAssignee' is not in your collective")
        }

        val saved =
            taskRepository.save(
                task.copy(
                    title = newTitle,
                    assignee = newAssignee,
                    dueDate = newDueDate,
                    category = newCategory,
                    xp = newXp,
                    recurrenceRule = newRecurrenceRule,
                    recurring = newRecurring,
                ),
            )

        clearDashboardCache()
        clearLeaderboardCache()
        eventPublisher.taskEvent("TASK_UPDATED", saved.toDto())
        realtimeUpdateService.publish(collectiveCode, "TASK_UPDATED", saved.toDto())

        return saved.toDto()
    }

    @Transactional
    fun toggleTask(
        taskId: Long,
        memberName: String,
    ): TaskDto {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val task =
            taskRepository.findByIdAndCollectiveCodeForUpdate(taskId, collectiveCode)
                ?: throw IllegalArgumentException("Task $taskId not found")

        val awardedXp =
            if (!task.completed && !task.xpAwarded && memberName == task.assignee) task.xp else 0

        if (awardedXp > 0) {
            val member =
                memberRepository.findByNameAndCollectiveCode(memberName, collectiveCode)
                    ?: throw IllegalArgumentException("User '$memberName' not found in collective")

            val updatedXp = member.xp + awardedXp
            val updatedLevel = updatedXp / 200 + 1

            memberRepository.save(
                member.copy(
                    xp = updatedXp,
                    level = updatedLevel,
                ),
            )
        }

        val updated =
            if (!task.completed) {
                taskRepository.save(
                    task.copy(
                        completed = true,
                        xpAwarded = (memberName == task.assignee),
                        completedBy = memberName,
                        completedAt = LocalDateTime.now(),
                    ),
                )
            } else {
                taskRepository.save(
                    task.copy(
                        completed = false,
                        completedBy = null,
                        completedAt = null,
                        xpAwarded = false,
                    ),
                )
            }

        clearDashboardCache()
        clearLeaderboardCache()
        eventPublisher.taskEvent("TASK_TOGGLED", updated.toDto())
        realtimeUpdateService.publish(
            collectiveCode,
            "TASK_UPDATED",
            mapOf(
                "task" to updated.toDto(),
                "awardedXp" to awardedXp,
                "updatedBy" to memberName,
            ),
        )

        if (awardedXp > 0) {
            val updatedMember = memberRepository.findByNameAndCollectiveCode(memberName, collectiveCode)
            realtimeUpdateService.publish(
                collectiveCode,
                "XP_UPDATED",
                mapOf(
                    "memberName" to memberName,
                    "awardedXp" to awardedXp,
                    "totalXp" to (updatedMember?.xp ?: 0),
                    "level" to (updatedMember?.level ?: 1),
                    "taskId" to taskId,
                ),
            )
        }

        return updated.toDto()
    }

    @Transactional
    fun regretTask(
        taskId: Long,
        memberName: String,
    ): TaskDto {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val task =
            taskRepository.findByIdAndCollectiveCodeForUpdate(taskId, collectiveCode)
                ?: throw IllegalArgumentException("Task $taskId not found")
        if (task.completed) throw IllegalStateException("Task already completed")

        // Example penalty logic: reduce XP by 50% for late completion
        val penaltyXp = (task.xp / 2).coerceAtLeast(1)
        val updated =
            task.copy(
                completed = true,
                xp = penaltyXp,
                completedBy = memberName,
                completedAt = LocalDateTime.now(),
                xpAwarded = true,
            )
        val saved = taskRepository.save(updated)

        // Optionally, create a notification for late completion
        notificationService.createCustomNotification(
            userName = memberName,
            message = "Du fullførte oppgaven '${task.title}' for sent. XP er redusert.",
            type = "TASK_COMPLETED_LATE",
        )

        clearDashboardCache()
        clearLeaderboardCache()
        eventPublisher.taskEvent("TASK_COMPLETED_LATE", saved.toDto())
        realtimeUpdateService.publish(collectiveCode, "TASK_COMPLETED_LATE", saved.toDto())

        return saved.toDto()
    }

    @Transactional
    fun deleteUser(memberName: String) {
        val member =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")

        val collectiveCode = member.collectiveCode
        memberRepository.delete(member)

        if (collectiveCode != null) {
            val remainingMembers =
                memberRepository.findAllByCollectiveCode(collectiveCode)
                    .filter { it.name != memberName }

            val memberNames = remainingMembers.map { it.name }.sorted()

            if (memberNames.isNotEmpty()) {
                val tasksToReassign =
                    taskRepository.findAllByCollectiveCode(collectiveCode)
                        .filter { it.assignee == memberName && !it.completed }

                // Build a map of current uncompleted task counts and total XP per member
                val uncompletedTasks =
                    taskRepository.findAllByCollectiveCode(collectiveCode)
                        .filter { !it.completed && it.assignee in memberNames }

                data class MemberLoad(val count: Int, val xp: Int)
                val memberLoad =
                    memberNames.associateWith { m ->
                        MemberLoad(
                            count = uncompletedTasks.count { it.assignee == m },
                            xp = uncompletedTasks.filter { it.assignee == m }.sumOf { it.xp },
                        )
                    }.toMutableMap()

                for (task in tasksToReassign) {
                    // Find the member with the lowest (task count, then xp)
                    val newAssignee =
                        memberLoad.entries.minWithOrNull(
                            compareBy<Map.Entry<String, MemberLoad>> { it.value.count }.thenBy { it.value.xp },
                        )?.key ?: memberNames.first()
                    taskRepository.save(task.copy(assignee = newAssignee))
                    val prev = memberLoad[newAssignee] ?: MemberLoad(0, 0)
                    memberLoad[newAssignee] = MemberLoad(prev.count + 1, prev.xp + (task.xp))
                }
            }
        }
    }

    @Transactional
    fun leaveCollective(memberName: String) {
        val member =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")
        if (member.collectiveCode == null) return
        // Optionally reassign tasks as in deleteUser
        val collectiveCode = member.collectiveCode
        memberRepository.save(member.copy(collectiveCode = null))
        if (collectiveCode != null) {
            val remainingMembers =
                memberRepository.findAllByCollectiveCode(collectiveCode)
                    .filter { it.name != memberName }

            val memberNames = remainingMembers.map { it.name }.sorted()

            if (memberNames.isNotEmpty()) {
                val tasksToReassign =
                    taskRepository.findAllByCollectiveCode(collectiveCode)
                        .filter { it.assignee == memberName && !it.completed }

                // Build a map of current uncompleted task counts and total XP per member
                val uncompletedTasks =
                    taskRepository.findAllByCollectiveCode(collectiveCode)
                        .filter { !it.completed && it.assignee in memberNames }

                data class MemberLoad(val count: Int, val xp: Int)
                val memberLoad =
                    memberNames.associateWith { m ->
                        MemberLoad(
                            count = uncompletedTasks.count { it.assignee == m },
                            xp = uncompletedTasks.filter { it.assignee == m }.sumOf { it.xp },
                        )
                    }.toMutableMap()

                for (task in tasksToReassign) {
                    // Find the member with the lowest (task count, then xp)
                    val newAssignee =
                        memberLoad.entries.minWithOrNull(
                            compareBy<Map.Entry<String, MemberLoad>> { it.value.count }.thenBy { it.value.xp },
                        )?.key ?: memberNames.first()
                    taskRepository.save(task.copy(assignee = newAssignee))
                    val prev = memberLoad[newAssignee] ?: MemberLoad(0, 0)
                    memberLoad[newAssignee] = MemberLoad(prev.count + 1, prev.xp + (task.xp))
                }
            }
        }
    }

    @Scheduled(cron = "0 0 4 * * *")
    fun penalizeMissedTasks() {
        val today = LocalDate.now()
        val overdueTasks =
            taskRepository.findAll()
                .filter { !it.completed && it.dueDate.isBefore(today) }
        for (task in overdueTasks) {
            val member = memberRepository.findByNameAndCollectiveCode(task.assignee, task.collectiveCode ?: "")
            if (member != null) {
                val penalty = -kotlin.math.abs(task.xp)
                // Only subtract if not already penalized
                if (task.penaltyXp == 0) {
                    memberRepository.save(member.copy(xp = member.xp + penalty))
                    taskRepository.save(task.copy(penaltyXp = penalty))
                    // Notify user about penalty and late approval option (real-time and persistent)
                    realtimeUpdateService.publish(
                        task.collectiveCode ?: "",
                        "TASK_PENALTY_APPLIED",
                        mapOf(
                            "assignee" to task.assignee,
                            "taskId" to task.id,
                            "title" to task.title,
                            "dueDate" to task.dueDate.toString(),
                            "penaltyXp" to penalty,
                            "lateApprovalAvailable" to true,
                        ),
                    )
                    notificationService.createCustomNotification(
                        userName = task.assignee,
                        message = "Your task '${task.title}' is overdue! A penalty has been applied.",
                        type = "TASK_OVERDUE",
                    )
                    // Notify all ACTIVE members in the collective (except assignee)
                    val collectiveCode = task.collectiveCode ?: ""
                    val activeMembers =
                        memberRepository.findAllByCollectiveCode(collectiveCode)
                            .filter { it.status == MemberStatus.ACTIVE && it.name != task.assignee }
                            .map { it.name }
                    if (activeMembers.isNotEmpty()) {
                        notificationService.createGroupNotification(
                            userNames = activeMembers,
                            message = "Task '${task.title}' assigned to ${task.assignee} is overdue and not completed.",
                            type = "TASK_OVERDUE_GROUP",
                        )
                    }
                } else if (task.penaltyXp != penalty) {
                    // If penaltyXp was changed, adjust member XP accordingly
                    val diff = penalty - task.penaltyXp
                    memberRepository.save(member.copy(xp = member.xp + diff))
                    taskRepository.save(task.copy(penaltyXp = penalty))
                }
            }
        }
    }

    @Transactional
    fun regretMissedTask(
        taskId: Long,
        memberName: String,
    ): TaskDto {
        val task =
            taskRepository.findById(taskId).orElse(null)
                ?: throw IllegalArgumentException("Task $taskId not found")
        if (task.assignee != memberName) throw IllegalArgumentException("Not your task")
        if (task.completed) throw IllegalArgumentException("Task already marked as completed")
        if (task.penaltyXp == 0) throw IllegalArgumentException("No penalty to regret")

        // Award only half XP for late completion, remove penalty
        val member =
            memberRepository.findByNameAndCollectiveCode(memberName, task.collectiveCode ?: "")
                ?: throw IllegalArgumentException("User '$memberName' not found in collective")
        val halfXp = (task.xp / 2.0).roundToInt()
        // Remove penalty, add half XP
        memberRepository.save(member.copy(xp = member.xp - task.penaltyXp + halfXp))
        val updated =
            taskRepository.save(
                task.copy(
                    completed = true,
                    completedBy = memberName,
                    completedAt = LocalDateTime.now(),
                    penaltyXp = 0,
                    xpAwarded = true,
                ),
            )
        clearDashboardCache()
        clearLeaderboardCache()
        eventPublisher.taskEvent("TASK_REGRET", updated.toDto())
        realtimeUpdateService.publish(task.collectiveCode ?: "", "TASK_REGRET", updated.toDto())
        return updated.toDto()
    }

    @Transactional
    fun updateMemberStatus(
        memberName: String,
        newStatus: MemberStatus,
    ) {
        val member =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")

        memberRepository.save(member.copy(status = newStatus))

        // Always redistribute tasks if the member is in a collective and their status changes
        if (member.collectiveCode != null && member.status != newStatus) {
            regenerateRecurringTasksForCollective(member.collectiveCode)
        }
    }

    @Transactional
    fun addFriend(
        memberName: String,
        friendName: String,
    ) {
        if (memberName == friendName) {
            throw IllegalArgumentException("Cannot add yourself as a friend")
        }

        memberRepository.findByName(memberName)
            ?: throw IllegalArgumentException("User '$memberName' not found")
        memberRepository.findByName(friendName)
            ?: throw IllegalArgumentException("Friend '$friendName' not found")

        val friends = friendsMap.getOrPut(memberName) { mutableSetOf() }
        if (!friends.add(friendName)) {
            throw IllegalArgumentException("'$friendName' is already a friend")
        }
    }

    @Transactional
    fun removeFriend(
        memberName: String,
        friendName: String,
    ) {
        val friends =
            friendsMap[memberName]
                ?: throw IllegalArgumentException("No friends found for '$memberName'")

        if (!friends.remove(friendName)) {
            throw IllegalArgumentException("'$friendName' is not a friend")
        }
    }

    @Transactional
    fun createUser(request: CreateUserRequest): AuthResponse {
        val name = request.name.trim()
        val email = request.email.trim().lowercase()
        val password = request.password.trim()

        if (name.isBlank()) throw IllegalArgumentException("Name is required")
        if (email.isBlank()) throw IllegalArgumentException("Email is required")
        if (password.length < 8) throw IllegalArgumentException("Password must be at least 8 characters")

        if (memberRepository.findByName(name) != null) {
            throw IllegalArgumentException("User with name '$name' already exists")
        }

        if (memberRepository.findAll().any { it.email == email }) {
            throw IllegalArgumentException("User with email '$email' already exists")
        }

        val saved =
            memberRepository.save(
                Member(
                    name = name,
                    email = email,
                    passwordHash = passwordEncoder.encode(password),
                ),
            )

        clearDashboardCache()
        clearLeaderboardCache()
        return toAuthResponse(saved)
    }

    @Transactional
    fun resetPassword(
        memberName: String?,
        email: String?,
        newPassword: String,
    ) {
        val member =
            when {
                !email.isNullOrBlank() ->
                    memberRepository.findAll()
                        .find { it.email.equals(email.trim(), ignoreCase = true) }

                !memberName.isNullOrBlank() ->
                    memberRepository.findByName(memberName.trim())

                else -> null
            } ?: throw IllegalArgumentException("User not found")

        memberRepository.save(member.copy(passwordHash = passwordEncoder.encode(newPassword)))
    }

    fun login(request: LoginRequest): AuthResponse {
        val name = request.name.trim()
        val password = request.password.trim()

        if (name.isBlank()) throw IllegalArgumentException("Name is required")
        if (password.isBlank()) throw IllegalArgumentException("Password is required")

        val user =
            memberRepository.findByName(name)
                ?: throw IllegalArgumentException("User '$name' not found")

        val hash =
            user.passwordHash
                ?: throw IllegalArgumentException("User '$name' has no password configured")

        if (!passwordEncoder.matches(password, hash)) {
            throw IllegalArgumentException("Invalid name or password")
        }

        return toAuthResponse(user)
    }

    fun getUserByName(name: String): UserDto {
        val user =
            memberRepository.findByName(name)
                ?: throw IllegalArgumentException("User '$name' not found")
        return user.toUserDto()
    }

    fun refreshToken(request: RefreshTokenRequest): AuthResponse {
        val refreshResult = tokenService.rotateRefreshToken(request.refreshToken)
        val user =
            memberRepository.findByName(refreshResult.subject)
                ?: throw IllegalArgumentException("User '${refreshResult.subject}' not found")
        return toAuthResponse(user)
    }

    fun logout(
        accessTokenJwt: Jwt,
        refreshToken: String?,
    ) {
        tokenService.revokeAccessToken(accessTokenJwt)
        if (!refreshToken.isNullOrBlank()) {
            tokenService.revokeRefreshToken(refreshToken)
        }
    }

    // -------------------------------------------------------------------------
    // Collective
    // -------------------------------------------------------------------------

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
        request.rooms.forEach { roomReq ->
            roomRepository.save(
                Room(
                    name = roomReq.name,
                    minutes = roomReq.minutes,
                    collective = collective,
                ),
            )
        }

        memberRepository.save(owner.copy(collectiveCode = joinCode))

        val residentNames =
            request.residents
                .map { it.trim() }
                .filter { it.isNotBlank() && it != owner.name }

        residentNames.forEach { name ->
            val existing = memberRepository.findByName(name)
            if (existing == null) {
                memberRepository.save(
                    Member(
                        name = name,
                        email = "${name.lowercase()}@example.com",
                        collectiveCode = joinCode,
                    ),
                )
            } else if (existing.collectiveCode == null) {
                memberRepository.save(existing.copy(collectiveCode = joinCode))
            }
        }

        val allResidents = listOf(owner.name) + residentNames
        val today = LocalDate.now()
        val numMembers = allResidents.size

        fun nextSunday(from: LocalDate): LocalDate {
            val daysUntilSunday = (7 - from.dayOfWeek.value) % 7
            return from.plusDays(daysUntilSunday.toLong())
        }

        val onboardingDueDate = nextSunday(today)

        // Only create onboarding tasks for the first week
        for ((roomIdx, room) in request.rooms.withIndex()) {
            val assigneeIdx = roomIdx % numMembers
            val assignee = allResidents[assigneeIdx]
            val dueDate = onboardingDueDate
            taskRepository.save(
                TaskItem(
                    title = "Vask ${room.name}",
                    assignee = assignee,
                    collectiveCode = joinCode,
                    dueDate = dueDate,
                    category = TaskCategory.CLEANING,
                    xp = room.minutes,
                    recurrenceRule = "WEEKLY",
                ),
            )
        }

        clearDashboardCache()
        clearLeaderboardCache()
        return collective.toDto()
    }

    private fun regenerateRecurringTasksForCollective(collectiveCode: String) {
        val members =
            memberRepository.findAllByCollectiveCode(collectiveCode)
                .filter { it.status == MemberStatus.ACTIVE }
        if (members.isEmpty()) return
        val collective = collectiveRepository.findByJoinCode(collectiveCode) ?: return
        val memberNames = members.map { it.name }.sorted()

        // Gather all recurring tasks to be assigned for the next period
        val allRecurringTasks =
            taskRepository.findAllByCollectiveCode(collectiveCode)
                .filter { isRecurringTask(it.recurrenceRule) }
        val groupedTasks = allRecurringTasks.groupBy { Pair(it.title, normalizeRecurrenceRule(it.recurrenceRule) ?: "WEEKLY") }

        // Build a list of (template, nextDueDate, lastAssignee) for all tasks to assign this week
        data class TaskTemplate(
            val title: String,
            val recurrenceRule: String,
            val category: TaskCategory,
            val xp: Int,
            val template: TaskItem,
            val nextDueDate: java.time.LocalDate,
            val lastAssignee: String?,
        )
        val tasksToAssign = mutableListOf<TaskTemplate>()
        for ((key, tasks) in groupedTasks) {
            val (title, recurrenceRule) = key
            val template = tasks.maxByOrNull { it.dueDate } ?: continue
            val lastDueDate = template.dueDate
            val nextDueDate =
                when (recurrenceRule.uppercase()) {
                    "WEEKLY" -> lastDueDate.plusWeeks(1)
                    "MONTHLY" -> lastDueDate.plusMonths(1)
                    else -> lastDueDate.plusWeeks(1)
                }
            // Remove any uncompleted future tasks for this title/recurrenceRule/collective/nextDueDate
            allRecurringTasks.filter {
                it.title == title &&
                    (normalizeRecurrenceRule(it.recurrenceRule) ?: "WEEKLY") == recurrenceRule &&
                    !it.completed &&
                    it.dueDate == nextDueDate
            }.forEach { taskRepository.deleteById(it.id) }
            val lastAssignee = template.assignee
            tasksToAssign.add(TaskTemplate(title, recurrenceRule, template.category, template.xp, template, nextDueDate, lastAssignee))
        }

        val numMembers = memberNames.size
        val numTasks = tasksToAssign.size
        val assignments = mutableMapOf<String, String>() // taskTitle::recurrenceRule -> assignee

        if (numMembers > 0 && numTasks > 0) {
            // If tasks == members, do strict round-robin
            if (numMembers == numTasks) {
                // Sort both lists to ensure deterministic rotation
                val sortedTasks = tasksToAssign.sortedBy { it.title + it.recurrenceRule }
                val lastAssignees = sortedTasks.map { it.lastAssignee }
                // Rotate members so no one gets same task as last week
                var rotatedMembers = memberNames.toList()
                // Try all rotations to avoid repeat
                for (shift in 0 until numMembers) {
                    val candidate = rotatedMembers
                    if (candidate.zip(lastAssignees).all { (m, last) -> m != last }) {
                        break
                    }
                    rotatedMembers = rotatedMembers.drop(1) + rotatedMembers.first()
                }
                for ((task, assignee) in sortedTasks.zip(rotatedMembers)) {
                    assignments[task.title + "::" + task.recurrenceRule] = assignee
                }
            } else {
                // Not a perfect match: distribute as evenly as possible, avoid repeats
                val availableMembers = memberNames.toMutableList()
                val shuffledTasks = tasksToAssign.shuffled()
                val memberTaskCounts = mutableMapOf<String, Int>().withDefault { 0 }
                for (task in shuffledTasks) {
                    val candidates = memberNames.filter { it != task.lastAssignee }
                    // Prefer members with fewest tasks so far
                    val minCount = candidates.minOfOrNull { memberTaskCounts.getValue(it) } ?: 0
                    val leastLoaded = candidates.filter { memberTaskCounts.getValue(it) == minCount }
                    val assignee =
                        leastLoaded.randomOrNull()
                            ?: memberNames.minByOrNull { memberTaskCounts.getValue(it) }
                            ?: memberNames.first()
                    assignments[task.title + "::" + task.recurrenceRule] = assignee
                    memberTaskCounts[assignee] = memberTaskCounts.getValue(assignee) + 1
                }
            }
        }

        // Save the assignments
        for (task in tasksToAssign) {
            val assignee = assignments[task.title + "::" + task.recurrenceRule] ?: memberNames.first()
            taskRepository.save(
                TaskItem(
                    title = task.title,
                    assignee = assignee,
                    collectiveCode = collectiveCode,
                    dueDate = task.nextDueDate,
                    category = task.category,
                    xp = task.xp,
                    recurring = true,
                    recurrenceRule = task.recurrenceRule,
                ),
            )
        }

        clearDashboardCache()
        clearLeaderboardCache()
    }

    @Scheduled(cron = "0 0 3 * * MON")
    fun scheduledWeeklyTaskRotation() {
        val allCollectives = collectiveRepository.findAll()
        for (collective in allCollectives) {
            regenerateRecurringTasksForCollective(collective.joinCode)
        }
    }

    @Transactional
    fun joinCollective(request: JoinCollectiveRequest): UserDto {
        val joinCode = request.joinCode.trim().uppercase()
        if (joinCode.isBlank()) {
            throw IllegalArgumentException("Join code is required")
        }

        val collective =
            collectiveRepository.findByJoinCode(joinCode)
                ?: throw IllegalArgumentException("Collective code '$joinCode' not found")

        val user =
            memberRepository.findById(request.userId).orElseThrow {
                IllegalArgumentException("User ${request.userId} not found")
            }

        if (user.collectiveCode != null) {
            throw IllegalArgumentException("User '${user.name}' is already in a collective")
        }

        val updated = memberRepository.save(user.copy(collectiveCode = collective.joinCode))

        val invitation =
            invitationRepository.findByEmailAndCollectiveCode(
                updated.email.trim().lowercase(),
                joinCode,
            )

        if (invitation != null && !invitation.accepted) {
            invitationRepository.save(
                invitation.copy(
                    accepted = true,
                    acceptedAt = LocalDateTime.now(),
                ),
            )
        }

        // Reassign all uncompleted recurring tasks for today and future
        val today = LocalDate.now()
        val allRecurringTasks =
            taskRepository.findAllByCollectiveCode(joinCode)
                .filter {
                    isRecurringTask(it.recurrenceRule) &&
                        !it.completed &&
                        !it.dueDate.isBefore(today)
                }

        val members =
            memberRepository.findAllByCollectiveCode(joinCode)
                .filter { it.status == MemberStatus.ACTIVE }

        val memberNames = members.map { it.name }.sorted()

        if (allRecurringTasks.isNotEmpty() && memberNames.isNotEmpty()) {
            val sortedTasks = allRecurringTasks.sortedWith(compareBy({ it.dueDate }, { it.title }))

            for ((i, task) in sortedTasks.withIndex()) {
                val assignee = memberNames[i % memberNames.size]
                if (task.assignee != assignee) {
                    taskRepository.save(task.copy(assignee = assignee))
                }
            }
        }

        clearDashboardCache()
        clearLeaderboardCache()

        // Rebuild recurring tasks fairly after the new member joins
        regenerateRecurringTasksForCollective(joinCode)

        return updated.toUserDto()
    }

    fun inviteUserToCollective(
        email: String,
        collectiveCode: String,
        inviterName: String,
    ) {
        val inviter =
            memberRepository.findByName(inviterName)
                ?: throw IllegalArgumentException("Inviter not found")

        if (inviter.collectiveCode != collectiveCode) {
            throw IllegalArgumentException("You are not a member of this collective")
        }

        val normalizedEmail = email.trim().lowercase()
        val existing = invitationRepository.findByEmailAndCollectiveCode(normalizedEmail, collectiveCode)
        if (existing != null) {
            throw IllegalArgumentException("This user has already been invited to this collective.")
        }

        val invitation =
            invitationRepository.save(
                Invitation(
                    email = normalizedEmail,
                    collectiveCode = collectiveCode,
                    invitedBy = inviter.name,
                ),
            )

        try {
            invitationRealtimeService.publish(normalizedEmail, "INVITATION_CREATED", invitation)
        } catch (_: Exception) {
        }

        println("[INVITE] Sent invite to $email for collective $collectiveCode (invited by ${inviter.name})")
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
        return memberRepository.findAllByCollectiveCode(collectiveCode)
            .sortedBy { it.name }
            .map { it.toUserDto() }
    }

    // -------------------------------------------------------------------------
    // Shopping
    // -------------------------------------------------------------------------

    fun getShoppingItems(memberName: String): List<ShoppingItemDto> {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        return shoppingItemRepository.findAllByCollectiveCode(collectiveCode).map { it.toDto() }
    }

    @Transactional
    fun createShoppingItem(
        request: CreateShoppingItemRequest,
        actorName: String,
    ): ShoppingItemDto {
        val collectiveCode = requireCollectiveCodeByMemberName(actorName)
        val saved =
            shoppingItemRepository.save(
                ShoppingItem(
                    item = request.item,
                    addedBy = actorName,
                    collectiveCode = collectiveCode,
                ),
            )
        eventPublisher.taskEvent("SHOPPING_ITEM_CREATED", saved.toDto())
        return saved.toDto()
    }

    @Transactional
    fun toggleShoppingItem(
        itemId: Long,
        memberName: String,
    ): ShoppingItemDto {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val item =
            shoppingItemRepository.findByIdAndCollectiveCode(itemId, collectiveCode)
                ?: throw IllegalArgumentException("Shopping item $itemId not found")

        val updated = shoppingItemRepository.save(item.copy(completed = !item.completed))
        eventPublisher.taskEvent("SHOPPING_ITEM_TOGGLED", updated.toDto())
        return updated.toDto()
    }

    @Transactional
    fun deleteShoppingItem(
        itemId: Long,
        memberName: String,
    ) {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val item =
            shoppingItemRepository.findByIdAndCollectiveCode(itemId, collectiveCode)
                ?: throw IllegalArgumentException("Shopping item $itemId not found")

        shoppingItemRepository.deleteById(item.id)
        eventPublisher.taskEvent("SHOPPING_ITEM_DELETED", mapOf("id" to itemId))
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    fun getEvents(memberName: String): List<EventDto> {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        return eventRepository.findAllByCollectiveCode(collectiveCode)
            .sortedBy { it.date }
            .map { it.toDto() }
    }

    @Transactional
    fun createEvent(
        request: CreateEventRequest,
        actorName: String,
    ): EventDto {
        val collectiveCode = requireCollectiveCodeByMemberName(actorName)
        val saved =
            eventRepository.save(
                CalendarEvent(
                    title = request.title,
                    collectiveCode = collectiveCode,
                    date = request.date,
                    time = request.time,
                    type = request.type,
                    organizer = actorName,
                    attendees = request.attendees,
                    description = request.description,
                ),
            )

        clearDashboardCache()
        eventPublisher.chatEvent("EVENT_CREATED", saved.toDto())
        return saved.toDto()
    }

    // -------------------------------------------------------------------------
    // Chat
    // -------------------------------------------------------------------------

    fun getMessages(memberName: String): List<MessageDto> {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        return chatMessageRepository.findAllByCollectiveCode(collectiveCode)
            .sortedBy { it.timestamp }
            .map { it.toDto() }
    }

    @Transactional
    fun createMessage(
        request: CreateMessageRequest,
        actorName: String,
    ): MessageDto {
        val collectiveCode = requireCollectiveCodeByMemberName(actorName)
        val normalizedText = request.text.trim()
        require(normalizedText.isNotBlank()) { "Message text is required" }
        val saved =
            chatMessageRepository.save(
                ChatMessage(
                    sender = actorName,
                    collectiveCode = collectiveCode,
                    text = normalizedText,
                    timestamp = LocalDateTime.now(),
                ),
            )

        eventPublisher.chatEvent("MESSAGE_CREATED", saved.toDto())
        realtimeUpdateService.publish(collectiveCode, "MESSAGE_CREATED", saved.toDto())
        return saved.toDto()
    }

    @Transactional
    fun createImageMessage(
        image: MultipartFile,
        caption: String?,
        actorName: String,
    ): MessageDto {
        require(!image.isEmpty) { "Image is required" }
        val contentType = image.contentType?.trim().orEmpty().lowercase()
        require(contentType.startsWith("image/")) { "Only image uploads are supported" }
        require(image.size <= maxChatImageBytes) { "Image is too large (max 5 MB)" }

        val collectiveCode = requireCollectiveCodeByMemberName(actorName)
        val normalizedCaption = caption?.trim().orEmpty()
        val payload = Base64.getEncoder().encodeToString(image.bytes)

        val saved =
            chatMessageRepository.save(
                ChatMessage(
                    sender = actorName,
                    collectiveCode = collectiveCode,
                    text = normalizedCaption,
                    imageData = payload,
                    imageMimeType = contentType,
                    imageFileName = image.originalFilename?.take(255),
                    timestamp = LocalDateTime.now(),
                ),
            )

        val dto = saved.toDto()
        eventPublisher.chatEvent("MESSAGE_CREATED", dto)
        realtimeUpdateService.publish(collectiveCode, "MESSAGE_CREATED", dto)
        return dto
    }

    @Transactional
    fun addReaction(
        messageId: Long,
        emoji: String,
        actorName: String,
    ): MessageDto {
        require(emoji in allowedReactionEmojis) { "Unsupported reaction" }

        val message =
            chatMessageRepository.findById(messageId)
                .orElseThrow { IllegalArgumentException("Message not found") }

        val collectiveCode = requireCollectiveCodeByMemberName(actorName)
        require(message.collectiveCode == collectiveCode) { "Message not found" }

        val reactions =
            message
                .reactionMap()
                .mapValues { (_, users) -> users.toMutableSet() }
                .toMutableMap()

        // Ensure one reaction per user: remove user from all emojis first
        reactions.values.forEach { users -> users.remove(actorName) }
        reactions.entries.removeIf { (_, users) -> users.isEmpty() }

        val users = reactions.getOrPut(emoji) { mutableSetOf() }
        users.add(actorName)

        val updated =
            chatMessageRepository.save(
                message.copy(reactions = objectMapper.writeValueAsString(reactions.toJsonMap())),
            )

        val dto = updated.toDto()
        realtimeUpdateService.publish(collectiveCode, "MESSAGE_REACTION_UPDATED", dto)
        return dto
    }

    @Transactional
    fun removeReaction(
        messageId: Long,
        emoji: String,
        actorName: String,
    ): MessageDto {
        require(emoji in allowedReactionEmojis) { "Unsupported reaction" }

        val message =
            chatMessageRepository.findById(messageId)
                .orElseThrow { IllegalArgumentException("Message not found") }

        val collectiveCode = requireCollectiveCodeByMemberName(actorName)
        require(message.collectiveCode == collectiveCode) { "Message not found" }

        val reactions = message.reactionMap().toMutableMap()
        val users = reactions[emoji]?.toMutableSet() ?: mutableSetOf()
        users.remove(actorName)

        if (users.isEmpty()) {
            reactions.remove(emoji)
        } else {
            reactions[emoji] = users
        }

        val updated =
            chatMessageRepository.save(
                message.copy(reactions = objectMapper.writeValueAsString(reactions.toJsonMap())),
            )

        val dto = updated.toDto()
        realtimeUpdateService.publish(collectiveCode, "MESSAGE_REACTION_UPDATED", dto)
        return dto
    }

    private fun ChatMessage.reactionMap(): Map<String, Set<String>> {
        if (reactions.isBlank()) return emptyMap()
        return try {
            objectMapper.readValue<Map<String, Set<String>>>(reactions)
        } catch (_: Exception) {
            emptyMap()
        }
    }

    private fun Map<String, Set<String>>.toJsonMap(): Map<String, List<String>> = mapValues { (_, value) -> value.toList().sorted() }

    @Transactional
    fun createPoll(
        request: CreatePollRequest,
        actorName: String,
    ): MessageDto {
        val collectiveCode = requireCollectiveCodeByMemberName(actorName)

        val question = request.question.trim()
        require(question.isNotBlank()) { "Poll question is required" }

        val options = request.options.map { it.trim() }.filter { it.isNotBlank() }.distinct()
        require(options.size in 2..6) { "Poll must have between 2 and 6 unique options" }

        val payload =
            PollPayload(
                question = question,
                options =
                    options.mapIndexed { index, text ->
                        PollOptionPayload(id = index, text = text, users = emptyList())
                    },
            )

        val saved =
            chatMessageRepository.save(
                ChatMessage(
                    sender = actorName,
                    collectiveCode = collectiveCode,
                    text = "📊 $question",
                    timestamp = LocalDateTime.now(),
                    poll = objectMapper.writeValueAsString(payload),
                ),
            )

        val dto = saved.toDto()
        eventPublisher.chatEvent("MESSAGE_CREATED", dto)
        realtimeUpdateService.publish(collectiveCode, "MESSAGE_CREATED", dto)
        return dto
    }

    @Transactional
    fun votePoll(
        messageId: Long,
        optionId: Int,
        actorName: String,
    ): MessageDto {
        val message =
            chatMessageRepository.findById(messageId)
                .orElseThrow { IllegalArgumentException("Message not found") }

        val collectiveCode = requireCollectiveCodeByMemberName(actorName)
        require(message.collectiveCode == collectiveCode) { "Message not found" }

        val poll = message.pollPayload() ?: throw IllegalArgumentException("Message is not a poll")
        require(poll.options.any { it.id == optionId }) { "Invalid poll option" }

        val updatedOptions =
            poll.options.map { option ->
                val usersWithoutActor = option.users.filter { it != actorName }
                if (option.id == optionId) {
                    option.copy(users = (usersWithoutActor + actorName).distinct().sorted())
                } else {
                    option.copy(users = usersWithoutActor.sorted())
                }
            }

        val updatedPoll = poll.copy(options = updatedOptions)

        val updated =
            chatMessageRepository.save(
                message.copy(
                    poll = objectMapper.writeValueAsString(updatedPoll),
                ),
            )

        val dto = updated.toDto()
        realtimeUpdateService.publish(collectiveCode, "MESSAGE_POLL_UPDATED", dto)
        return dto
    }

    // poll
    private data class PollPayload(
        val question: String,
        val options: List<PollOptionPayload>,
    )

    private data class PollOptionPayload(
        val id: Int,
        val text: String,
        val users: List<String> = emptyList(),
    )

    private fun ChatMessage.pollPayload(): PollPayload? {
        val raw = poll?.trim().orEmpty()
        if (raw.isBlank()) return null
        return try {
            objectMapper.readValue<PollPayload>(raw)
        } catch (_: Exception) {
            null
        }
    }

    private fun ChatMessage.toDto() =
        MessageDto(
            id = id,
            sender = sender,
            text = text,
            imageData = imageData,
            imageMimeType = imageMimeType,
            imageFileName = imageFileName,
            timestamp = timestamp,
            reactions =
                reactionMap()
                    .map { (emoji, users) -> ReactionDto(emoji, users.toList().sorted()) }
                    .sortedBy { it.emoji },
            poll =
                pollPayload()?.let { payload ->
                    PollDto(
                        question = payload.question,
                        options =
                            payload.options
                                .sortedBy { it.id }
                                .map { PollOptionDto(id = it.id, text = it.text, users = it.users.sorted()) },
                    )
                },
        )
    // -------------------------------------------------------------------------
    // Economy
    // -------------------------------------------------------------------------

    fun getExpenses(memberName: String): List<ExpenseDto> {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        return expenseRepository.findAllByCollectiveCode(collectiveCode)
            .sortedByDescending { it.date }
            .map { it.toDto() }
    }

    @Transactional
    fun createExpense(
        request: CreateExpenseRequest,
        actorName: String,
    ): ExpenseDto {
        val collectiveCode = requireCollectiveCodeByMemberName(actorName)
        val collectiveMembers =
            memberRepository.findAllByCollectiveCode(collectiveCode)
                .map { it.name }
                .toSet()

        if (collectiveMembers.isEmpty()) {
            throw IllegalArgumentException("Collective '$collectiveCode' has no members")
        }

        val requestedParticipants =
            request.participantNames
                .map { it.trim() }
                .filter { it.isNotBlank() }
                .toSet()

        val participants =
            if (requestedParticipants.isEmpty()) collectiveMembers else requestedParticipants

        val invalidParticipants = participants - collectiveMembers
        if (invalidParticipants.isNotEmpty()) {
            throw IllegalArgumentException("Participants not in collective: ${invalidParticipants.joinToString(", ")}")
        }

        val saved =
            expenseRepository.save(
                Expense(
                    description = request.description,
                    amount = request.amount,
                    paidBy = actorName,
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
            expenseRepository.findAllByCollectiveCode(collectiveCode)
                .filter { it.id > checkpointExpenseId }

        if (expenses.isEmpty()) return emptyList()

        val members = memberRepository.findAllByCollectiveCode(collectiveCode).map { it.name }
        return calculateBalances(expenses, members)
    }

    fun getPantSummary(
        memberName: String,
        goal: Int = 1000,
    ): PantSummaryDto {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val entries =
            pantEntryRepository.findAllByCollectiveCode(collectiveCode)
                .sortedByDescending { it.date }
                .map { it.toDto() }

        val current = entries.sumOf { it.amount }

        return PantSummaryDto(
            currentAmount = current,
            goalAmount = goal,
            entries = entries,
        )
    }

    @Transactional
    fun addPantEntry(
        request: CreatePantEntryRequest,
        actorName: String,
    ): PantEntryDto {
        val collectiveCode = requireCollectiveCodeByMemberName(actorName)
        val saved =
            pantEntryRepository.save(
                PantEntry(
                    bottles = request.bottles,
                    amount = request.amount,
                    addedBy = actorName,
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
    fun settleUp(memberName: String): SettleUpResponse {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val lastExpenseId = expenseRepository.findTopByCollectiveCodeOrderByIdDesc(collectiveCode)?.id ?: 0L

        val checkpoint =
            settlementCheckpointRepository.save(
                SettlementCheckpoint(
                    collectiveCode = collectiveCode,
                    settledBy = memberName,
                    lastExpenseId = lastExpenseId,
                ),
            )

        eventPublisher.economyEvent(
            "BALANCES_SETTLED",
            mapOf(
                "collectiveCode" to collectiveCode,
                "settledBy" to memberName,
                "lastExpenseId" to lastExpenseId,
                "settledAt" to checkpoint.createdAt.toString(),
            ),
        )

        return SettleUpResponse(
            collectiveCode = collectiveCode,
            settledBy = memberName,
            lastExpenseId = lastExpenseId,
            settledAt = checkpoint.createdAt,
        )
    }

    // -------------------------------------------------------------------------
    // Leaderboard / Dashboard / Achievements
    // -------------------------------------------------------------------------

    fun getLeaderboard(
        memberName: String,
        period: LeaderboardPeriod = LeaderboardPeriod.OVERALL,
    ): LeaderboardResponse {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val collective = collectiveRepository.findByJoinCode(collectiveCode)
            ?: throw IllegalArgumentException("Collective not found")
        val leaderboardKey = "leaderboard:$collectiveCode:$period"
        val cached = redisTemplate.opsForValue().get(leaderboardKey)
        if (cached is LeaderboardResponse) return cached

        val allTasks = taskRepository.findAllByCollectiveCode(collectiveCode)
        val now = LocalDateTime.now()

        // Filter tasks based on period
        val filteredTasks =
            when (period) {
                LeaderboardPeriod.OVERALL -> allTasks.filter { it.completed }
                LeaderboardPeriod.YEAR ->
                    allTasks.filter {
                        it.completed && it.completedAt?.year == now.year
                    }
                LeaderboardPeriod.MONTH ->
                    allTasks.filter {
                        it.completed &&
                            it.completedAt?.year == now.year &&
                            it.completedAt?.month == now.month
                    }
            }

        val players =
            memberRepository.findAllByCollectiveCode(collectiveCode)
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
        val collective = collectiveRepository.findByJoinCode(collectiveCode)
            ?: throw IllegalArgumentException("Collective not found")
        return collective.monthlyPrize
    }

    fun setMonthlyPrize(memberName: String, prize: String?) {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val collective = collectiveRepository.findByJoinCode(collectiveCode)
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
                    taskRepository.findAllByCollectiveCode(collectiveCode)
                        .filter { !it.completed }
                        .sortedBy { it.dueDate }
                        .take(3)
                        .map { it.toDto() },
                upcomingEvents =
                    eventRepository.findAllByCollectiveCode(collectiveCode)
                        .filter { it.date >= LocalDate.now() }
                        .sortedBy { it.date }
                        .take(3)
                        .map { it.toDto() },
                recentExpenses =
                    expenseRepository.findAllByCollectiveCode(collectiveCode)
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
        val member =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")
        return requireCollectiveCode(member)
    }

    private fun requireCollectiveCode(member: Member): String {
        return member.collectiveCode
            ?: throw IllegalArgumentException("User '${member.name}' must join a collective first")
    }

    private fun latestSettledExpenseId(collectiveCode: String): Long {
        return settlementCheckpointRepository
            .findTopByCollectiveCodeOrderByIdDesc(collectiveCode)
            ?.lastExpenseId
            ?: 0L
    }

    private fun calculateBalances(
        expenses: List<Expense>,
        members: List<String>,
    ): List<BalanceDto> {
        if (members.isEmpty()) return emptyList()

        val perMember = members.associateWith { 0.0 }.toMutableMap()
        val memberSet = members.toSet()

        expenses.forEach { expense ->
            val participants =
                (
                    if (expense.participantNames.isEmpty()) memberSet else expense.participantNames
                ).intersect(memberSet)

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
            DrinkingQuestionDto("$topPlayer, som leaderboard-leder, del ut 3 slurker!", "distribute", topPlayer),
            DrinkingQuestionDto("$bottomPlayer, du er sist på leaderboardet. Drikk 2!", "drink", bottomPlayer),
            DrinkingQuestionDto("Alle som har glemt å tømme søppel denne uken drikker 2!", "everyone", null),
            DrinkingQuestionDto("Pek på hvem som mest sannsynlig glemmer å handle. De drikker 1!", "vote", null),
            DrinkingQuestionDto("Rock, paper, scissors mellom topp 2 på leaderboard. Taper drikker 3!", "challenge", null),
        )

    private fun toAuthResponse(member: Member): AuthResponse {
        val token = tokenService.issueTokenPair(member)
        return AuthResponse(
            accessToken = token.accessToken,
            refreshToken = token.refreshToken,
            tokenType = token.tokenType,
            expiresIn = token.expiresIn,
            user = member.toUserDto(),
        )
    }

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
        )

    private fun ShoppingItem.toDto() = ShoppingItemDto(id, item, addedBy, completed)

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

    private fun Achievement.toDto() = AchievementDto(id, title, description, icon, unlocked, progress, total)

    private fun normalizeRecurrenceRule(
        recurrenceRule: String?,
        recurringFallback: Boolean = false,
    ): String? {
        val normalized = recurrenceRule?.trim()?.uppercase()

        return when {
            normalized.isNullOrBlank() || normalized == "NONE" ->
                if (recurringFallback) "WEEKLY" else null

            normalized in setOf("DAILY", "WEEKLY", "MONTHLY") ->
                normalized

            else ->
                normalized // allow custom RRULE strings too
        }
    }

    private fun isRecurringTask(recurrenceRule: String?): Boolean {
        return !recurrenceRule.isNullOrBlank() && recurrenceRule.uppercase() != "NONE"
    }
}
