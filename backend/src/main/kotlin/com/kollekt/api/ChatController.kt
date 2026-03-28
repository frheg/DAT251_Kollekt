@file:Suppress("ktlint:standard:no-wildcard-imports")

package com.kollekt.api

import com.kollekt.api.dto.AddReactionRequest
import com.kollekt.api.dto.CreateMessageRequest
import com.kollekt.api.dto.CreatePollRequest
import com.kollekt.api.dto.MessageDto
import com.kollekt.api.dto.RemoveReactionRequest
import com.kollekt.api.dto.VotePollRequest
import com.kollekt.service.KollektService
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

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

    @PostMapping("/images")
    @ResponseStatus(HttpStatus.CREATED)
    fun createImageMessage(
        @RequestParam("image") image: MultipartFile,
        @RequestParam("caption", required = false) caption: String?,
        @AuthenticationPrincipal jwt: Jwt,
    ): MessageDto = service.createImageMessage(image, caption, jwt.subject)

    @PostMapping("/polls")
    @ResponseStatus(HttpStatus.CREATED)
    fun createPoll(
        @RequestBody request: CreatePollRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): MessageDto = service.createPoll(request, jwt.subject)

    @PostMapping("/messages/{messageId}/poll/vote")
    fun votePoll(
        @PathVariable messageId: Long,
        @RequestBody request: VotePollRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): MessageDto = service.votePoll(messageId, request.optionId, jwt.subject)

    @PostMapping("/messages/{messageId}/reactions")
    fun addReaction(
        @PathVariable messageId: Long,
        @RequestBody request: AddReactionRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): MessageDto = service.addReaction(messageId, request.emoji, jwt.subject)

    @DeleteMapping("/messages/{messageId}/reactions")
    fun removeReaction(
        @PathVariable messageId: Long,
        @RequestBody request: RemoveReactionRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): MessageDto = service.removeReaction(messageId, request.emoji, jwt.subject)
}
