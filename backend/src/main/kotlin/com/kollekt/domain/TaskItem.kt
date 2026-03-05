package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDate
import java.time.LocalDateTime

enum class TaskCategory {
    CLEANING,
    SHOPPING,
    OTHER,
}

@Entity
@Table(name = "tasks")
data class TaskItem(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val title: String,
    @Column(nullable = false) val assignee: String,
    @Column(nullable = true) val collectiveCode: String? = null,
    @Column(nullable = false) val dueDate: LocalDate,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    val category: TaskCategory = TaskCategory.OTHER,
    @Column(nullable = false) val completed: Boolean = false,
    @Column(nullable = false) val xpAwarded: Boolean = false,
    @Column(nullable = true) val completedBy: String? = null,
    @Column(nullable = true) val completedAt: LocalDateTime? = null,
    @Column(nullable = false) val xp: Int = 10,
    @Column(nullable = false) val recurring: Boolean = false,
)
