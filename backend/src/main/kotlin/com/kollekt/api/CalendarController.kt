@file:Suppress("ktlint:standard:no-wildcard-imports")

package com.kollekt.api

import com.kollekt.api.dto.CreateEventRequest
import com.kollekt.api.dto.EventDto
import com.kollekt.service.KollektService
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/events")
class CalendarController(private val service: KollektService) {
    @GetMapping
    fun getEvents(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): List<EventDto> {
        requireTokenSubject(jwt, memberName)
        return service.getEvents(memberName)
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun createEvent(
        @RequestBody request: CreateEventRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): EventDto = service.createEvent(request, jwt.subject)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteEvent(
        @PathVariable id: Long,
        @AuthenticationPrincipal jwt: Jwt,
    ) = service.deleteEvent(id, jwt.subject)
}
