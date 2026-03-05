package com.kollekt.repository

import com.kollekt.domain.TaskItem
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface TaskRepository : JpaRepository<TaskItem, Long> {
    fun findAllByCollectiveCode(collectiveCode: String): List<TaskItem>

    fun findByIdAndCollectiveCode(
        id: Long,
        collectiveCode: String,
    ): TaskItem?

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from TaskItem t where t.id = :id and t.collectiveCode = :collectiveCode")
    fun findByIdAndCollectiveCodeForUpdate(
        @Param("id") id: Long,
        @Param("collectiveCode") collectiveCode: String,
    ): TaskItem?
}
