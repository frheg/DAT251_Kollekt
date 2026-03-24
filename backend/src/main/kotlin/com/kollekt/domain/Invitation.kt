package com.kollekt.domain

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "invitations")
data class Invitation(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val email: String,
    @Column(nullable = false) val collectiveCode: String,
    @Column(nullable = false) val invitedBy: String,
    @Column(nullable = false) val createdAt: LocalDateTime = LocalDateTime.now(),
    @Column(nullable = false) val accepted: Boolean = false,
    @Column(nullable = true) val acceptedAt: LocalDateTime? = null,
)
