package com.kollekt.repository

import com.kollekt.domain.Collective
import org.springframework.data.jpa.repository.JpaRepository

interface CollectiveRepository : JpaRepository<Collective, Long> {
    fun findByJoinCode(joinCode: String): Collective?
    fun existsByJoinCode(joinCode: String): Boolean
}
