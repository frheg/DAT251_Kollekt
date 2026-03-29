package com.kollekt.service

import com.google.api.client.auth.oauth2.BearerToken
import com.google.api.client.auth.oauth2.ClientParametersAuthentication
import com.google.api.client.auth.oauth2.Credential
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow
import com.google.api.client.googleapis.auth.oauth2.GoogleClientSecrets
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport
import com.google.api.client.http.GenericUrl
import com.google.api.client.json.gson.GsonFactory
import com.google.api.client.util.DateTime
import com.google.api.services.calendar.Calendar
import com.google.api.services.calendar.model.Event
import com.google.api.services.calendar.model.EventDateTime
import com.kollekt.domain.CalendarEvent
import com.kollekt.domain.Member
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.time.ZoneId

@Service
class GoogleCalendarService(
    @Value("\${app.google.client-id:}") private val clientId: String,
    @Value("\${app.google.client-secret:}") private val clientSecret: String,
    @Value("\${app.google.redirect-uri:http://localhost:8080/api/google-calendar/callback}") private val redirectUri: String,
) {
    private val httpTransport = GoogleNetHttpTransport.newTrustedTransport()
    private val jsonFactory = GsonFactory.getDefaultInstance()
    private val scopes = listOf("https://www.googleapis.com/auth/calendar.events")

    fun isConfigured() = clientId.isNotBlank() && clientSecret.isNotBlank()

    fun isConnected(member: Member) = !member.googleAccessToken.isNullOrBlank()

    fun getAuthorizationUrl(memberName: String): String =
        buildFlow()
            .newAuthorizationUrl()
            .setRedirectUri(redirectUri)
            .setState(memberName)
            .set("access_type", "offline")
            .set("prompt", "consent")
            .build()

    fun exchangeCode(code: String): Pair<String, String?> {
        val response = buildFlow().newTokenRequest(code).setRedirectUri(redirectUri).execute()
        return Pair(response.accessToken, response.refreshToken)
    }

    fun createGoogleEvent(
        member: Member,
        event: CalendarEvent,
    ): String? {
        if (!isConfigured() || !isConnected(member)) return null
        return try {
            val startZdt = event.date.atTime(event.time).atZone(ZoneId.of("Europe/Oslo"))
            val endZdt = startZdt.plusHours(2)
            val googleEvent =
                Event().apply {
                    summary = event.title
                    description = event.description
                    start =
                        EventDateTime()
                            .setDateTime(DateTime(startZdt.toInstant().toEpochMilli()))
                            .setTimeZone("Europe/Oslo")
                    end =
                        EventDateTime()
                            .setDateTime(DateTime(endZdt.toInstant().toEpochMilli()))
                            .setTimeZone("Europe/Oslo")
                }
            buildCalendarClient(member).events().insert("primary", googleEvent).execute().id
        } catch (_: Exception) {
            null
        }
    }

    fun deleteGoogleEvent(
        member: Member,
        googleEventId: String,
    ) {
        if (!isConfigured() || !isConnected(member)) return
        try {
            buildCalendarClient(member).events().delete("primary", googleEventId).execute()
        } catch (_: Exception) {
            // Non-fatal — local delete proceeds regardless
        }
    }

    private fun buildFlow(): GoogleAuthorizationCodeFlow {
        val secrets =
            GoogleClientSecrets().apply {
                installed =
                    GoogleClientSecrets.Details().apply {
                        this.clientId = this@GoogleCalendarService.clientId
                        this.clientSecret = this@GoogleCalendarService.clientSecret
                    }
            }
        return GoogleAuthorizationCodeFlow.Builder(httpTransport, jsonFactory, secrets, scopes).build()
    }

    private fun buildCalendarClient(member: Member): Calendar {
        val credential =
            Credential.Builder(BearerToken.authorizationHeaderAccessMethod())
                .setTransport(httpTransport)
                .setJsonFactory(jsonFactory)
                .setTokenServerUrl(GenericUrl("https://oauth2.googleapis.com/token"))
                .setClientAuthentication(ClientParametersAuthentication(clientId, clientSecret))
                .build()
        credential.accessToken = member.googleAccessToken
        credential.refreshToken = member.googleRefreshToken
        return Calendar.Builder(httpTransport, jsonFactory, credential)
            .setApplicationName("Kollekt")
            .build()
    }
}
