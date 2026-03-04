package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.CollectionTable
import jakarta.persistence.ElementCollection
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.Table
import java.time.LocalDate

@Entity
@Table(name = "expenses")
data class Expense(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
        @Column(nullable = false) val description: String,
        @Column(nullable = false) val amount: Int,
        @Column(nullable = false) val paidBy: String,
        @Column(nullable = true) val collectiveCode: String? = null,
        @Column(nullable = false) val category: String,
        @Column(nullable = false) val date: LocalDate,
        @ElementCollection(fetch = FetchType.EAGER)
        @CollectionTable(
                name = "expense_participants",
                joinColumns = [JoinColumn(name = "expense_id")]
        )
        @Column(name = "member_name", nullable = false)
        val participantNames: Set<String> = emptySet(),
)
