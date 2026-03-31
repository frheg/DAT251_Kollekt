package com.kollekt.service

import com.kollekt.domain.CalendarEvent
import com.kollekt.domain.EventType
import com.kollekt.domain.Member
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.LocalDate
import java.time.LocalTime

class GoogleCalendarServiceTest {
    @Test
    fun `is configured reflects presence of google credentials`() {
        assertFalse(GoogleCalendarService("", "", "http://localhost/callback").isConfigured())
        assertTrue(GoogleCalendarService("client-id", "client-secret", "http://localhost/callback").isConfigured())
    }

    @Test
    fun `is connected requires a non blank access token`() {
        val disconnected = member(googleAccessToken = null)
        val connected = member(googleAccessToken = "token")

        assertFalse(GoogleCalendarService("id", "secret", "http://localhost/callback").isConnected(disconnected))
        assertTrue(GoogleCalendarService("id", "secret", "http://localhost/callback").isConnected(connected))
    }

    @Test
    fun `authorization url includes redirect uri and member state`() {
        val service = GoogleCalendarService("client-id", "client-secret", "http://localhost/callback")

        val url = service.getAuthorizationUrl("Kasper")

        assertTrue(url.contains("http://localhost/callback"))
        assertTrue(url.contains("state=Kasper"))
        assertTrue(url.contains("scope="))
    }

    @Test
    fun `create google event returns null when service is not configured`() {
        val service = GoogleCalendarService("", "", "http://localhost/callback")

        val result = service.createGoogleEvent(member(googleAccessToken = "token"), event())

        assertNull(result)
    }

    @Test
    fun `create google event returns null when member is not connected`() {
        val service = GoogleCalendarService("client-id", "client-secret", "http://localhost/callback")

        val result = service.createGoogleEvent(member(googleAccessToken = null), event())

        assertNull(result)
    }

    @Test
    fun `delete google event safely noops when prerequisites are missing`() {
        GoogleCalendarService("", "", "http://localhost/callback")
            .deleteGoogleEvent(member(googleAccessToken = "token"), "google-id")

        GoogleCalendarService("client-id", "client-secret", "http://localhost/callback")
            .deleteGoogleEvent(member(googleAccessToken = null), "google-id")
    }

    private fun member(googleAccessToken: String?) =
        Member(
            id = 1,
            name = "Kasper",
            email = "kasper@example.com",
            googleAccessToken = googleAccessToken,
            googleRefreshToken = "refresh-token",
        )

    private fun event() =
        CalendarEvent(
            id = 1,
            title = "Movie Night",
            collectiveCode = "ABC123",
            date = LocalDate.parse("2026-04-02"),
            time = LocalTime.parse("19:00"),
            type = EventType.MOVIE,
            organizer = "Kasper",
            attendees = 4,
            description = "Bring snacks",
        )
}
