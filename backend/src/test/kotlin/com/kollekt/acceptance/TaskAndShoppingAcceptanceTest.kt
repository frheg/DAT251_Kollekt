package com.kollekt.acceptance

import com.kollekt.domain.Member
import com.kollekt.repository.MemberRepository
import com.kollekt.service.IntegrationEventPublisher
import org.springframework.boot.CommandLineRunner
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.hamcrest.Matchers.hasItem
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.kafka.core.KafkaAdmin
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
class TaskAndShoppingAcceptanceTest {
    @Autowired lateinit var mockMvc: MockMvc
    @Autowired lateinit var memberRepository: MemberRepository

    // Keep acceptance tests deterministic: don't require Redis/Kafka.
    @MockBean lateinit var redisTemplate: RedisTemplate<String, Any>
    @MockBean lateinit var eventPublisher: IntegrationEventPublisher
    @MockBean(name = "seedData") lateinit var seedData: CommandLineRunner
    // Prevent KafkaAdmin from trying to connect to localhost:9092 in CI (no broker available).
    @MockBean lateinit var kafkaAdmin: KafkaAdmin

    @BeforeEach
    fun setUp() {
        whenever(redisTemplate.keys(any<String>())).thenReturn(emptySet())

        // The production app relies on DataSeeder for initial members, but in tests we mock seeding.
        // Ensure referenced members exist so controllers don't reject requests.
        ensureMemberExists("Kasper")
        ensureMemberExists("Emma")
    }

    private fun ensureMemberExists(name: String) {
        try {
            memberRepository.saveAndFlush(Member(name = name, level = 1, xp = 0))
        } catch (_: DataIntegrityViolationException) {
            // Member already created concurrently by another test.
        }
    }

    @Test
    fun `task user story flow create list and toggle`() {
        // Create
        val created =
            mockMvc
                .perform(
                    post("/api/tasks")
                        .contentType("application/json")
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
            .perform(get("/api/tasks"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("\$[*].title").value(hasItem("Tomme soppla")))

        // Toggle marks completed
        mockMvc
            .perform(patch("/api/tasks/{id}/toggle", id))
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
            .perform(get("/api/tasks/shopping"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("\$[*].item").value(hasItem("Dopapir")))

        // Toggle completed
        mockMvc
            .perform(patch("/api/tasks/shopping/{id}/toggle", itemId))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(itemId))
            .andExpect(jsonPath("$.completed").value(true))

        // Delete
        mockMvc
            .perform(delete("/api/tasks/shopping/{id}", itemId))
            .andExpect(status().isNoContent)
    }
}
