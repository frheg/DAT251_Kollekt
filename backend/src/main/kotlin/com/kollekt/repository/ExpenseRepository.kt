package com.kollekt.repository

import com.kollekt.domain.Expense
import org.springframework.data.jpa.repository.JpaRepository

interface ExpenseRepository : JpaRepository<Expense, Long> {
    fun findAllByCollectiveCode(collectiveCode: String): List<Expense>

    fun findTopByCollectiveCodeOrderByIdDesc(collectiveCode: String): Expense?
}
