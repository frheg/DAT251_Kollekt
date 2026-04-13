package com.kollekt.service

import com.kollekt.api.dto.CreateTaskRequest
import com.kollekt.domain.Member
import com.kollekt.domain.MemberStatus
import com.kollekt.domain.TaskCategory
import com.kollekt.domain.TaskFeedback
import com.kollekt.domain.TaskItem
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.TaskFeedbackRepository
import com.kollekt.repository.TaskRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.check
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.redis.core.RedisTemplate
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.Optional

class TaskOperationsTest {
    private lateinit var taskRepository: TaskRepository
    private lateinit var memberRepository: MemberRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var eventPublisher: IntegrationEventPublisher
    private lateinit var realtimeUpdateService: RealtimeUpdateService
    private lateinit var notificationService: NotificationService
    private lateinit var redisTemplate: RedisTemplate<String, Any>
    private lateinit var collectiveAccessService: CollectiveAccessService
    private lateinit var statsCacheService: StatsCacheService
    private lateinit var taskFeedbackRepository: TaskFeedbackRepository
    private lateinit var operations: TaskOperations

    @BeforeEach
    fun setUp() {
        taskRepository = mock()
        memberRepository = mock()
        collectiveRepository = mock()
        eventPublisher = mock()
        realtimeUpdateService = mock()
        notificationService = mock()
        taskFeedbackRepository = mock()
        redisTemplate = mock()
        whenever(redisTemplate.keys("dashboard:*")).thenReturn(emptySet())
        whenever(redisTemplate.keys("leaderboard:*")).thenReturn(emptySet())
        collectiveAccessService = CollectiveAccessService(memberRepository, collectiveRepository)
        statsCacheService = StatsCacheService(redisTemplate)
        operations =
            TaskOperations(
                taskRepository = taskRepository,
                memberRepository = memberRepository,
                taskFeedbackRepository = taskFeedbackRepository,
                eventPublisher = eventPublisher,
                realtimeUpdateService = realtimeUpdateService,
                notificationService = notificationService,
                collectiveAccessService = collectiveAccessService,
                statsCacheService = statsCacheService,
            )
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
    }

    @Test
    fun `notify upcoming task deadlines publishes realtime reminder and notification`() {
        val dueSoon =
            TaskItem(
                id = 8,
                title = "Trash",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().plusDays(1),
                category = TaskCategory.OTHER,
            )
        whenever(taskRepository.findAll()).thenReturn(listOf(dueSoon))

        operations.notifyUpcomingTaskDeadlines(reminderDaysBeforeDue = 1)

        verify(realtimeUpdateService).publish(
            "ABC123",
            "TASK_DEADLINE_SOON",
            mapOf(
                "assignee" to "Kasper",
                "taskId" to 8L,
                "title" to "Trash",
                "dueDate" to dueSoon.dueDate.toString(),
            ),
        )
        verify(notificationService).createCustomNotification(
            userName = "Kasper",
            message = "Your task 'Trash' is due in 1 day(s).",
            type = "TASK_DEADLINE_SOON",
        )
    }

    @Test
    fun `create task normalizes recurrence clears caches and notifies assignee`() {
        whenever(memberRepository.findByNameAndCollectiveCode("Emma", "ABC123"))
            .thenReturn(member("Emma", "emma@example.com", id = 2))

        val taskCaptor = argumentCaptor<TaskItem>()
        whenever(taskRepository.save(taskCaptor.capture())).thenAnswer {
            taskCaptor.firstValue.copy(id = 12)
        }

        val result =
            operations.createTask(
                request =
                    CreateTaskRequest(
                        title = "Vask",
                        assignee = "Emma",
                        dueDate = LocalDate.parse("2026-04-20"),
                        category = TaskCategory.CLEANING,
                        xp = 15,
                        recurrenceRule = " weekly ",
                    ),
                actorName = "Kasper",
            )

        verify(redisTemplate).keys("dashboard:*")
        verify(redisTemplate).keys("leaderboard:*")
        assertEquals("ABC123", taskCaptor.firstValue.collectiveCode)
        assertEquals("WEEKLY", taskCaptor.firstValue.recurrenceRule)
        assertTrue(taskCaptor.firstValue.recurring)
        verify(notificationService).createTaskAssignedNotification("Emma", "Vask")
        verify(eventPublisher).taskEvent("TASK_CREATED", result)
        verify(realtimeUpdateService).publish("ABC123", "TASK_CREATED", result)
    }

