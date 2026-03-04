package com.kollekt.repository

import com.kollekt.domain.ChatMessage
import org.springframework.data.jpa.repository.JpaRepository

interface ChatMessageRepository : JpaRepository<ChatMessage, Long> {
    fun findAllByCollectiveCode(collectiveCode: String): List<ChatMessage>
}
