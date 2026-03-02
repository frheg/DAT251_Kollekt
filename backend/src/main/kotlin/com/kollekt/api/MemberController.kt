package com.kollekt.api

import com.kollekt.domain.Member
import com.kollekt.repository.MemberRepository
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/members")
class MemberController(private val memberRepository: MemberRepository) {
    @GetMapping fun getMembers(): List<Member> = memberRepository.findAll()
}
