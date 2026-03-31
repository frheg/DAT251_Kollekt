package com.kollekt.api

import com.kollekt.domain.Invitation
import com.kollekt.repository.InvitationRepository
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/invitations")
class InvitationController(
    private val invitationRepository: InvitationRepository,
) {
    @GetMapping
    fun getInvitationsForEmail(
        @RequestParam email: String,
    ): List<Invitation> = invitationRepository.findAllByEmail(email.trim().lowercase())
}
