package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDate

@Entity
@Table(name = "pant_entries")
data class PantEntry(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
        @Column(nullable = false) val bottles: Int,
        @Column(nullable = false) val amount: Int,
        @Column(nullable = false) val addedBy: String,
        @Column(nullable = false) val date: LocalDate,
)