    @Test
    fun `update task falls back invalid category and enables weekly recurrence`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(3, "ABC123")).thenReturn(
            TaskItem(
                id = 3,
                title = "Old",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.parse("2026-04-01"),
                category = TaskCategory.CLEANING,
                xp = 10,
                recurring = false,
            ),
        )
        whenever(memberRepository.findByNameAndCollectiveCode("Emma", "ABC123"))
            .thenReturn(member("Emma", "emma@example.com", id = 2))
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        val result =
            operations.updateTask(
                taskId = 3,
                updates =
                    mapOf(
                        "title" to "New",
                        "assignee" to "Emma",
                        "dueDate" to "2026-04-15",
                        "category" to "INVALID",
                        "xp" to 25,
                        "recurring" to true,
                    ),
                memberName = "Kasper",
            )

        assertEquals("New", result.title)
        assertEquals("Emma", result.assignee)
        assertEquals(LocalDate.parse("2026-04-15"), result.dueDate)
        assertEquals(TaskCategory.CLEANING, result.category)
        assertEquals(25, result.xp)
        assertEquals("WEEKLY", result.recurrenceRule)
    }

    @Test
    fun `toggle task awards half xp for overdue completion and publishes xp update`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(11, "ABC123")).thenReturn(
            TaskItem(
                id = 11,
                title = "Task",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().minusDays(1),
                category = TaskCategory.OTHER,
                completed = false,
                xpAwarded = false,
                xp = 25,
            ),
        )
        whenever(memberRepository.findByNameAndCollectiveCode("Kasper", "ABC123"))
            .thenReturn(
                member("Kasper", "kasper@example.com", xp = 100, level = 1),
                member("Kasper", "kasper@example.com", xp = 112, level = 1),
            )
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        val result = operations.toggleTask(taskId = 11, memberName = "Kasper")

        assertTrue(result.completed)
        verify(memberRepository).save(
            org.mockito.kotlin.check {
                assertEquals(112, it.xp)
                assertEquals(1, it.level)
            },
        )
        verify(realtimeUpdateService).publish(eq("ABC123"), eq("XP_UPDATED"), any())
    }

    @Test
    fun `penalize missed tasks applies penalty once and notifies collective`() {
        val overdueTask =
            TaskItem(
                id = 4,
                title = "Trash",
                assignee = "Emma",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().minusDays(1),
                category = TaskCategory.OTHER,
                xp = 10,
            )
        whenever(taskRepository.findAll()).thenReturn(listOf(overdueTask))
        whenever(memberRepository.findByNameAndCollectiveCode("Emma", "ABC123"))
            .thenReturn(member("Emma", "emma@example.com", id = 2, xp = 40))
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Emma", "emma@example.com", id = 2, xp = 40),
                member("Kasper", "kasper@example.com", id = 1, xp = 20),
                member("Ola", "ola@example.com", id = 3, status = MemberStatus.AWAY),
            ),
        )
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        operations.penalizeMissedTasks()

        verify(memberRepository).save(
            org.mockito.kotlin.check {
                assertEquals("Emma", it.name)
                assertEquals(30, it.xp)
            },
        )
        verify(taskRepository).save(
            org.mockito.kotlin.check {
                assertEquals(-10, it.penaltyXp)
            },
        )
        verify(notificationService).createCustomNotification(
            userName = "Emma",
            message = "Your task 'Trash' is overdue! A penalty has been applied.",
            type = "TASK_OVERDUE",
        )
        verify(notificationService).createGroupNotification(
            userNames = listOf("Kasper"),
            message = "Task 'Trash' assigned to Emma is overdue and not completed.",
            type = "TASK_OVERDUE_GROUP",
        )
        verify(realtimeUpdateService).publish(eq("ABC123"), eq("TASK_PENALTY_APPLIED"), any())
    }

    @Test
    fun `regret missed task removes penalty and awards half xp`() {
        val task =
            TaskItem(
                id = 9,
                title = "Kitchen",
                assignee = "Emma",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().minusDays(2),
                category = TaskCategory.CLEANING,
                completed = false,
                xp = 20,
                penaltyXp = -20,
            )
        whenever(taskRepository.findById(9)).thenReturn(Optional.of(task))
        whenever(memberRepository.findByNameAndCollectiveCode("Emma", "ABC123"))
            .thenReturn(member("Emma", "emma@example.com", id = 2, xp = 100))
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        val result = operations.regretMissedTask(taskId = 9, memberName = "Emma")

        assertTrue(result.completed)
        verify(memberRepository).save(
            org.mockito.kotlin.check {
                assertEquals(130, it.xp)
            },
        )
    }

    @Test
    fun `get tasks returns tasks sorted by due date`() {
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                TaskItem(
                    id = 2,
                    title = "Trash",
                    assignee = "Kasper",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.parse("2026-04-20"),
                    category = TaskCategory.OTHER,
                ),
                TaskItem(
                    id = 1,
                    title = "Kitchen",
                    assignee = "Emma",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.parse("2026-04-15"),
                    category = TaskCategory.CLEANING,
                ),
            ),
        )

        val result = operations.getTasks("Kasper")

        assertEquals(listOf(1L, 2L), result.map { it.id })
    }

    @Test
    fun `create task rejects assignee outside the collective`() {
        whenever(memberRepository.findByNameAndCollectiveCode("Emma", "ABC123")).thenReturn(null)

        val error =
            assertThrows<IllegalArgumentException> {
                operations.createTask(
                    request =
                        CreateTaskRequest(
                            title = "Vask",
                            assignee = "Emma",
                            dueDate = LocalDate.parse("2026-04-20"),
                            category = TaskCategory.CLEANING,
                            xp = 15,
                        ),
                    actorName = "Kasper",
                )
            }

        assertEquals("Assignee 'Emma' is not in your collective", error.message)
    }

    @Test
    fun `delete expired tasks removes incomplete tasks older than five days`() {
        val expiredTask =
            TaskItem(
                id = 6,
                title = "Trash",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().minusDays(6),
                category = TaskCategory.OTHER,
            )
        val recentTask = expiredTask.copy(id = 7, dueDate = LocalDate.now().minusDays(5))
        val completedTask = expiredTask.copy(id = 8, completed = true)
        whenever(taskRepository.findAll()).thenReturn(listOf(expiredTask, recentTask, completedTask))

        operations.deleteExpiredTasks()

        verify(taskRepository).deleteAll(listOf(expiredTask))
    }

    @Test
    fun `delete task publishes deletion event and realtime update`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(5, "ABC123")).thenReturn(
            TaskItem(
                id = 5,
                title = "Trash",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.parse("2026-04-20"),
                category = TaskCategory.OTHER,
            ),
        )

        operations.deleteTask(5, "Kasper")

        verify(taskRepository).deleteById(5)
        verify(eventPublisher).taskEvent("TASK_DELETED", mapOf("id" to 5L))
        verify(realtimeUpdateService).publish("ABC123", "TASK_DELETED", mapOf("id" to 5L))
        verify(redisTemplate).keys("dashboard:*")
        verify(redisTemplate).keys("leaderboard:*")
    }

    @Test
    fun `give task feedback persists feedback and publishes update`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(13, "ABC123")).thenReturn(
            TaskItem(
                id = 13,
                title = "Bad",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.parse("2026-04-20"),
                category = TaskCategory.CLEANING,
            ),
        )
        val savedFeedback = TaskFeedback(id = 1, taskId = 13, author = "Kasper", message = "Bra jobbet", anonymous = false)
        whenever(taskFeedbackRepository.save(any<TaskFeedback>())).thenReturn(savedFeedback)
        whenever(taskFeedbackRepository.findAllByTaskId(13)).thenReturn(listOf(savedFeedback))

        val result = operations.giveTaskFeedback(13, "Kasper", "Bra jobbet", false, null, null)

        assertEquals(13, result.id)
        assertEquals(1, result.feedbacks.size)
        assertEquals("Kasper", result.feedbacks[0].author)
        assertEquals("Bra jobbet", result.feedbacks[0].message)
        verify(taskFeedbackRepository).save(
            check {
                assertEquals("Bra jobbet", it.message)
                assertEquals("Kasper", it.author)
                assertEquals(false, it.anonymous)
            },
        )
        verify(eventPublisher).taskEvent("TASK_FEEDBACK_UPDATED", result)
        verify(realtimeUpdateService).publish("ABC123", "TASK_FEEDBACK_UPDATED", result)
    }

    @Test
    fun `give task feedback notifies assignee when actor is different member`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(14, "ABC123")).thenReturn(
            TaskItem(
                id = 14,
                title = "Støvsuge",
                assignee = "Emma",
                collectiveCode = "ABC123",
                dueDate = LocalDate.parse("2026-04-20"),
                category = TaskCategory.CLEANING,
            ),
        )
        val savedFeedback = TaskFeedback(id = 2, taskId = 14, author = "Kasper", message = "Ikke grundig nok", anonymous = true)
        whenever(taskFeedbackRepository.save(any<TaskFeedback>())).thenReturn(savedFeedback)
        whenever(taskFeedbackRepository.findAllByTaskId(14)).thenReturn(listOf(savedFeedback))

        val result = operations.giveTaskFeedback(14, "Kasper", "Ikke grundig nok", true, null, null)

        assertEquals(14, result.id)
        assertEquals(1, result.feedbacks.size)
        assertEquals(null, result.feedbacks[0].author) // anonymous — author hidden
        verify(notificationService).createCustomNotification(
            userName = "Emma",
            message = "Someone left feedback on your task 'Støvsuge'.",
            type = "TASK_FEEDBACK",
        )
    }

    @Test
    fun `update task keeps existing recurrence when recurring fields are omitted`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(3, "ABC123")).thenReturn(
            TaskItem(
                id = 3,
                title = "Old",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.parse("2026-04-01"),
                category = TaskCategory.CLEANING,
                xp = 10,
                recurrenceRule = "MONTHLY",
                recurring = true,
            ),
        )
        whenever(memberRepository.findByNameAndCollectiveCode("Kasper", "ABC123"))
            .thenReturn(member("Kasper", "kasper@example.com"))
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        val result =
            operations.updateTask(
                taskId = 3,
                updates = mapOf("title" to "Updated"),
                memberName = "Kasper",
            )

        assertEquals("MONTHLY", result.recurrenceRule)
        verify(taskRepository).save(
            check {
                assertTrue(it.recurring)
            },
        )
    }

    @Test
    fun `toggle task awards full xp when completed on time`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(11, "ABC123")).thenReturn(
            TaskItem(
                id = 11,
                title = "Task",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().plusDays(1),
                category = TaskCategory.OTHER,
                completed = false,
                xpAwarded = false,
                xp = 25,
            ),
        )
        whenever(memberRepository.findByNameAndCollectiveCode("Kasper", "ABC123"))
            .thenReturn(
                member("Kasper", "kasper@example.com", xp = 100, level = 1),
                member("Kasper", "kasper@example.com", xp = 125, level = 1),
            )
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        operations.toggleTask(taskId = 11, memberName = "Kasper")

        verify(memberRepository).save(
            check {
                assertEquals(125, it.xp)
            },
        )
    }

    @Test
    fun `toggle task reopens a completed task`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(12, "ABC123")).thenReturn(
            TaskItem(
                id = 12,
                title = "Laundry",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now(),
                category = TaskCategory.OTHER,
                completed = true,
                xpAwarded = true,
                completedBy = "Kasper",
                completedAt = LocalDateTime.parse("2026-04-13T10:00:00"),
                xp = 15,
            ),
        )
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        val result = operations.toggleTask(taskId = 12, memberName = "Kasper")

        assertEquals(false, result.completed)
        verify(taskRepository).save(
            check {
                assertEquals(false, it.completed)
                assertEquals(null, it.completedBy)
                assertEquals(null, it.completedAt)
            },
        )
    }

    @Test
    fun `regret task completes late task with reduced xp and notification`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(14, "ABC123")).thenReturn(
            TaskItem(
                id = 14,
                title = "Bathroom",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().minusDays(2),
                category = TaskCategory.CLEANING,
                completed = false,
                xpAwarded = false,
                xp = 20,
            ),
        )
        whenever(memberRepository.findByNameAndCollectiveCode("Kasper", "ABC123"))
            .thenReturn(member("Kasper", "kasper@example.com", xp = 100, level = 1))
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        val result = operations.regretTask(taskId = 14, memberName = "Kasper")

        assertEquals(true, result.completed)
        assertEquals(20, result.xp)
        verify(memberRepository).save(
            check {
                assertEquals(110, it.xp)
            },
        )
        verify(notificationService).createCustomNotification(
            userName = "Kasper",
            message = "Du fullførte oppgaven 'Bathroom' for sent. XP er redusert.",
            type = "TASK_COMPLETED_LATE",
        )
        verify(eventPublisher).taskEvent("TASK_COMPLETED_LATE", result)
        verify(realtimeUpdateService).publish("ABC123", "TASK_COMPLETED_LATE", result)
    }

    @Test
    fun `penalize missed tasks updates existing penalty difference`() {
        val overdueTask =
            TaskItem(
                id = 18,
                title = "Trash",
                assignee = "Emma",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().minusDays(1),
                category = TaskCategory.OTHER,
                xp = 10,
                penaltyXp = -20,
            )
        whenever(taskRepository.findAll()).thenReturn(listOf(overdueTask))
        whenever(memberRepository.findByNameAndCollectiveCode("Emma", "ABC123"))
            .thenReturn(member("Emma", "emma@example.com", id = 2, xp = 40))

        operations.penalizeMissedTasks()

        verify(memberRepository).save(
            check {
                assertEquals("Emma", it.name)
                assertEquals(50, it.xp)
            },
        )
        verify(taskRepository).save(
            check {
                assertEquals(-10, it.penaltyXp)
            },
        )
    }

    @Test
    fun `regenerate recurring tasks rotates assignments when task count matches member count`() {
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Emma", "emma@example.com", id = 2),
                member("Kasper", "kasper@example.com", id = 1),
            ),
        )
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                TaskItem(
                    id = 1,
                    title = "Kitchen",
                    assignee = "Emma",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.parse("2026-04-01"),
                    category = TaskCategory.CLEANING,
                    xp = 20,
                    recurrenceRule = "WEEKLY",
                    recurring = true,
                ),
                TaskItem(
                    id = 2,
                    title = "Trash",
                    assignee = "Kasper",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.parse("2026-04-01"),
                    category = TaskCategory.OTHER,
                    xp = 10,
                    recurrenceRule = "WEEKLY",
                    recurring = true,
                ),
            ),
        )
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        operations.regenerateRecurringTasksForCollective("ABC123")

        val savedTasks = argumentCaptor<TaskItem>()
        verify(taskRepository, times(2)).save(savedTasks.capture())
        assertTrue(
            savedTasks.allValues.any {
                it.title == "Kitchen" &&
                    it.assignee == "Kasper" &&
                    it.dueDate == LocalDate.parse("2026-04-08")
            },
        )
        assertTrue(
            savedTasks.allValues.any {
                it.title == "Trash" &&
                    it.assignee == "Emma" &&
                    it.dueDate == LocalDate.parse("2026-04-08")
            },
        )
        verify(redisTemplate).keys("dashboard:*")
        verify(redisTemplate).keys("leaderboard:*")
    }

    @Test
    fun `regenerate recurring tasks picks a different assignee when task count differs from member count`() {
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Emma", "emma@example.com", id = 2),
                member("Kasper", "kasper@example.com", id = 1),
            ),
        )
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                TaskItem(
                    id = 1,
                    title = "Kitchen",
                    assignee = "Emma",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.parse("2026-04-01"),
                    category = TaskCategory.CLEANING,
                    xp = 20,
                    recurrenceRule = "WEEKLY",
                    recurring = true,
                ),
            ),
        )
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        operations.regenerateRecurringTasksForCollective("ABC123")

        verify(taskRepository).save(
            check {
                assertEquals("Kitchen", it.title)
                assertEquals("Kasper", it.assignee)
                assertEquals(LocalDate.parse("2026-04-08"), it.dueDate)
            },
        )
    }

    private fun member(
        name: String,
        email: String,
        id: Long = 1,
        collectiveCode: String? = "ABC123",
        xp: Int = 0,
        level: Int = 1,
        status: MemberStatus = MemberStatus.ACTIVE,
    ) = Member(
        id = id,
        name = name,
        email = email,
        collectiveCode = collectiveCode,
        xp = xp,
        level = level,
        status = status,
    )
}
