package com.kollekt.repository

import com.kollekt.domain.PersonalSettlement
import org.springframework.data.jpa.repository.JpaRepository

interface PersonalSettlementRepository : JpaRepository<PersonalSettlement, Long> {
    fun findAllByCollectiveCode(collectiveCode: String): List<PersonalSettlement>

    fun findAllByCollectiveCodeAndPaidByAndPaidTo(
        collectiveCode: String,
        paidBy: String,
        paidTo: String,
    ): List<PersonalSettlement>

    fun deleteAllByCollectiveCodeAndPaidBy(
        collectiveCode: String,
        paidBy: String,
    )
}
