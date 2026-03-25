package com.kollekt.api

import com.kollekt.api.dto.AuthResponse
import com.kollekt.api.dto.CollectiveCodeDto
import com.kollekt.api.dto.CollectiveDto
import com.kollekt.api.dto.CreateCollectiveRequest
import com.kollekt.api.dto.CreateUserRequest
import com.kollekt.api.dto.JoinCollectiveRequest
import com.kollekt.api.dto.LoginRequest
import com.kollekt.api.dto.LogoutRequest
import com.kollekt.api.dto.RefreshTokenRequest
import com.kollekt.api.dto.UserDto
import com.kollekt.service.KollektService
import org.springframework.http.HttpStatus
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/onboarding")
class OnboardingController(private val service: KollektService) {
    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    fun createUser(
        @RequestBody request: CreateUserRequest,
    ): AuthResponse = service.createUser(request)

    @PostMapping("/login")
    fun login(
        @RequestBody request: LoginRequest,
    ): AuthResponse = service.login(request)

    @PostMapping("/refresh")
    fun refresh(
        @RequestBody request: RefreshTokenRequest,
    ): AuthResponse = service.refreshToken(request)

    @GetMapping("/me")
    fun getCurrentUser(
        @AuthenticationPrincipal jwt: Jwt,
    ): UserDto = service.getUserByName(jwt.subject)

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun logout(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody(required = false) request: LogoutRequest?,
    ) {
        service.logout(jwt, request?.refreshToken)
    }

    @PostMapping("/collectives")
    @ResponseStatus(HttpStatus.CREATED)
    fun createCollective(
        @RequestBody request: CreateCollectiveRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): CollectiveDto {
        verifyUserId(jwt, request.ownerUserId)
        return service.createCollective(request)
    }

    @PostMapping("/collectives/join")
    fun joinCollective(
        @RequestBody request: JoinCollectiveRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): UserDto {
        verifyUserId(jwt, request.userId)
        return service.joinCollective(request)
    }

    @GetMapping("/collectives/code/{userId}")
    fun getCollectiveCode(
        @PathVariable userId: Long,
        @AuthenticationPrincipal jwt: Jwt,
    ): CollectiveCodeDto {
        verifyUserId(jwt, userId)
        return service.getCollectiveCodeForUser(userId)
    }

    private fun verifyUserId(
        jwt: Jwt,
        expectedUserId: Long,
    ) {
        val tokenUser = service.getUserByName(jwt.subject)
        if (tokenUser.id != expectedUserId) {
            throw AccessDeniedException("Token user does not match requested user")
        }
    }
}
