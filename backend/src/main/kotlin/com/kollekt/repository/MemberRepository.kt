package com.kollekt.repository

import com.kollekt.domain.Member
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface MemberRepository : JpaRepository<Member, Long> {
    fun findByName(name: String): Member?

    fun findByEmail(email: String): Member?

    fun findByNameAndCollectiveCode(
        name: String,
        collectiveCode: String,
    ): Member?

    fun findAllByCollectiveCode(collectiveCode: String): List<Member>

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Member m where m.name = :name and m.collectiveCode = :collectiveCode")
    fun findByNameAndCollectiveCodeForUpdate(
        @Param("name") name: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Member?
}
