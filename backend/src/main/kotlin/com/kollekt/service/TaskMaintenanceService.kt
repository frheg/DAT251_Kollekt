package com.kollekt.service

import com.kollekt.repository.CollectiveRepository
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class TaskMaintenanceService(
    private val collectiveRepository: CollectiveRepository,
    private val taskOperations: TaskOperations,
    private val shoppingOperations: ShoppingOperations,
    private val economyOperations: EconomyOperations,
) {
    private val reminderDaysBeforeDue = 1L

    @Scheduled(cron = "0 0 8 * * *")
    fun notifyUpcomingTaskDeadlines() = taskOperations.notifyUpcomingTaskDeadlines(reminderDaysBeforeDue)

    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    fun deleteExpiredTasks() = taskOperations.deleteExpiredTasks()

    @Scheduled(cron = "0 0 4 * * *")
    fun penalizeMissedTasks() = taskOperations.penalizeMissedTasks()

    @Scheduled(cron = "0 0 3 * * *")
    fun cleanupBoughtShoppingItems() = shoppingOperations.cleanupBoughtItems()

    @Scheduled(cron = "0 0 8 * * *")
    fun notifyUpcomingExpenseDeadlines() = economyOperations.notifyUpcomingExpenseDeadlines()

    @Scheduled(cron = "0 0 9 * * *")
    fun notifyExpiredExpenseDeadlines() = economyOperations.notifyExpiredExpenseDeadlines()

    @Scheduled(cron = "0 0 3 * * MON")
    fun scheduledWeeklyTaskRotation() {
        collectiveRepository.findAll().forEach { collective ->
            taskOperations.regenerateRecurringTasksForCollective(collective.joinCode)
        }
    }
}
