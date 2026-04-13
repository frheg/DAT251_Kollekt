package com.kollekt.repository

import com.kollekt.domain.Notification
import org.springframework.data.jpa.repository.JpaRepository

interface NotificationRepository : JpaRepository<Notification, Long> {
    fun findAllByUserName(userName: String): List<Notification>

    fun deleteByIdAndUserName(
        id: Long,
        userName: String,
    )

    fun deleteAllByUserName(userName: String)
}
