package com.kollekt.service

import com.kollekt.api.dto.CreateEventRequest
import com.kollekt.api.dto.EventDto
import com.kollekt.api.dto.UpdateEventRequest
import com.kollekt.domain.CalendarEvent
import com.kollekt.domain.MemberStatus
import com.kollekt.repository.EventRepository
import com.kollekt.repository.MemberRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class EventOperations(
    private val memberRepository: MemberRepository,
    private val eventRepository: EventRepository,
    private val eventPublisher: IntegrationEventPublisher,
    private val notificationService: NotificationService,
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
                    endTime = request.endTime,
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

        val others =
            memberRepository.findAllByCollectiveCode(collectiveCode)
                .filter { it.status == MemberStatus.ACTIVE && it.name != actorName }
                .map { it.name }
        if (others.isNotEmpty()) {
            notificationService.createParameterizedGroupNotification(
                userNames = others,
                type = "EVENT_ADDED",
                params = mapOf("title" to request.title, "date" to request.date.toString()),
            )
        }

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

    @Transactional
    fun updateEvent(
        eventId: Long,
        request: UpdateEventRequest,
        actorName: String,
    ): EventDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val event =
            eventRepository
                .findById(eventId)
                .orElseThrow { IllegalArgumentException("Event $eventId not found") }

        require(event.collectiveCode == collectiveCode) { "Event not in your collective" }

        val updated =
            eventRepository.save(
                event.copy(
                    title = request.title,
                    time = request.time,
                    endTime = request.endTime,
                    type = request.type,
                    description = request.description,
                ),
            )

        statsCacheService.clearDashboardCache()
        eventPublisher.chatEvent("EVENT_UPDATED", updated.toDto())
        return updated.toDto()
    }

    private fun CalendarEvent.toDto() = EventDto(id, title, date, time, endTime, type, organizer, attendees, description)
}
