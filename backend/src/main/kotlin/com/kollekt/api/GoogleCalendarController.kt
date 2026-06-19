package com.kollekt.api

import com.kollekt.service.CollectiveOperations
import com.kollekt.service.GoogleCalendarService
import com.kollekt.service.GoogleOAuthStateService
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
import org.springframework.web.util.UriComponentsBuilder

@RestController
@RequestMapping("/api/google-calendar")
class GoogleCalendarController(
    private val googleCalendarService: GoogleCalendarService,
    private val googleOAuthStateService: GoogleOAuthStateService,
    private val collectiveOperations: CollectiveOperations,
    @Value("\${app.google.frontend-url:http://localhost:5173}") private val frontendUrl: String,
    @Value("\${app.google.mobile-return-url:no.kollekt.app://google-calendar-connected}")
    private val mobileReturnUrl: String,
) {
    @GetMapping("/auth-url")
    fun getAuthUrl(
        @RequestParam memberName: String,
        @RequestParam(required = false) returnUrl: String?,
        @AuthenticationPrincipal jwt: Jwt,
    ): Map<String, String> {
        requireTokenSubject(jwt, memberName)
        val resolvedReturnUrl = returnUrl?.takeIf { it.isNotBlank() } ?: frontendUrl
        require(resolvedReturnUrl == frontendUrl || resolvedReturnUrl == mobileReturnUrl) {
            "Invalid OAuth return URL"
        }
        val state = googleOAuthStateService.issueState(memberName, resolvedReturnUrl)
        return mapOf("url" to googleCalendarService.getAuthorizationUrl(state))
    }

    // Called by Google — no JWT available here (permitted in SecurityConfig)
    @GetMapping("/callback")
    fun handleCallback(
        @RequestParam code: String,
        @RequestParam state: String,
    ): RedirectView {
        val oauthState = googleOAuthStateService.consumeState(state)
        collectiveOperations.saveGoogleCalendarTokens(oauthState.memberName, code)
        val returnUrl =
            UriComponentsBuilder
                .fromUriString(oauthState.returnUrl)
                .queryParam("googleCalendarConnected", "true")
                .build()
                .toUriString()
        return RedirectView(returnUrl)
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
