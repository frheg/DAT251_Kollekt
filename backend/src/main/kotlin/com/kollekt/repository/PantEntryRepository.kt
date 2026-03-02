package com.kollekt.repository

import com.kollekt.domain.PantEntry
import org.springframework.data.jpa.repository.JpaRepository

interface PantEntryRepository : JpaRepository<PantEntry, Long>
