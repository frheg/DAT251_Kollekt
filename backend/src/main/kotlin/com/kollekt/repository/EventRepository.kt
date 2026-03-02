package com.kollekt.repository

import com.kollekt.domain.CalendarEvent
import org.springframework.data.jpa.repository.JpaRepository

interface EventRepository : JpaRepository<CalendarEvent, Long>
