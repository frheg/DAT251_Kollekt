package com.kollekt.repository

import com.kollekt.domain.TaskFeedback
import org.springframework.data.jpa.repository.JpaRepository

interface TaskFeedbackRepository : JpaRepository<TaskFeedback, Long> {
    fun findAllByTaskId(taskId: Long): List<TaskFeedback>
}
