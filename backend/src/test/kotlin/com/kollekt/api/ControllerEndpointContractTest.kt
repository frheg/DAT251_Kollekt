package com.kollekt.api

import com.kollekt.api.dto.AchievementDto
import com.kollekt.api.dto.AuthResponse
import com.kollekt.api.dto.BalanceDto
import com.kollekt.api.dto.CollectiveCodeDto
import com.kollekt.api.dto.CreateEventRequest
import com.kollekt.api.dto.CreateMessageRequest
import com.kollekt.api.dto.CreatePantEntryRequest
import com.kollekt.api.dto.CreateUserRequest
import com.kollekt.api.dto.DrinkingQuestionDto
import com.kollekt.api.dto.EconomySummaryDto
import com.kollekt.api.dto.EventDto
import com.kollekt.api.dto.ExpenseDto
import com.kollekt.api.dto.MessageDto
import com.kollekt.api.dto.PantEntryDto
import com.kollekt.api.dto.PantSummaryDto
import com.kollekt.api.dto.SettleUpResponse
import com.kollekt.api.dto.TaskDto
import com.kollekt.api.dto.UserDto
import com.kollekt.domain.EventType
import com.kollekt.domain.Invitation
import com.kollekt.domain.MemberStatus
import com.kollekt.domain.TaskCategory
import com.kollekt.repository.InvitationRepository
import com.kollekt.service.KollektService
import com.kollekt.service.TokenStoreService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.isNull
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

@WebMvcTest(
    properties = ["app.security.jwt-secret=test-jwt-secret-that-is-long-enough"],
    controllers =
        [
            OnboardingController::class,
            TaskController::class,
            CalendarController::class,
            ChatController::class,
            EconomyController::class,
            StatsController::class,
            MemberController::class,
            InvitationController::class,
        ],
)
class ControllerEndpointContractTest {
    @Autowired lateinit var mockMvc: MockMvc

    @MockitoBean lateinit var service: KollektService

    @MockitoBean lateinit var tokenStoreService: TokenStoreService

    @MockitoBean lateinit var invitationRepository: InvitationRepository

