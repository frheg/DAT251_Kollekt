package com.kollekt.service

import com.kollekt.api.dto.CreateEventRequest
import com.kollekt.api.dto.EventDto
import com.kollekt.domain.CalendarEvent
import com.kollekt.repository.EventRepository
import com.kollekt.repository.MemberRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class EventOperations(
    private val memberRepository: MemberRepository,
    private val eventRepository: EventRepository,
    private val eventPublisher: IntegrationEventPublisher,
    private val collectiveAccessService: CollectiveAccessService,
    private val statsCacheService: StatsCacheService,
    private val googleCalendarService: GoogleCalendarService,
) {
    fun getEvents(memberName: String): List<EventDto> {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        return eventRepository
            .findAllByCollectiveCode(collectiveCode)
            .sortedBy { it.date }
            .map { it.toDto() }
    }

    @Transactional
    fun createEvent(
        request: CreateEventRequest,
        actorName: String,
    ): EventDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        var saved =
            eventRepository.save(
                CalendarEvent(
                    title = request.title,
                    collectiveCode = collectiveCode,
                    date = request.date,
                    time = request.time,
                    type = request.type,
                    organizer = actorName,
                    attendees = request.attendees,
                    description = request.description,
                ),
            )

        if (request.syncToGoogle) {
            val member = memberRepository.findByName(actorName)
            if (member != null) {
                val googleEventId = googleCalendarService.createGoogleEvent(member, saved)
                if (googleEventId != null) {
                    saved = eventRepository.save(saved.copy(googleEventId = googleEventId))
                }
            }
        }

        statsCacheService.clearDashboardCache()
        eventPublisher.chatEvent("EVENT_CREATED", saved.toDto())
        return saved.toDto()
    }

    @Transactional
    fun deleteEvent(
        eventId: Long,
        actorName: String,
    ) {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val event =
            eventRepository
                .findById(eventId)
                .orElseThrow { IllegalArgumentException("Event $eventId not found") }

        require(event.collectiveCode == collectiveCode) { "Event not in your collective" }

        if (event.googleEventId != null) {
            val member = memberRepository.findByName(actorName)
            if (member != null) {
                googleCalendarService.deleteGoogleEvent(member, event.googleEventId)
            }
        }

        eventRepository.delete(event)
        statsCacheService.clearDashboardCache()
        eventPublisher.chatEvent("EVENT_DELETED", mapOf("id" to eventId))
    }

    private fun CalendarEvent.toDto() = EventDto(id, title, date, time, type, organizer, attendees, description)
}
