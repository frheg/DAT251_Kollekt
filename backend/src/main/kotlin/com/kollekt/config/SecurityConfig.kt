package com.kollekt.config

import com.kollekt.service.TokenStoreService
import com.nimbusds.jose.jwk.source.ImmutableSecret
import javax.crypto.spec.SecretKeySpec
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
import org.springframework.security.config.Customizer
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.JwtValidators
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder
import org.springframework.security.web.SecurityFilterChain

@Configuration
@EnableWebSecurity
class SecurityConfig(
        @Value("\${app.security.jwt-secret}") private val jwtSecret: String,
        private val tokenStoreService: TokenStoreService,
) {
    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        return http
                .csrf { it.disable() }
                .cors(Customizer.withDefaults())
                .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
                .authorizeHttpRequests {
                    it.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                    it.requestMatchers(
                                    "/api/onboarding/users",
                                    "/api/onboarding/login",
                                    "/api/onboarding/refresh",
                            )
                            .permitAll()
                    it.requestMatchers("/ws/**").permitAll()
                    it.anyRequest().authenticated()
                }
                .oauth2ResourceServer { it.jwt(Customizer.withDefaults()) }
                .build()
    }

    @Bean fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    @Bean
    fun jwtDecoder(): JwtDecoder {
        val key = SecretKeySpec(jwtSecret.toByteArray(), "HmacSHA256")
        val decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build()
        val defaultValidator = JwtValidators.createDefault()
        val revokedValidator = RevokedTokenValidator(tokenStoreService)
        decoder.setJwtValidator(
                DelegatingOAuth2TokenValidator<Jwt>(defaultValidator, revokedValidator)
        )
        return decoder
    }

    @Bean
    fun jwtEncoder(): JwtEncoder {
        val key = SecretKeySpec(jwtSecret.toByteArray(), "HmacSHA256")
        return NimbusJwtEncoder(ImmutableSecret(key))
    }
}
