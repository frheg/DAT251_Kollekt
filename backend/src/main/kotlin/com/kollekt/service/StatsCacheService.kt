package com.kollekt.service

import org.springframework.data.redis.core.RedisTemplate
import org.springframework.stereotype.Service

@Service
class StatsCacheService(
    private val redisTemplate: RedisTemplate<String, Any>,
) {
    fun clearTaskCaches() {
        clearDashboardCache()
        clearLeaderboardCache()
    }

    fun clearDashboardCache() {
        val keys = redisTemplate.keys("dashboard:*")
        if (!keys.isNullOrEmpty()) {
            redisTemplate.delete(keys)
        }
    }

    fun clearLeaderboardCache() {
        val keys = redisTemplate.keys("leaderboard:*")
        if (!keys.isNullOrEmpty()) {
            redisTemplate.delete(keys)
        }
    }

    fun clearAllCaches() = clearTaskCaches()
}
