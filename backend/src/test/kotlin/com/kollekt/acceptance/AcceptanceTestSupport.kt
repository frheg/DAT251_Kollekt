package com.kollekt.acceptance

import com.kollekt.domain.Member
import com.kollekt.repository.MemberRepository
import com.kollekt.service.IntegrationEventPublisher
import com.kollekt.service.TokenStoreService
import org.junit.jupiter.api.BeforeEach
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.CommandLineRunner
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.kafka.core.KafkaAdmin
import org.springframework.test.web.servlet.MockMvc

abstract class AcceptanceTestSupport {
    @Autowired lateinit var mockMvc: MockMvc

    @Autowired lateinit var memberRepository: MemberRepository

    // Keep acceptance tests deterministic: don't require Redis/Kafka/Security.
    @MockBean lateinit var redisTemplate: RedisTemplate<String, Any>

    @MockBean lateinit var eventPublisher: IntegrationEventPublisher

    @MockBean(name = "seedData")
    lateinit var seedData: CommandLineRunner

    // Prevent KafkaAdmin from trying to connect to localhost:9092 in CI (no broker available).
    @MockBean lateinit var kafkaAdmin: KafkaAdmin

    // TokenStoreService is used by SecurityConfig; mock it to avoid Redis dependency.
    @MockBean lateinit var tokenStoreService: TokenStoreService

    @BeforeEach
    fun setUpAcceptanceContext() {
        whenever(redisTemplate.keys(any<String>())).thenReturn(emptySet())

        val collectiveCode = "TEST-COLLECTIVE"
        ensureMember("Kasper", "kasper@example.com", collectiveCode)
        ensureMember("Emma", "emma@example.com", collectiveCode)
    }

    protected fun extractId(json: String): Long {
        val idRegex = "\"id\"\\s*:\\s*(\\d+)".toRegex()
        return idRegex.find(json)!!.groupValues[1].toLong()
    }

    private fun ensureMember(
        name: String,
        email: String,
        collectiveCode: String,
    ) {
        if (memberRepository.findByName(name) == null) {
            memberRepository.saveAndFlush(
                Member(name = name, email = email, level = 1, xp = 0, collectiveCode = collectiveCode),
            )
        }
    }
}
