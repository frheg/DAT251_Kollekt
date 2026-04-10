package com.kollekt.service

import com.kollekt.domain.Collective
import com.kollekt.domain.Member
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.MemberRepository
import org.springframework.stereotype.Service

@Service
class CollectiveAccessService(
    private val memberRepository: MemberRepository,
    private val collectiveRepository: CollectiveRepository,
) {
    fun requireMember(memberName: String): Member =
        memberRepository.findByName(memberName)
            ?: throw IllegalArgumentException("User '$memberName' not found")

    fun requireCollectiveCodeByMemberName(memberName: String): String = requireCollectiveCode(requireMember(memberName))

    fun requireCollectiveCode(member: Member): String =
        member.collectiveCode
            ?: throw IllegalArgumentException("User '${member.name}' must join a collective first")

    fun requireCollectiveByCode(collectiveCode: String): Collective =
        collectiveRepository.findByJoinCode(collectiveCode)
            ?: throw IllegalArgumentException("Collective not found")
}
