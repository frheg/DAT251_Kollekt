package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "achievements")
data class Achievement(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val title: String,
    @Column(nullable = false) val description: String,
    @Column(nullable = false) val icon: String,
    @Column(nullable = false) val unlocked: Boolean = false,
    val progress: Int? = null,
    val total: Int? = null,
)
