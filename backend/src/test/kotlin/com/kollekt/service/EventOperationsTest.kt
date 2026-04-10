package com.kollekt.service

import com.kollekt.api.dto.CreateEventRequest
import com.kollekt.domain.CalendarEvent
import com.kollekt.domain.EventType
import com.kollekt.domain.Member
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.EventRepository
import com.kollekt.repository.MemberRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.redis.core.RedisTemplate
import java.time.LocalDate
import java.time.LocalTime
import java.util.Optional

class EventOperationsTest {
    private lateinit var memberRepository: MemberRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var eventRepository: EventRepository
    private lateinit var eventPublisher: IntegrationEventPublisher
    private lateinit var redisTemplate: RedisTemplate<String, Any>
    private lateinit var googleCalendarService: GoogleCalendarService
    private lateinit var collectiveAccessService: CollectiveAccessService
    private lateinit var statsCacheService: StatsCacheService
    private lateinit var operations: EventOperations

    @BeforeEach
    fun setUp() {
        memberRepository = mock()
        collectiveRepository = mock()
        eventRepository = mock()
        eventPublisher = mock()
        redisTemplate = mock()
        googleCalendarService = mock()
        doReturn(setOf("dashboard:Kasper")).whenever(redisTemplate).keys("dashboard:*")
        collectiveAccessService = CollectiveAccessService(memberRepository, collectiveRepository)
        statsCacheService = StatsCacheService(redisTemplate)
        operations =
            EventOperations(
                memberRepository,
                eventRepository,
                eventPublisher,
                collectiveAccessService,
                statsCacheService,
                googleCalendarService,
            )
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
    }

    @Test
    fun `create event clears dashboard and syncs to google when enabled`() {
        val actor = member("Kasper", "kasper@example.com")
        whenever(memberRepository.findByName("Kasper")).thenReturn(actor)
        whenever(eventRepository.save(any<CalendarEvent>())).thenAnswer {
            val event = it.arguments[0] as CalendarEvent
            if (event.id == 0L) event.copy(id = 7) else event
        }
        whenever(googleCalendarService.createGoogleEvent(any(), any())).thenReturn("google-123")

        val result =
            operations.createEvent(
                request =
                    CreateEventRequest(
                        title = "Movie night",
                        date = LocalDate.parse("2026-04-01"),
                        time = LocalTime.of(19, 0),
                        type = EventType.MOVIE,
                        organizer = "Ignored",
                        attendees = 4,
                        description = "Bring snacks",
                        syncToGoogle = true,
                    ),
                actorName = "Kasper",
            )

        verify(redisTemplate).delete(setOf("dashboard:Kasper"))
        verify(googleCalendarService).createGoogleEvent(actor, result.toEntity("ABC123"))
        assertEquals("Kasper", result.organizer)
        verify(eventPublisher).chatEvent("EVENT_CREATED", result)
    }

    @Test
    fun `delete event removes synced google event before deleting local record`() {
        val actor = member("Kasper", "kasper@example.com")
        val event =
            CalendarEvent(
                id = 3,
                title = "Movie night",
                collectiveCode = "ABC123",
                date = LocalDate.now().plusDays(1),
                time = LocalTime.NOON,
                type = EventType.MOVIE,
                organizer = "Kasper",
                attendees = 3,
                googleEventId = "google-123",
            )
        whenever(memberRepository.findByName("Kasper")).thenReturn(actor)
        whenever(eventRepository.findById(3)).thenReturn(Optional.of(event))

        operations.deleteEvent(eventId = 3, actorName = "Kasper")

        verify(redisTemplate).delete(setOf("dashboard:Kasper"))
        verify(googleCalendarService).deleteGoogleEvent(actor, "google-123")
        verify(eventRepository).delete(event)
        verify(eventPublisher).chatEvent("EVENT_DELETED", mapOf("id" to 3L))
    }

    private fun member(
        name: String,
        email: String,
        id: Long = 1,
        collectiveCode: String? = "ABC123",
    ) = Member(
        id = id,
        name = name,
        email = email,
        collectiveCode = collectiveCode,
    )

    private fun com.kollekt.api.dto.EventDto.toEntity(collectiveCode: String) =
        CalendarEvent(
            id = id,
            title = title,
            collectiveCode = collectiveCode,
            date = date,
            time = time,
            type = type,
            organizer = organizer,
            attendees = attendees,
            description = description,
        )
}
