package com.kollekt.service

import com.kollekt.domain.Member
import com.kollekt.domain.Notification
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.NotificationRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class NotificationServiceTest {
    private lateinit var notificationRepository: NotificationRepository
    private lateinit var memberRepository: MemberRepository
    private lateinit var realtimeUpdateService: RealtimeUpdateService
    private lateinit var service: NotificationService

    @BeforeEach
    fun setUp() {
        notificationRepository = mock()
        memberRepository = mock()
        realtimeUpdateService = mock()
        service = NotificationService(notificationRepository, memberRepository, realtimeUpdateService)
    }

    @Test
    fun `create task assigned notification stores unread task notification`() {
        val captor = argumentCaptor<Notification>()

        service.createTaskAssignedNotification("Kasper", "Take out trash")

        verify(notificationRepository).save(captor.capture())
        val saved = captor.firstValue
        assertEquals("Kasper", saved.userName)
        assertEquals("You have been assigned a new task: Take out trash", saved.message)
        assertEquals("TASK_ASSIGNED", saved.type)
        assertFalse(saved.read)
    }

    @Test
    fun `create custom notification persists supplied payload`() {
        val captor = argumentCaptor<Notification>()

        service.createCustomNotification("Emma", "Task overdue", "TASK_OVERDUE")

        verify(notificationRepository).save(captor.capture())
        val saved = captor.firstValue
        assertEquals("Emma", saved.userName)
        assertEquals("Task overdue", saved.message)
        assertEquals("TASK_OVERDUE", saved.type)
        assertFalse(saved.read)
    }

    @Test
    fun `create group notification stores one notification per user`() {
        val captor = argumentCaptor<List<Notification>>()

        service.createGroupNotification(listOf("Emma", "Kasper"), "Shared alert", "GROUP")

        verify(notificationRepository).saveAll(captor.capture())
        val notifications = captor.firstValue
        assertEquals(listOf("Emma", "Kasper"), notifications.map { it.userName })
        assertTrue(notifications.all { it.message == "Shared alert" })
        assertTrue(notifications.all { it.type == "GROUP" })
        assertTrue(notifications.all { !it.read })
        assertEquals(1, notifications.map { it.timestamp }.distinct().size)
    }

    @Test
    fun `get notifications for user delegates to repository`() {
        val expected = listOf(Notification(id = 1, userName = "Kasper", message = "Hi"))
        whenever(notificationRepository.findAllByUserName("Kasper")).thenReturn(expected)

        val result = service.getNotificationsForUser("Kasper")

        assertEquals(expected, result)
    }

    @Test
    fun `is notification enabled returns false when type disabled in prefs`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", """{"TASK_ASSIGNED": false}"""))

        assertFalse(service.isNotificationEnabled("Kasper", "TASK_ASSIGNED"))
    }

    @Test
    fun `is notification enabled returns true when type not in prefs`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", """{"TASK_ASSIGNED": false}"""))

        assertTrue(service.isNotificationEnabled("Kasper", "NEW_MESSAGE"))
    }

    @Test
    fun `get preferences returns all true when member not found`() {
        whenever(memberRepository.findByName("Unknown")).thenReturn(null)

        val result = service.getPreferences("Unknown")

        assertTrue(result.values.all { it })
        assertEquals(ALL_NOTIFICATION_TYPES.toSet(), result.keys)
    }

    @Test
    fun `get preferences returns merged prefs for member with saved preferences`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", """{"TASK_ASSIGNED": false}"""))

        val result = service.getPreferences("Kasper")

        assertFalse(result["TASK_ASSIGNED"]!!)
        assertTrue(result["NEW_MESSAGE"]!!)
    }

    @Test
    fun `update preferences persists sanitised json to member`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", null))
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] }

        service.updatePreferences("Kasper", mapOf("TASK_ASSIGNED" to false))

        val captor = argumentCaptor<Member>()
        verify(memberRepository).save(captor.capture())
        assertTrue(captor.firstValue.notificationPreferences!!.contains("TASK_ASSIGNED"))
    }

    @Test
    fun `create task assigned notification skips when type is disabled`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", """{"TASK_ASSIGNED": false}"""))

        service.createTaskAssignedNotification("Kasper", "Clean up")

        verify(notificationRepository, never()).save(any())
    }

    @Test
    fun `create custom notification skips when type is disabled`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", """{"EXPENSE_OWED": false}"""))

        service.createCustomNotification("Kasper", "You owe 100 kr", "EXPENSE_OWED")

        verify(notificationRepository, never()).save(any())
    }

    @Test
    fun `delete notification delegates to repository`() {
        service.deleteNotification("Kasper", 5L)

        verify(notificationRepository).deleteByIdAndUserName(5L, "Kasper")
    }

    @Test
    fun `delete all notifications delegates to repository`() {
        service.deleteAllNotifications("Kasper")

        verify(notificationRepository).deleteAllByUserName("Kasper")
    }

    @Test
    fun `mark all as read updates every notification`() {
        val notifications =
            listOf(
                Notification(id = 1, userName = "Kasper", message = "One", read = false),
                Notification(id = 2, userName = "Kasper", message = "Two", read = false),
            )
        whenever(notificationRepository.findAllByUserName("Kasper")).thenReturn(notifications)

        service.markAllAsRead("Kasper")

        val captor = argumentCaptor<Notification>()
        verify(notificationRepository, times(2)).save(captor.capture())
        assertEquals(listOf(1L, 2L), captor.allValues.map { it.id })
        assertTrue(captor.allValues.all { it.read })
    }

    private fun member(
        name: String,
        notificationPreferences: String?,
    ) = Member(name = name, email = "$name@example.com", collectiveCode = "ABC123", notificationPreferences = notificationPreferences)
}
