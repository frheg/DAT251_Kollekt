package com.kollekt.repository

import com.kollekt.domain.TaskItem
import org.springframework.data.jpa.repository.JpaRepository

interface TaskRepository : JpaRepository<TaskItem, Long>
