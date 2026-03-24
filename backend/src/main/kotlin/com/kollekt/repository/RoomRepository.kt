package com.kollekt.repository

import com.kollekt.domain.Room
import org.springframework.data.jpa.repository.JpaRepository

interface RoomRepository : JpaRepository<Room, Long> {
    fun findAllByCollectiveId(collectiveId: Long): List<Room>
}