    @Test
    fun `onboarding create user uses api onboarding users endpoint`() {
        val request = CreateUserRequest(name = "Kasper", email = "kasper@example.com", password = "verysecure")
        whenever(service.createUser(request))
            .thenReturn(
                AuthResponse(
                    accessToken = "token",
                    refreshToken = "refresh-token",
                    tokenType = "Bearer",
                    expiresIn = 3600,
                    user =
                        UserDto(
                            id = 1,
                            name = "Kasper",
                            collectiveCode = null,
                        ),
                ),
            )

        mockMvc.perform(
            post("/api/onboarding/users")
                .contentType(MediaType.APPLICATION_JSON)
                .with(csrf())
                .with(jwt().jwt { it.subject("Kasper") })
                .content("""{"name":"Kasper","email":"kasper@example.com","password":"verysecure"}"""),
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.user.name").value("Kasper"))

        verify(service).createUser(request)
    }

    @Test
    fun `onboarding collective code uses api onboarding collectives code endpoint`() {
        whenever(service.getUserByName("Kasper"))
            .thenReturn(UserDto(id = 5, name = "Kasper", collectiveCode = "ABC123"))
        whenever(service.getCollectiveCodeForUser(5))
            .thenReturn(CollectiveCodeDto(joinCode = "ABC123"))

        mockMvc.perform(
            get("/api/onboarding/collectives/code/5")
                .with(jwt().jwt { it.subject("Kasper") }),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.joinCode").value("ABC123"))

        verify(service).getUserByName("Kasper")
        verify(service).getCollectiveCodeForUser(5)
    }

    @Test
    fun `onboarding me returns the authenticated user including status`() {
        whenever(service.getUserByName("Kasper"))
            .thenReturn(
                UserDto(
                    id = 5,
                    name = "Kasper",
                    email = "kasper@example.com",
                    collectiveCode = "ABC123",
                    status = MemberStatus.AWAY,
                ),
            )

        mockMvc.perform(
            get("/api/onboarding/me")
                .with(jwt().jwt { it.subject("Kasper") }),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.email").value("kasper@example.com"))
            .andExpect(jsonPath("$.status").value("AWAY"))

        verify(service).getUserByName("Kasper")
    }

    @Test
    fun `onboarding create collective rejects mismatched token user`() {
        whenever(service.getUserByName("Kasper"))
            .thenReturn(UserDto(id = 1, name = "Kasper", collectiveCode = null))

        mockMvc.perform(
            post("/api/onboarding/collectives")
                .contentType(MediaType.APPLICATION_JSON)
                .with(csrf())
                .with(jwt().jwt { it.subject("Kasper") })
                .content(
                    """
                    {
                      "name":"Kollekt",
                      "ownerUserId":2,
                      "numRooms":1,
                      "residents":["Emma"],
                      "rooms":[{"name":"Bad","minutes":15}]
                    }
                    """.trimIndent(),
                ),
        )
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error").value("Token user does not match requested user"))

        verify(service).getUserByName("Kasper")
        verify(service, never()).createCollective(any())
    }

    @Test
    fun `onboarding logout accepts missing refresh token body`() {
        val jwtCaptor = argumentCaptor<Jwt>()

        mockMvc.perform(
            post("/api/onboarding/logout")
                .with(csrf())
                .with(jwt().jwt { it.subject("Kasper") }),
        )
            .andExpect(status().isNoContent)

        verify(service).logout(jwtCaptor.capture(), isNull())
        assertEquals("Kasper", jwtCaptor.firstValue.subject)
    }

    @Test
    fun `task toggle uses api tasks toggle endpoint and values`() {
        whenever(service.toggleTask(42, "Kasper"))
            .thenReturn(
                TaskDto(
                    id = 42,
                    title = "Vask",
                    assignee = "Kasper",
                    dueDate = LocalDate.parse("2026-03-06"),
                    category = TaskCategory.CLEANING,
                    completed = true,
                    xp = 10,
                    recurrenceRule = null,
                ),
            )

        mockMvc.perform(
            patch("/api/tasks/42/toggle")
                .param("memberName", "Kasper")
                .param("completed", "true")
                .with(csrf())
                .with(jwt().jwt { it.subject("Kasper") }),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(42))

        verify(service).toggleTask(42, "Kasper")
    }

    @Test
    fun `tasks endpoint rejects mismatched token subject`() {
        mockMvc.perform(
            get("/api/tasks")
                .param("memberName", "Emma")
                .with(jwt().jwt { it.subject("Kasper") }),
        )
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error").value("Token subject does not match requested member"))

        verify(service, never()).getTasks(any())
    }

    @Test
    fun `shopping delete uses api tasks shopping item endpoint`() {
        mockMvc.perform(
            delete("/api/tasks/shopping/9")
                .param("memberName", "Kasper")
                .with(csrf())
                .with(jwt().jwt { it.subject("Kasper") }),
        )
            .andExpect(status().isNoContent)

        verify(service).deleteShoppingItem(9, "Kasper")
    }

    @Test
    fun `calendar create uses api events endpoint`() {
        val request =
            CreateEventRequest(
                title = "Filmkveld",
                date = LocalDate.parse("2026-03-10"),
                time = LocalTime.parse("19:30:00"),
                type = EventType.MOVIE,
                organizer = "Kasper",
                attendees = 4,
                description = "Ta med snacks",
            )
        whenever(service.createEvent(request, "Kasper"))
            .thenReturn(
                EventDto(
                    id = 1,
                    title = request.title,
                    date = request.date,
                    time = request.time,
                    type = request.type,
                    organizer = request.organizer,
                    attendees = request.attendees,
                    description = request.description,
                ),
            )

        mockMvc.perform(
            post("/api/events")
                .contentType(MediaType.APPLICATION_JSON)
                .with(csrf())
                .with(jwt().jwt { it.subject("Kasper") })
                .content(
                    """
                    {
                      "title":"Filmkveld",
                      "date":"2026-03-10",
                      "time":"19:30:00",
                      "type":"MOVIE",
                      "organizer":"Kasper",
                      "attendees":4,
                      "description":"Ta med snacks"
                    }
                    """.trimIndent(),
                ),
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.type").value("MOVIE"))

        verify(service).createEvent(request, "Kasper")
    }

    @Test
    fun `chat messages uses api chat messages endpoint`() {
        whenever(service.getMessages("Kasper")).thenReturn(emptyList())

        mockMvc.perform(
            get("/api/chat/messages")
                .param("memberName", "Kasper")
                .with(jwt().jwt { it.subject("Kasper") }),
        )
            .andExpect(status().isOk)

        verify(service).getMessages("Kasper")
    }

    @Test
    fun `chat create uses api chat messages endpoint`() {
        val request = CreateMessageRequest(sender = "Emma", text = "Hei kollektivet")
        whenever(service.createMessage(request, "Kasper"))
            .thenReturn(
                MessageDto(
                    id = 3,
                    sender = "Kasper",
                    text = request.text,
                    timestamp = LocalDateTime.parse("2026-03-04T10:15:00"),
                ),
            )

        mockMvc.perform(
            post("/api/chat/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .with(csrf())
                .with(jwt().jwt { it.subject("Kasper") })
                .content("""{"sender":"Emma","text":"Hei kollektivet"}"""),
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.sender").value("Kasper"))

        verify(service).createMessage(request, "Kasper")
    }

    @Test
    fun `economy settle up uses api economy settle up endpoint`() {
        whenever(service.settleUp("Kasper"))
            .thenReturn(
                SettleUpResponse(
                    collectiveCode = "ABC123",
                    settledBy = "Kasper",
                    lastExpenseId = 7,
                    settledAt = LocalDateTime.parse("2026-03-04T10:00:00"),
                ),
            )

        mockMvc.perform(
            post("/api/economy/settle-up")
                .contentType(MediaType.APPLICATION_JSON)
                .with(csrf())
                .with(jwt().jwt { it.subject("Kasper") })
                .content("""{"memberName":"Kasper"}"""),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.lastExpenseId").value(7))

        verify(service).settleUp("Kasper")
    }

    @Test
    fun `economy add pant uses api economy pant endpoint`() {
        val request =
            CreatePantEntryRequest(
                bottles = 18,
                amount = 54,
                addedBy = "Emma",
                date = LocalDate.parse("2026-03-10"),
            )
        whenever(service.addPantEntry(request, "Kasper"))
            .thenReturn(
                PantEntryDto(
                    id = 5,
                    bottles = 18,
                    amount = 54,
                    addedBy = "Kasper",
                    date = request.date,
                ),
            )

        mockMvc.perform(
            post("/api/economy/pant")
                .contentType(MediaType.APPLICATION_JSON)
                .with(csrf())
                .with(jwt().jwt { it.subject("Kasper") })
                .content("""{"bottles":18,"amount":54,"addedBy":"Emma","date":"2026-03-10"}"""),
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.addedBy").value("Kasper"))

        verify(service).addPantEntry(request, "Kasper")
    }

    @Test
    fun `economy summary uses api economy summary endpoint`() {
        whenever(service.getEconomySummary("Kasper"))
            .thenReturn(
                EconomySummaryDto(
                    expenses =
                        listOf(
                            ExpenseDto(
                                id = 1,
                                description = "Pizza",
                                amount = 200,
                                paidBy = "Kasper",
                                category = "Mat",
                                date = LocalDate.parse("2026-03-10"),
                                participantNames = listOf("Emma", "Kasper"),
                            ),
                        ),
                    balances =
                        listOf(
                            BalanceDto(name = "Kasper", amount = 100),
                            BalanceDto(name = "Emma", amount = -100),
                        ),
                    pantSummary =
                        PantSummaryDto(
                            currentAmount = 54,
                            goalAmount = 1000,
                            entries = emptyList(),
                        ),
                ),
            )

        mockMvc.perform(
            get("/api/economy/summary")
                .param("memberName", "Kasper")
                .with(jwt().jwt { it.subject("Kasper") }),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.balances[0].amount").value(100))
            .andExpect(jsonPath("$.pantSummary.currentAmount").value(54))

        verify(service).getEconomySummary("Kasper")
    }

    @Test
    fun `stats question uses api drinking game endpoint`() {
        whenever(service.getDrinkingQuestion("Kasper"))
            .thenReturn(
                DrinkingQuestionDto(
                    text = "Hvem tar oppvasken?",
                    type = "challenge",
                    targetedPlayer = null,
                ),
            )

        mockMvc.perform(
            get("/api/drinking-game/question")
                .param("memberName", "Kasper")
                .with(jwt().jwt { it.subject("Kasper") }),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.type").value("challenge"))

        verify(service).getDrinkingQuestion("Kasper")
    }

    @Test
    fun `stats achievements uses api achievements endpoint`() {
        whenever(service.getAchievements())
            .thenReturn(
                listOf(
                    AchievementDto(
                        id = 7,
                        title = "Oppvaskhelt",
                        description = "Fullfor 10 oppgaver",
                        icon = "sparkles",
                        unlocked = true,
                        progress = 10,
                        total = 10,
                    ),
                ),
            )

        mockMvc.perform(
            get("/api/achievements")
                .with(jwt().jwt { it.subject("Kasper") }),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].title").value("Oppvaskhelt"))

        verify(service).getAchievements()
    }

    @Test
    fun `members collective uses api members collective endpoint`() {
        whenever(service.getCollectiveMembers("Kasper"))
            .thenReturn(
                listOf(UserDto(id = 1, name = "Kasper", collectiveCode = "ABC123")),
            )

        mockMvc.perform(
            get("/api/members/collective")
                .param("memberName", "Kasper")
                .with(jwt().jwt { it.subject("Kasper") }),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].collectiveCode").value("ABC123"))

        verify(service).getCollectiveMembers("Kasper")
    }

    @Test
    fun `member status rejects invalid status values`() {
        mockMvc.perform(
            patch("/api/members/status")
                .contentType(MediaType.APPLICATION_JSON)
                .with(csrf())
                .with(jwt().jwt { it.subject("Kasper") })
                .content("""{"memberName":"Kasper","status":"sleeping"}"""),
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("Invalid status"))

        verify(service, never()).updateMemberStatus(any(), any())
    }

    @Test
    fun `member reset password validates identifier and password`() {
        mockMvc.perform(
            patch("/api/members/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .with(csrf())
                .with(jwt().jwt { it.subject("Kasper") })
                .content("""{"newPassword":""}"""),
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("Provide either memberName or email and a newPassword"))

        verify(service, never()).resetPassword(anyOrNull(), anyOrNull(), any())
    }

    @Test
    fun `invitations endpoint normalizes email query parameter`() {
        whenever(invitationRepository.findAllByEmail("test@example.com"))
            .thenReturn(
                listOf(
                    Invitation(
                        id = 1,
                        email = "test@example.com",
                        collectiveCode = "ABC123",
                        invitedBy = "Kasper",
                    ),
                ),
            )

        mockMvc.perform(
            get("/api/invitations")
                .param("email", "  Test@Example.com ")
                .with(jwt().jwt { it.subject("Kasper") }),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].email").value("test@example.com"))

        verify(invitationRepository).findAllByEmail("test@example.com")
    }
}
