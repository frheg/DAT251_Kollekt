package com.kollekt.service

import com.kollekt.api.dto.*
import com.kollekt.domain.*
import com.kollekt.repository.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.util.Optional
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.junit.jupiter.MockitoSettings
import org.mockito.quality.Strictness
import org.mockito.kotlin.*
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.ValueOperations


@ExtendWith(MockitoExtension::class)
@MockitoSettings(strictness = Strictness.LENIENT)
class KollektServiceTest {
    @Mock lateinit var memberRepository: MemberRepository
    @Mock lateinit var collectiveRepository: CollectiveRepository
    @Mock lateinit var taskRepository: TaskRepository
    @Mock lateinit var shoppingItemRepository: ShoppingItemRepository
    @Mock lateinit var eventRepository: EventRepository
    @Mock lateinit var chatMessageRepository: ChatMessageRepository
    @Mock lateinit var expenseRepository: ExpenseRepository
    @Mock lateinit var pantEntryRepository: PantEntryRepository
    @Mock lateinit var achievementRepository: AchievementRepository
    @Mock lateinit var redisTemplate: RedisTemplate<String, Any>
    @Mock lateinit var eventPublisher: IntegrationEventPublisher

    private lateinit var valueOps: ValueOperations<String, Any>
    private lateinit var service: KollektService

    @BeforeEach
    fun setUp() {
        valueOps = mock()
        whenever(redisTemplate.opsForValue()).thenReturn(valueOps)
        service =
            KollektService(
                memberRepository,
                collectiveRepository,
                taskRepository,
                shoppingItemRepository,
                eventRepository,
                chatMessageRepository,
                expenseRepository,
                pantEntryRepository,
                achievementRepository,
                redisTemplate,
                eventPublisher,
            )
    }

    @Test
    fun `getTasks sorts by dueDate`() {
        whenever(taskRepository.findAll()).thenReturn(
            listOf(
                TaskItem(id = 1, title = "A", assignee = "Emma", dueDate = LocalDate.parse("2026-03-10"), category = TaskCategory.OTHER),
                TaskItem(id = 2, title = "B", assignee = "Emma", dueDate = LocalDate.parse("2026-03-01"), category = TaskCategory.OTHER),
            ),
        )

        val result = service.getTasks()

        assertEquals(listOf(2L, 1L), result.map { it.id })
    }

    @Test
    fun `createTask saves, clears caches, and publishes event`() {
        doReturn(setOf("dashboard:Emma", "dashboard:Kasper")).whenever(redisTemplate).keys("dashboard:*")

        val savedTaskCaptor = argumentCaptor<TaskItem>()
        whenever(taskRepository.save(savedTaskCaptor.capture())).thenAnswer {
            savedTaskCaptor.firstValue.copy(id = 123)
        }

        val request =
            CreateTaskRequest(
                title = "Vaske bad",
                assignee = "Kasper",
                dueDate = LocalDate.parse("2026-03-02"),
                category = TaskCategory.CLEANING,
                xp = 50,
                recurring = true,
            )

        val result = service.createTask(request)

        assertEquals(123, result.id)
        assertEquals("Vaske bad", result.title)
        assertEquals("Kasper", result.assignee)
        assertEquals(TaskCategory.CLEANING, result.category)
        assertEquals(50, result.xp)
        assertTrue(result.recurring)
        assertFalse(result.completed)

        verify(redisTemplate).keys("dashboard:*")
        verify(redisTemplate).delete(eq(setOf("dashboard:Emma", "dashboard:Kasper")))
        verify(redisTemplate).delete("leaderboard:global")

        val payloadCaptor = argumentCaptor<Any>()
        verify(eventPublisher).taskEvent(eq("TASK_CREATED"), payloadCaptor.capture())
        assertTrue(payloadCaptor.firstValue is TaskDto)
        assertEquals(123, (payloadCaptor.firstValue as TaskDto).id)
    }

