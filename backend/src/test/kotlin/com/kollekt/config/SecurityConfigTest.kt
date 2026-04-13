package com.kollekt.config

import com.kollekt.api.OnboardingController
import com.kollekt.api.TaskController
import com.kollekt.api.dto.AuthResponse
import com.kollekt.api.dto.LoginRequest
import com.kollekt.api.dto.UserDto
import com.kollekt.service.AccountOperations
import com.kollekt.service.CollectiveOperations
import com.kollekt.service.ShoppingOperations
import com.kollekt.service.TaskOperations
import com.kollekt.service.TokenStoreService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.JwsHeader
import org.springframework.security.oauth2.jwt.JwtClaimsSet
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.JwtEncoderParameters
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant

@WebMvcTest(
    properties = [
        "app.security.jwt-secret=test-jwt-secret-that-is-long-enough-for-hs256",
        "app.cors.allowed-origins=http://localhost:3000, https://kollekt.app",
    ],
    controllers = [OnboardingController::class, TaskController::class],
)
@Import(SecurityConfig::class)
class SecurityConfigTest {
    @Autowired lateinit var mockMvc: MockMvc

    @Autowired lateinit var corsConfigurationSource: org.springframework.web.cors.CorsConfigurationSource

    @Autowired lateinit var jwtEncoder: JwtEncoder

    @Autowired lateinit var jwtDecoder: JwtDecoder

    @Autowired lateinit var passwordEncoder: PasswordEncoder

    @MockitoBean lateinit var accountOperations: AccountOperations

    @MockitoBean lateinit var collectiveOperations: CollectiveOperations

    @MockitoBean lateinit var taskOperations: TaskOperations

    @MockitoBean lateinit var shoppingOperations: ShoppingOperations

    @MockitoBean lateinit var tokenStoreService: TokenStoreService

    @Test
    fun `security config allows onboarding login without authentication`() {
        val request = LoginRequest(name = "Kasper", password = "verysecure")
        whenever(accountOperations.login(request))
            .thenReturn(
                AuthResponse(
                    accessToken = "access-token",
                    refreshToken = "refresh-token",
                    tokenType = "Bearer",
                    expiresIn = 3600,
                    user = UserDto(id = 1, name = "Kasper", collectiveCode = null),
                ),
            )

        mockMvc
            .perform(
                post("/api/onboarding/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .content("""{"name":"Kasper","password":"verysecure"}"""),
            ).andExpect(status().isOk)

        verify(accountOperations).login(request)
    }

    @Test
    fun `security config requires authentication for task endpoints`() {
        mockMvc
            .perform(
                get("/api/tasks")
                    .param("memberName", "Kasper"),
            ).andExpect(status().isUnauthorized)

        verify(taskOperations, never()).getTasks(any())
    }

    @Test
    fun `security config accepts authenticated task requests`() {
        whenever(taskOperations.getTasks("Kasper")).thenReturn(emptyList())

        mockMvc
            .perform(
                get("/api/tasks")
                    .param("memberName", "Kasper")
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isOk)

        verify(taskOperations).getTasks("Kasper")
    }

    @Test
    fun `cors configuration applies configured origins to api and websocket routes`() {
        val apiRequest = MockHttpServletRequest("GET", "/api/tasks")
        val wsRequest = MockHttpServletRequest("GET", "/ws/socket")

        val apiConfig = corsConfigurationSource.getCorsConfiguration(apiRequest)
        val wsConfig = corsConfigurationSource.getCorsConfiguration(wsRequest)

        assertEquals(listOf("http://localhost:3000", "https://kollekt.app"), apiConfig?.allowedOrigins)
        assertEquals(listOf("http://localhost:3000", "https://kollekt.app"), wsConfig?.allowedOrigins)
        assertTrue(apiConfig?.allowCredentials == true)
    }

    @Test
    fun `jwt beans can encode and decode tokens with the configured secret`() {
        whenever(tokenStoreService.isAccessTokenRevoked(any())).thenReturn(false)
        val now = Instant.now()
        val claims =
            JwtClaimsSet
                .builder()
                .subject("Kasper")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .build()

        val encoded =
            jwtEncoder.encode(
                JwtEncoderParameters.from(
                    JwsHeader.with(MacAlgorithm.HS256).build(),
                    claims,
                ),
            )

        val decoded = jwtDecoder.decode(encoded.tokenValue)

        assertEquals("Kasper", decoded.subject)
    }

    @Test
    fun `password encoder hashes and verifies passwords`() {
        val encoded = passwordEncoder.encode("verysecure")

        assertTrue(passwordEncoder.matches("verysecure", encoded))
    }
}
