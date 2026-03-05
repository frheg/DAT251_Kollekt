package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "members")
data class Member(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false, unique = true) val name: String,
    @Column(nullable = true) val passwordHash: String? = null,
    @Column(nullable = false) val level: Int = 1,
    @Column(nullable = false) val xp: Int = 0,
    @Column(nullable = true) val collectiveCode: String? = null,
)
