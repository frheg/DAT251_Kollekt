package com.kollekt.domain

import jakarta.persistence.*

@Entity
@Table(name = "rooms")
data class Room(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val name: String,
    @Column(nullable = false) val minutes: Int,
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "collective_id") val collective: Collective
)
