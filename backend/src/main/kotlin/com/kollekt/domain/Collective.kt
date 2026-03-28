package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.OneToMany
import jakarta.persistence.Table

@Entity
@Table(name = "collectives")
data class Collective(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val name: String,
    @Column(nullable = false, unique = true) val joinCode: String,
    @Column(nullable = false) val ownerMemberId: Long,
    @Column(nullable = true) val monthlyPrize: String? = null,
    @OneToMany(mappedBy = "collective", fetch = FetchType.LAZY, cascade = [jakarta.persistence.CascadeType.ALL], orphanRemoval = true)
    val rooms: List<Room> = emptyList(),
)
