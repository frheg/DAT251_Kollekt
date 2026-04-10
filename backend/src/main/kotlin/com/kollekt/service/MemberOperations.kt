package com.kollekt.service

import com.kollekt.api.dto.UserDto
import com.kollekt.domain.Member
import com.kollekt.domain.MemberStatus
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.TaskRepository
import org.springframework.stereotype.Service

@Service
class MemberOperations(
    private val memberRepository: MemberRepository,
    private val taskRepository: TaskRepository,
) {
    fun deleteUser(memberName: String) {
        val member =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")

        val collectiveCode = member.collectiveCode
        memberRepository.delete(member)

        if (collectiveCode != null) {
            redistributeOpenTasks(memberName, collectiveCode)
        }
    }

    fun leaveCollective(memberName: String) {
        val member =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")
        val collectiveCode = member.collectiveCode ?: return

        memberRepository.save(member.copy(collectiveCode = null))
        redistributeOpenTasks(memberName, collectiveCode)
    }

    fun updateMemberStatus(
        memberName: String,
        newStatus: MemberStatus,
        regenerateRecurringTasksForCollective: (String) -> Unit,
    ) {
        val member =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")

        memberRepository.save(member.copy(status = newStatus))

        if (member.collectiveCode != null && member.status != newStatus) {
            regenerateRecurringTasksForCollective(member.collectiveCode)
        }
    }

    fun addFriend(
        memberName: String,
        friendName: String,
        friendsMap: MutableMap<String, MutableSet<String>>,
    ) {
        if (memberName == friendName) {
            throw IllegalArgumentException("Cannot add yourself as a friend")
        }

        memberRepository.findByName(memberName)
            ?: throw IllegalArgumentException("User '$memberName' not found")
        memberRepository.findByName(friendName)
            ?: throw IllegalArgumentException("Friend '$friendName' not found")

        val friends = friendsMap.getOrPut(memberName) { mutableSetOf() }
        if (!friends.add(friendName)) {
            throw IllegalArgumentException("'$friendName' is already a friend")
        }
    }

    fun removeFriend(
        memberName: String,
        friendName: String,
        friendsMap: MutableMap<String, MutableSet<String>>,
    ) {
        val friends =
            friendsMap[memberName]
                ?: throw IllegalArgumentException("No friends found for '$memberName'")

        if (!friends.remove(friendName)) {
            throw IllegalArgumentException("'$friendName' is not a friend")
        }
    }

    fun getCollectiveMembers(
        memberName: String,
        memberToUserDto: (Member) -> UserDto,
    ): List<UserDto> {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        return memberRepository
            .findAllByCollectiveCode(collectiveCode)
            .sortedBy { it.name }
            .map(memberToUserDto)
    }

    private fun requireCollectiveCodeByMemberName(memberName: String): String {
        val member =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")
        return member.collectiveCode
            ?: throw IllegalArgumentException("User '${member.name}' must join a collective first")
    }

    private fun redistributeOpenTasks(
        departingMemberName: String,
        collectiveCode: String,
    ) {
        val remainingMembers =
            memberRepository
                .findAllByCollectiveCode(collectiveCode)
                .filter { it.name != departingMemberName }

        val memberNames = remainingMembers.map { it.name }.sorted()
        if (memberNames.isEmpty()) {
            return
        }

        val tasksInCollective = taskRepository.findAllByCollectiveCode(collectiveCode)
        val tasksToReassign =
            tasksInCollective
                .filter { it.assignee == departingMemberName && !it.completed }

        data class MemberLoad(
            val count: Int,
            val xp: Int,
        )

        val uncompletedTasks =
            tasksInCollective
                .filter { !it.completed && it.assignee in memberNames }

        val memberLoad =
            memberNames
                .associateWith { memberName ->
                    MemberLoad(
                        count = uncompletedTasks.count { it.assignee == memberName },
                        xp = uncompletedTasks.filter { it.assignee == memberName }.sumOf { it.xp },
                    )
                }.toMutableMap()

        for (task in tasksToReassign) {
            val newAssignee =
                memberLoad.entries
                    .minWithOrNull(
                        compareBy<Map.Entry<String, MemberLoad>> { it.value.count }.thenBy { it.value.xp },
                    )?.key ?: memberNames.first()

            taskRepository.save(task.copy(assignee = newAssignee))

            val previous = memberLoad[newAssignee] ?: MemberLoad(count = 0, xp = 0)
            memberLoad[newAssignee] = previous.copy(count = previous.count + 1, xp = previous.xp + task.xp)
        }
    }
}
