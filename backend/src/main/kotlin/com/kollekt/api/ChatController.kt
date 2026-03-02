package com.kollekt.api

import com.kollekt.api.dto.CreateMessageRequest
import com.kollekt.api.dto.MessageDto
import com.kollekt.service.KollektService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/chat")
class ChatController(private val service: KollektService) {
    @GetMapping("/messages") fun getMessages(): List<MessageDto> = service.getMessages()

    @PostMapping("/messages")
    @ResponseStatus(HttpStatus.CREATED)
    fun createMessage(@RequestBody request: CreateMessageRequest): MessageDto =
            service.createMessage(request)
}
