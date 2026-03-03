package com.kollekt.repository

import com.kollekt.domain.TaskItem
import org.springframework.data.jpa.repository.JpaRepository

interface TaskRepository : JpaRepository<TaskItem, Long> {
    fun findAllByCollectiveCode(collectiveCode: String): List<TaskItem>
    fun findByIdAndCollectiveCode(id: Long, collectiveCode: String): TaskItem?
}
