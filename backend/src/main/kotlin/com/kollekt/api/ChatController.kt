package com.kollekt.api

import com.kollekt.api.dto.CreateMessageRequest
import com.kollekt.api.dto.MessageDto
import com.kollekt.service.KollektService
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/chat")
class ChatController(private val service: KollektService) {
        @GetMapping("/messages")
        fun getMessages(
                @RequestParam memberName: String,
                @AuthenticationPrincipal jwt: Jwt,
        ): List<MessageDto> {
                requireTokenSubject(jwt, memberName)
                return service.getMessages(memberName)
        }

        @PostMapping("/messages")
        @ResponseStatus(HttpStatus.CREATED)
        fun createMessage(
                @RequestBody request: CreateMessageRequest,
                @AuthenticationPrincipal jwt: Jwt,
        ): MessageDto = service.createMessage(request, jwt.subject)
}
