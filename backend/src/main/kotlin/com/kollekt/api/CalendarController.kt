package com.kollekt.api

import com.kollekt.api.dto.CreateEventRequest
import com.kollekt.api.dto.EventDto
import com.kollekt.service.KollektService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/events")
class CalendarController(private val service: KollektService) {
    @GetMapping
    fun getEvents(@RequestParam memberName: String): List<EventDto> = service.getEvents(memberName)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun createEvent(@RequestBody request: CreateEventRequest): EventDto =
            service.createEvent(request)
}
