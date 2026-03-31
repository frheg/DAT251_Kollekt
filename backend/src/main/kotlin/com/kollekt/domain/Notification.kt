package com.kollekt.domain
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "notifications")
data class Notification(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    // Assignee's name or user id
    @Column(nullable = false)
    val userName: String,
    @Column(nullable = false)
    val message: String,
    @Column(nullable = false)
    val type: String = "TASK_ASSIGNED",
    @Column(nullable = false)
    val timestamp: Instant = Instant.now(),
    @Column(nullable = false)
    val read: Boolean = false,
)
