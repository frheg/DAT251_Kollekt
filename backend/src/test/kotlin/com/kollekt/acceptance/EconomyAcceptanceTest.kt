package com.kollekt.acceptance

import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.annotation.DirtiesContext
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestSecurityConfig::class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class EconomyAcceptanceTest : AcceptanceTestSupport() {
    @Test
    fun `economy flow creates summary and clears balances after settle up`() {
        mockMvc
            .perform(
                post("/api/economy/expenses")
                    .contentType("application/json")
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content(
                        """
                        {
                            "description": "Pizza",
                            "amount": 200,
                            "paidBy": "Emma",
                            "category": "Mat",
                            "date": "2026-03-10",
                            "participantNames": ["Kasper", "Emma"]
                        }
                        """.trimIndent(),
                    ),
            )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.description").value("Pizza"))
            .andExpect(jsonPath("$.paidBy").value("Kasper"))

        mockMvc
            .perform(
                post("/api/economy/pant")
                    .contentType("application/json")
                    .with(jwt().jwt { it.subject("Emma") })
                    .content(
                        """
                        {
                            "bottles": 20,
                            "amount": 60,
                            "addedBy": "Kasper",
                            "date": "2026-03-11"
                        }
                        """.trimIndent(),
                    ),
            )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.amount").value(60))
            .andExpect(jsonPath("$.addedBy").value("Emma"))

        mockMvc
            .perform(
                get("/api/economy/summary")
                    .param("memberName", "Kasper")
                    .with(jwt().jwt { it.subject("Kasper") }),
            )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.expenses[0].description").value("Pizza"))
            .andExpect(jsonPath("$.balances[0].name").value("Kasper"))
            .andExpect(jsonPath("$.balances[0].amount").value(100))
            .andExpect(jsonPath("$.balances[1].name").value("Emma"))
            .andExpect(jsonPath("$.balances[1].amount").value(-100))
            .andExpect(jsonPath("$.pantSummary.currentAmount").value(60))

        mockMvc
            .perform(
                post("/api/economy/settle-up")
                    .contentType("application/json")
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{"memberName":"Kasper"}"""),
            )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.settledBy").value("Kasper"))
            .andExpect(jsonPath("$.lastExpenseId").isNumber)

        mockMvc
            .perform(
                get("/api/economy/balances")
                    .param("memberName", "Kasper")
                    .with(jwt().jwt { it.subject("Kasper") }),
            )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(0))
    }
}
