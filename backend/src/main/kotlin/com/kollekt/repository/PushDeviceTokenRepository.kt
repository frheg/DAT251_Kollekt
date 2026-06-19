package com.kollekt.repository

import com.kollekt.domain.PushDeviceToken
import org.springframework.data.jpa.repository.JpaRepository

interface PushDeviceTokenRepository : JpaRepository<PushDeviceToken, String> {
    fun findByMemberName(memberName: String): List<PushDeviceToken>
}
