package com.kollekt.service

import com.kollekt.api.dto.FriendDto
import com.kollekt.api.dto.UserDto
import com.kollekt.domain.Member
import com.kollekt.repository.MemberRepository
import org.springframework.stereotype.Service

@Service
class UserProfileService(
    private val memberRepository: MemberRepository,
) {
    companion object {
        // TODO: Replace with persistent storage (e.g., Friend entity/repository)
        private val friendsMap = mutableMapOf<String, MutableSet<String>>()
    }

    fun getUserByName(name: String): UserDto = toUserDto(requireMember(name))

    fun addFriend(
        memberName: String,
        friendName: String,
    ) {
        if (memberName == friendName) {
            throw IllegalArgumentException("Cannot add yourself as a friend")
        }

        requireMember(memberName)
        requireMember(friendName)

        val friends = friendsMap.getOrPut(memberName) { mutableSetOf() }
        if (!friends.add(friendName)) {
            throw IllegalArgumentException("'$friendName' is already a friend")
        }
    }

    fun removeFriend(
        memberName: String,
        friendName: String,
    ) {
        val friends =
            friendsMap[memberName]
                ?: throw IllegalArgumentException("No friends found for '$memberName'")

        if (!friends.remove(friendName)) {
            throw IllegalArgumentException("'$friendName' is not a friend")
        }
    }

    fun toUserDto(member: Member): UserDto {
        val friends = friendsMap[member.name]?.map(::FriendDto) ?: emptyList()
        return UserDto(
            id = member.id,
            name = member.name,
            email = member.email,
            collectiveCode = member.collectiveCode,
            status = member.status,
            friends = friends,
        )
    }

    private fun requireMember(memberName: String): Member =
        memberRepository.findByName(memberName)
            ?: throw IllegalArgumentException("User '$memberName' not found")
}
