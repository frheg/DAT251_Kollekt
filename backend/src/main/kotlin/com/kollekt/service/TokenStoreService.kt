package com.kollekt.service

import java.time.Duration
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service

@Service
class TokenStoreService(
        private val redisTemplate: StringRedisTemplate,
) {
    fun storeRefreshToken(jti: String, subject: String, ttl: Duration) {
        redisTemplate.opsForValue().set(refreshKey(jti), subject, ttl)
    }

    fun isRefreshTokenActive(jti: String, subject: String): Boolean {
        val stored = redisTemplate.opsForValue().get(refreshKey(jti))
        return stored == subject
    }

    fun revokeRefreshToken(jti: String) {
        redisTemplate.delete(refreshKey(jti))
    }

    fun revokeAccessToken(jti: String, ttl: Duration) {
        if (!ttl.isNegative && !ttl.isZero) {
            redisTemplate.opsForValue().set(revokedAccessKey(jti), "1", ttl)
        }
    }

    fun isAccessTokenRevoked(jti: String): Boolean =
            redisTemplate.hasKey(revokedAccessKey(jti)) == true

    private fun refreshKey(jti: String): String = "auth:refresh:$jti"

    private fun revokedAccessKey(jti: String): String = "auth:revoked-access:$jti"
}
