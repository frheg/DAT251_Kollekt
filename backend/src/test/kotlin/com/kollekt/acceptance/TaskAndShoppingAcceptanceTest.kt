package com.kollekt.acceptance

import org.hamcrest.Matchers.hasItem
import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.annotation.DirtiesContext
import org.springframework.test.context.ActiveProfiles
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
class TaskAndShoppingAcceptanceTest : AcceptanceTestSupport() {
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

        val id = extractId(created.response.contentAsString)

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

        val itemId = extractId(created.response.contentAsString)

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