    @Test
    fun `toggleTask flips completed, clears caches, and publishes event`() {
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")

        val existing =
            TaskItem(
                id = 10,
                title = "Tømme søppel",
                assignee = "Kasper",
                dueDate = LocalDate.parse("2026-03-02"),
                category = TaskCategory.CLEANING,
                completed = false,
            )

        whenever(taskRepository.findById(10)).thenReturn(Optional.of(existing))
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        val result = service.toggleTask(10)

        assertTrue(result.completed)
        verify(redisTemplate).delete("leaderboard:global")

        val payloadCaptor = argumentCaptor<Any>()
        verify(eventPublisher).taskEvent(eq("TASK_TOGGLED"), payloadCaptor.capture())
        assertTrue(payloadCaptor.firstValue is TaskDto)
        assertEquals(true, (payloadCaptor.firstValue as TaskDto).completed)
    }

    @Test
    fun `toggleTask throws when task not found`() {
        whenever(taskRepository.findById(404)).thenReturn(Optional.empty())

        val ex = assertThrows<IllegalArgumentException> { service.toggleTask(404) }
        assertTrue(ex.message!!.contains("not found"))
    }

    @Test
    fun `shopping item create publishes task event`() {
        val savedCaptor = argumentCaptor<ShoppingItem>()
        whenever(shoppingItemRepository.save(savedCaptor.capture())).thenAnswer {
            savedCaptor.firstValue.copy(id = 7)
        }

        val result = service.createShoppingItem(CreateShoppingItemRequest(item = "Dopapir", addedBy = "Emma"))

        assertEquals(7, result.id)
        assertEquals("Dopapir", result.item)

        verify(eventPublisher).taskEvent(eq("SHOPPING_ITEM_CREATED"), any())
    }

    @Test
    fun `getShoppingItems maps all items`() {
        whenever(shoppingItemRepository.findAll()).thenReturn(
            listOf(
                ShoppingItem(id = 1, item = "Dopapir", addedBy = "Emma", completed = false),
                ShoppingItem(id = 2, item = "Kluter", addedBy = "Kasper", completed = true),
            ),
        )

        val result = service.getShoppingItems()

        assertEquals(listOf(1L, 2L), result.map { it.id })
        assertEquals(listOf("Dopapir", "Kluter"), result.map { it.item })
    }

    @Test
    fun `shopping item toggle flips completed and publishes`() {
        val existing = ShoppingItem(id = 5, item = "Kluter", addedBy = "Emma", completed = false)
        whenever(shoppingItemRepository.findById(5)).thenReturn(Optional.of(existing))
        whenever(shoppingItemRepository.save(any<ShoppingItem>())).thenAnswer { it.arguments[0] as ShoppingItem }

        val result = service.toggleShoppingItem(5)

        assertTrue(result.completed)
        verify(eventPublisher).taskEvent(eq("SHOPPING_ITEM_TOGGLED"), any())
    }

    @Test
    fun `shopping item toggle throws when item not found`() {
        whenever(shoppingItemRepository.findById(404)).thenReturn(Optional.empty())

        val ex = assertThrows<IllegalArgumentException> { service.toggleShoppingItem(404) }
        assertTrue(ex.message!!.contains("not found"))
    }

    @Test
    fun `shopping item delete deletes and publishes`() {
        service.deleteShoppingItem(9L)

        verify(shoppingItemRepository).deleteById(9)

        val payloadCaptor = argumentCaptor<Any>()
        verify(eventPublisher).taskEvent(eq("SHOPPING_ITEM_DELETED"), payloadCaptor.capture())
        @Suppress("UNCHECKED_CAST")
        val payload = payloadCaptor.firstValue as Map<String, Any>
        assertEquals(9L, payload["id"])
    }

    @Test
    fun `getEvents sorts by date`() {
        whenever(eventRepository.findAll()).thenReturn(
            listOf(
                CalendarEvent(id = 1, title = "A", date = LocalDate.parse("2026-03-10"), time = LocalTime.NOON, organizer = "Emma"),
                CalendarEvent(id = 2, title = "B", date = LocalDate.parse("2026-03-01"), time = LocalTime.NOON, organizer = "Emma"),
            ),
        )

        val result = service.getEvents()

        assertEquals(listOf(2L, 1L), result.map { it.id })
    }

