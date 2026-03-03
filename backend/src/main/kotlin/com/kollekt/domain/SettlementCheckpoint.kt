package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "settlement_checkpoints")
data class SettlementCheckpoint(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
        @Column(nullable = false) val collectiveCode: String,
        @Column(nullable = false) val settledBy: String,
        @Column(nullable = false) val lastExpenseId: Long,
        @Column(nullable = false) val createdAt: LocalDateTime = LocalDateTime.now(),
)
