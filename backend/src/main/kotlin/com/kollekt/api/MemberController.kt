
package com.kollekt.api

import com.kollekt.api.dto.UserDto
import com.kollekt.service.KollektService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
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

    @PatchMapping("/reset-password")
    fun resetPassword(
        @RequestParam memberName: String,
        @RequestBody body: Map<String, String>,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        requireTokenSubject(jwt, memberName)
        val newPassword = body["newPassword"] ?: throw IllegalArgumentException("Missing newPassword")
        service.resetPassword(memberName, newPassword)
    }

    @DeleteMapping("/delete")
    fun deleteUser(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        requireTokenSubject(jwt, memberName)
        service.deleteUser(memberName)
    }

    @PostMapping("/friends/add")
    fun addFriend(
        @RequestParam memberName: String,
        @RequestBody body: Map<String, String>,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        requireTokenSubject(jwt, memberName)
        val friendName = body["friendName"] ?: throw IllegalArgumentException("Missing friendName")
        service.addFriend(memberName, friendName)
    }

    @DeleteMapping("/friends/remove")
    fun removeFriend(
        @RequestParam memberName: String,
        @RequestParam friendName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        requireTokenSubject(jwt, memberName)
        service.removeFriend(memberName, friendName)
    }
}
