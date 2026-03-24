package com.kollekt.repository

import com.kollekt.domain.Invitation
import org.springframework.data.jpa.repository.JpaRepository

interface InvitationRepository : JpaRepository<Invitation, Long> {
    fun findByEmailAndCollectiveCode(email: String, collectiveCode: String): Invitation?
    fun findAllByCollectiveCode(collectiveCode: String): List<Invitation>
    fun findAllByEmail(email: String): List<Invitation>
}
