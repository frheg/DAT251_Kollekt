package com.kollekt.acceptance

import com.nimbusds.jose.jwk.source.ImmutableSecret
import javax.crypto.spec.SecretKeySpec
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
import org.springframework.context.annotation.Profile
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder
import org.springframework.security.web.SecurityFilterChain

/**
 * Replaces the real SecurityConfig in the "test" profile.
 * SecurityConfig itself is excluded via @Profile("!test") on the prod class,
 * so only this single chain is registered — no dual-chain conflict.
 * Permits all requests so acceptance tests need no JWT token.
 */
@TestConfiguration
@Profile("test")
class TestSecurityConfig {
    private val secret = "test-jwt-secret-that-is-at-least-32-characters-long"

    @Bean @Primary
    fun testSecurityFilterChain(http: HttpSecurity): SecurityFilterChain =
        http
            .csrf { it.disable() }
            .authorizeHttpRequests { it.anyRequest().permitAll() }
            .build()

    @Bean @Primary
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    @Bean @Primary
    fun jwtDecoder(): JwtDecoder {
        val key = SecretKeySpec(secret.toByteArray(), "HmacSHA256")
        return NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build()
    }

    @Bean @Primary
    fun jwtEncoder(): JwtEncoder {
        val key = SecretKeySpec(secret.toByteArray(), "HmacSHA256")
        return NimbusJwtEncoder(ImmutableSecret(key))
    }
}
