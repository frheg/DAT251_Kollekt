package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "task_feedback")
data class TaskFeedback(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val taskId: Long,
    @Column(nullable = false) val author: String,
    @Column(nullable = false) val message: String,
    @Column(nullable = false) val anonymous: Boolean = false,
    @Column(nullable = true) val imageData: String? = null,
    @Column(nullable = true, length = 120) val imageMimeType: String? = null,
    @Column(nullable = false) val createdAt: LocalDateTime = LocalDateTime.now(),
)
