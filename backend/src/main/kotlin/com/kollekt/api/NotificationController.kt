package com.kollekt.api
import com.kollekt.domain.Notification
import com.kollekt.service.NotificationService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/notifications")
class NotificationController(
    private val notificationService: NotificationService,
) {
    @GetMapping("/{userName}")
    fun getNotifications(
        @PathVariable userName: String,
    ): List<Notification> = notificationService.getNotificationsForUser(userName)

    @PostMapping("/{userName}/read")
    fun markAllAsRead(
        @PathVariable userName: String,
    ) {
        notificationService.markAllAsRead(userName)
    }
}
