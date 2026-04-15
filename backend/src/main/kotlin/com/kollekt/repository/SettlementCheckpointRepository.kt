package com.kollekt.repository

import com.kollekt.domain.SettlementCheckpoint
import org.springframework.data.jpa.repository.JpaRepository

interface SettlementCheckpointRepository : JpaRepository<SettlementCheckpoint, Long> {
    fun findTopByCollectiveCodeOrderByIdDesc(collectiveCode: String): SettlementCheckpoint?

    fun findTopByCollectiveCodeAndSettledByOrderByIdDesc(
        collectiveCode: String,
        settledBy: String,
    ): SettlementCheckpoint?
}