    @Test
    fun `createEvent clears dashboard cache and publishes chat event`() {
        doReturn(setOf("dashboard:Emma")).whenever(redisTemplate).keys("dashboard:*")

        val savedCaptor = argumentCaptor<CalendarEvent>()
        whenever(eventRepository.save(savedCaptor.capture())).thenAnswer { savedCaptor.firstValue.copy(id = 44) }

        val result =
            service.createEvent(
                CreateEventRequest(
                    title = "Filmkveld",
                    date = LocalDate.parse("2026-03-03"),
                    time = LocalTime.parse("19:00"),
                    type = EventType.MOVIE,
                    organizer = "Emma",
                    attendees = 5,
                    description = "Ta med snacks",
                ),
            )

        assertEquals(44, result.id)
        verify(redisTemplate).delete(eq(setOf("dashboard:Emma")))
        verify(eventPublisher).chatEvent(eq("EVENT_CREATED"), any())
    }

    @Test
    fun `createMessage saves and publishes chat event`() {
        val savedCaptor = argumentCaptor<ChatMessage>()
        whenever(chatMessageRepository.save(savedCaptor.capture())).thenAnswer {
            savedCaptor.firstValue.copy(id = 3)
        }

        val result = service.createMessage(CreateMessageRequest(sender = "Kasper", text = "Hei"))

        assertEquals(3, result.id)
        assertEquals("Kasper", result.sender)
        assertEquals("Hei", result.text)

        verify(eventPublisher).chatEvent(eq("MESSAGE_CREATED"), any())
    }

    @Test
    fun `createUser saves member and clears caches`() {
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        whenever(memberRepository.findByName("Lina")).thenReturn(null)
        whenever(memberRepository.save(any())).thenReturn(Member(id = 77, name = "Lina"))

        val result = service.createUser(CreateUserRequest(name = "Lina"))

        assertEquals(77, result.id)
        assertEquals("Lina", result.name)
        assertNull(result.collectiveCode)
        verify(redisTemplate).delete("leaderboard:global")
    }

    @Test
    fun `createCollective generates code and assigns owner`() {
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        whenever(memberRepository.findById(1)).thenReturn(Optional.of(Member(id = 1, name = "Kasper")))
        whenever(collectiveRepository.existsByJoinCode(any())).thenReturn(false)

        val collectiveCaptor = argumentCaptor<Collective>()
        whenever(collectiveRepository.save(collectiveCaptor.capture())).thenAnswer {
            collectiveCaptor.firstValue.copy(id = 9)
        }

        val updatedOwnerCaptor = argumentCaptor<Member>()
        whenever(memberRepository.save(updatedOwnerCaptor.capture())).thenReturn(updatedOwnerCaptor.firstValue)

        val result = service.createCollective(CreateCollectiveRequest(name = "Team Kollekt", ownerUserId = 1))

        assertEquals(9, result.id)
        assertEquals("Team Kollekt", result.name)
        assertEquals(6, result.joinCode.length)
        assertEquals(result.joinCode, updatedOwnerCaptor.firstValue.collectiveCode)
    }

    @Test
    fun `joinCollective sets collective code on user`() {
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(
            Collective(id = 3, name = "Huset", joinCode = "ABC123", ownerMemberId = 10),
        )
        whenever(memberRepository.findById(2)).thenReturn(Optional.of(Member(id = 2, name = "Emma")))

        val updatedUserCaptor = argumentCaptor<Member>()
        whenever(memberRepository.save(updatedUserCaptor.capture())).thenReturn(updatedUserCaptor.firstValue)

        val result = service.joinCollective(JoinCollectiveRequest(userId = 2, joinCode = "abc123"))

        assertEquals("ABC123", result.collectiveCode)
        assertEquals("ABC123", updatedUserCaptor.firstValue.collectiveCode)
    }

    @Test
    fun `getMessages sorts by timestamp`() {
        whenever(chatMessageRepository.findAll()).thenReturn(
            listOf(
                ChatMessage(id = 1, sender = "A", text = "later", timestamp = LocalDateTime.parse("2026-03-02T12:00:00")),
                ChatMessage(id = 2, sender = "B", text = "earlier", timestamp = LocalDateTime.parse("2026-03-02T10:00:00")),
            ),
        )

        val result = service.getMessages()

        assertEquals(listOf(2L, 1L), result.map { it.id })
    }

