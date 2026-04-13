package com.kollekt.api

import com.kollekt.domain.Notification
import com.kollekt.service.NotificationService
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
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

    @DeleteMapping("/{userName}/{id}")
    fun deleteNotification(
        @PathVariable userName: String,
        @PathVariable id: Long,
    ) {
        notificationService.deleteNotification(userName, id)
    }

    @DeleteMapping("/{userName}")
    fun deleteAllNotifications(
        @PathVariable userName: String,
    ) {
        notificationService.deleteAllNotifications(userName)
    }

    @GetMapping("/preferences")
    fun getPreferences(
        @RequestParam memberName: String,
    ): Map<String, Boolean> = notificationService.getPreferences(memberName)

    @PatchMapping("/preferences")
    fun updatePreferences(
        @RequestParam memberName: String,
        @RequestBody prefs: Map<String, Boolean>,
    ) {
        notificationService.updatePreferences(memberName, prefs)
    }
}
