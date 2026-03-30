package com.kollekt.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.CorsRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

@Configuration
class WebConfig(
    @Value("\${app.cors.allowed-origins}") private val allowedOrigins: String,
) : WebMvcConfigurer {
    override fun addCorsMappings(registry: CorsRegistry) {
        val configuredOrigins = allowedOrigins.split(',').map { it.trim() }.filter { it.isNotBlank() }
        val originPatterns = (configuredOrigins + listOf("http://127.0.0.1:*", "http://localhost:*")).distinct()

        registry
            .addMapping("/api/**")
            .allowedOriginPatterns(*originPatterns.toTypedArray())
            .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            .allowedHeaders("*")
    }
}