    @Test
    fun `createExpense clears caches and publishes economy event`() {
        doReturn(setOf("dashboard:Emma")).whenever(redisTemplate).keys("dashboard:*")

        val savedCaptor = argumentCaptor<Expense>()
        whenever(expenseRepository.save(savedCaptor.capture())).thenAnswer { savedCaptor.firstValue.copy(id = 99) }

        val result =
            service.createExpense(
                CreateExpenseRequest(
                    description = "Pizza",
                    amount = 320,
                    paidBy = "Kasper",
                    category = "Mat",
                    date = LocalDate.parse("2026-03-01"),
                    splitBetween = 5,
                ),
            )

        assertEquals(99, result.id)
        verify(redisTemplate).delete("leaderboard:global")
        verify(redisTemplate).delete(eq(setOf("dashboard:Emma")))
        verify(eventPublisher).economyEvent(eq("EXPENSE_CREATED"), any())
    }

    @Test
    fun `getExpenses sorts by date descending`() {
        whenever(expenseRepository.findAll()).thenReturn(
            listOf(
                Expense(id = 1, description = "Old", amount = 10, paidBy = "A", category = "Any", date = LocalDate.parse("2026-03-01"), splitBetween = 1),
                Expense(id = 2, description = "New", amount = 20, paidBy = "B", category = "Any", date = LocalDate.parse("2026-03-02"), splitBetween = 1),
            ),
        )

        val result = service.getExpenses()

        assertEquals(listOf(2L, 1L), result.map { it.id })
    }

    @Test
    fun `getBalances returns empty when no expenses`() {
        whenever(expenseRepository.findAll()).thenReturn(emptyList())

        assertEquals(emptyList<BalanceDto>(), service.getBalances())
    }

    @Test
    fun `getBalances computes per member amounts`() {
        whenever(expenseRepository.findAll()).thenReturn(
            listOf(
                Expense(
                    id = 1,
                    description = "Test",
                    amount = 100,
                    paidBy = "A",
                    category = "Any",
                    date = LocalDate.parse("2026-03-01"),
                    splitBetween = 2,
                ),
            ),
        )
        whenever(memberRepository.findAll()).thenReturn(
            listOf(
                Member(id = 1, name = "A"),
                Member(id = 2, name = "B"),
                Member(id = 3, name = "C"),
            ),
        )

        val result = service.getBalances()

        // Expense: split 100 between first 2 members (A,B) => -50 each; paidBy A gets +100 => A +50
        val map = result.associateBy { it.name }
        assertEquals(50, map.getValue("A").amount)
        assertEquals(-50, map.getValue("B").amount)
        assertEquals(0, map.getValue("C").amount)
    }

    @Test
    fun `getPantSummary sums entries`() {
        whenever(pantEntryRepository.findAll()).thenReturn(
            listOf(
                PantEntry(id = 1, bottles = 1, amount = 10, addedBy = "Emma", date = LocalDate.parse("2026-03-01")),
                PantEntry(id = 2, bottles = 2, amount = 20, addedBy = "Kasper", date = LocalDate.parse("2026-03-02")),
            ),
        )

        val result = service.getPantSummary(goal = 100)

        assertEquals(30, result.currentAmount)
        assertEquals(100, result.goalAmount)
        assertEquals(2, result.entries.size)
    }

    @Test
    fun `addPantEntry saves and publishes economy event`() {
        val savedCaptor = argumentCaptor<PantEntry>()
        whenever(pantEntryRepository.save(savedCaptor.capture())).thenAnswer { savedCaptor.firstValue.copy(id = 11) }

        val result =
            service.addPantEntry(
                CreatePantEntryRequest(
                    bottles = 10,
                    amount = 30,
                    addedBy = "Emma",
                    date = LocalDate.parse("2026-03-02"),
                ),
            )

        assertEquals(11, result.id)
        verify(eventPublisher).economyEvent(eq("PANT_ADDED"), any())
    }

    @Test
    fun `getAchievements maps all achievements`() {
        whenever(achievementRepository.findAll()).thenReturn(
            listOf(
                Achievement(id = 1, title = "A1", description = "d", icon = "I", unlocked = true, progress = null, total = null),
                Achievement(id = 2, title = "A2", description = "d", icon = "I", unlocked = false, progress = 1, total = 10),
            ),
        )

        val result = service.getAchievements()

        assertEquals(listOf(1L, 2L), result.map { it.id })
        assertEquals(listOf(true, false), result.map { it.unlocked })
    }

