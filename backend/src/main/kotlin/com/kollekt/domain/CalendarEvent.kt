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
import java.time.LocalTime

enum class EventType {
    PARTY,
    MOVIE,
    DINNER,
    OTHER,
}

@Entity
@Table(name = "events")
data class CalendarEvent(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val title: String,
    @Column(nullable = true) val collectiveCode: String? = null,
    @Column(nullable = false) val date: LocalDate,
    @Column(nullable = false) val time: LocalTime,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    val type: EventType = EventType.OTHER,
    @Column(nullable = false) val organizer: String,
    @Column(nullable = false) val attendees: Int = 1,
    val description: String? = null,
    @Column(nullable = true) val googleEventId: String? = null,
)
