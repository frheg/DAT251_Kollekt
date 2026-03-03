package com.kollekt.repository

import com.kollekt.domain.Member
import org.springframework.data.jpa.repository.JpaRepository

interface MemberRepository : JpaRepository<Member, Long> {
    fun findByName(name: String): Member?
    fun findAllByCollectiveCode(collectiveCode: String): List<Member>
}
