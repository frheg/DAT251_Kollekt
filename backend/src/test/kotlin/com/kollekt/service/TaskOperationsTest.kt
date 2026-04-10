package com.kollekt.service

import com.kollekt.api.dto.CreateTaskRequest
import com.kollekt.domain.Member
import com.kollekt.domain.MemberStatus
import com.kollekt.domain.TaskCategory
import com.kollekt.domain.TaskItem
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.TaskRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.LocalDate
import java.util.Optional

class TaskOperationsTest {
    private lateinit var taskRepository: TaskRepository
    private lateinit var memberRepository: MemberRepository
    private lateinit var eventPublisher: IntegrationEventPublisher
    private lateinit var realtimeUpdateService: RealtimeUpdateService
    private lateinit var notificationService: NotificationService
    private lateinit var operations: TaskOperations

    @BeforeEach
    fun setUp() {
        taskRepository = mock()
        memberRepository = mock()
        eventPublisher = mock()
        realtimeUpdateService = mock()
        notificationService = mock()
        operations =
            TaskOperations(
                taskRepository = taskRepository,
                memberRepository = memberRepository,
                eventPublisher = eventPublisher,
                realtimeUpdateService = realtimeUpdateService,
                notificationService = notificationService,
            )
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

        var cachesCleared = false
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
                requireCollectiveCodeByMemberName = { "ABC123" },
                clearTaskCaches = { cachesCleared = true },
            )

        assertTrue(cachesCleared)
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
                requireCollectiveCodeByMemberName = { "ABC123" },
                clearTaskCaches = {},
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

        var cachesCleared = false
        val result =
            operations.toggleTask(
                taskId = 11,
                memberName = "Kasper",
                requireCollectiveCodeByMemberName = { "ABC123" },
                clearTaskCaches = { cachesCleared = true },
            )

        assertTrue(cachesCleared)
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

        var cachesCleared = false
        val result =
            operations.regretMissedTask(
                taskId = 9,
                memberName = "Emma",
                clearTaskCaches = { cachesCleared = true },
            )

        assertTrue(cachesCleared)
        assertTrue(result.completed)
        assertEquals(0, result.penaltyXp)
        verify(memberRepository).save(
            org.mockito.kotlin.check {
                assertEquals(130, it.xp)
            },
        )
        verify(eventPublisher).taskEvent("TASK_REGRET", result)
    }

    @Test
    fun `regenerate recurring tasks rotates assignees when members and tasks match`() {
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
                    title = "Bathroom",
                    assignee = "Emma",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.parse("2026-04-07"),
                    category = TaskCategory.CLEANING,
                    recurring = true,
                    recurrenceRule = "WEEKLY",
                ),
                TaskItem(
                    id = 2,
                    title = "Kitchen",
                    assignee = "Kasper",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.parse("2026-04-07"),
                    category = TaskCategory.CLEANING,
                    recurring = true,
                    recurrenceRule = "WEEKLY",
                ),
            ),
        )

        val taskCaptor = argumentCaptor<TaskItem>()
        whenever(taskRepository.save(taskCaptor.capture())).thenAnswer { it.arguments[0] as TaskItem }

        var cachesCleared = false
        operations.regenerateRecurringTasksForCollective("ABC123") { cachesCleared = true }

        assertTrue(cachesCleared)
        assertEquals(2, taskCaptor.allValues.size)
        val assignments = taskCaptor.allValues.associate { it.title to it.assignee }
        assertEquals("Kasper", assignments["Bathroom"])
        assertEquals("Emma", assignments["Kitchen"])
        assertTrue(taskCaptor.allValues.all { it.dueDate == LocalDate.parse("2026-04-14") })
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
