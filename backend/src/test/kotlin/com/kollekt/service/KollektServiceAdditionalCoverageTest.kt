package com.kollekt.service

import com.kollekt.api.dto.AddReactionRequest
import com.kollekt.api.dto.CreatePollRequest
import com.kollekt.api.dto.LogoutRequest
import com.kollekt.api.dto.MonthlyPrizeRequest
import com.kollekt.api.dto.RemoveReactionRequest
import com.kollekt.api.dto.VotePollRequest
import com.kollekt.domain.CalendarEvent
import com.kollekt.domain.ChatMessage
import com.kollekt.domain.Collective
import com.kollekt.domain.EventType
import com.kollekt.domain.Member
import com.kollekt.domain.MemberStatus
import com.kollekt.domain.TaskCategory
import com.kollekt.domain.TaskItem
import com.kollekt.repository.AchievementRepository
import com.kollekt.repository.ChatMessageRepository
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.EventRepository
import com.kollekt.repository.ExpenseRepository
import com.kollekt.repository.InvitationRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.PantEntryRepository
import com.kollekt.repository.RoomRepository
import com.kollekt.repository.SettlementCheckpointRepository
import com.kollekt.repository.ShoppingItemRepository
import com.kollekt.repository.TaskRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.check
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.ValueOperations
import org.springframework.mock.web.MockMultipartFile
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.util.Base64
import java.util.Optional

class KollektServiceAdditionalCoverageTest {
    private lateinit var invitationRepository: InvitationRepository
    private lateinit var roomRepository: RoomRepository
    private lateinit var memberRepository: MemberRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var taskRepository: TaskRepository
    private lateinit var shoppingItemRepository: ShoppingItemRepository
    private lateinit var eventRepository: EventRepository
    private lateinit var chatMessageRepository: ChatMessageRepository
    private lateinit var expenseRepository: ExpenseRepository
    private lateinit var settlementCheckpointRepository: SettlementCheckpointRepository
    private lateinit var pantEntryRepository: PantEntryRepository
    private lateinit var achievementRepository: AchievementRepository
    private lateinit var redisTemplate: RedisTemplate<String, Any>
    private lateinit var eventPublisher: IntegrationEventPublisher
    private lateinit var realtimeUpdateService: RealtimeUpdateService
    private lateinit var passwordEncoder: org.springframework.security.crypto.password.PasswordEncoder
    private lateinit var tokenService: TokenService
    private lateinit var notificationService: NotificationService
    private lateinit var valueOps: ValueOperations<String, Any>
    private lateinit var service: KollektService

    @BeforeEach
    fun setUp() {
        invitationRepository = mock()
        roomRepository = mock()
        memberRepository = mock()
        collectiveRepository = mock()
        taskRepository = mock()
        shoppingItemRepository = mock()
        eventRepository = mock()
        chatMessageRepository = mock()
        expenseRepository = mock()
        settlementCheckpointRepository = mock()
        pantEntryRepository = mock()
        achievementRepository = mock()
        redisTemplate = mock()
        eventPublisher = mock()
        realtimeUpdateService = mock()
        passwordEncoder = mock()
        tokenService = mock()
        notificationService = mock()
        valueOps = mock()
        doReturn(valueOps).whenever(redisTemplate).opsForValue()

        service =
            KollektService(
                memberRepository,
                collectiveRepository,
                taskRepository,
                shoppingItemRepository,
                eventRepository,
                chatMessageRepository,
                expenseRepository,
                settlementCheckpointRepository,
                pantEntryRepository,
                achievementRepository,
                redisTemplate,
                eventPublisher,
                realtimeUpdateService,
                passwordEncoder,
                tokenService,
                invitationRepository,
                roomRepository,
                notificationService,
            )
    }

