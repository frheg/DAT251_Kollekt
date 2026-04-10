package com.kollekt.service

import com.kollekt.api.dto.CreateEventRequest
import com.kollekt.api.dto.EventDto
import com.kollekt.domain.CalendarEvent
import com.kollekt.domain.Member
import com.kollekt.repository.EventRepository
import com.kollekt.repository.MemberRepository
import org.springframework.stereotype.Service

@Service
class EventOperations(
    private val memberRepository: MemberRepository,
    private val eventRepository: EventRepository,
    private val eventPublisher: IntegrationEventPublisher,
) {
    fun getEvents(
        memberName: String,
        requireCollectiveCodeByMemberName: (String) -> String,
    ): List<EventDto> {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        return eventRepository
            .findAllByCollectiveCode(collectiveCode)
            .sortedBy { it.date }
            .map { it.toDto() }
    }

    fun createEvent(
        request: CreateEventRequest,
        actorName: String,
        requireCollectiveCodeByMemberName: (String) -> String,
        clearDashboardCache: () -> Unit,
        createGoogleEvent: ((Member, CalendarEvent) -> String?)? = null,
    ): EventDto {
        val collectiveCode = requireCollectiveCodeByMemberName(actorName)
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

        if (request.syncToGoogle && createGoogleEvent != null) {
            val member = memberRepository.findByName(actorName)
            if (member != null) {
                val googleEventId = createGoogleEvent(member, saved)
                if (googleEventId != null) {
                    saved = eventRepository.save(saved.copy(googleEventId = googleEventId))
                }
            }
        }

        clearDashboardCache()
        eventPublisher.chatEvent("EVENT_CREATED", saved.toDto())
        return saved.toDto()
    }

    fun deleteEvent(
        eventId: Long,
        actorName: String,
        requireCollectiveCodeByMemberName: (String) -> String,
        clearDashboardCache: () -> Unit,
        deleteGoogleEvent: ((Member, String) -> Unit)? = null,
    ) {
        val collectiveCode = requireCollectiveCodeByMemberName(actorName)
        val event =
            eventRepository
                .findById(eventId)
                .orElseThrow { IllegalArgumentException("Event $eventId not found") }

        require(event.collectiveCode == collectiveCode) { "Event not in your collective" }

        if (event.googleEventId != null && deleteGoogleEvent != null) {
            val member = memberRepository.findByName(actorName)
            if (member != null) {
                deleteGoogleEvent(member, event.googleEventId)
            }
        }

        eventRepository.delete(event)
        clearDashboardCache()
        eventPublisher.chatEvent("EVENT_DELETED", mapOf("id" to eventId))
    }

    private fun CalendarEvent.toDto() = EventDto(id, title, date, time, type, organizer, attendees, description)
}
