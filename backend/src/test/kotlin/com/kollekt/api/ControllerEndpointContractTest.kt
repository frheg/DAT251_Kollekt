package com.kollekt.api

import com.kollekt.api.dto.AuthResponse
import com.kollekt.api.dto.CollectiveCodeDto
import com.kollekt.api.dto.CreateEventRequest
import com.kollekt.api.dto.CreateUserRequest
import com.kollekt.api.dto.DrinkingQuestionDto
import com.kollekt.api.dto.EventDto
import com.kollekt.api.dto.SettleUpRequest
import com.kollekt.api.dto.SettleUpResponse
import com.kollekt.api.dto.TaskDto
import com.kollekt.api.dto.UserDto
import com.kollekt.domain.EventType
import com.kollekt.domain.TaskCategory
import com.kollekt.service.KollektService
import com.kollekt.service.TokenStoreService
import org.junit.jupiter.api.Test
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
        ],
)
class ControllerEndpointContractTest {
    @Autowired lateinit var mockMvc: MockMvc

    @MockitoBean lateinit var service: KollektService

    @MockitoBean lateinit var tokenStoreService: TokenStoreService

    @Test
    fun `onboarding create user uses api onboarding users endpoint`() {
        val request = CreateUserRequest(name = "Kasper", password = "verysecure")
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
                .content("""{"name":"Kasper","password":"verysecure"}"""),
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.user.name").value("Kasper"))

        verify(service).createUser(request)
    }

    @Test
    fun `task toggle uses api tasks toggle endpoint and values`() {
        whenever(service.toggleTask(42, "Kasper", true))
            .thenReturn(
                TaskDto(
                    id = 42,
                    title = "Vask",
                    assignee = "Kasper",
                    dueDate = LocalDate.parse("2026-03-06"),
                    category = TaskCategory.CLEANING,
                    completed = true,
                    xp = 10,
                    recurring = false,
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

        verify(service).toggleTask(42, "Kasper", true)
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
    fun `economy settle up uses api economy settle up endpoint`() {
        val request = SettleUpRequest(memberName = "Kasper")
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
}
