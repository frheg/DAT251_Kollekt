package com.kollekt.service

import com.kollekt.api.dto.CreateCollectiveRequest
import com.kollekt.api.dto.JoinCollectiveRequest
import com.kollekt.api.dto.RoomRequest
import com.kollekt.api.dto.UserDto
import com.kollekt.domain.Collective
import com.kollekt.domain.Invitation
import com.kollekt.domain.Member
import com.kollekt.domain.TaskCategory
import com.kollekt.domain.TaskItem
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.InvitationRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.RoomRepository
import com.kollekt.repository.TaskRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.check
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.LocalDate
import java.util.Optional

class CollectiveOperationsTest {
    private lateinit var memberRepository: MemberRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var taskRepository: TaskRepository
    private lateinit var invitationRepository: InvitationRepository
    private lateinit var roomRepository: RoomRepository
    private lateinit var operations: CollectiveOperations

    @BeforeEach
    fun setUp() {
        memberRepository = mock()
        collectiveRepository = mock()
        taskRepository = mock()
        invitationRepository = mock()
        roomRepository = mock()
        operations =
            CollectiveOperations(
                memberRepository = memberRepository,
                collectiveRepository = collectiveRepository,
                taskRepository = taskRepository,
                invitationRepository = invitationRepository,
                roomRepository = roomRepository,
            )
    }

    @Test
    fun `create collective provisions rooms owner and onboarding tasks`() {
        val owner = member("Kasper", "kasper@example.com", collectiveCode = null)
        whenever(memberRepository.findById(1)).thenReturn(Optional.of(owner))
        whenever(collectiveRepository.existsByJoinCode(any())).thenReturn(false)
        whenever(collectiveRepository.save(any<Collective>())).thenAnswer {
            (it.arguments[0] as Collective).copy(id = 10)
        }
        whenever(memberRepository.findByName("Emma")).thenReturn(null)
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        var cachesCleared = false
        val result =
            operations.createCollective(
                request =
                    CreateCollectiveRequest(
                        name = " Villa ",
                        ownerUserId = 1,
                        numRooms = 1,
                        residents = listOf("Emma"),
                        rooms = listOf(RoomRequest(name = "Kitchen", minutes = 25)),
                    ),
                clearCaches = { cachesCleared = true },
            )

        assertEquals("Villa", result.name)
        assertTrue(cachesCleared)
        verify(roomRepository).save(
            check {
                assertEquals("Kitchen", it.name)
            },
        )
        verify(taskRepository).save(
            check {
                assertEquals("Vask Kitchen", it.title)
                assertEquals(TaskCategory.CLEANING, it.category)
            },
        )
        verify(memberRepository, times(2)).save(any<Member>())
    }

    @Test
    fun `join collective accepts invitation and triggers recurring rebuild`() {
        val pendingUser = member("Kasper", "kasper@example.com", id = 7, collectiveCode = null)
        val existingMember = member("Emma", "emma@example.com", id = 2)
        val invitation = Invitation(id = 3, email = "kasper@example.com", collectiveCode = "ABC123", invitedBy = "Emma")
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(
            Collective(id = 1, name = "Villa", joinCode = "ABC123", ownerMemberId = 2),
        )
        whenever(memberRepository.findById(7)).thenReturn(Optional.of(pendingUser))
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(invitationRepository.findByEmailAndCollectiveCode("kasper@example.com", "ABC123")).thenReturn(invitation)
        whenever(invitationRepository.save(any<Invitation>())).thenAnswer { it.arguments[0] as Invitation }
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                recurringTask(id = 8, title = "Kitchen", assignee = "Emma"),
            ),
        )
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(existingMember, pendingUser.copy(id = 7, collectiveCode = "ABC123")),
        )

        var cachesCleared = false
        var regenerated = false
        val result =
            operations.joinCollective(
                request = JoinCollectiveRequest(userId = 7, joinCode = " abc123 "),
                clearCaches = { cachesCleared = true },
                regenerateRecurringTasksForCollective = { regenerated = true },
                memberToUserDto = { member -> UserDto(id = member.id, name = member.name, email = member.email, collectiveCode = member.collectiveCode) },
            )

        assertEquals("ABC123", result.collectiveCode)
        assertTrue(cachesCleared)
        assertTrue(regenerated)
        verify(invitationRepository).save(
            check {
                assertTrue(it.accepted)
            },
        )
    }

    @Test
    fun `create invitation normalizes email before saving`() {
        val inviter = member("Emma", "emma@example.com", collectiveCode = "ABC123")
        whenever(memberRepository.findByName("Emma")).thenReturn(inviter)
        whenever(invitationRepository.findByEmailAndCollectiveCode("kasper@example.com", "ABC123")).thenReturn(null)
        whenever(invitationRepository.save(any<Invitation>())).thenAnswer {
            (it.arguments[0] as Invitation).copy(id = 1)
        }

        val invitation = operations.createInvitation("  KASPER@example.com ", "ABC123", "Emma")

        assertEquals("kasper@example.com", invitation.email)
        assertEquals("Emma", invitation.invitedBy)
    }

    private fun member(
        name: String,
        email: String,
        id: Long = 1,
        collectiveCode: String? = "ABC123",
    ) = Member(
        id = id,
        name = name,
        email = email,
        collectiveCode = collectiveCode,
    )

    private fun recurringTask(
        id: Long,
        title: String,
        assignee: String,
    ) = TaskItem(
        id = id,
        title = title,
        assignee = assignee,
        collectiveCode = "ABC123",
        dueDate = LocalDate.now().plusDays(1),
        category = TaskCategory.CLEANING,
        xp = 20,
        recurrenceRule = "WEEKLY",
        recurring = true,
    )
}
