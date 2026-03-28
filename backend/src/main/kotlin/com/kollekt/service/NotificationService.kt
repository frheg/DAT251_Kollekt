package com.kollekt.service

import com.kollekt.domain.Notification
import com.kollekt.repository.NotificationRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class NotificationService(
    private val notificationRepository: NotificationRepository,
) {
    @Transactional
    fun createTaskAssignedNotification(
        userName: String,
        taskTitle: String,
    ) {
        val message = "You have been assigned a new task: $taskTitle"
        val notification =
            Notification(
                userName = userName,
                message = message,
                type = "TASK_ASSIGNED",
                timestamp = Instant.now(),
                read = false,
            )
        notificationRepository.save(
            notification,
        )
    }

    fun createCustomNotification(
        userName: String,
        message: String,
        type: String,
    ) {
        val notification =
            Notification(
                userName = userName,
                message = message,
                type = type,
                timestamp = java.time.Instant.now(),
                read = false,
            )
        notificationRepository.save(
            notification,
        )
    }

    fun createGroupNotification(
        userNames: List<String>,
        message: String,
        type: String,
    ) {
        val now = Instant.now()
        val notifications =
            userNames.map { userName ->
                Notification(
                    userName = userName,
                    message = message,
                    type = type,
                    timestamp = now,
                    read = false,
                )
            }
        notificationRepository.saveAll(notifications)
    }

    fun getNotificationsForUser(userName: String): List<Notification> {
        return notificationRepository.findAllByUserName(userName)
    }

    @Transactional
    fun markAllAsRead(userName: String) {
        val notifications = notificationRepository.findAllByUserName(userName)
        notifications.forEach {
            notificationRepository.save(
                it.copy(read = true),
            )
        }
    }
}
