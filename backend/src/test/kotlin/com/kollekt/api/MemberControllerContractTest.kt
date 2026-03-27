package com.kollekt.api

import com.kollekt.service.KollektService
import com.kollekt.service.TokenStoreService
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.http.MediaType
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@WebMvcTest(
    properties = ["app.security.jwt-secret=test-jwt-secret-that-is-long-enough"],
    controllers = [MemberController::class],
)
class MemberControllerContractTest {
    @Autowired lateinit var mockMvc: MockMvc

    @MockitoBean lateinit var service: KollektService

    @MockitoBean lateinit var tokenStoreService: TokenStoreService

    @Test
    fun `member invite delegates to the service with token subject`() {
        mockMvc
            .perform(
                post("/api/members/invite")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{"email":"emma@example.com","collectiveCode":"ABC123"}"""),
            ).andExpect(status().isOk)

        verify(service).inviteUserToCollective("emma@example.com", "ABC123", "Kasper")
    }

    @Test
    fun `member status update accepts valid enum values`() {
        mockMvc
            .perform(
                patch("/api/members/status")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{"memberName":"Kasper","status":"away"}"""),
            ).andExpect(status().isOk)

        verify(service).updateMemberStatus("Kasper", com.kollekt.domain.MemberStatus.AWAY)
    }

    @Test
    fun `member reset password forwards identifier and password`() {
        mockMvc
            .perform(
                patch("/api/members/reset-password")
                    .param("email", "kasper@example.com")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{"newPassword":"new-secret"}"""),
            ).andExpect(status().isOk)

        verify(service).resetPassword(null, "kasper@example.com", "new-secret")
    }

    @Test
    fun `member delete delegates when token subject matches member`() {
        mockMvc
            .perform(
                delete("/api/members/delete")
                    .param("memberName", "Kasper")
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isOk)

        verify(service).deleteUser("Kasper")
    }

    @Test
    fun `member add and remove friend endpoints delegate expected names`() {
        mockMvc
            .perform(
                post("/api/members/friends/add")
                    .param("memberName", "Kasper")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{"friendName":"Emma"}"""),
            ).andExpect(status().isOk)

        mockMvc
            .perform(
                delete("/api/members/friends/remove")
                    .param("memberName", "Kasper")
                    .param("friendName", "Emma")
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isOk)

        verify(service).addFriend("Kasper", "Emma")
        verify(service).removeFriend("Kasper", "Emma")
    }

    @Test
    fun `member add friend rejects missing friend name`() {
        mockMvc
            .perform(
                post("/api/members/friends/add")
                    .param("memberName", "Kasper")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{}"""),
            ).andExpect(status().isBadRequest)

        verify(service, never()).addFriend(any(), any())
    }

    @Test
    fun `member reset password rejects missing new password`() {
        mockMvc
            .perform(
                patch("/api/members/reset-password")
                    .param("memberName", "Kasper")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{}"""),
            ).andExpect(status().isBadRequest)

        verify(service, never()).resetPassword(anyOrNull(), anyOrNull(), any())
    }
}
