package com.kollekt.service

import com.kollekt.api.dto.CreateUserRequest
import com.kollekt.api.dto.LoginRequest
import com.kollekt.api.dto.RefreshTokenRequest
import com.kollekt.domain.Member
import com.kollekt.repository.MemberRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.security.crypto.password.PasswordEncoder

class AccountOperationsTest {
    private lateinit var memberRepository: MemberRepository
    private lateinit var passwordEncoder: PasswordEncoder
    private lateinit var tokenService: TokenService
    private lateinit var redisTemplate: RedisTemplate<String, Any>
    private lateinit var userProfileService: UserProfileService
    private lateinit var statsCacheService: StatsCacheService
    private lateinit var operations: AccountOperations

    @BeforeEach
    fun setUp() {
        memberRepository = mock()
        passwordEncoder = mock()
        tokenService = mock()
        redisTemplate = mock()
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("leaderboard:*")
        userProfileService = UserProfileService(memberRepository)
        statsCacheService = StatsCacheService(redisTemplate)
        operations = AccountOperations(memberRepository, passwordEncoder, tokenService, userProfileService, statsCacheService)
    }

    @Test
    fun `create user uses normalized email lookup and returns auth response`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(null)
        whenever(memberRepository.findByEmail("kasper@example.com")).thenReturn(null)
        whenever(passwordEncoder.encode("supersecret")).thenReturn("encoded-password")
        whenever(memberRepository.save(any<Member>())).thenAnswer {
            (it.arguments[0] as Member).copy(id = 5)
        }
        whenever(tokenService.issueTokenPair(any<Member>())).thenReturn(
            TokenResult("access-token", "refresh-token", "Bearer", 3600),
        )

        val result =
            operations.createUser(
                CreateUserRequest("  Kasper  ", "  KASPER@example.com ", "  supersecret  "),
            )

        verify(memberRepository).findByEmail("kasper@example.com")
        verify(redisTemplate).keys("dashboard:*")
        verify(redisTemplate).keys("leaderboard:*")
        assertEquals("access-token", result.accessToken)
        assertEquals("kasper@example.com", result.user.email)
    }

    @Test
    fun `reset password uses normalized email lookup`() {
        val existing = member(name = "Kasper", email = "kasper@example.com").copy(passwordHash = "old")
        whenever(memberRepository.findByEmail("kasper@example.com")).thenReturn(existing)
        whenever(passwordEncoder.encode("new-secret")).thenReturn("encoded-secret")

        operations.resetPassword(memberName = null, email = "  KASPER@example.com ", newPassword = "new-secret")

        val memberCaptor = argumentCaptor<Member>()
        verify(memberRepository).save(memberCaptor.capture())
        assertEquals("encoded-secret", memberCaptor.firstValue.passwordHash)
        verify(memberRepository, never()).findByName(any<String>())
    }

    @Test
    fun `refresh token reissues token pair for rotated subject`() {
        val existing = member(name = "Kasper", email = "kasper@example.com")
        whenever(tokenService.rotateRefreshToken("refresh-token")).thenReturn(RefreshResult("Kasper"))
        whenever(memberRepository.findByName("Kasper")).thenReturn(existing)
        whenever(tokenService.issueTokenPair(existing)).thenReturn(
            TokenResult("new-access", "new-refresh", "Bearer", 3600),
        )

        val result = operations.refreshToken(RefreshTokenRequest("refresh-token"))

        assertEquals("new-access", result.accessToken)
        assertEquals("new-refresh", result.refreshToken)
    }

    @Test
    fun `login trims credentials before authentication`() {
        val existing = member(name = "Kasper", email = "kasper@example.com").copy(passwordHash = "stored-hash")
        whenever(memberRepository.findByName("Kasper")).thenReturn(existing)
        whenever(passwordEncoder.matches("supersecret", "stored-hash")).thenReturn(true)
        whenever(tokenService.issueTokenPair(existing)).thenReturn(
            TokenResult("access-token", "refresh-token", "Bearer", 3600),
        )

        val result = operations.login(LoginRequest("  Kasper  ", "  supersecret  "))

        assertEquals("Kasper", result.user.name)
    }

    @Test
    fun `get user by name uses user profile mapping with defaults`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))

        val result = operations.getUserByName("Kasper")

        assertEquals("kasper@example.com", result.email)
        assertTrue(result.friends.isEmpty())
    }

    private fun member(
        name: String,
        email: String,
        id: Long = 1,
        collectiveCode: String? = "ABC123",
    ) = Member(
        id = id,
        name = name,
        email = email,
        collectiveCode = collectiveCode,
    )
}
