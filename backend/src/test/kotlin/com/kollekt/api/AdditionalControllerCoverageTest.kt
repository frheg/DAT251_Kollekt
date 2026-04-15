package com.kollekt.api

import com.kollekt.api.dto.AddReactionRequest
import com.kollekt.api.dto.AuthResponse
import com.kollekt.api.dto.CollectiveDto
import com.kollekt.api.dto.CreatePollRequest
import com.kollekt.api.dto.CreateShoppingItemRequest
import com.kollekt.api.dto.CreateTaskRequest
import com.kollekt.api.dto.DashboardResponse
import com.kollekt.api.dto.EventDto
import com.kollekt.api.dto.JoinCollectiveRequest
import com.kollekt.api.dto.LeaderboardPeriod
import com.kollekt.api.dto.LeaderboardPlayerDto
import com.kollekt.api.dto.LeaderboardResponse
import com.kollekt.api.dto.MessageDto
import com.kollekt.api.dto.PeriodStatsDto
import com.kollekt.api.dto.RefreshTokenRequest
import com.kollekt.api.dto.RemoveReactionRequest
import com.kollekt.api.dto.ShoppingItemDto
import com.kollekt.api.dto.TaskDto
import com.kollekt.api.dto.UserDto
import com.kollekt.api.dto.VotePollRequest
import com.kollekt.domain.EventType
import com.kollekt.domain.Notification
import com.kollekt.domain.TaskCategory
import com.kollekt.service.AccountOperations
import com.kollekt.service.ChatOperations
import com.kollekt.service.CollectiveOperations
import com.kollekt.service.EventOperations
import com.kollekt.service.GoogleCalendarService
import com.kollekt.service.NotificationService
import com.kollekt.service.ShoppingOperations
import com.kollekt.service.StatsService
import com.kollekt.service.TaskOperations
import com.kollekt.service.TokenStoreService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.http.MediaType
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

@WebMvcTest(
    properties = [
        "app.security.jwt-secret=test-jwt-secret-that-is-long-enough",
        "app.google.frontend-url=https://kollekt.test/settings",
    ],
    controllers =
        [
            CalendarController::class,
            ChatController::class,
            GoogleCalendarController::class,
            NotificationController::class,
            OnboardingController::class,
            StatsController::class,
            TaskController::class,
        ],
)
class AdditionalControllerCoverageTest {
    @Autowired lateinit var mockMvc: MockMvc

    @MockitoBean lateinit var accountOperations: AccountOperations

    @MockitoBean lateinit var chatOperations: ChatOperations

    @MockitoBean lateinit var collectiveOperations: CollectiveOperations

    @MockitoBean lateinit var eventOperations: EventOperations

    @MockitoBean lateinit var googleCalendarService: GoogleCalendarService

    @MockitoBean lateinit var notificationService: NotificationService

    @MockitoBean lateinit var shoppingOperations: ShoppingOperations

    @MockitoBean lateinit var statsService: StatsService

    @MockitoBean lateinit var taskOperations: TaskOperations

    @MockitoBean lateinit var tokenStoreService: TokenStoreService

