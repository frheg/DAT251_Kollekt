package com.kollekt.service

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.core.ValueOperations
import java.time.Duration

@ExtendWith(MockitoExtension::class)
class TokenStoreServiceTest {
    @Mock lateinit var redisTemplate: StringRedisTemplate

    @Mock lateinit var valueOperations: ValueOperations<String, String>

    @Test
    fun `storeRefreshToken writes refresh key with ttl`() {
        whenever(redisTemplate.opsForValue()).thenReturn(valueOperations)
        val service = TokenStoreService(redisTemplate)

        service.storeRefreshToken("jti-1", "Kasper", Duration.ofMinutes(30))

        verify(valueOperations).set("auth:refresh:jti-1", "Kasper", Duration.ofMinutes(30))
    }

    @Test
    fun `isRefreshTokenActive returns true only for matching subject`() {
        whenever(redisTemplate.opsForValue()).thenReturn(valueOperations)
        whenever(valueOperations.get("auth:refresh:jti-1")).thenReturn("Kasper")
        val service = TokenStoreService(redisTemplate)

        assertTrue(service.isRefreshTokenActive("jti-1", "Kasper"))
        assertFalse(service.isRefreshTokenActive("jti-1", "Emma"))
    }

    @Test
    fun `revokeRefreshToken deletes refresh key`() {
        val service = TokenStoreService(redisTemplate)

        service.revokeRefreshToken("jti-2")

        verify(redisTemplate).delete("auth:refresh:jti-2")
    }

    @Test
    fun `revokeAccessToken stores revoked key only for positive ttl`() {
        whenever(redisTemplate.opsForValue()).thenReturn(valueOperations)
        val service = TokenStoreService(redisTemplate)

        service.revokeAccessToken("jti-3", Duration.ofMinutes(5))
        service.revokeAccessToken("jti-4", Duration.ZERO)
        service.revokeAccessToken("jti-5", Duration.ofSeconds(-1))

        verify(valueOperations).set("auth:revoked-access:jti-3", "1", Duration.ofMinutes(5))
        verify(valueOperations, never()).set(eq("auth:revoked-access:jti-4"), eq("1"), eq(Duration.ZERO))
        verify(valueOperations, never()).set(
            eq("auth:revoked-access:jti-5"),
            eq("1"),
            eq(Duration.ofSeconds(-1)),
        )
    }

    @Test
    fun `isAccessTokenRevoked mirrors redis hasKey`() {
        whenever(redisTemplate.hasKey("auth:revoked-access:jti-6")).thenReturn(true)
        whenever(redisTemplate.hasKey("auth:revoked-access:jti-7")).thenReturn(false)
        val service = TokenStoreService(redisTemplate)

        assertTrue(service.isAccessTokenRevoked("jti-6"))
        assertFalse(service.isAccessTokenRevoked("jti-7"))
    }
}
