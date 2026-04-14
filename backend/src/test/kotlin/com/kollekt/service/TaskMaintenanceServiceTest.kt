package com.kollekt.service

import com.kollekt.domain.Collective
import com.kollekt.repository.CollectiveRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class TaskMaintenanceServiceTest {
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var taskOperations: TaskOperations
    private lateinit var shoppingOperations: ShoppingOperations
    private lateinit var economyOperations: EconomyOperations
    private lateinit var service: TaskMaintenanceService

    @BeforeEach
    fun setUp() {
        collectiveRepository = mock()
        taskOperations = mock()
        shoppingOperations = mock()
        economyOperations = mock()
        service = TaskMaintenanceService(collectiveRepository, taskOperations, shoppingOperations, economyOperations)
    }

    @Test
    fun `notify upcoming task deadlines delegates with default reminder window`() {
        service.notifyUpcomingTaskDeadlines()

        verify(taskOperations).notifyUpcomingTaskDeadlines(1L)
    }

    @Test
    fun `delete expired tasks delegates to task operations`() {
        service.deleteExpiredTasks()

        verify(taskOperations).deleteExpiredTasks()
    }

    @Test
    fun `penalize missed tasks delegates to task operations`() {
        service.penalizeMissedTasks()

        verify(taskOperations).penalizeMissedTasks()
    }

    @Test
    fun `scheduled weekly task rotation regenerates recurring tasks for each collective`() {
        whenever(collectiveRepository.findAll()).thenReturn(
            listOf(
                Collective(id = 1, name = "Villa", joinCode = "ABC123", ownerMemberId = 1),
                Collective(id = 2, name = "Loft", joinCode = "XYZ789", ownerMemberId = 2),
            ),
        )

        service.scheduledWeeklyTaskRotation()

        verify(taskOperations).regenerateRecurringTasksForCollective("ABC123")
        verify(taskOperations).regenerateRecurringTasksForCollective("XYZ789")
    }
}
