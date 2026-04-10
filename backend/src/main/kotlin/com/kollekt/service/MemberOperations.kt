package com.kollekt.service

import com.kollekt.domain.MemberStatus
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.TaskRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class MemberOperations(
    private val memberRepository: MemberRepository,
    private val taskRepository: TaskRepository,
    private val taskOperations: TaskOperations,
    private val userProfileService: UserProfileService,
    private val collectiveAccessService: CollectiveAccessService,
    private val statsCacheService: StatsCacheService,
) {
    @Transactional
    fun deleteUser(memberName: String) {
        val member =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")

        val collectiveCode = member.collectiveCode
        memberRepository.delete(member)

        if (collectiveCode != null) {
            redistributeOpenTasks(memberName, collectiveCode)
            statsCacheService.clearTaskCaches()
        }
    }

    @Transactional
    fun leaveCollective(memberName: String) {
        val member =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")
        val collectiveCode = member.collectiveCode ?: return

        memberRepository.save(member.copy(collectiveCode = null))
        redistributeOpenTasks(memberName, collectiveCode)
        statsCacheService.clearTaskCaches()
    }

    @Transactional
    fun updateMemberStatus(
        memberName: String,
        newStatus: MemberStatus,
    ) {
        val member =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")

        memberRepository.save(member.copy(status = newStatus))

        if (member.collectiveCode != null && member.status != newStatus) {
            taskOperations.regenerateRecurringTasksForCollective(member.collectiveCode)
        }
    }

    fun addFriend(
        memberName: String,
        friendName: String,
    ) = userProfileService.addFriend(memberName, friendName)

    fun removeFriend(
        memberName: String,
        friendName: String,
    ) = userProfileService.removeFriend(memberName, friendName)

    fun getCollectiveMembers(memberName: String) =
        memberRepository
            .findAllByCollectiveCode(collectiveAccessService.requireCollectiveCodeByMemberName(memberName))
            .sortedBy { it.name }
            .map(userProfileService::toUserDto)

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