    @Test
    fun `getLeaderboard returns cached value when present`() {
        val cached =
            LeaderboardResponse(
                players = emptyList(),
                weeklyStats = WeeklyStatsDto(totalTasks = 0, totalXp = 0, avgPerPerson = 0, topContributor = "N/A"),
            )
        whenever(valueOps.get("leaderboard:global")).thenReturn(cached)

        val result = service.getLeaderboard()

        assertSame(cached, result)
        verifyNoInteractions(memberRepository, taskRepository)
        verify(valueOps, never()).set(any(), any())
    }

    @Test
    fun `getLeaderboard computes ranks, badges, and caches`() {
        whenever(valueOps.get("leaderboard:global")).thenReturn(null)

        whenever(memberRepository.findAll()).thenReturn(
            listOf(
                Member(id = 1, name = "Emma", level = 10, xp = 300),
                Member(id = 2, name = "Kasper", level = 9, xp = 200),
                Member(id = 3, name = "Lars", level = 1, xp = 10),
            ),
        )
        whenever(taskRepository.findAll()).thenReturn(
            listOf(
                TaskItem(id = 1, title = "T1", assignee = "Emma", dueDate = LocalDate.parse("2026-03-01"), category = TaskCategory.OTHER, completed = true),
                TaskItem(id = 2, title = "T2", assignee = "Emma", dueDate = LocalDate.parse("2026-03-02"), category = TaskCategory.OTHER, completed = false),
                TaskItem(id = 3, title = "T3", assignee = "Kasper", dueDate = LocalDate.parse("2026-03-02"), category = TaskCategory.OTHER, completed = true),
            ),
        )

        val result = service.getLeaderboard()

        assertEquals(listOf("Emma", "Kasper", "Lars"), result.players.map { it.name })
        assertEquals(listOf(1, 2, 3), result.players.map { it.rank })

        val emma = result.players.first()
        assertTrue(emma.badges.contains("TOP"))

        val kasper = result.players[1]
        assertFalse(kasper.badges.contains("TOP"))

        val weekly = result.weeklyStats
        assertEquals(2, weekly.totalTasks)
        assertEquals(510, weekly.totalXp)
        assertEquals(170, weekly.avgPerPerson)
        assertEquals("Emma", weekly.topContributor)

        verify(valueOps).set(eq("leaderboard:global"), any())
    }

    @Test
    fun `getDashboard returns cached value when present`() {
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
        verify(valueOps, never()).set(any(), any())
    }

    @Test
    fun `getDashboard aggregates upcoming tasks and events and recent expenses`() {
        whenever(valueOps.get(any())).thenReturn(null)

        val now = LocalDate.now()

        whenever(memberRepository.findByName("Kasper")).thenReturn(Member(id = 1, name = "Kasper", level = 1, xp = 10))
        whenever(memberRepository.findAll()).thenReturn(
            listOf(
                Member(id = 1, name = "Kasper", level = 1, xp = 10),
                Member(id = 2, name = "Emma", level = 1, xp = 0),
            ),
        )

        whenever(taskRepository.findAll()).thenReturn(
            listOf(
                TaskItem(id = 1, title = "Done", assignee = "Kasper", dueDate = now.plusDays(1), category = TaskCategory.OTHER, completed = true),
                TaskItem(id = 2, title = "T-3", assignee = "Kasper", dueDate = now.plusDays(3), category = TaskCategory.OTHER, completed = false),
                TaskItem(id = 3, title = "T-1", assignee = "Kasper", dueDate = now.plusDays(1), category = TaskCategory.OTHER, completed = false),
                TaskItem(id = 4, title = "T-2", assignee = "Kasper", dueDate = now.plusDays(2), category = TaskCategory.OTHER, completed = false),
                TaskItem(id = 5, title = "T-4", assignee = "Kasper", dueDate = now.plusDays(4), category = TaskCategory.OTHER, completed = false),
            ),
        )

        whenever(eventRepository.findAll()).thenReturn(
            listOf(
                CalendarEvent(id = 10, title = "Past", date = now.minusDays(1), time = LocalTime.NOON, organizer = "Emma"),
                CalendarEvent(id = 11, title = "E+2", date = now.plusDays(2), time = LocalTime.NOON, organizer = "Emma"),
                CalendarEvent(id = 12, title = "E+1", date = now.plusDays(1), time = LocalTime.NOON, organizer = "Emma"),
                CalendarEvent(id = 13, title = "E+3", date = now.plusDays(3), time = LocalTime.NOON, organizer = "Emma"),
                CalendarEvent(id = 14, title = "E+4", date = now.plusDays(4), time = LocalTime.NOON, organizer = "Emma"),
            ),
        )

        whenever(expenseRepository.findAll()).thenReturn(
            listOf(
                Expense(id = 21, description = "Old", amount = 1, paidBy = "Kasper", category = "Any", date = now.minusDays(3), splitBetween = 1),
                Expense(id = 22, description = "New", amount = 1, paidBy = "Kasper", category = "Any", date = now.minusDays(1), splitBetween = 1),
                Expense(id = 23, description = "Mid", amount = 1, paidBy = "Kasper", category = "Any", date = now.minusDays(2), splitBetween = 1),
                Expense(id = 24, description = "Newest", amount = 1, paidBy = "Kasper", category = "Any", date = now, splitBetween = 1),
            ),
        )

        val result = service.getDashboard("Kasper")

        // upcomingTasks: incomplete only, sorted by dueDate, limited to 3
        assertEquals(listOf(3L, 4L, 2L), result.upcomingTasks.map { it.id })
        assertTrue(result.upcomingTasks.all { !it.completed })

        // upcomingEvents: date >= now, sorted by date, limited to 3
        assertEquals(listOf(12L, 11L, 13L), result.upcomingEvents.map { it.id })

        // recentExpenses: sorted desc, limited to 3
        assertEquals(listOf(24L, 22L, 23L), result.recentExpenses.map { it.id })

        verify(valueOps).set(eq("dashboard:Kasper"), any())
    }

