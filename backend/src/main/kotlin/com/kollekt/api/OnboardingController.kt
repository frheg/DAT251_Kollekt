package com.kollekt.api

import com.kollekt.api.dto.CollectiveDto
import com.kollekt.api.dto.CollectiveCodeDto
import com.kollekt.api.dto.CreateCollectiveRequest
import com.kollekt.api.dto.CreateUserRequest
import com.kollekt.api.dto.JoinCollectiveRequest
import com.kollekt.api.dto.LoginRequest
import com.kollekt.api.dto.UserDto
import com.kollekt.service.KollektService
import org.springframework.http.HttpStatus
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
    fun createUser(@RequestBody request: CreateUserRequest): UserDto = service.createUser(request)

    @PostMapping("/login")
    fun login(@RequestBody request: LoginRequest): UserDto = service.login(request)

    @PostMapping("/collectives")
    @ResponseStatus(HttpStatus.CREATED)
    fun createCollective(@RequestBody request: CreateCollectiveRequest): CollectiveDto =
            service.createCollective(request)

    @PostMapping("/collectives/join")
    fun joinCollective(@RequestBody request: JoinCollectiveRequest): UserDto =
            service.joinCollective(request)

    @GetMapping("/collectives/code/{userId}")
    fun getCollectiveCode(@PathVariable userId: Long): CollectiveCodeDto =
            service.getCollectiveCodeForUser(userId)
}
