package com.kollekt.acceptance

import com.kollekt.domain.Member
import com.kollekt.repository.MemberRepository
import com.kollekt.service.IntegrationEventPublisher
import com.kollekt.service.TokenStoreService
import org.hamcrest.Matchers.hasItem
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.CommandLineRunner
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.context.annotation.Import
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.kafka.core.KafkaAdmin
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.annotation.DirtiesContext
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestSecurityConfig::class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class TaskAndShoppingAcceptanceTest {
    @Autowired lateinit var mockMvc: MockMvc

    @Autowired lateinit var memberRepository: MemberRepository

    // Keep acceptance tests deterministic: don't require Redis/Kafka/Security.
    @MockBean lateinit var redisTemplate: RedisTemplate<String, Any>

    @MockBean lateinit var eventPublisher: IntegrationEventPublisher

    @MockBean(name = "seedData")
    lateinit var seedData: CommandLineRunner

    // Prevent KafkaAdmin from trying to connect to localhost:9092 in CI (no broker available).
    @MockBean lateinit var kafkaAdmin: KafkaAdmin

    // TokenStoreService is used by SecurityConfig; mock it to avoid Redis dependency.
    @MockBean lateinit var tokenStoreService: TokenStoreService

    @BeforeEach
    fun setUp() {
        whenever(redisTemplate.keys(any<String>())).thenReturn(emptySet())

        // Ensure referenced members exist in a shared collective so the service
        // can resolve collective code and assignee membership checks.
        val collectiveCode = "TEST-COLLECTIVE"
        if (memberRepository.findByName("Kasper") == null) {
            memberRepository.saveAndFlush(
                Member(name = "Kasper", email = "kasper@example.com", level = 1, xp = 0, collectiveCode = collectiveCode),
            )
        }
        if (memberRepository.findByName("Emma") == null) {
            memberRepository.saveAndFlush(
                Member(name = "Emma", email = "emma@example.com", level = 1, xp = 0, collectiveCode = collectiveCode),
            )
        }
    }

    @Test
    fun `task user story flow create list and toggle`() {
        // Create — jwt subject acts as the authenticated user (assignee from JWT)
        val created =
            mockMvc
                .perform(
                    post("/api/tasks")
                        .contentType("application/json")
                        .with(jwt().jwt { it.subject("Kasper") })
                        .content(
                            """
                            {
                                "title": "Tomme soppla",
                                "assignee": "Kasper",
                                "dueDate": "2026-03-10",
                                "category": "CLEANING",
                                "xp": 10,
                                "recurring": false
                            }
                            """.trimIndent(),
                        ),
                )
                .andDo(print())
                .andExpect(status().isCreated)
                .andExpect(jsonPath("$.id").isNumber)
                .andExpect(jsonPath("$.title").value("Tomme soppla"))
                .andExpect(jsonPath("$.assignee").value("Kasper"))
                .andExpect(jsonPath("$.completed").value(false))
                .andReturn()

        val idRegex = "\"id\"\\s*:\\s*(\\d+)".toRegex()
        val id = idRegex.find(created.response.contentAsString)!!.groupValues[1].toLong()

        // List includes task
        mockMvc
            .perform(
                get("/api/tasks")
                    .param("memberName", "Kasper")
                    .with(jwt().jwt { it.subject("Kasper") }),
            )
            .andExpect(status().isOk)
            .andExpect(jsonPath("\$[*].title").value(hasItem("Tomme soppla")))

        // Toggle marks completed
        mockMvc
            .perform(
                patch("/api/tasks/{id}/toggle", id)
                    .param("memberName", "Kasper")
                    .with(jwt().jwt { it.subject("Kasper") }),
            )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(id))
            .andExpect(jsonPath("$.completed").value(true))
    }

    @Test
    fun `shopping list flow create toggle delete`() {
        val created =
            mockMvc
                .perform(
                    post("/api/tasks/shopping")
                        .contentType("application/json")
                        .with(jwt().jwt { it.subject("Emma") })
                        .content(
                            """
                            {
                                "item": "Dopapir",
                                "addedBy": "Emma"
                            }
                            """.trimIndent(),
                        ),
                )
                .andDo(print())
                .andExpect(status().isCreated)
                .andExpect(jsonPath("$.id").isNumber)
                .andExpect(jsonPath("$.item").value("Dopapir"))
                .andExpect(jsonPath("$.completed").value(false))
                .andReturn()

        val idRegex = "\"id\"\\s*:\\s*(\\d+)".toRegex()
        val itemId = idRegex.find(created.response.contentAsString)!!.groupValues[1].toLong()

        // List includes item
        mockMvc
            .perform(
                get("/api/tasks/shopping")
                    .param("memberName", "Emma")
                    .with(jwt().jwt { it.subject("Emma") }),
            )
            .andExpect(status().isOk)
            .andExpect(jsonPath("\$[*].item").value(hasItem("Dopapir")))

        // Toggle completed
        mockMvc
            .perform(
                patch("/api/tasks/shopping/{id}/toggle", itemId)
                    .param("memberName", "Emma")
                    .with(jwt().jwt { it.subject("Emma") }),
            )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(itemId))
            .andExpect(jsonPath("$.completed").value(true))

        // Delete
        mockMvc
            .perform(
                delete("/api/tasks/shopping/{id}", itemId)
                    .param("memberName", "Emma")
                    .with(jwt().jwt { it.subject("Emma") }),
            )
            .andExpect(status().isNoContent)
    }
}