    @Test
    fun `notify upcoming task deadlines emits realtime and notification reminders`() {
        whenever(taskRepository.findAll()).thenReturn(
            listOf(
                task(id = 1, title = "Trash", assignee = "Emma", dueDate = LocalDate.now().plusDays(1)),
                task(id = 2, title = "Done", assignee = "Emma", dueDate = LocalDate.now().plusDays(1), completed = true),
                task(id = 3, title = "Later", assignee = "Emma", dueDate = LocalDate.now().plusDays(3)),
            ),
        )

        service.notifyUpcomingTaskDeadlines()

        verify(realtimeUpdateService).publish(
            eq("ABC123"),
            eq("TASK_DEADLINE_SOON"),
            check<Map<String, Any>> {
                assertEquals("Emma", it["assignee"])
                assertEquals("Trash", it["title"])
            },
        )
        verify(notificationService).createCustomNotification(
            "Emma",
            "Your task 'Trash' is due in 1 day(s).",
            "TASK_DEADLINE_SOON",
        )
    }

    @Test
    fun `delete expired tasks removes overdue incomplete tasks`() {
        val expiredTask = task(id = 1, title = "Expired", assignee = "Emma", dueDate = LocalDate.now().minusDays(6))
        whenever(taskRepository.findAll()).thenReturn(
            listOf(
                expiredTask,
                task(id = 2, title = "Done", assignee = "Emma", dueDate = LocalDate.now().minusDays(10), completed = true),
                task(id = 3, title = "Recent", assignee = "Emma", dueDate = LocalDate.now().minusDays(2)),
            ),
        )

        service.deleteExpiredTasks()

        verify(taskRepository).deleteAll(listOf(expiredTask))
    }

