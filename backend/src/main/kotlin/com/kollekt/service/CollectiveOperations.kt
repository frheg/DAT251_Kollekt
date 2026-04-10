package com.kollekt.service

import com.kollekt.api.dto.CollectiveCodeDto
import com.kollekt.api.dto.CollectiveDto
import com.kollekt.api.dto.CreateCollectiveRequest
import com.kollekt.api.dto.JoinCollectiveRequest
import com.kollekt.api.dto.UserDto
import com.kollekt.domain.Collective
import com.kollekt.domain.Invitation
import com.kollekt.domain.Member
import com.kollekt.domain.MemberStatus
import com.kollekt.domain.Room
import com.kollekt.domain.TaskCategory
import com.kollekt.domain.TaskItem
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.InvitationRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.RoomRepository
import com.kollekt.repository.TaskRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.LocalDateTime

@Service
class CollectiveOperations(
    private val memberRepository: MemberRepository,
    private val collectiveRepository: CollectiveRepository,
    private val taskRepository: TaskRepository,
    private val invitationRepository: InvitationRepository,
    private val roomRepository: RoomRepository,
    private val taskOperations: TaskOperations,
    private val userProfileService: UserProfileService,
    private val statsCacheService: StatsCacheService,
    private val invitationRealtimeService: InvitationRealtimeService,
    private val googleCalendarService: GoogleCalendarService,
) {
    private val joinCodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

    @Transactional
    fun createCollective(request: CreateCollectiveRequest): CollectiveDto {
        val collectiveName = request.name.trim()
        if (collectiveName.isBlank()) throw IllegalArgumentException("Collective name is required")

        val owner =
            memberRepository.findById(request.ownerUserId).orElseThrow {
                IllegalArgumentException("User ${request.ownerUserId} not found")
            }

        if (owner.collectiveCode != null) {
            throw IllegalArgumentException("User ${owner.id} is already in a collective")
        }

        val collective =
            collectiveRepository.save(
                Collective(
                    name = collectiveName,
                    joinCode = generateUniqueJoinCode(),
                    ownerMemberId = owner.id,
                ),
            )

        request.rooms.forEach { roomReq ->
            roomRepository.save(
                Room(
                    name = roomReq.name,
                    minutes = roomReq.minutes,
                    collective = collective,
                ),
            )
        }

        memberRepository.save(owner.copy(collectiveCode = collective.joinCode))

        val residentNames =
            request.residents
                .map { it.trim() }
                .filter { it.isNotBlank() && it != owner.name }

        residentNames.forEach { name ->
            val existing = memberRepository.findByName(name)
            if (existing == null) {
                memberRepository.save(
                    Member(
                        name = name,
                        email = "${name.lowercase()}@example.com",
                        collectiveCode = collective.joinCode,
                    ),
                )
            } else if (existing.collectiveCode == null) {
                memberRepository.save(existing.copy(collectiveCode = collective.joinCode))
            }
        }

        createOnboardingTasks(collective.joinCode, owner.name, residentNames, request)
        statsCacheService.clearAllCaches()
        return collective.toDto()
    }

    @Transactional
    fun joinCollective(request: JoinCollectiveRequest): UserDto {
        val joinCode = request.joinCode.trim().uppercase()
        if (joinCode.isBlank()) {
            throw IllegalArgumentException("Join code is required")
        }

        collectiveRepository.findByJoinCode(joinCode)
            ?: throw IllegalArgumentException("Collective code '$joinCode' not found")

        val user =
            memberRepository.findById(request.userId).orElseThrow {
                IllegalArgumentException("User ${request.userId} not found")
            }

        if (user.collectiveCode != null) {
            throw IllegalArgumentException("User '${user.name}' is already in a collective")
        }

        val updated = memberRepository.save(user.copy(collectiveCode = joinCode))
        acceptInvitationIfPresent(updated.email, joinCode)
        redistributeRecurringTasks(joinCode)
        statsCacheService.clearAllCaches()
        taskOperations.regenerateRecurringTasksForCollective(joinCode)
        return userProfileService.toUserDto(updated)
    }

    @Transactional
    fun inviteUserToCollective(
        email: String,
        collectiveCode: String,
        inviterName: String,
    ) {
        val invitation = createInvitation(email, collectiveCode, inviterName)

        try {
            invitationRealtimeService.publish(invitation.email, "INVITATION_CREATED", invitation)
        } catch (_: Exception) {
        }
    }

    @Transactional
    fun createInvitation(
        email: String,
        collectiveCode: String,
        inviterName: String,
    ): Invitation {
        val inviter =
            memberRepository.findByName(inviterName)
                ?: throw IllegalArgumentException("Inviter not found")

        if (inviter.collectiveCode != collectiveCode) {
            throw IllegalArgumentException("You are not a member of this collective")
        }

        val normalizedEmail = email.trim().lowercase()
        val existing = invitationRepository.findByEmailAndCollectiveCode(normalizedEmail, collectiveCode)
        if (existing != null) {
            throw IllegalArgumentException("This user has already been invited to this collective.")
        }

        return invitationRepository.save(
            Invitation(
                email = normalizedEmail,
                collectiveCode = collectiveCode,
                invitedBy = inviter.name,
            ),
        )
    }

    fun getCollectiveCodeForUser(userId: Long): CollectiveCodeDto {
        val user =
            memberRepository.findById(userId).orElseThrow {
                IllegalArgumentException("User $userId not found")
            }

        val code =
            user.collectiveCode
                ?: throw IllegalArgumentException("User $userId is not in a collective")

        return CollectiveCodeDto(code)
    }

    @Transactional
    fun saveGoogleCalendarTokens(
        memberName: String,
        code: String,
    ) {
        val member =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("Member $memberName not found")

        val (accessToken, refreshToken) = googleCalendarService.exchangeCode(code)
        memberRepository.save(
            member.copy(
                googleAccessToken = accessToken,
                googleRefreshToken = refreshToken ?: member.googleRefreshToken,
            ),
        )
    }

    fun isGoogleCalendarConnected(memberName: String): Boolean {
        val member = memberRepository.findByName(memberName) ?: return false
        return googleCalendarService.isConnected(member)
    }

    @Transactional
    fun disconnectGoogleCalendar(memberName: String) {
        val member = memberRepository.findByName(memberName) ?: return
        memberRepository.save(member.copy(googleAccessToken = null, googleRefreshToken = null))
    }

    private fun createOnboardingTasks(
        collectiveCode: String,
        ownerName: String,
        residentNames: List<String>,
        request: CreateCollectiveRequest,
    ) {
        val allResidents = listOf(ownerName) + residentNames
        val onboardingDueDate = nextSunday(LocalDate.now())
        val numMembers = allResidents.size

        for ((roomIndex, room) in request.rooms.withIndex()) {
            taskRepository.save(
                TaskItem(
                    title = "Vask ${room.name}",
                    assignee = allResidents[roomIndex % numMembers],
                    collectiveCode = collectiveCode,
                    dueDate = onboardingDueDate,
                    category = TaskCategory.CLEANING,
                    xp = room.minutes,
                    recurrenceRule = "WEEKLY",
                ),
            )
        }
    }

    private fun nextSunday(from: LocalDate): LocalDate {
        val daysUntilSunday = (7 - from.dayOfWeek.value) % 7
        return from.plusDays(daysUntilSunday.toLong())
    }

    private fun acceptInvitationIfPresent(
        email: String,
        joinCode: String,
    ) {
        val invitation =
            invitationRepository.findByEmailAndCollectiveCode(
                email.trim().lowercase(),
                joinCode,
            )

        if (invitation != null && !invitation.accepted) {
            invitationRepository.save(
                invitation.copy(
                    accepted = true,
                    acceptedAt = LocalDateTime.now(),
                ),
            )
        }
    }

    private fun redistributeRecurringTasks(joinCode: String) {
        val today = LocalDate.now()
        val allRecurringTasks =
            taskRepository
                .findAllByCollectiveCode(joinCode)
                .filter {
                    !it.completed &&
                        !it.dueDate.isBefore(today) &&
                        !it.recurrenceRule.isNullOrBlank() &&
                        it.recurrenceRule.uppercase() != "NONE"
                }

        val members =
            memberRepository
                .findAllByCollectiveCode(joinCode)
                .filter { it.status == MemberStatus.ACTIVE }

        val memberNames = members.map { it.name }.sorted()
        if (allRecurringTasks.isEmpty() || memberNames.isEmpty()) {
            return
        }

        val sortedTasks = allRecurringTasks.sortedWith(compareBy({ it.dueDate }, { it.title }))
        for ((index, task) in sortedTasks.withIndex()) {
            val assignee = memberNames[index % memberNames.size]
            if (task.assignee != assignee) {
                taskRepository.save(task.copy(assignee = assignee))
            }
        }
    }

    private fun generateUniqueJoinCode(length: Int = 6): String {
        repeat(20) {
            val code = (1..length).map { joinCodeChars.random() }.joinToString("")
            if (!collectiveRepository.existsByJoinCode(code)) {
                return code
            }
        }

        throw IllegalStateException("Unable to generate unique collective code")
    }

    private fun Collective.toDto() = CollectiveDto(id, name, joinCode)
}