    @Test
    fun `task regret uses api tasks regret endpoint`() {
        whenever(taskOperations.regretTask(7, "Kasper"))
            .thenReturn(
                TaskDto(
                    id = 7,
                    title = "Vask",
                    assignee = "Kasper",
                    dueDate = LocalDate.parse("2026-04-15"),
                    category = TaskCategory.CLEANING,
                    completed = true,
                    xp = 8,
                ),
            )

        mockMvc
            .perform(
                post("/api/tasks/7/regret")
                    .param("memberName", "Kasper")
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.completed").value(true))

        verify(taskOperations).regretTask(7, "Kasper")
    }

    @Test
    fun `task regret missed uses api tasks regret missed endpoint`() {
        whenever(taskOperations.regretMissedTask(8, "Kasper"))
            .thenReturn(
                TaskDto(
                    id = 8,
                    title = "Soppel",
                    assignee = "Kasper",
                    dueDate = LocalDate.parse("2026-04-10"),
                    category = TaskCategory.OTHER,
                    completed = true,
                    xp = 5,
                ),
            )

        mockMvc
            .perform(
                post("/api/tasks/8/regret-missed")
                    .param("memberName", "Kasper")
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(8))

        verify(taskOperations).regretMissedTask(8, "Kasper")
    }

    @Test
    fun `task feedback defaults to empty string when feedback key is missing`() {
        whenever(taskOperations.giveTaskFeedback(9, "Kasper", "", false, null, null))
            .thenReturn(
                TaskDto(
                    id = 9,
                    title = "Brett tøy",
                    assignee = "Kasper",
                    dueDate = LocalDate.parse("2026-04-18"),
                    category = TaskCategory.OTHER,
                    completed = false,
                    xp = 10,
                ),
            )

        mockMvc
            .perform(
                patch("/api/tasks/9/feedback")
                    .contentType(MediaType.APPLICATION_JSON)
                    .param("memberName", "Kasper")
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("{}"),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(9))

        verify(taskOperations).giveTaskFeedback(9, "Kasper", "", false, null, null)
    }

    @Test
    fun `task update forwards request body to operations`() {
        val updatesCaptor = argumentCaptor<Map<String, Any>>()
        whenever(taskOperations.updateTask(eq(10), any(), eq("Kasper")))
            .thenReturn(
                TaskDto(
                    id = 10,
                    title = "Ny oppgave",
                    assignee = "Emma",
                    dueDate = LocalDate.parse("2026-04-20"),
                    category = TaskCategory.CLEANING,
                    completed = false,
                    xp = 25,
                    recurrenceRule = "WEEKLY",
                ),
            )

        mockMvc
            .perform(
                patch("/api/tasks/10")
                    .contentType(MediaType.APPLICATION_JSON)
                    .param("memberName", "Kasper")
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content(
                        """
                        {
                          "title": "Ny oppgave",
                          "assignee": "Emma",
                          "dueDate": "2026-04-20",
                          "category": "CLEANING",
                          "xp": 25
                        }
                        """.trimIndent(),
                    ),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.recurrenceRule").value("WEEKLY"))

        verify(taskOperations).updateTask(eq(10), updatesCaptor.capture(), eq("Kasper"))
        assertEquals("Ny oppgave", updatesCaptor.firstValue["title"])
        assertEquals("Emma", updatesCaptor.firstValue["assignee"])
        assertEquals("2026-04-20", updatesCaptor.firstValue["dueDate"])
        assertEquals("CLEANING", updatesCaptor.firstValue["category"])
        assertEquals(25, (updatesCaptor.firstValue["xp"] as Number).toInt())
    }

    @Test
    fun `task delete uses api tasks delete endpoint`() {
        mockMvc
            .perform(
                delete("/api/tasks/11")
                    .param("memberName", "Kasper")
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isNoContent)

        verify(taskOperations).deleteTask(11, "Kasper")
    }

    @Test
    fun `stats dashboard uses api dashboard endpoint`() {
        whenever(statsService.getDashboard("Kasper"))
            .thenReturn(
                DashboardResponse(
                    currentUserName = "Kasper",
                    currentUserXp = 320,
                    currentUserLevel = 2,
                    currentUserRank = 1,
                    upcomingTasks = emptyList(),
                    upcomingEvents = emptyList(),
                    recentExpenses = emptyList(),
                ),
            )

        mockMvc
            .perform(
                get("/api/dashboard")
                    .param("memberName", "Kasper")
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.currentUserXp").value(320))

        verify(statsService).getDashboard("Kasper")
    }

    @Test
    fun `stats leaderboard uses api leaderboard endpoint and period`() {
        whenever(statsService.getLeaderboard("Kasper", LeaderboardPeriod.MONTH))
            .thenReturn(
                LeaderboardResponse(
                    players =
                        listOf(
                            LeaderboardPlayerDto(
                                rank = 1,
                                name = "Kasper",
                                level = 2,
                                xp = 320,
                                tasksCompleted = 15,
                                streak = 4,
                                badges = listOf("dishmaster"),
                            ),
                        ),
                    periodStats =
                        PeriodStatsDto(
                            totalTasks = 12,
                            totalXp = 180,
                            avgPerPerson = 60,
                            topContributor = "Kasper",
                            bestStreak = 4,
                            bestStreakHolder = "Kasper",
                            totalPenaltyXp = 0,
                            lateCompletions = 0,
                            lateCompletionsHolder = "N/A",
                            skippedCount = 0,
                            skippedHolder = "N/A",
                        ),
                    monthlyPrize = "Pizza night",
                ),
            )

        mockMvc
            .perform(
                get("/api/leaderboard")
                    .param("memberName", "Kasper")
                    .param("period", "MONTH")
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.monthlyPrize").value("Pizza night"))
            .andExpect(jsonPath("$.players[0].name").value("Kasper"))

        verify(statsService).getLeaderboard("Kasper", LeaderboardPeriod.MONTH)
    }

    @Test
    fun `stats monthly prize get uses api monthly prize endpoint`() {
        whenever(statsService.getMonthlyPrize("Kasper")).thenReturn("Spa weekend")

        mockMvc
            .perform(
                get("/api/monthly-prize")
                    .param("memberName", "Kasper")
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isOk)
            .andExpect(content().string("Spa weekend"))

        verify(statsService).getMonthlyPrize("Kasper")
    }

    @Test
    fun `stats monthly prize post uses api monthly prize endpoint`() {
        mockMvc
            .perform(
                post("/api/monthly-prize")
                    .contentType(MediaType.APPLICATION_JSON)
                    .param("memberName", "Kasper")
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{"prize":"Spa weekend"}"""),
            ).andExpect(status().isOk)

        verify(statsService).setMonthlyPrize("Kasper", "Spa weekend")
    }

    @Test
    fun `google calendar auth url uses api google calendar auth url endpoint`() {
        whenever(googleCalendarService.getAuthorizationUrl("Kasper"))
            .thenReturn("https://accounts.google.com/o/oauth2/auth")

        mockMvc
            .perform(
                get("/api/google-calendar/auth-url")
                    .param("memberName", "Kasper")
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.url").value("https://accounts.google.com/o/oauth2/auth"))

        verify(googleCalendarService).getAuthorizationUrl("Kasper")
    }

    @Test
    fun `google calendar callback stores tokens and redirects to frontend`() {
        mockMvc
            .perform(
                get("/api/google-calendar/callback")
                    .param("code", "auth-code")
                    .param("state", "Kasper")
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().is3xxRedirection)
            .andExpect(redirectedUrl("https://kollekt.test/settings?googleCalendarConnected=true"))

        verify(collectiveOperations).saveGoogleCalendarTokens("Kasper", "auth-code")
    }

    @Test
    fun `google calendar status uses api google calendar status endpoint`() {
        whenever(collectiveOperations.isGoogleCalendarConnected("Kasper")).thenReturn(true)

        mockMvc
            .perform(
                get("/api/google-calendar/status")
                    .param("memberName", "Kasper")
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.connected").value(true))

        verify(collectiveOperations).isGoogleCalendarConnected("Kasper")
    }

    @Test
    fun `google calendar disconnect uses api google calendar disconnect endpoint`() {
        mockMvc
            .perform(
                delete("/api/google-calendar/disconnect")
                    .param("memberName", "Kasper")
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isNoContent)

        verify(collectiveOperations).disconnectGoogleCalendar("Kasper")
    }

    @Test
    fun `shopping item create uses actor subject instead of request added by`() {
        val request = CreateShoppingItemRequest(item = "Milk", addedBy = "Emma")
        whenever(shoppingOperations.createShoppingItem(request, "Kasper"))
            .thenReturn(
                ShoppingItemDto(
                    id = 6,
                    item = "Milk",
                    addedBy = "Kasper",
                    completed = false,
                ),
            )

        mockMvc
            .perform(
                post("/api/tasks/shopping")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{"item":"Milk","addedBy":"Emma"}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.addedBy").value("Kasper"))

        verify(shoppingOperations).createShoppingItem(request, "Kasper")
    }

    @Test
    fun `task create uses actor subject instead of request assignee lookup`() {
        val request =
            CreateTaskRequest(
                title = "Toalett",
                assignee = "Emma",
                dueDate = LocalDate.parse("2026-04-22"),
                category = TaskCategory.CLEANING,
                xp = 18,
            )
        whenever(taskOperations.createTask(request, "Kasper"))
            .thenReturn(
                TaskDto(
                    id = 12,
                    title = request.title,
                    assignee = request.assignee,
                    dueDate = request.dueDate,
                    category = request.category,
                    completed = false,
                    xp = request.xp,
                ),
            )

        mockMvc
            .perform(
                post("/api/tasks")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content(
                        """
                        {
                          "title":"Toalett",
                          "assignee":"Emma",
                          "dueDate":"2026-04-22",
                          "category":"CLEANING",
                          "xp":18
                        }
                        """.trimIndent(),
                    ),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.id").value(12))

        verify(taskOperations).createTask(request, "Kasper")
    }

    @Test
    fun `calendar events list uses authenticated member name`() {
        whenever(eventOperations.getEvents("Kasper")).thenReturn(
            listOf(
                EventDto(
                    id = 3,
                    title = "Movie night",
                    date = LocalDate.parse("2026-04-25"),
                    time = LocalTime.parse("19:00:00"),
                    endTime = null,
                    type = EventType.MOVIE,
                    organizer = "Kasper",
                    attendees = 4,
                    description = "Snacks",
                ),
            ),
        )

        mockMvc
            .perform(
                get("/api/events")
                    .param("memberName", "Kasper")
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$[0].title").value("Movie night"))

        verify(eventOperations).getEvents("Kasper")
    }

    @Test
    fun `calendar delete forwards actor subject`() {
        mockMvc
            .perform(
                delete("/api/events/9")
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isNoContent)

        verify(eventOperations).deleteEvent(9, "Kasper")
    }

    @Test
    fun `chat poll create uses actor subject`() {
        val request = CreatePollRequest(question = "Who cooks?", options = listOf("Emma", "Kasper"))
        whenever(chatOperations.createPoll(request, "Kasper"))
            .thenReturn(
                MessageDto(
                    id = 15,
                    sender = "Kasper",
                    text = "Who cooks?",
                    timestamp = LocalDateTime.parse("2026-04-13T18:00:00"),
                ),
            )

        mockMvc
            .perform(
                post("/api/chat/polls")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{"question":"Who cooks?","options":["Emma","Kasper"]}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.id").value(15))

        verify(chatOperations).createPoll(request, "Kasper")
    }

    @Test
    fun `chat poll vote forwards option id and subject`() {
        val request = VotePollRequest(optionId = 2)
        whenever(chatOperations.votePoll(15, 2, "Kasper"))
            .thenReturn(
                MessageDto(
                    id = 15,
                    sender = "Kasper",
                    text = "Vote recorded",
                    timestamp = LocalDateTime.parse("2026-04-13T18:05:00"),
                ),
            )

        mockMvc
            .perform(
                post("/api/chat/messages/15/poll/vote")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{"optionId":2}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.text").value("Vote recorded"))

        verify(chatOperations).votePoll(15, request.optionId, "Kasper")
    }

    @Test
    fun `chat add reaction forwards emoji and subject`() {
        val request = AddReactionRequest(emoji = "🔥")
        whenever(chatOperations.addReaction(16, "🔥", "Kasper"))
            .thenReturn(
                MessageDto(
                    id = 16,
                    sender = "Emma",
                    text = "Nice",
                    timestamp = LocalDateTime.parse("2026-04-13T18:06:00"),
                ),
            )

        mockMvc
            .perform(
                post("/api/chat/messages/16/reactions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{"emoji":"🔥"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(16))

        verify(chatOperations).addReaction(16, request.emoji, "Kasper")
    }

    @Test
    fun `chat remove reaction forwards emoji and subject`() {
        val request = RemoveReactionRequest(emoji = "🔥")
        whenever(chatOperations.removeReaction(16, "🔥", "Kasper"))
            .thenReturn(
                MessageDto(
                    id = 16,
                    sender = "Emma",
                    text = "Reaction removed",
                    timestamp = LocalDateTime.parse("2026-04-13T18:07:00"),
                ),
            )

        mockMvc
            .perform(
                delete("/api/chat/messages/16/reactions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{"emoji":"🔥"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.text").value("Reaction removed"))

        verify(chatOperations).removeReaction(16, request.emoji, "Kasper")
    }

    @Test
    fun `onboarding refresh uses refresh token endpoint`() {
        val request = RefreshTokenRequest(refreshToken = "refresh-token")
        whenever(accountOperations.refreshToken(request))
            .thenReturn(
                AuthResponse(
                    accessToken = "new-token",
                    refreshToken = "refresh-token",
                    tokenType = "Bearer",
                    expiresIn = 3600,
                    user = UserDto(id = 1, name = "Kasper", collectiveCode = "ABC123"),
                ),
            )

        mockMvc
            .perform(
                post("/api/onboarding/refresh")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{"refreshToken":"refresh-token"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.accessToken").value("new-token"))

        verify(accountOperations).refreshToken(request)
    }

    @Test
    fun `onboarding create collective uses collective operations when token user matches`() {
        val requestBody =
            """
            {
              "name":"Kollekt",
              "ownerUserId":1,
              "numRooms":1,
              "residents":["Emma"],
              "rooms":[{"name":"Kitchen","minutes":25}]
            }
            """.trimIndent()
        whenever(accountOperations.getUserByName("Kasper"))
            .thenReturn(UserDto(id = 1, name = "Kasper", collectiveCode = null))
        whenever(collectiveOperations.createCollective(any()))
            .thenReturn(CollectiveDto(id = 4, name = "Kollekt", joinCode = "ABC123"))

        mockMvc
            .perform(
                post("/api/onboarding/collectives")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content(requestBody),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.joinCode").value("ABC123"))

        verify(collectiveOperations).createCollective(any())
    }

    @Test
    fun `onboarding join collective uses collective operations when token user matches`() {
        val request = JoinCollectiveRequest(userId = 1, joinCode = "ABC123")
        whenever(accountOperations.getUserByName("Kasper"))
            .thenReturn(UserDto(id = 1, name = "Kasper", collectiveCode = null))
        whenever(collectiveOperations.joinCollective(request))
            .thenReturn(UserDto(id = 1, name = "Kasper", collectiveCode = "ABC123"))

        mockMvc
            .perform(
                post("/api/onboarding/collectives/join")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{"userId":1,"joinCode":"ABC123"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.collectiveCode").value("ABC123"))

        verify(collectiveOperations).joinCollective(request)
    }

    @Test
    fun `notification get returns notifications for requested user`() {
        whenever(notificationService.getNotificationsForUser("Kasper")).thenReturn(
            listOf(
                Notification(
                    id = 1,
                    userName = "Kasper",
                    message = "Task assigned",
                ),
            ),
        )

        mockMvc
            .perform(
                get("/api/notifications/Kasper")
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$[0].userName").value("Kasper"))

        verify(notificationService).getNotificationsForUser("Kasper")
    }

    @Test
    fun `notification mark all as read uses requested user`() {
        mockMvc
            .perform(
                post("/api/notifications/Kasper/read")
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isOk)

        verify(notificationService).markAllAsRead("Kasper")
    }
}
