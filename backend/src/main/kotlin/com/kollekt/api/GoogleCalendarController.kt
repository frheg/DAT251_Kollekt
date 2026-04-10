package com.kollekt.api

import com.kollekt.service.CollectiveOperations
import com.kollekt.service.GoogleCalendarService
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.view.RedirectView

@RestController
@RequestMapping("/api/google-calendar")
class GoogleCalendarController(
    private val googleCalendarService: GoogleCalendarService,
    private val collectiveOperations: CollectiveOperations,
    @Value("\${app.google.frontend-url:http://localhost:5173}") private val frontendUrl: String,
) {
    @GetMapping("/auth-url")
    fun getAuthUrl(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): Map<String, String> {
        requireTokenSubject(jwt, memberName)
        return mapOf("url" to googleCalendarService.getAuthorizationUrl(memberName))
    }

    // Called by Google — no JWT available here (permitted in SecurityConfig)
    @GetMapping("/callback")
    fun handleCallback(
        @RequestParam code: String,
        @RequestParam state: String,
    ): RedirectView {
        collectiveOperations.saveGoogleCalendarTokens(state, code)
        return RedirectView("$frontendUrl?googleCalendarConnected=true")
    }

    @GetMapping("/status")
    fun getStatus(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): Map<String, Boolean> {
        requireTokenSubject(jwt, memberName)
        return mapOf("connected" to collectiveOperations.isGoogleCalendarConnected(memberName))
    }

    @DeleteMapping("/disconnect")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun disconnect(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        requireTokenSubject(jwt, memberName)
        collectiveOperations.disconnectGoogleCalendar(memberName)
    }
}
