package com.kollekt.config

import org.apache.kafka.clients.admin.NewTopic
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.support.serializer.JsonDeserializer
import org.springframework.kafka.support.serializer.JsonSerializer

@Configuration
class KafkaConfig {
    @Bean
    fun taskEventsTopic(
        @Value("\${app.topics.task-events}") topic: String,
    ): NewTopic = NewTopic(topic, 1, 1)

    @Bean
    fun chatEventsTopic(
        @Value("\${app.topics.chat-events}") topic: String,
    ): NewTopic = NewTopic(topic, 1, 1)

    @Bean
    fun economyEventsTopic(
        @Value("\${app.topics.economy-events}") topic: String,
    ): NewTopic = NewTopic(topic, 1, 1)

    @Bean
    fun jsonDeserializer(): JsonDeserializer<Any> {
        val deserializer = JsonDeserializer<Any>()
        deserializer.addTrustedPackages("*")
        return deserializer
    }

    @Bean fun jsonSerializer(): JsonSerializer<Any> = JsonSerializer()
}
