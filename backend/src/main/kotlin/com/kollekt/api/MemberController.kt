package com.kollekt.api

import com.kollekt.api.dto.UserDto
import com.kollekt.service.KollektService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/members")
class MemberController(private val service: KollektService) {
    @GetMapping("/collective")
    fun getCollectiveMembers(
            @RequestParam memberName: String,
            @AuthenticationPrincipal jwt: Jwt,
    ): List<UserDto> {
        requireTokenSubject(jwt, memberName)
        return service.getCollectiveMembers(memberName)
    }
}
