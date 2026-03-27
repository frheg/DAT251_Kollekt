package com.kollekt.config

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertSame
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.springframework.data.redis.connection.RedisConnectionFactory
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer
import org.springframework.data.redis.serializer.StringRedisSerializer
import com.fasterxml.jackson.databind.SerializationFeature
import kotlin.test.assertIs

class RedisConfigTest {
    private val config = RedisConfig()

    @Test
    fun `object mapper writes java time values as iso strings`() {
        val objectMapper = config.objectMapper()

        assertFalse(objectMapper.isEnabled(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS))
    }

    @Test
    fun `redis template uses string keys and json values`() {
        val connectionFactory = mock<RedisConnectionFactory>()
        val objectMapper = config.objectMapper()

        val template = config.redisTemplate(connectionFactory, objectMapper)

        assertSame(connectionFactory, template.connectionFactory)
        assertIs<StringRedisSerializer>(template.keySerializer)
        assertIs<StringRedisSerializer>(template.hashKeySerializer)
        assertIs<Jackson2JsonRedisSerializer<*>>(template.valueSerializer)
        assertIs<Jackson2JsonRedisSerializer<*>>(template.hashValueSerializer)
    }
}
