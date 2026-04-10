package com.kollekt.service

import com.kollekt.api.dto.CreateCollectiveRequest
import com.kollekt.api.dto.CreateEventRequest
import com.kollekt.api.dto.CreateExpenseRequest
import com.kollekt.api.dto.CreateMessageRequest
import com.kollekt.api.dto.CreateTaskRequest
import com.kollekt.api.dto.CreateUserRequest
import com.kollekt.api.dto.DashboardResponse
import com.kollekt.api.dto.JoinCollectiveRequest
import com.kollekt.api.dto.LeaderboardResponse
import com.kollekt.api.dto.LoginRequest
import com.kollekt.api.dto.RefreshTokenRequest
import com.kollekt.api.dto.RoomRequest
import com.kollekt.api.dto.WeeklyStatsDto
import com.kollekt.domain.CalendarEvent
import com.kollekt.domain.ChatMessage
import com.kollekt.domain.Collective
import com.kollekt.domain.EventType
import com.kollekt.domain.Expense
import com.kollekt.domain.Invitation
import com.kollekt.domain.Member
import com.kollekt.domain.MemberStatus
import com.kollekt.domain.Room
import com.kollekt.domain.SettlementCheckpoint
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
import org.junit.jupiter.api.Assertions.assertSame
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito.lenient
import org.mockito.Mockito.times
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.ValueOperations
import org.springframework.security.crypto.password.PasswordEncoder
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class KollektServiceTest {
    @Mock
    lateinit var invitationRepository: InvitationRepository

    @Mock
    lateinit var roomRepository: RoomRepository

    @Mock
    lateinit var memberRepository: MemberRepository

    @Mock
    lateinit var collectiveRepository: CollectiveRepository

    @Mock
    lateinit var taskRepository: TaskRepository

    @Mock
    lateinit var shoppingItemRepository: ShoppingItemRepository

    @Mock
    lateinit var eventRepository: EventRepository

    @Mock
    lateinit var chatMessageRepository: ChatMessageRepository

    @Mock
    lateinit var expenseRepository: ExpenseRepository

    @Mock
    lateinit var settlementCheckpointRepository: SettlementCheckpointRepository

    @Mock
    lateinit var pantEntryRepository: PantEntryRepository

    @Mock
    lateinit var achievementRepository: AchievementRepository

    @Mock
    lateinit var redisTemplate: RedisTemplate<String, Any>

    @Mock
    lateinit var eventPublisher: IntegrationEventPublisher

    @Mock
    lateinit var realtimeUpdateService: RealtimeUpdateService

    @Mock
    lateinit var passwordEncoder: PasswordEncoder

    @Mock
    lateinit var tokenService: TokenService

    @Mock
    lateinit var notificationService: NotificationService

    private lateinit var accountOperations: AccountOperations
    private lateinit var memberOperations: MemberOperations
    private lateinit var collectiveOperations: CollectiveOperations
    private lateinit var taskOperations: TaskOperations
    private lateinit var shoppingOperations: ShoppingOperations
    private lateinit var eventOperations: EventOperations
    private lateinit var chatOperations: ChatOperations
    private lateinit var economyOperations: EconomyOperations
    private lateinit var valueOps: ValueOperations<String, Any>
    private lateinit var service: KollektService

    @BeforeEach
    fun setUp() {
        valueOps = mock()
        lenient().`when`(redisTemplate.opsForValue()).thenReturn(valueOps)
        accountOperations = AccountOperations(memberRepository, passwordEncoder, tokenService)
        memberOperations = MemberOperations(memberRepository, taskRepository)
        collectiveOperations =
            CollectiveOperations(
                memberRepository,
                collectiveRepository,
                taskRepository,
                invitationRepository,
                roomRepository,
            )
        taskOperations =
            TaskOperations(
                taskRepository,
                memberRepository,
                eventPublisher,
                realtimeUpdateService,
                notificationService,
            )
        shoppingOperations = ShoppingOperations(shoppingItemRepository, eventPublisher)
        eventOperations = EventOperations(memberRepository, eventRepository, eventPublisher)
        chatOperations = ChatOperations(chatMessageRepository, eventPublisher, realtimeUpdateService)
        economyOperations =
            EconomyOperations(
                memberRepository,
                expenseRepository,
                settlementCheckpointRepository,
                pantEntryRepository,
                eventPublisher,
                realtimeUpdateService,
            )
        service =
            KollektService(
                memberRepository,
                collectiveRepository,
                taskRepository,
                eventRepository,
                expenseRepository,
                achievementRepository,
                redisTemplate,
                accountOperations,
                memberOperations,
                collectiveOperations,
                taskOperations,
                shoppingOperations,
                eventOperations,
                chatOperations,
                economyOperations,
            )
    }

    @Test
    fun `getTasks sorts by dueDate within collective`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                TaskItem(
                    id = 1,
                    title = "A",
                    assignee = "Kasper",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.parse("2026-03-10"),
                    category = TaskCategory.OTHER,
                ),
                TaskItem(
                    id = 2,
                    title = "B",
                    assignee = "Kasper",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.parse("2026-03-01"),
                    category = TaskCategory.OTHER,
                ),
            ),
        )

        val result = service.getTasks("Kasper")

        assertEquals(listOf(2L, 1L), result.map { it.id })
    }

    @Test
    fun `createTask resolves collective from actor and validates assignee`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(memberRepository.findByNameAndCollectiveCode("Kasper", "ABC123"))
            .thenReturn(member("Kasper", "kasper@example.com"))
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("leaderboard:*")

        val taskCaptor = argumentCaptor<TaskItem>()
        whenever(taskRepository.save(taskCaptor.capture())).thenAnswer {
            taskCaptor.firstValue.copy(id = 10)
        }

        service.createTask(
            CreateTaskRequest(
                title = "Vask",
                assignee = "Kasper",
                dueDate = LocalDate.parse("2026-03-05"),
                category = TaskCategory.CLEANING,
                xp = 10,
                recurrenceRule = null,
            ),
            "Kasper",
        )

        assertEquals("ABC123", taskCaptor.firstValue.collectiveCode)
        verify(eventPublisher).taskEvent(eq("TASK_CREATED"), any())
    }

    @Test
    fun `toggleTask enforces collective scope`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(99, "ABC123")).thenReturn(null)

        assertThrows<IllegalArgumentException> {
            service.toggleTask(99, "Kasper")
        }
    }

    @Test
    fun `toggleTask awards half XP when completing overdue task`() {
        whenever(memberRepository.findByName("Kasper"))
            .thenReturn(member("Kasper", "kasper@example.com", xp = 100, level = 1))
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(11, "ABC123")).thenReturn(
            TaskItem(
                id = 11,
                title = "Task",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.parse("2026-03-01"),
                category = TaskCategory.OTHER,
                completed = false,
                xpAwarded = false,
                xp = 25,
            ),
        )
        whenever(memberRepository.findByNameAndCollectiveCode("Kasper", "ABC123"))
            .thenReturn(member("Kasper", "kasper@example.com", xp = 100, level = 1))
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("leaderboard:*")

        val result = service.toggleTask(11, "Kasper")

        assertTrue(result.completed)

        val memberCaptor = argumentCaptor<Member>()
        verify(memberRepository).save(memberCaptor.capture())
        assertEquals(112, memberCaptor.firstValue.xp)
    }

    @Test
    fun `toggleTask toggles completed task back to incomplete without awarding XP again`() {
        whenever(memberRepository.findByName("Kasper"))
            .thenReturn(member("Kasper", "kasper@example.com", xp = 125, level = 1))
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(11, "ABC123")).thenReturn(
            TaskItem(
                id = 11,
                title = "Task",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.parse("2026-03-01"),
                category = TaskCategory.OTHER,
                completed = true,
                xpAwarded = true,
                completedBy = "Kasper",
                completedAt = LocalDateTime.now(),
                xp = 25,
            ),
        )
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("leaderboard:*")

        val result = service.toggleTask(11, "Kasper")

        assertFalse(result.completed)
        verify(memberRepository, never()).save(any<Member>())
    }

    @Test
    fun `addFriend adds a new friend after validating both users`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(memberRepository.findByName("Emma")).thenReturn(member("Emma", "emma@example.com", id = 2))

        service.addFriend("Kasper", "Emma")

        service.removeFriend("Kasper", "Emma")
    }

    @Test
    fun `addFriend rejects duplicate friend relationship`() {
        whenever(memberRepository.findByName("Nora")).thenReturn(member("Nora", "nora@example.com"))
        whenever(memberRepository.findByName("Lars")).thenReturn(member("Lars", "lars@example.com", id = 2))

        service.addFriend("Nora", "Lars")

        assertThrows<IllegalArgumentException> {
            service.addFriend("Nora", "Lars")
        }
    }

    @Test
    fun `removeFriend fails when member has no friends`() {
        assertThrows<IllegalArgumentException> {
            service.removeFriend("Nobody", "Emma")
        }
    }

    @Test
    fun `getEvents sorts by date within collective`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(eventRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                CalendarEvent(
                    id = 2,
                    title = "Late",
                    collectiveCode = "ABC123",
                    date = LocalDate.parse("2026-03-10"),
                    time = LocalTime.NOON,
                    type = EventType.OTHER,
                    organizer = "Kasper",
                    attendees = 2,
                ),
                CalendarEvent(
                    id = 1,
                    title = "Early",
                    collectiveCode = "ABC123",
                    date = LocalDate.parse("2026-03-01"),
                    time = LocalTime.NOON,
                    type = EventType.DINNER,
                    organizer = "Emma",
                    attendees = 3,
                ),
            ),
        )

        val result = service.getEvents("Kasper")

        assertEquals(listOf(1L, 2L), result.map { it.id })
    }

    @Test
    fun `createEvent saves actor scoped event and clears dashboard cache`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        doReturn(setOf("dashboard:Kasper")).whenever(redisTemplate).keys("dashboard:*")

        val eventCaptor = argumentCaptor<CalendarEvent>()
        whenever(eventRepository.save(eventCaptor.capture())).thenAnswer {
            eventCaptor.firstValue.copy(id = 20)
        }

        val result =
            service.createEvent(
                CreateEventRequest(
                    title = "Movie night",
                    date = LocalDate.parse("2026-04-01"),
                    time = LocalTime.of(19, 0),
                    type = EventType.MOVIE,
                    organizer = "Ignored by service",
                    attendees = 4,
                    description = "Bring snacks",
                ),
                "Kasper",
            )

        assertEquals("ABC123", eventCaptor.firstValue.collectiveCode)
        assertEquals("Kasper", eventCaptor.firstValue.organizer)
        assertEquals(20L, result.id)
        verify(redisTemplate).delete(setOf("dashboard:Kasper"))
        verify(eventPublisher).chatEvent(eq("EVENT_CREATED"), any())
    }

    @Test
    fun `getMessages sorts by timestamp within collective`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(chatMessageRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                ChatMessage(
                    id = 2,
                    sender = "Emma",
                    collectiveCode = "ABC123",
                    text = "Later",
                    timestamp = LocalDateTime.parse("2026-03-02T10:15:00"),
                ),
                ChatMessage(
                    id = 1,
                    sender = "Kasper",
                    collectiveCode = "ABC123",
                    text = "Earlier",
                    timestamp = LocalDateTime.parse("2026-03-01T10:15:00"),
                ),
            ),
        )

        val result = service.getMessages("Kasper")

        assertEquals(listOf(1L, 2L), result.map { it.id })
    }

    @Test
    fun `createMessage publishes chat event and realtime update`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))

        val messageCaptor = argumentCaptor<ChatMessage>()
        whenever(chatMessageRepository.save(messageCaptor.capture())).thenAnswer {
            messageCaptor.firstValue.copy(id = 7)
        }

        val result =
            service.createMessage(
                CreateMessageRequest(sender = "Ignored by service", text = "Hei kollektiv"),
                "Kasper",
            )

        assertEquals("ABC123", messageCaptor.firstValue.collectiveCode)
        assertEquals("Kasper", messageCaptor.firstValue.sender)
        assertEquals(7L, result.id)
        verify(eventPublisher).chatEvent(eq("MESSAGE_CREATED"), any())
        verify(realtimeUpdateService).publish(eq("ABC123"), eq("MESSAGE_CREATED"), any())
    }

    @Test
    fun `getAchievements maps repository results`() {
        whenever(achievementRepository.findAll()).thenReturn(
            listOf(
                com.kollekt.domain.Achievement(
                    id = 1,
                    title = "Starter",
                    description = "Complete your first task",
                    icon = "star",
                    unlocked = true,
                    progress = 1,
                    total = 1,
                ),
            ),
        )

        val result = service.getAchievements()

        assertEquals(1, result.size)
        assertEquals("Starter", result.first().title)
        assertTrue(result.first().unlocked)
    }

    @Test
    fun `createUser trims input encodes password and returns tokenized auth response`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(null)
        whenever(memberRepository.findByEmail("kasper@example.com")).thenReturn(null)
        whenever(passwordEncoder.encode("supersecret")).thenReturn("encoded-password")
        whenever(memberRepository.save(any<Member>())).thenAnswer {
            (it.arguments[0] as Member).copy(id = 15)
        }
        whenever(tokenService.issueTokenPair(any<Member>())).thenReturn(
            TokenResult(
                accessToken = "access-token",
                refreshToken = "refresh-token",
                tokenType = "Bearer",
                expiresIn = 3600,
            ),
        )
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("leaderboard:*")

        val result = service.createUser(CreateUserRequest("  Kasper  ", "  KASPER@example.com ", "  supersecret  "))

        val memberCaptor = argumentCaptor<Member>()
        verify(memberRepository).save(memberCaptor.capture())
        assertEquals("Kasper", memberCaptor.firstValue.name)
        assertEquals("kasper@example.com", memberCaptor.firstValue.email)
        assertEquals("encoded-password", memberCaptor.firstValue.passwordHash)
        assertEquals("access-token", result.accessToken)
        assertEquals("Kasper", result.user.name)
    }

    @Test
    fun `createUser rejects duplicate email after normalization`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(null)
        whenever(memberRepository.findByEmail("kasper@example.com"))
            .thenReturn(member("Existing", "kasper@example.com", id = 2))

        assertThrows<IllegalArgumentException> {
            service.createUser(CreateUserRequest("Kasper", "KASPER@EXAMPLE.COM", "supersecret"))
        }
    }

    @Test
    fun `login returns auth response when credentials match`() {
        val existing = member("Kasper", "kasper@example.com").copy(passwordHash = "stored-hash")
        whenever(memberRepository.findByName("Kasper")).thenReturn(existing)
        whenever(passwordEncoder.matches("supersecret", "stored-hash")).thenReturn(true)
        whenever(tokenService.issueTokenPair(existing)).thenReturn(
            TokenResult("access-token", "refresh-token", "Bearer", 3600),
        )

        val result = service.login(LoginRequest("  Kasper  ", "  supersecret  "))

        assertEquals("access-token", result.accessToken)
        assertEquals("Kasper", result.user.name)
    }

    @Test
    fun `login rejects users without password hash`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))

        assertThrows<IllegalArgumentException> {
            service.login(LoginRequest("Kasper", "secret"))
        }
    }

    @Test
    fun `refreshToken returns auth response for rotated subject`() {
        val existing = member("Kasper", "kasper@example.com")
        whenever(tokenService.rotateRefreshToken("refresh-token")).thenReturn(RefreshResult("Kasper"))
        whenever(memberRepository.findByName("Kasper")).thenReturn(existing)
        whenever(tokenService.issueTokenPair(existing)).thenReturn(
            TokenResult("new-access", "new-refresh", "Bearer", 3600),
        )

        val result = service.refreshToken(RefreshTokenRequest("refresh-token"))

        assertEquals("new-access", result.accessToken)
        assertEquals("new-refresh", result.refreshToken)
    }

    @Test
    fun `logout revokes access token and ignores blank refresh token`() {
        val jwt = mock<org.springframework.security.oauth2.jwt.Jwt>()

        service.logout(jwt, "   ")

        verify(tokenService).revokeAccessToken(jwt)
        verify(tokenService, never()).revokeRefreshToken(any())
    }

    @Test
    fun `deleteTask removes task clears caches and publishes updates`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(9, "ABC123")).thenReturn(
            TaskItem(
                id = 9,
                title = "Trash",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.parse("2026-03-10"),
                category = TaskCategory.OTHER,
            ),
        )
        doReturn(setOf("dashboard:Kasper")).whenever(redisTemplate).keys("dashboard:*")
        doReturn(setOf("leaderboard:ABC123")).whenever(redisTemplate).keys("leaderboard:*")

        service.deleteTask(9, "Kasper")

        verify(taskRepository).deleteById(9)
        verify(redisTemplate).delete(setOf("dashboard:Kasper"))
        verify(redisTemplate).delete(setOf("leaderboard:ABC123"))
        verify(eventPublisher).taskEvent("TASK_DELETED", mapOf("id" to 9L))
        verify(realtimeUpdateService).publish("ABC123", "TASK_DELETED", mapOf("id" to 9L))
    }

    @Test
    fun `updateTask applies provided fields and falls back on invalid category`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(3, "ABC123")).thenReturn(
            TaskItem(
                id = 3,
                title = "Old",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.parse("2026-03-01"),
                category = TaskCategory.CLEANING,
                xp = 10,
                recurring = false,
            ),
        )
        whenever(memberRepository.findByNameAndCollectiveCode("Emma", "ABC123"))
            .thenReturn(member("Emma", "emma@example.com", id = 2))
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("leaderboard:*")

        val result =
            service.updateTask(
                3,
                mapOf(
                    "title" to "New",
                    "assignee" to "Emma",
                    "dueDate" to "2026-03-15",
                    "category" to "NOT_A_REAL_CATEGORY",
                    "xp" to 25,
                    "recurring" to true,
                ),
                "Kasper",
            )

        assertEquals("New", result.title)
        assertEquals("Emma", result.assignee)
        assertEquals(LocalDate.parse("2026-03-15"), result.dueDate)
        assertEquals(TaskCategory.CLEANING, result.category)
        assertEquals(25, result.xp)
        assertEquals("WEEKLY", result.recurrenceRule)
        verify(eventPublisher).taskEvent(eq("TASK_UPDATED"), any())
        verify(realtimeUpdateService).publish(eq("ABC123"), eq("TASK_UPDATED"), any())
    }

    @Test
    fun `updateTask rejects assignee outside collective`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(3, "ABC123")).thenReturn(
            TaskItem(
                id = 3,
                title = "Old",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.parse("2026-03-01"),
                category = TaskCategory.CLEANING,
            ),
        )
        whenever(memberRepository.findByNameAndCollectiveCode("Ola", "ABC123")).thenReturn(null)

        assertThrows<IllegalArgumentException> {
            service.updateTask(3, mapOf("assignee" to "Ola"), "Kasper")
        }
    }

    @Test
    fun `deleteUser reassigns incomplete tasks to remaining collective members`() {
        val deletedMember = member("Kasper", "kasper@example.com")
        val emma = member("Emma", "emma@example.com", id = 2)
        val ola = member("Ola", "ola@example.com", id = 3)
        whenever(memberRepository.findByName("Kasper")).thenReturn(deletedMember)
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(listOf(emma, ola))
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                TaskItem(
                    id = 1,
                    title = "Trash",
                    assignee = "Kasper",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.parse("2026-03-01"),
                    category = TaskCategory.OTHER,
                    completed = false,
                ),
                TaskItem(
                    id = 2,
                    title = "Vacuum",
                    assignee = "Kasper",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.parse("2026-03-02"),
                    category = TaskCategory.CLEANING,
                    completed = false,
                ),
                TaskItem(
                    id = 3,
                    title = "Done",
                    assignee = "Kasper",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.parse("2026-03-03"),
                    category = TaskCategory.OTHER,
                    completed = true,
                ),
            ),
        )
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        service.deleteUser("Kasper")

        verify(memberRepository).delete(deletedMember)
        val taskCaptor = argumentCaptor<TaskItem>()
        verify(taskRepository, times(2)).save(taskCaptor.capture())
        assertEquals(listOf("Emma", "Ola"), taskCaptor.allValues.map { it.assignee })
    }

    @Test
    fun `deleteUser only deletes member when collective has no other members`() {
        val deletedMember = member("Solo", "solo@example.com")
        whenever(memberRepository.findByName("Solo")).thenReturn(deletedMember)
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(emptyList())

        service.deleteUser("Solo")

        verify(memberRepository).delete(deletedMember)
        verify(taskRepository, never()).findAllByCollectiveCode(any())
        verify(taskRepository, never()).save(any<TaskItem>())
    }

    @Test
    fun `createExpense defaults participants to all collective members`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Kasper", "kasper@example.com"),
                member("Emma", "emma@example.com", id = 2),
            ),
        )
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("leaderboard:*")

        val expenseCaptor = argumentCaptor<Expense>()
        whenever(expenseRepository.save(expenseCaptor.capture())).thenAnswer {
            expenseCaptor.firstValue.copy(id = 1)
        }

        val result =
            service.createExpense(
                CreateExpenseRequest(
                    description = "Pizza",
                    amount = 200,
                    paidBy = "Kasper",
                    category = "Mat",
                    date = LocalDate.parse("2026-03-01"),
                    participantNames = emptyList(),
                ),
                "Kasper",
            )

        assertEquals(setOf("Kasper", "Emma"), expenseCaptor.firstValue.participantNames)
        assertEquals(listOf("Emma", "Kasper"), result.participantNames)
    }

    @Test
    fun `createExpense rejects participants outside collective`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Kasper", "kasper@example.com"),
                member("Emma", "emma@example.com", id = 2),
            ),
        )

        assertThrows<IllegalArgumentException> {
            service.createExpense(
                CreateExpenseRequest(
                    description = "Taxi",
                    amount = 300,
                    paidBy = "Kasper",
                    category = "Transport",
                    date = LocalDate.parse("2026-03-01"),
                    participantNames = listOf("Kasper", "Ola"),
                ),
                "Kasper",
            )
        }
    }

    @Test
    fun `getBalances uses explicit expense participants`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(settlementCheckpointRepository.findTopByCollectiveCodeOrderByIdDesc("ABC123")).thenReturn(null)
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("A", "a@example.com", id = 1),
                member("B", "b@example.com", id = 2),
                member("C", "c@example.com", id = 3),
            ),
        )
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                Expense(
                    id = 1,
                    description = "Test",
                    amount = 100,
                    paidBy = "A",
                    collectiveCode = "ABC123",
                    category = "Any",
                    date = LocalDate.parse("2026-03-01"),
                    participantNames = setOf("A", "B"),
                ),
            ),
        )

        val result = service.getBalances("Kasper")
        val map = result.associateBy { it.name }

        assertEquals(50, map.getValue("A").amount)
        assertEquals(-50, map.getValue("B").amount)
        assertEquals(0, map.getValue("C").amount)
    }

    @Test
    fun `getExpenses maps and sorts participant names`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                Expense(
                    id = 1,
                    description = "Old",
                    amount = 10,
                    paidBy = "Kasper",
                    collectiveCode = "ABC123",
                    category = "Any",
                    date = LocalDate.parse("2026-03-01"),
                    participantNames = setOf("Kasper", "Emma"),
                ),
                Expense(
                    id = 2,
                    description = "New",
                    amount = 20,
                    paidBy = "Emma",
                    collectiveCode = "ABC123",
                    category = "Any",
                    date = LocalDate.parse("2026-03-02"),
                    participantNames = setOf("Emma", "Kasper"),
                ),
            ),
        )

        val result = service.getExpenses("Kasper")

        assertEquals(listOf(2L, 1L), result.map { it.id })
        assertEquals(listOf("Emma", "Kasper"), result.first().participantNames)
    }

    @Test
    fun `getBalances ignores expenses before latest settle up checkpoint`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(settlementCheckpointRepository.findTopByCollectiveCodeOrderByIdDesc("ABC123")).thenReturn(
            SettlementCheckpoint(
                id = 10,
                collectiveCode = "ABC123",
                settledBy = "Kasper",
                lastExpenseId = 2,
            ),
        )
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("A", "a@example.com", id = 1),
                member("B", "b@example.com", id = 2),
            ),
        )
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                Expense(
                    id = 1,
                    description = "Before",
                    amount = 100,
                    paidBy = "A",
                    collectiveCode = "ABC123",
                    category = "Any",
                    date = LocalDate.parse("2026-03-01"),
                    participantNames = setOf("A", "B"),
                ),
                Expense(
                    id = 3,
                    description = "After",
                    amount = 60,
                    paidBy = "B",
                    collectiveCode = "ABC123",
                    category = "Any",
                    date = LocalDate.parse("2026-03-02"),
                    participantNames = setOf("A", "B"),
                ),
            ),
        )

        val result = service.getBalances("Kasper")
        val map = result.associateBy { it.name }

        assertEquals(-30, map.getValue("A").amount)
        assertEquals(30, map.getValue("B").amount)
    }

    @Test
    fun `settle up creates checkpoint at latest expense id`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(expenseRepository.findTopByCollectiveCodeOrderByIdDesc("ABC123")).thenReturn(
            Expense(
                id = 7,
                description = "Latest",
                amount = 1,
                paidBy = "Kasper",
                collectiveCode = "ABC123",
                category = "Any",
                date = LocalDate.parse("2026-03-01"),
                participantNames = setOf("Kasper"),
            ),
        )

        val checkpointCaptor = argumentCaptor<SettlementCheckpoint>()
        whenever(settlementCheckpointRepository.save(checkpointCaptor.capture())).thenAnswer {
            checkpointCaptor.firstValue.copy(id = 5)
        }

        val result = service.settleUp("Kasper")

        assertEquals("ABC123", checkpointCaptor.firstValue.collectiveCode)
        assertEquals("Kasper", checkpointCaptor.firstValue.settledBy)
        assertEquals(7, checkpointCaptor.firstValue.lastExpenseId)
        assertEquals(7, result.lastExpenseId)
        verify(eventPublisher).economyEvent(eq("BALANCES_SETTLED"), any())
    }

    @Test
    fun `getLeaderboard returns collective scoped cached value`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(collective())

        val cached =
            LeaderboardResponse(
                players = emptyList(),
                weeklyStats =
                    WeeklyStatsDto(
                        totalTasks = 0,
                        totalXp = 0,
                        avgPerPerson = 0,
                        topContributor = "N/A",
                    ),
            )

        whenever(valueOps.get("leaderboard:ABC123:OVERALL")).thenReturn(cached)

        val result = service.getLeaderboard("Kasper")

        assertSame(cached, result)
        verify(taskRepository, never()).findAllByCollectiveCode(any())
        verify(memberRepository, never()).findAllByCollectiveCode(any())
    }

    @Test
    fun `getDashboard returns cached value`() {
        val cached =
            DashboardResponse(
                currentUserName = "Kasper",
                currentUserXp = 1,
                currentUserLevel = 1,
                currentUserRank = 1,
                upcomingTasks = emptyList(),
                upcomingEvents = emptyList(),
                recentExpenses = emptyList(),
            )

        whenever(valueOps.get("dashboard:Kasper")).thenReturn(cached)

        val result = service.getDashboard("Kasper")

        assertSame(cached, result)
        verifyNoInteractions(memberRepository, taskRepository, eventRepository, expenseRepository)
    }

    @Test
    fun `getDashboard aggregates collective scoped data`() {
        whenever(valueOps.get(any())).thenReturn(null)
        val now = LocalDate.now()

        whenever(memberRepository.findByName("Kasper"))
            .thenReturn(member("Kasper", "kasper@example.com", xp = 10, level = 2))
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(collective())
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Kasper", "kasper@example.com", xp = 10, level = 2),
                member("Emma", "emma@example.com", id = 2, xp = 20, level = 3),
            ),
        )
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                TaskItem(
                    id = 1,
                    title = "Done",
                    assignee = "Kasper",
                    collectiveCode = "ABC123",
                    dueDate = now.plusDays(1),
                    category = TaskCategory.OTHER,
                    completed = true,
                ),
                TaskItem(
                    id = 2,
                    title = "Todo",
                    assignee = "Kasper",
                    collectiveCode = "ABC123",
                    dueDate = now.plusDays(2),
                    category = TaskCategory.OTHER,
                    completed = false,
                ),
            ),
        )
        whenever(eventRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                CalendarEvent(
                    id = 1,
                    title = "Past",
                    collectiveCode = "ABC123",
                    date = now.minusDays(1),
                    time = LocalTime.NOON,
                    type = EventType.OTHER,
                    organizer = "Kasper",
                    attendees = 1,
                ),
                CalendarEvent(
                    id = 2,
                    title = "Next",
                    collectiveCode = "ABC123",
                    date = now.plusDays(1),
                    time = LocalTime.NOON,
                    type = EventType.OTHER,
                    organizer = "Kasper",
                    attendees = 1,
                ),
            ),
        )
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                Expense(
                    id = 1,
                    description = "E",
                    amount = 1,
                    paidBy = "Kasper",
                    collectiveCode = "ABC123",
                    category = "Any",
                    date = now,
                    participantNames = setOf("Kasper", "Emma"),
                ),
            ),
        )

        val result = service.getDashboard("Kasper")

        assertEquals("Kasper", result.currentUserName)
        assertEquals(listOf(2L), result.upcomingTasks.map { it.id })
        assertEquals(listOf(2L), result.upcomingEvents.map { it.id })
        assertEquals(listOf(1L), result.recentExpenses.map { it.id })
    }

    @Test
    fun `getDrinkingQuestion uses scoped leaderboard`() {
        whenever(valueOps.get(any())).thenReturn(null)
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(collective())
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Top", "top@example.com", xp = 10),
                member("Bottom", "bottom@example.com", id = 2, xp = 0),
            ),
        )
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(emptyList())

        val result = service.getDrinkingQuestion("Kasper")

        val texts = listOf("Top", "Bottom", "søppel", "handle", "Rock, paper, scissors")
        assertTrue(texts.any { result.text.contains(it) })
    }

    @Test
    fun `resetPassword finds user by email ignoring case and saves encoded password`() {
        val existing = member("Kasper", "kasper@example.com").copy(passwordHash = "old")
        whenever(memberRepository.findByEmail("kasper@example.com")).thenReturn(existing)
        whenever(passwordEncoder.encode("new-secret")).thenReturn("encoded-new-secret")

        service.resetPassword(null, " KASPER@example.com ", "new-secret")

        val memberCaptor = argumentCaptor<Member>()
        verify(memberRepository).save(memberCaptor.capture())
        assertEquals("encoded-new-secret", memberCaptor.firstValue.passwordHash)
    }

    @Test
    fun `resetPassword falls back to member name lookup`() {
        val existing = member("Nora", "nora@example.com").copy(passwordHash = "old")
        whenever(memberRepository.findByName("Nora")).thenReturn(existing)
        whenever(passwordEncoder.encode("fresh-pass")).thenReturn("encoded-fresh-pass")

        service.resetPassword(" Nora ", null, "fresh-pass")

        verify(memberRepository).save(
            org.mockito.kotlin.check {
                assertEquals("encoded-fresh-pass", it.passwordHash)
                assertEquals("Nora", it.name)
            },
        )
    }

    @Test
    fun `resetPassword throws when no matching user exists`() {
        whenever(memberRepository.findByName("Missing")).thenReturn(null)

        assertThrows<IllegalArgumentException> {
            service.resetPassword("Missing", null, "whatever")
        }
    }

    @Test
    fun `getUserByName returns mapped friend list`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(memberRepository.findByName("Emma")).thenReturn(member("Emma", "emma@example.com", id = 2))

        service.addFriend("Kasper", "Emma")
        val result = service.getUserByName("Kasper")

        assertEquals("Kasper", result.name)
        assertEquals(listOf("Emma"), result.friends.map { it.name })
    }

    @Test
    fun `updateMemberStatus saves updated status`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))

        service.updateMemberStatus("Kasper", MemberStatus.AWAY)

        val memberCaptor = argumentCaptor<Member>()
        verify(memberRepository).save(memberCaptor.capture())
        assertEquals(MemberStatus.AWAY, memberCaptor.firstValue.status)
    }

    @Test
    fun `createCollective creates rooms residents and recurring tasks`() {
        val owner = member("Kasper", "kasper@example.com", id = 1).copy(collectiveCode = null)
        val existingResident = member("Ola", "ola@example.com", id = 2).copy(collectiveCode = null)
        whenever(memberRepository.findById(1)).thenReturn(Optional.of(owner))
        whenever(collectiveRepository.save(any<Collective>())).thenAnswer {
            (it.arguments[0] as Collective).copy(id = 99)
        }
        whenever(roomRepository.save(any<Room>())).thenAnswer { it.arguments[0] as Room }
        whenever(memberRepository.findByName("Emma")).thenReturn(null)
        whenever(memberRepository.findByName("Ola")).thenReturn(existingResident)
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("leaderboard:*")

        val result =
            service.createCollective(
                CreateCollectiveRequest(
                    name = "  Villa Kollekt  ",
                    ownerUserId = 1,
                    numRooms = 2,
                    residents = listOf("Kasper", "Emma", "Ola"),
                    rooms = listOf(RoomRequest("Kitchen", 20), RoomRequest("Bathroom", 30)),
                ),
            )

        assertEquals("Villa Kollekt", result.name)
        assertEquals(99L, result.id)
        verify(roomRepository, times(2)).save(any<Room>())
        val taskCaptor = argumentCaptor<TaskItem>()
        verify(taskRepository, times(2)).save(taskCaptor.capture())
        assertEquals(listOf("Vask Bathroom", "Vask Kitchen"), taskCaptor.allValues.map { it.title }.sorted())
        assertTrue(taskCaptor.allValues.all { it.recurrenceRule == "WEEKLY" })

        val savedMembers = argumentCaptor<Member>()
        verify(memberRepository, times(3)).save(savedMembers.capture())
        val collectiveCodes = savedMembers.allValues.mapNotNull { it.collectiveCode }.toSet()
        assertEquals(1, collectiveCodes.size)
        assertEquals(result.joinCode, collectiveCodes.first())
        assertTrue(savedMembers.allValues.any { it.name == "Emma" && it.email == "emma@example.com" })
        assertTrue(savedMembers.allValues.any { it.name == "Ola" && it.id == 2L })
    }

    @Test
    fun `joinCollective updates user accepts invitation and regenerates tasks`() {
        val collective = Collective(id = 10, name = "Villa", joinCode = "ABC123", ownerMemberId = 1)
        val user = member("Kasper", "kasper@example.com", id = 7).copy(collectiveCode = null)
        val invitation =
            Invitation(
                id = 5,
                email = "kasper@example.com",
                collectiveCode = "ABC123",
                invitedBy = "Emma",
            )
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(collective)
        whenever(memberRepository.findById(7)).thenReturn(Optional.of(user))
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(invitationRepository.findByEmailAndCollectiveCode("kasper@example.com", "ABC123")).thenReturn(invitation)
        whenever(invitationRepository.save(any<Invitation>())).thenAnswer { it.arguments[0] as Invitation }
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(user.copy(collectiveCode = "ABC123")),
        )
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(emptyList())
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("leaderboard:*")

        val result = service.joinCollective(JoinCollectiveRequest(userId = 7, joinCode = " abc123 "))

        assertEquals("ABC123", result.collectiveCode)
        verify(invitationRepository).save(
            org.mockito.kotlin.check {
                assertTrue(it.accepted)
                assertEquals("ABC123", it.collectiveCode)
            },
        )
    }

    @Test
    fun `joinCollective regenerates recurring tasks for active members and deletes stale future tasks`() {
        val collective = Collective(id = 10, name = "Villa", joinCode = "ABC123", ownerMemberId = 1)
        val joinedUser = member("Kasper", "kasper@example.com", id = 7).copy(collectiveCode = null)
        val emma = member("Emma", "emma@example.com", id = 2)
        val awayMember = member("Ola", "ola@example.com", id = 3).copy(status = MemberStatus.AWAY)
        val invitation =
            Invitation(
                id = 5,
                email = "kasper@example.com",
                collectiveCode = "ABC123",
                invitedBy = "Emma",
            )
        val manualRecurringTask =
            TaskItem(
                id = 50,
                title = "Buy soap",
                assignee = "Emma",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().plusDays(2),
                category = TaskCategory.SHOPPING,
                completed = false,
                recurring = true,
                xp = 15,
                recurrenceRule = "WEEKLY",
            )
        val futureCleaningTask =
            TaskItem(
                id = 60,
                title = "Old cleaning",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().plusDays(1),
                category = TaskCategory.CLEANING,
                completed = false,
                recurring = true,
                xp = 20,
                recurrenceRule = "WEEKLY",
            )
        val oldPastTask =
            TaskItem(
                id = 70,
                title = "Old past task",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().minusDays(5),
                category = TaskCategory.OTHER,
                completed = false,
                recurring = false,
                xp = 5,
            )

        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(collective)
        whenever(memberRepository.findById(7)).thenReturn(Optional.of(joinedUser))
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(invitationRepository.findByEmailAndCollectiveCode("kasper@example.com", "ABC123")).thenReturn(invitation)
        whenever(invitationRepository.save(any<Invitation>())).thenAnswer { it.arguments[0] as Invitation }
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(joinedUser.copy(collectiveCode = "ABC123"), emma, awayMember),
        )
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(manualRecurringTask, futureCleaningTask, oldPastTask),
        )
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("leaderboard:*")

        service.joinCollective(JoinCollectiveRequest(userId = 7, joinCode = "ABC123"))

        verify(taskRepository, never()).deleteById(any())

        val taskCaptor = argumentCaptor<TaskItem>()
        verify(taskRepository, times(4)).save(taskCaptor.capture())
        assertEquals(2, taskCaptor.allValues.count { it.title == "Buy soap" })
        assertEquals(2, taskCaptor.allValues.count { it.title == "Old cleaning" })
        assertTrue(taskCaptor.allValues.none { it.assignee == "Ola" })
        assertTrue(taskCaptor.allValues.filter { it.dueDate.isAfter(LocalDate.now().plusDays(7)) }.all { it.id == 0L && !it.completed })
    }

    @Test
    fun `joinCollective skips regeneration when collective has no active members`() {
        val collective = Collective(id = 10, name = "Villa", joinCode = "ABC123", ownerMemberId = 1)
        val user = member("Kasper", "kasper@example.com", id = 7).copy(collectiveCode = null)
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(collective)
        whenever(memberRepository.findById(7)).thenReturn(Optional.of(user))
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(invitationRepository.findByEmailAndCollectiveCode("kasper@example.com", "ABC123")).thenReturn(null)
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(user.copy(collectiveCode = "ABC123", status = MemberStatus.AWAY)),
        )
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("leaderboard:*")

        service.joinCollective(JoinCollectiveRequest(userId = 7, joinCode = "ABC123"))

        verify(roomRepository, never()).findAllByCollectiveId(any())
        verify(taskRepository).findAllByCollectiveCode("ABC123")
        verify(taskRepository, never()).save(any<TaskItem>())
    }

    @Test
    fun `inviteUserToCollective normalizes email and saves invitation`() {
        whenever(memberRepository.findByName("Emma")).thenReturn(member("Emma", "emma@example.com"))
        whenever(invitationRepository.findByEmailAndCollectiveCode("kasper@example.com", "ABC123")).thenReturn(null)
        whenever(invitationRepository.save(any<Invitation>())).thenAnswer { (it.arguments[0] as Invitation).copy(id = 3) }

        service.inviteUserToCollective("  KASPER@example.com ", "ABC123", "Emma")

        verify(invitationRepository).save(
            org.mockito.kotlin.check {
                assertEquals("kasper@example.com", it.email)
                assertEquals("ABC123", it.collectiveCode)
                assertEquals("Emma", it.invitedBy)
            },
        )
    }

    @Test
    fun `inviteUserToCollective rejects inviter outside collective`() {
        whenever(memberRepository.findByName("Emma")).thenReturn(
            member("Emma", "emma@example.com").copy(collectiveCode = "OTHER99"),
        )

        assertThrows<IllegalArgumentException> {
            service.inviteUserToCollective("kasper@example.com", "ABC123", "Emma")
        }
    }

    @Test
    fun `inviteUserToCollective rejects duplicate invitation`() {
        whenever(memberRepository.findByName("Emma")).thenReturn(member("Emma", "emma@example.com"))
        whenever(invitationRepository.findByEmailAndCollectiveCode("kasper@example.com", "ABC123")).thenReturn(
            Invitation(
                id = 1,
                email = "kasper@example.com",
                collectiveCode = "ABC123",
                invitedBy = "Emma",
            ),
        )

        assertThrows<IllegalArgumentException> {
            service.inviteUserToCollective("kasper@example.com", "ABC123", "Emma")
        }
    }

    @Test
    fun `getCollectiveCodeForUser returns join code for member`() {
        whenever(memberRepository.findById(7)).thenReturn(Optional.of(member("Kasper", "kasper@example.com", id = 7)))

        val result = service.getCollectiveCodeForUser(7)

        assertEquals("ABC123", result.joinCode)
    }

    @Test
    fun `getCollectiveCodeForUser throws when member has no collective`() {
        whenever(memberRepository.findById(8)).thenReturn(
            Optional.of(member("Lone", "lone@example.com", id = 8).copy(collectiveCode = null)),
        )

        assertThrows<IllegalArgumentException> {
            service.getCollectiveCodeForUser(8)
        }
    }

    @Test
    fun `getCollectiveMembers returns sorted users in same collective`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Ola", "ola@example.com", id = 2),
                member("Emma", "emma@example.com", id = 3),
            ),
        )

        val result = service.getCollectiveMembers("Kasper")

        assertEquals(listOf("Emma", "Ola"), result.map { it.name })
    }

    private fun member(
        name: String,
        email: String,
        id: Long = 1,
        collectiveCode: String = "ABC123",
        level: Int = 1,
        xp: Int = 0,
    ) = Member(
        id = id,
        name = name,
        email = email,
        collectiveCode = collectiveCode,
        level = level,
        xp = xp,
    )

    private fun collective(
        id: Long = 1,
        joinCode: String = "ABC123",
        name: String = "Test Collective",
        ownerMemberId: Long = 1,
        monthlyPrize: String? = null,
    ) = Collective(
        id = id,
        joinCode = joinCode,
        name = name,
        ownerMemberId = ownerMemberId,
        monthlyPrize = monthlyPrize,
    )
}