    @Test
    fun `getDashboard falls back to first member if name not found`() {
        whenever(valueOps.get(any())).thenReturn(null)

        whenever(memberRepository.findByName("Unknown")).thenReturn(null)
        whenever(memberRepository.findAll()).thenReturn(listOf(Member(id = 1, name = "Emma", level = 2, xp = 20)))
        whenever(taskRepository.findAll()).thenReturn(emptyList())
        whenever(eventRepository.findAll()).thenReturn(emptyList())
        whenever(expenseRepository.findAll()).thenReturn(emptyList())

        // Allow leaderboard computation
        whenever(valueOps.get("leaderboard:global")).thenReturn(null)

        val leaderboardMembers = listOf(Member(id = 1, name = "Emma", level = 2, xp = 20))
        whenever(memberRepository.findAll()).thenReturn(leaderboardMembers)

        val result = service.getDashboard("Unknown")

        assertEquals("Emma", result.currentUserName)
        verify(valueOps).set(eq("dashboard:Unknown"), any())
    }

    @Test
    fun `getDashboard throws if no members exist`() {
        whenever(valueOps.get(any())).thenReturn(null)
        whenever(memberRepository.findByName(any())).thenReturn(null)
        whenever(memberRepository.findAll()).thenReturn(emptyList())

        assertThrows<IllegalStateException> { service.getDashboard("Kasper") }
    }

    @Test
    fun `getDrinkingQuestion always returns one of predefined templates`() {
        whenever(valueOps.get("leaderboard:global")).thenReturn(null)
        whenever(memberRepository.findAll()).thenReturn(
            listOf(
                Member(id = 1, name = "Top", level = 1, xp = 10),
                Member(id = 2, name = "Bottom", level = 1, xp = 0),
            ),
        )
        whenever(taskRepository.findAll()).thenReturn(emptyList())

        val expected =
            setOf(
                DrinkingQuestionDto("Top, som leaderboard-leder, del ut 3 slurker!", "distribute", "Top"),
                DrinkingQuestionDto("Bottom, du er sist på leaderboardet. Drikk 2!", "drink", "Bottom"),
                DrinkingQuestionDto("Alle som har glemt å tømme søppel denne uken drikker 2!", "everyone", null),
                DrinkingQuestionDto("Pek på hvem som mest sannsynlig glemmer å handle. De drikker 1!", "vote", null),
                DrinkingQuestionDto("Rock, paper, scissors mellom topp 2 på leaderboard. Taper drikker 3!", "challenge", null),
            )

        val result = service.getDrinkingQuestion()

        assertTrue(expected.contains(result))
    }
}
