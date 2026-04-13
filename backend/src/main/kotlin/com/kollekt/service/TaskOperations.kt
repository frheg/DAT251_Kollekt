package com.kollekt.service

import com.kollekt.api.dto.CreateTaskRequest
import com.kollekt.api.dto.TaskDto
import com.kollekt.api.dto.TaskFeedbackDto
import com.kollekt.domain.MemberStatus
import com.kollekt.domain.TaskCategory
import com.kollekt.domain.TaskFeedback
import com.kollekt.domain.TaskItem
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.TaskFeedbackRepository
import com.kollekt.repository.TaskRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.LocalDateTime

@Service
class TaskOperations(
    private val taskRepository: TaskRepository,
    private val memberRepository: MemberRepository,
    private val taskFeedbackRepository: TaskFeedbackRepository,
    private val eventPublisher: IntegrationEventPublisher,
    private val realtimeUpdateService: RealtimeUpdateService,
    private val notificationService: NotificationService,
    private val collectiveAccessService: CollectiveAccessService,
    private val statsCacheService: StatsCacheService,
) {
    fun notifyUpcomingTaskDeadlines(reminderDaysBeforeDue: Long = 1L) {
        val reminderDate = LocalDate.now().plusDays(reminderDaysBeforeDue)
        val tasksDueSoon =
            taskRepository
                .findAll()
                .filter { !it.completed && it.dueDate == reminderDate }

        for (task in tasksDueSoon) {
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

    fun deleteExpiredTasks() {
        val thresholdDate = LocalDate.now().minusDays(5)
        val expiredTasks =
            taskRepository
                .findAll()
                .filter { !it.completed && it.dueDate.isBefore(thresholdDate) }

        if (expiredTasks.isNotEmpty()) {
            taskRepository.deleteAll(expiredTasks)
        }
    }

    fun getTasks(memberName: String): List<TaskDto> {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        return taskRepository
            .findAllByCollectiveCode(collectiveCode)
            .sortedBy { it.dueDate }
            .map { it.toDto(taskFeedbackRepository.findAllByTaskId(it.id)) }
    }

    @Transactional
    fun createTask(
        request: CreateTaskRequest,
        actorName: String,
    ): TaskDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)

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

        notificationService.createTaskAssignedNotification(request.assignee, request.title)
        statsCacheService.clearTaskCaches()
        val dto = saved.toDto()
        eventPublisher.taskEvent("TASK_CREATED", dto)
        realtimeUpdateService.publish(collectiveCode, "TASK_CREATED", dto)
        return dto
    }

    @Transactional
    fun deleteTask(
        taskId: Long,
        memberName: String,
    ) {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        taskRepository.findByIdAndCollectiveCodeForUpdate(taskId, collectiveCode)
            ?: throw IllegalArgumentException("Task $taskId not found")

        taskRepository.deleteById(taskId)
        statsCacheService.clearTaskCaches()
        val payload = mapOf("id" to taskId)
        eventPublisher.taskEvent("TASK_DELETED", payload)
        realtimeUpdateService.publish(collectiveCode, "TASK_DELETED", payload)
    }

    @Transactional
    fun giveTaskFeedback(
        taskId: Long,
        memberName: String,
        message: String,
        anonymous: Boolean,
        imageData: String?,
        imageMimeType: String?,
    ): TaskDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val task =
            taskRepository.findByIdAndCollectiveCodeForUpdate(taskId, collectiveCode)
                ?: throw IllegalArgumentException("Task $taskId not found")

        taskFeedbackRepository.save(
            TaskFeedback(
                taskId = taskId,
                author = memberName,
                message = message,
                anonymous = anonymous,
                imageData = imageData,
                imageMimeType = imageMimeType,
            ),
        )

        if (task.assignee != memberName) {
            notificationService.createCustomNotification(
                userName = task.assignee,
                message = "${if (anonymous) "Someone" else memberName} left feedback on your task '${task.title}'.",
                type = "TASK_FEEDBACK",
            )
        }

        val feedbacks = taskFeedbackRepository.findAllByTaskId(taskId)
        val dto = task.toDto(feedbacks)
        eventPublisher.taskEvent("TASK_FEEDBACK_UPDATED", dto)
        realtimeUpdateService.publish(collectiveCode, "TASK_FEEDBACK_UPDATED", dto)
        return dto
    }

    @Transactional
    fun updateTask(
        taskId: Long,
        updates: Map<String, Any>,
        memberName: String,
    ): TaskDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val task =
            taskRepository.findByIdAndCollectiveCodeForUpdate(taskId, collectiveCode)
                ?: throw IllegalArgumentException("Task $taskId not found")

        val newTitle = updates["title"] as? String ?: task.title
        val newAssignee = updates["assignee"] as? String ?: task.assignee
        val newDueDate = (updates["dueDate"] as? String)?.let(LocalDate::parse) ?: task.dueDate
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
                recurrenceRuleExplicit != null -> normalizeRecurrenceRule(recurrenceRuleExplicit)
                recurringExplicit == false -> null
                recurringExplicit == true -> normalizeRecurrenceRule(task.recurrenceRule, recurringFallback = true)
                else -> normalizeRecurrenceRule(task.recurrenceRule)
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

        statsCacheService.clearTaskCaches()
        val dto = saved.toDto()
        eventPublisher.taskEvent("TASK_UPDATED", dto)
        realtimeUpdateService.publish(collectiveCode, "TASK_UPDATED", dto)
        return dto
    }

    @Transactional
    fun toggleTask(
        taskId: Long,
        memberName: String,
    ): TaskDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val task =
            taskRepository.findByIdAndCollectiveCodeForUpdate(taskId, collectiveCode)
                ?: throw IllegalArgumentException("Task $taskId not found")

        val completionXp = calculateCompletionAwardXp(task)
        val awardedXp = if (!task.completed && !task.xpAwarded) completionXp else 0

        if (awardedXp > 0) {
            val assignee =
                memberRepository.findByNameAndCollectiveCode(task.assignee, collectiveCode)
                    ?: throw IllegalArgumentException("Task assignee '${task.assignee}' not found in collective")

            val updatedXp = assignee.xp + awardedXp
            val updatedLevel = updatedXp / 200 + 1
            memberRepository.save(assignee.copy(xp = updatedXp, level = updatedLevel))
        }

        val saved =
            if (!task.completed) {
                taskRepository.save(
                    task.copy(
                        completed = true,
                        xpAwarded = true,
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
                        xpAwarded = task.xpAwarded,
                    ),
                )
            }

        statsCacheService.clearTaskCaches()
        val dto = saved.toDto()
        eventPublisher.taskEvent("TASK_TOGGLED", dto)
        realtimeUpdateService.publish(
            collectiveCode,
            "TASK_UPDATED",
            mapOf(
                "task" to dto,
                "awardedXp" to awardedXp,
                "updatedBy" to memberName,
            ),
        )

        if (awardedXp > 0) {
            val updatedMember = memberRepository.findByNameAndCollectiveCode(task.assignee, collectiveCode)
            realtimeUpdateService.publish(
                collectiveCode,
                "XP_UPDATED",
                mapOf(
                    "memberName" to task.assignee,
                    "awardedXp" to awardedXp,
                    "totalXp" to (updatedMember?.xp ?: 0),
                    "level" to (updatedMember?.level ?: 1),
                    "taskId" to taskId,
                ),
            )
        }

        return dto
    }

    @Transactional
    fun regretTask(
        taskId: Long,
        memberName: String,
    ): TaskDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val task =
            taskRepository.findByIdAndCollectiveCodeForUpdate(taskId, collectiveCode)
                ?: throw IllegalArgumentException("Task $taskId not found")
        if (task.completed) throw IllegalStateException("Task already completed")

        val awardedXp =
            if (!task.xpAwarded && memberName == task.assignee) calculateLateCompletionXp(task.xp) else 0

        if (awardedXp > 0) {
            val member =
                memberRepository.findByNameAndCollectiveCode(memberName, collectiveCode)
                    ?: throw IllegalArgumentException("User '$memberName' not found in collective")

            val updatedXp = member.xp + awardedXp
            val updatedLevel = updatedXp / 200 + 1
            memberRepository.save(member.copy(xp = updatedXp, level = updatedLevel))
        }

        val saved =
            taskRepository.save(
                task.copy(
                    completed = true,
                    completedBy = memberName,
                    completedAt = LocalDateTime.now(),
                    xpAwarded = (memberName == task.assignee),
                ),
            )

        notificationService.createCustomNotification(
            userName = memberName,
            message = "Du fullførte oppgaven '${task.title}' for sent. XP er redusert.",
            type = "TASK_COMPLETED_LATE",
        )

        statsCacheService.clearTaskCaches()
        val dto = saved.toDto()
        eventPublisher.taskEvent("TASK_COMPLETED_LATE", dto)
        realtimeUpdateService.publish(collectiveCode, "TASK_COMPLETED_LATE", dto)
        return dto
    }

    @Transactional
    fun penalizeMissedTasks() {
        val today = LocalDate.now()
        val overdueTasks =
            taskRepository
                .findAll()
                .filter { !it.completed && it.dueDate.isBefore(today) }

        for (task in overdueTasks) {
            val collectiveCode = task.collectiveCode ?: ""
            val member = memberRepository.findByNameAndCollectiveCode(task.assignee, collectiveCode)
            if (member != null && member.status == MemberStatus.ACTIVE) {
                val penalty = calculatePenaltyXp(task)
                if (task.penaltyXp == 0) {
                    memberRepository.save(member.copy(xp = member.xp + penalty))
                    taskRepository.save(task.copy(penaltyXp = penalty))
                    realtimeUpdateService.publish(
                        collectiveCode,
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
                    val activeMembers =
                        memberRepository
                            .findAllByCollectiveCode(collectiveCode)
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

        val collectiveCode = task.collectiveCode ?: ""
        val member =
            memberRepository.findByNameAndCollectiveCode(memberName, collectiveCode)
                ?: throw IllegalArgumentException("User '$memberName' not found in collective")
        val halfXp = calculateLateCompletionXp(task.xp)

        memberRepository.save(member.copy(xp = member.xp - task.penaltyXp + halfXp))
        val saved =
            taskRepository.save(
                task.copy(
                    completed = true,
                    completedBy = memberName,
                    completedAt = LocalDateTime.now(),
                    penaltyXp = 0,
                    xpAwarded = true,
                ),
            )

        statsCacheService.clearTaskCaches()
        val dto = saved.toDto()
        eventPublisher.taskEvent("TASK_REGRET", dto)
        realtimeUpdateService.publish(collectiveCode, "TASK_REGRET", dto)
        return dto
    }

    @Transactional
    fun regenerateRecurringTasksForCollective(collectiveCode: String) {
        val members =
            memberRepository
                .findAllByCollectiveCode(collectiveCode)
                .filter { it.status == MemberStatus.ACTIVE }
        if (members.isEmpty()) return

        val memberNames = members.map { it.name }.sorted()
        val allRecurringTasks =
            taskRepository
                .findAllByCollectiveCode(collectiveCode)
                .filter { isRecurringTask(it.recurrenceRule) }
        val groupedTasks = allRecurringTasks.groupBy { it.title to (normalizeRecurrenceRule(it.recurrenceRule) ?: "WEEKLY") }

        data class TaskTemplate(
            val title: String,
            val recurrenceRule: String,
            val category: TaskCategory,
            val xp: Int,
            val nextDueDate: LocalDate,
            val lastAssignee: String?,
        )

        val tasksToAssign = mutableListOf<TaskTemplate>()
        for ((key, tasks) in groupedTasks) {
            val (title, recurrenceRule) = key
            val template = tasks.maxByOrNull { it.dueDate } ?: continue
            val nextDueDate =
                when (recurrenceRule.uppercase()) {
                    "WEEKLY" -> template.dueDate.plusWeeks(1)
                    "MONTHLY" -> template.dueDate.plusMonths(1)
                    else -> template.dueDate.plusWeeks(1)
                }

            allRecurringTasks
                .filter {
                    it.title == title &&
                        (normalizeRecurrenceRule(it.recurrenceRule) ?: "WEEKLY") == recurrenceRule &&
                        !it.completed &&
                        it.dueDate == nextDueDate
                }.forEach { taskRepository.deleteById(it.id) }

            tasksToAssign.add(
                TaskTemplate(
                    title = title,
                    recurrenceRule = recurrenceRule,
                    category = template.category,
                    xp = template.xp,
                    nextDueDate = nextDueDate,
                    lastAssignee = template.assignee,
                ),
            )
        }

        val assignments = mutableMapOf<String, String>()
        if (memberNames.isNotEmpty() && tasksToAssign.isNotEmpty()) {
            if (memberNames.size == tasksToAssign.size) {
                val sortedTasks = tasksToAssign.sortedBy { it.title + it.recurrenceRule }
                val lastAssignees = sortedTasks.map { it.lastAssignee }
                var rotatedMembers = memberNames.toList()
                for (shift in memberNames.indices) {
                    val candidate = rotatedMembers
                    if (candidate.zip(lastAssignees).all { (member, last) -> member != last }) {
                        break
                    }
                    rotatedMembers = rotatedMembers.drop(1) + rotatedMembers.first()
                }
                for ((task, assignee) in sortedTasks.zip(rotatedMembers)) {
                    assignments[task.title + "::" + task.recurrenceRule] = assignee
                }
            } else {
                val memberTaskCounts = mutableMapOf<String, Int>().withDefault { 0 }
                for (task in tasksToAssign.shuffled()) {
                    val candidates = memberNames.filter { it != task.lastAssignee }
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

        statsCacheService.clearTaskCaches()
    }

    private fun calculateCompletionAwardXp(task: TaskItem): Int =
        if (task.dueDate.isBefore(LocalDate.now())) {
            calculateLateCompletionXp(task.xp)
        } else {
            task.xp
        }

    private fun calculateLateCompletionXp(baseXp: Int): Int = (baseXp / 2).coerceAtLeast(1)

    private fun calculatePenaltyXp(task: TaskItem): Int = -kotlin.math.abs(task.xp)

    private fun normalizeRecurrenceRule(
        recurrenceRule: String?,
        recurringFallback: Boolean = false,
    ): String? {
        val normalized = recurrenceRule?.trim()?.uppercase()
        return when {
            normalized.isNullOrBlank() || normalized == "NONE" -> {
                if (recurringFallback) "WEEKLY" else null
            }

            normalized in setOf("DAILY", "WEEKLY", "MONTHLY") -> {
                normalized
            }

            else -> {
                normalized
            }
        }
    }

    private fun isRecurringTask(recurrenceRule: String?): Boolean = !recurrenceRule.isNullOrBlank() && recurrenceRule.uppercase() != "NONE"

    private fun TaskItem.toDto(feedbacks: List<TaskFeedback> = emptyList()) =
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
            feedbacks =
                feedbacks.map { fb ->
                    TaskFeedbackDto(
                        id = fb.id,
                        author = if (fb.anonymous) null else fb.author,
                        message = fb.message,
                        anonymous = fb.anonymous,
                        imageData = fb.imageData,
                        imageMimeType = fb.imageMimeType,
                        createdAt = fb.createdAt,
                    )
                },
        )
}