    @Test
    fun `give task feedback saves updated task and publishes update`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(4, "ABC123")).thenReturn(
            task(id = 4, title = "Kitchen", assignee = "Kasper"),
        )
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        val result = service.giveTaskFeedback(4, "Kasper", "Nice work")

        verify(taskRepository).save(
            check {
                assertEquals("Nice work", it.assignmentFeedback)
            },
        )
        verify(eventPublisher).taskEvent("TASK_FEEDBACK_UPDATED", result)
        verify(realtimeUpdateService).publish("ABC123", "TASK_FEEDBACK_UPDATED", result)
    }

    @Test
    fun `regret task marks task complete with reduced xp and clears caches`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(4, "ABC123")).thenReturn(
            task(id = 4, title = "Kitchen", assignee = "Kasper", xp = 9),
        )
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }
        doReturn(setOf("dashboard:Kasper")).whenever(redisTemplate).keys("dashboard:*")
        doReturn(setOf("leaderboard:ABC123")).whenever(redisTemplate).keys("leaderboard:*")

        val result = service.regretTask(4, "Kasper")

        assertTrue(result.completed)
        assertEquals(4, result.xp)
        verify(redisTemplate).delete(setOf("dashboard:Kasper"))
        verify(redisTemplate).delete(setOf("leaderboard:ABC123"))
        verify(notificationService).createCustomNotification(
            "Kasper",
            "Du fullførte oppgaven 'Kitchen' for sent. XP er redusert.",
            "TASK_COMPLETED_LATE",
        )
    }

    @Test
    fun `leave collective clears membership and redistributes incomplete tasks`() {
        val kasper = member("Kasper", "kasper@example.com")
        val emma = member("Emma", "emma@example.com", id = 2)
        val ola = member("Ola", "ola@example.com", id = 3)
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(listOf(kasper, emma, ola))
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                task(id = 1, title = "Trash", assignee = "Kasper", xp = 20),
                task(id = 2, title = "Floors", assignee = "Emma", xp = 30),
            ),
        )
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        service.leaveCollective("Kasper")

        verify(memberRepository).save(kasper.copy(collectiveCode = null))
        verify(taskRepository).save(
            check {
                assertEquals(1L, it.id)
                assertEquals("Ola", it.assignee)
            },
        )
    }

    @Test
    fun `penalize missed tasks applies penalty and notifies collective`() {
        val overdue = task(id = 5, title = "Trash", assignee = "Kasper", xp = 10, dueDate = LocalDate.now().minusDays(1))
        val kasper = member("Kasper", "kasper@example.com").copy(xp = 50)
        val emma = member("Emma", "emma@example.com", id = 2)
        val away = member("Ola", "ola@example.com", id = 3).copy(status = MemberStatus.AWAY)
        whenever(taskRepository.findAll()).thenReturn(listOf(overdue))
        whenever(memberRepository.findByNameAndCollectiveCode("Kasper", "ABC123")).thenReturn(kasper)
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(listOf(kasper, emma, away))
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        service.penalizeMissedTasks()

        verify(memberRepository).save(kasper.copy(xp = 40))
        verify(taskRepository).save(
            check {
                assertEquals(-10, it.penaltyXp)
            },
        )
        verify(notificationService).createCustomNotification(
            "Kasper",
            "Your task 'Trash' is overdue! A penalty has been applied.",
            "TASK_OVERDUE",
        )
        verify(notificationService).createGroupNotification(
            listOf("Emma"),
            "Task 'Trash' assigned to Kasper is overdue and not completed.",
            "TASK_OVERDUE_GROUP",
        )
    }

    @Test
    fun `penalize missed tasks adjusts an existing penalty when xp changed`() {
        val overdue =
            task(
                id = 5,
                title = "Trash",
                assignee = "Kasper",
                xp = 10,
                dueDate = LocalDate.now().minusDays(1),
                penaltyXp = -3,
            )
        val kasper = member("Kasper", "kasper@example.com").copy(xp = 20)
        whenever(taskRepository.findAll()).thenReturn(listOf(overdue))
        whenever(memberRepository.findByNameAndCollectiveCode("Kasper", "ABC123")).thenReturn(kasper)
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        service.penalizeMissedTasks()

        verify(memberRepository).save(kasper.copy(xp = 13))
        verify(taskRepository).save(
            check {
                assertEquals(-10, it.penaltyXp)
            },
        )
        verify(notificationService, never()).createCustomNotification(any(), any(), any())
    }

    @Test
    fun `regret missed task restores xp marks task complete and publishes update`() {
        val task =
            task(
                id = 7,
                title = "Trash",
                assignee = "Kasper",
                xp = 9,
                penaltyXp = -9,
                completed = false,
            )
        val kasper = member("Kasper", "kasper@example.com").copy(xp = 10)
        whenever(taskRepository.findById(7)).thenReturn(Optional.of(task))
        whenever(memberRepository.findByNameAndCollectiveCode("Kasper", "ABC123")).thenReturn(kasper)
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }
        doReturn(setOf("dashboard:Kasper")).whenever(redisTemplate).keys("dashboard:*")
        doReturn(setOf("leaderboard:ABC123")).whenever(redisTemplate).keys("leaderboard:*")

        val result = service.regretMissedTask(7, "Kasper")

        assertTrue(result.completed)
        verify(memberRepository).save(kasper.copy(xp = 24))
        verify(eventPublisher).taskEvent("TASK_REGRET", result)
        verify(realtimeUpdateService).publish("ABC123", "TASK_REGRET", result)
    }

    @Test
    fun `delete event removes google event before deleting local record`() {
        val googleCalendarService: GoogleCalendarService = mock()
        injectGoogleCalendarService(googleCalendarService)
        val event =
            CalendarEvent(
                id = 3,
                title = "Movie night",
                collectiveCode = "ABC123",
                date = LocalDate.now().plusDays(1),
                time = LocalTime.NOON,
                type = EventType.MOVIE,
                organizer = "Kasper",
                attendees = 3,
                googleEventId = "google-123",
            )
        val kasper = member("Kasper", "kasper@example.com").copy(googleAccessToken = "token")
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)
        whenever(eventRepository.findById(3)).thenReturn(Optional.of(event))

        service.deleteEvent(3, "Kasper")

        verify(googleCalendarService).deleteGoogleEvent(kasper, "google-123")
        verify(eventRepository).delete(event)
        verify(eventPublisher).chatEvent("EVENT_DELETED", mapOf("id" to 3L))
    }

    @Test
    fun `save google calendar tokens persists exchanged credentials`() {
        val googleCalendarService: GoogleCalendarService = mock()
        injectGoogleCalendarService(googleCalendarService)
        val kasper = member("Kasper", "kasper@example.com").copy(googleRefreshToken = "old-refresh")
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)
        whenever(googleCalendarService.exchangeCode("auth-code")).thenReturn("access-token" to "refresh-token")

        service.saveGoogleCalendarTokens("Kasper", "auth-code")

        verify(memberRepository).save(
            kasper.copy(
                googleAccessToken = "access-token",
                googleRefreshToken = "refresh-token",
            ),
        )
    }

    @Test
    fun `google calendar connection helpers reflect member token state`() {
        val googleCalendarService: GoogleCalendarService = mock()
        injectGoogleCalendarService(googleCalendarService)
        val connectedMember = member("Kasper", "kasper@example.com").copy(googleAccessToken = "token", googleRefreshToken = "refresh")
        whenever(memberRepository.findByName("Kasper")).thenReturn(connectedMember)
        whenever(googleCalendarService.isConnected(connectedMember)).thenReturn(true)

        assertTrue(service.isGoogleCalendarConnected("Kasper"))

        service.disconnectGoogleCalendar("Kasper")

        verify(memberRepository).save(connectedMember.copy(googleAccessToken = null, googleRefreshToken = null))
    }

    @Test
    fun `create image message stores image payload and publishes event`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer {
            (it.arguments[0] as ChatMessage).copy(id = 11)
        }
        val image = MockMultipartFile("image", "cleanup.png", "image/png", "img".toByteArray())

        val result = service.createImageMessage(image, "  Finished  ", "Kasper")

        assertEquals("Finished", result.text)
        assertEquals("image/png", result.imageMimeType)
        assertEquals("cleanup.png", result.imageFileName)
        assertEquals(Base64.getEncoder().encodeToString("img".toByteArray()), result.imageData)
        verify(eventPublisher).chatEvent("MESSAGE_CREATED", result)
        verify(realtimeUpdateService).publish("ABC123", "MESSAGE_CREATED", result)
    }

    @Test
    fun `add reaction replaces actor previous reaction and returns sorted dto`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(chatMessageRepository.findById(9)).thenReturn(
            Optional.of(
                ChatMessage(
                    id = 9,
                    sender = "Emma",
                    collectiveCode = "ABC123",
                    text = "Hi",
                    timestamp = LocalDateTime.now(),
                    reactions = """{"❤️":["Kasper"],"👍":["Emma"]}""",
                ),
            ),
        )
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer { it.arguments[0] as ChatMessage }

        val result = service.addReaction(9, "😂", "Kasper")

        assertEquals(listOf("Emma"), result.reactions.single { it.emoji == "👍" }.users)
        assertEquals(listOf("Kasper"), result.reactions.single { it.emoji == "😂" }.users)
        assertNull(result.reactions.find { it.emoji == "❤️" })
        verify(realtimeUpdateService).publish("ABC123", "MESSAGE_REACTION_UPDATED", result)
    }

    @Test
    fun `remove reaction drops empty emoji groups from message`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(chatMessageRepository.findById(9)).thenReturn(
            Optional.of(
                ChatMessage(
                    id = 9,
                    sender = "Emma",
                    collectiveCode = "ABC123",
                    text = "Hi",
                    timestamp = LocalDateTime.now(),
                    reactions = """{"😂":["Kasper"],"👍":["Emma","Kasper"]}""",
                ),
            ),
        )
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer { it.arguments[0] as ChatMessage }

        val result = service.removeReaction(9, "😂", "Kasper")

        assertEquals(1, result.reactions.size)
        assertEquals("👍", result.reactions.single().emoji)
        verify(realtimeUpdateService).publish("ABC123", "MESSAGE_REACTION_UPDATED", result)
    }

    @Test
    fun `create poll normalizes input and returns poll payload`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer {
            (it.arguments[0] as ChatMessage).copy(id = 15)
        }

        val result =
            service.createPoll(
                CreatePollRequest(
                    question = "  Favorite snack?  ",
                    options = listOf(" Chips ", "Soda", "Chips", ""),
                ),
                "Kasper",
            )

        assertTrue(result.text.contains("Favorite snack?"))
        assertNotNull(result.poll)
        assertEquals("Favorite snack?", result.poll!!.question)
        assertEquals(listOf("Chips", "Soda"), result.poll!!.options.map { it.text })
        verify(eventPublisher).chatEvent("MESSAGE_CREATED", result)
        verify(realtimeUpdateService).publish("ABC123", "MESSAGE_CREATED", result)
    }

    @Test
    fun `vote poll moves actor vote between options and publishes update`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(chatMessageRepository.findById(15)).thenReturn(
            Optional.of(
                ChatMessage(
                    id = 15,
                    sender = "Emma",
                    collectiveCode = "ABC123",
                    text = "Poll",
                    timestamp = LocalDateTime.now(),
                    poll =
                        """
                        {"question":"Favorite snack?","options":[
                          {"id":0,"text":"Chips","users":["Emma","Kasper"]},
                          {"id":1,"text":"Soda","users":[]}
                        ]}
                        """.trimIndent(),
                ),
            ),
        )
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer { it.arguments[0] as ChatMessage }

        val result = service.votePoll(15, 1, "Kasper")

        assertTrue(
            result.poll!!
                .options
                .single { it.id == 0 }
                .users
                .none { it == "Kasper" },
        )
        assertEquals(
            listOf("Kasper"),
            result.poll!!
                .options
                .single { it.id == 1 }
                .users,
        )
        verify(realtimeUpdateService).publish("ABC123", "MESSAGE_POLL_UPDATED", result)
    }

    @Test
    fun `monthly prize can be read and updated while clearing leaderboard cache`() {
        val collective = Collective(id = 1, name = "Villa", joinCode = "ABC123", ownerMemberId = 1, monthlyPrize = "Pizza")
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(collective)
        doReturn(setOf("leaderboard:ABC123")).whenever(redisTemplate).keys("leaderboard:*")

        assertEquals("Pizza", service.getMonthlyPrize("Kasper"))

        service.setMonthlyPrize("Kasper", "Movie night")

        verify(collectiveRepository).save(collective.copy(monthlyPrize = "Movie night"))
        verify(redisTemplate).delete(setOf("leaderboard:ABC123"))
    }

    @Test
    fun `scheduled weekly rotation regenerates recurring tasks for all collectives`() {
        val collective = Collective(id = 1, name = "Villa", joinCode = "ABC123", ownerMemberId = 1)
        val recurringTask =
            task(
                id = 9,
                title = "Kitchen",
                assignee = "Emma",
                dueDate = LocalDate.now().plusDays(1),
                recurrenceRule = "WEEKLY",
                recurring = true,
            )
        whenever(collectiveRepository.findAll()).thenReturn(listOf(collective))
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(collective)
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Emma", "emma@example.com", id = 2),
                member("Kasper", "kasper@example.com"),
            ),
        )
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(listOf(recurringTask))
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        service.scheduledWeeklyTaskRotation()

        verify(taskRepository).save(
            check {
                assertEquals("Kitchen", it.title)
                assertEquals(LocalDate.now().plusDays(8), it.dueDate)
            },
        )
    }

    @Test
    fun `request dto accessors remain stable for controller bindings`() {
        assertEquals("😂", AddReactionRequest("😂").emoji)
        assertEquals("👍", RemoveReactionRequest("👍").emoji)
        assertEquals(2, VotePollRequest(2).optionId)
        assertEquals("Movie night", MonthlyPrizeRequest("Movie night").prize)
        assertEquals("refresh-token", LogoutRequest("refresh-token").refreshToken)
    }

    private fun injectGoogleCalendarService(googleCalendarService: GoogleCalendarService) {
        val field = KollektService::class.java.getDeclaredField("googleCalendarService")
        field.isAccessible = true
        field.set(service, googleCalendarService)
    }

    private fun member(
        name: String,
        email: String,
        id: Long = 1,
        collectiveCode: String = "ABC123",
    ) = Member(
        id = id,
        name = name,
        email = email,
        collectiveCode = collectiveCode,
    )

    private fun task(
        id: Long,
        title: String,
        assignee: String,
        dueDate: LocalDate = LocalDate.now().plusDays(1),
        xp: Int = 10,
        completed: Boolean = false,
        penaltyXp: Int = 0,
        recurrenceRule: String? = null,
        recurring: Boolean = recurrenceRule != null,
    ) = TaskItem(
        id = id,
        title = title,
        assignee = assignee,
        collectiveCode = "ABC123",
        dueDate = dueDate,
        category = TaskCategory.CLEANING,
        xp = xp,
        completed = completed,
        penaltyXp = penaltyXp,
        recurrenceRule = recurrenceRule,
        recurring = recurring,
    )
}
