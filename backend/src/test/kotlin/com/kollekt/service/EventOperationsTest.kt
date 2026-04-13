package com.kollekt.service

import com.kollekt.api.dto.CreateEventRequest
import com.kollekt.api.dto.UpdateEventRequest
import com.kollekt.domain.CalendarEvent
import com.kollekt.domain.EventType
import com.kollekt.domain.Member
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.EventRepository
import com.kollekt.repository.MemberRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
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
    private lateinit var notificationService: NotificationService
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
        notificationService = mock()
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
                notificationService,
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

    @Test
    fun `get events returns events sorted by date`() {
        whenever(eventRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                CalendarEvent(
                    id = 2,
                    title = "Later",
                    collectiveCode = "ABC123",
                    date = LocalDate.parse("2026-05-01"),
                    time = LocalTime.NOON,
                    type = EventType.OTHER,
                    organizer = "Kasper",
                    attendees = 1,
                ),
                CalendarEvent(
                    id = 1,
                    title = "Earlier",
                    collectiveCode = "ABC123",
                    date = LocalDate.parse("2026-04-01"),
                    time = LocalTime.NOON,
                    type = EventType.MOVIE,
                    organizer = "Kasper",
                    attendees = 1,
                ),
            ),
        )

        val result = operations.getEvents("Kasper")

        assertEquals(listOf("Earlier", "Later"), result.map { it.title })
    }

    @Test
    fun `create event sends group notification to other active members`() {
        val kasper = member("Kasper", "kasper@example.com")
        val emma = member("Emma", "emma@example.com", id = 2)
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(listOf(kasper, emma))
        whenever(eventRepository.save(any<CalendarEvent>())).thenAnswer {
            val e = it.arguments[0] as CalendarEvent
            if (e.id == 0L) e.copy(id = 5) else e
        }

        operations.createEvent(
            CreateEventRequest(
                title = "Party",
                date = LocalDate.parse("2026-06-01"),
                time = LocalTime.of(20, 0),
                type = EventType.PARTY,
                organizer = "Ignored",
                attendees = 1,
                syncToGoogle = false,
            ),
            actorName = "Kasper",
        )

        verify(notificationService).createGroupNotification(
            userNames = listOf("Emma"),
            message = "New event: 'Party' on 2026-06-01",
            type = "EVENT_ADDED",
        )
    }

    @Test
    fun `delete event throws when event not found`() {
        whenever(eventRepository.findById(99L)).thenReturn(Optional.empty())

        assertThrows<IllegalArgumentException> {
            operations.deleteEvent(eventId = 99L, actorName = "Kasper")
        }
    }

    @Test
    fun `delete event throws when event belongs to different collective`() {
        val event =
            CalendarEvent(
                id = 5,
                title = "Other",
                collectiveCode = "DIFFERENT",
                date = LocalDate.now(),
                time = LocalTime.NOON,
                type = EventType.OTHER,
                organizer = "Other",
                attendees = 1,
            )
        whenever(eventRepository.findById(5L)).thenReturn(Optional.of(event))

        assertThrows<IllegalArgumentException> {
            operations.deleteEvent(eventId = 5L, actorName = "Kasper")
        }
    }

    @Test
    fun `update event saves changed fields and publishes event`() {
        val existing =
            CalendarEvent(
                id = 3,
                title = "Old",
                collectiveCode = "ABC123",
                date = LocalDate.now(),
                time = LocalTime.of(18, 0),
                type = EventType.OTHER,
                organizer = "Kasper",
                attendees = 1,
            )
        whenever(eventRepository.findById(3L)).thenReturn(Optional.of(existing))
        whenever(eventRepository.save(any<CalendarEvent>())).thenAnswer { it.arguments[0] as CalendarEvent }

        val result =
            operations.updateEvent(
                eventId = 3L,
                request =
                    UpdateEventRequest(
                        title = "New Title",
                        time = LocalTime.of(20, 0),
                        endTime = LocalTime.of(22, 0),
                        type = EventType.PARTY,
                    ),
                actorName = "Kasper",
            )

        assertEquals("New Title", result.title)
        assertEquals(EventType.PARTY, result.type)
        verify(eventPublisher).chatEvent("EVENT_UPDATED", result)
        verify(redisTemplate).delete(setOf("dashboard:Kasper"))
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
