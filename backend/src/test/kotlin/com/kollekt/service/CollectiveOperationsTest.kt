package com.kollekt.service

import com.kollekt.api.dto.CreateCollectiveRequest
import com.kollekt.api.dto.JoinCollectiveRequest
import com.kollekt.api.dto.RoomRequest
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
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.check
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.redis.core.RedisTemplate
import java.time.LocalDate
import java.util.Optional

class CollectiveOperationsTest {
    private lateinit var memberRepository: MemberRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var taskRepository: TaskRepository
    private lateinit var invitationRepository: InvitationRepository
    private lateinit var roomRepository: RoomRepository
    private lateinit var taskOperations: TaskOperations
    private lateinit var invitationRealtimeService: InvitationRealtimeService
    private lateinit var googleCalendarService: GoogleCalendarService
    private lateinit var redisTemplate: RedisTemplate<String, Any>
    private lateinit var userProfileService: UserProfileService
    private lateinit var statsCacheService: StatsCacheService
    private lateinit var operations: CollectiveOperations

    @BeforeEach
    fun setUp() {
        memberRepository = mock()
        collectiveRepository = mock()
        taskRepository = mock()
        invitationRepository = mock()
        roomRepository = mock()
        taskOperations = mock()
        invitationRealtimeService = mock()
        googleCalendarService = mock()
        redisTemplate = mock()
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("leaderboard:*")
        userProfileService = UserProfileService(memberRepository)
        statsCacheService = StatsCacheService(redisTemplate)
        operations =
            CollectiveOperations(
                memberRepository = memberRepository,
                collectiveRepository = collectiveRepository,
                taskRepository = taskRepository,
                invitationRepository = invitationRepository,
                roomRepository = roomRepository,
                taskOperations = taskOperations,
                userProfileService = userProfileService,
                statsCacheService = statsCacheService,
                invitationRealtimeService = invitationRealtimeService,
                googleCalendarService = googleCalendarService,
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

        val result =
            operations.createCollective(
                CreateCollectiveRequest(
                    name = " Villa ",
                    ownerUserId = 1,
                    numRooms = 1,
                    residents = listOf("Emma"),
                    rooms = listOf(RoomRequest(name = "Kitchen", minutes = 25)),
                ),
            )

        assertEquals("Villa", result.name)
        verify(redisTemplate).keys("dashboard:*")
        verify(redisTemplate).keys("leaderboard:*")
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
    fun `join collective accepts invitation and updates caches`() {
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
            listOf(recurringTask(id = 8, title = "Kitchen", assignee = "Emma")),
        )
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(existingMember, pendingUser.copy(id = 7, collectiveCode = "ABC123")),
        )

        val result = operations.joinCollective(JoinCollectiveRequest(userId = 7, joinCode = " abc123 "))

        assertEquals("ABC123", result.collectiveCode)
        verify(redisTemplate).keys("dashboard:*")
        verify(redisTemplate).keys("leaderboard:*")
        verify(invitationRepository).save(
            check {
                assertTrue(it.accepted)
            },
        )
    }

    @Test
    fun `invite user publishes realtime event for created invitation`() {
        val inviter = member("Emma", "emma@example.com", collectiveCode = "ABC123")
        whenever(memberRepository.findByName("Emma")).thenReturn(inviter)
        whenever(invitationRepository.findByEmailAndCollectiveCode("kasper@example.com", "ABC123")).thenReturn(null)
        whenever(invitationRepository.save(any<Invitation>())).thenAnswer {
            (it.arguments[0] as Invitation).copy(id = 1)
        }

        operations.inviteUserToCollective("  KASPER@example.com ", "ABC123", "Emma")

        verify(invitationRealtimeService).publish(
            eq("kasper@example.com"),
            eq("INVITATION_CREATED"),
            check<Invitation> { assertEquals("Emma", it.invitedBy) },
        )
    }

    @Test
    fun `save google calendar tokens stores exchanged tokens`() {
        val member = member("Kasper", "kasper@example.com")
        whenever(memberRepository.findByName("Kasper")).thenReturn(member)
        whenever(googleCalendarService.exchangeCode("auth-code")).thenReturn("access-token" to "refresh-token")

        operations.saveGoogleCalendarTokens("Kasper", "auth-code")

        verify(memberRepository).save(
            check {
                assertEquals("access-token", it.googleAccessToken)
                assertEquals("refresh-token", it.googleRefreshToken)
            },
        )
    }

    @Test
    fun `disconnect google calendar clears stored tokens`() {
        val member =
            member("Kasper", "kasper@example.com").copy(
                googleAccessToken = "access-token",
                googleRefreshToken = "refresh-token",
            )
        whenever(memberRepository.findByName("Kasper")).thenReturn(member)

        operations.disconnectGoogleCalendar("Kasper")

        verify(memberRepository).save(
            check {
                assertEquals(null, it.googleAccessToken)
                assertEquals(null, it.googleRefreshToken)
            },
        )
    }

    @Test
    fun `create collective adds existing resident without collective to join code`() {
        val owner = member("Kasper", "kasper@example.com", collectiveCode = null)
        val existingResident = member("Emma", "emma@example.com", id = 2, collectiveCode = null)
        whenever(memberRepository.findById(1)).thenReturn(Optional.of(owner))
        whenever(collectiveRepository.existsByJoinCode(any())).thenReturn(false)
        whenever(collectiveRepository.save(any<Collective>())).thenReturn(
            Collective(id = 10, name = "Villa", joinCode = "ABC123", ownerMemberId = 1),
        )
        whenever(memberRepository.findByName("Emma")).thenReturn(existingResident)
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        operations.createCollective(
            CreateCollectiveRequest(
                name = "Villa",
                ownerUserId = 1,
                numRooms = 1,
                residents = listOf("Emma"),
                rooms = listOf(RoomRequest(name = "Kitchen", minutes = 25)),
            ),
        )

        val memberCaptor = argumentCaptor<Member>()
        verify(memberRepository, times(2)).save(memberCaptor.capture())
        assertTrue(
            memberCaptor.allValues.any { it.name == "Emma" && it.collectiveCode == "ABC123" },
        )
    }

    @Test
    fun `join collective redistributes recurring tasks to active members`() {
        val pendingUser = member("Kasper", "kasper@example.com", id = 7, collectiveCode = null)
        val existingMember = member("Emma", "emma@example.com", id = 2)
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(
            Collective(id = 1, name = "Villa", joinCode = "ABC123", ownerMemberId = 2),
        )
        whenever(memberRepository.findById(7)).thenReturn(Optional.of(pendingUser))
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(invitationRepository.findByEmailAndCollectiveCode("kasper@example.com", "ABC123")).thenReturn(null)
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(recurringTask(id = 8, title = "Kitchen", assignee = "Kasper")),
        )
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(existingMember, pendingUser.copy(id = 7, collectiveCode = "ABC123")),
        )

        operations.joinCollective(JoinCollectiveRequest(userId = 7, joinCode = "ABC123"))

        verify(taskRepository).save(
            check {
                assertEquals("Emma", it.assignee)
            },
        )
    }

    @Test
    fun `invite user ignores realtime publish failures`() {
        val inviter = member("Emma", "emma@example.com", collectiveCode = "ABC123")
        whenever(memberRepository.findByName("Emma")).thenReturn(inviter)
        whenever(invitationRepository.findByEmailAndCollectiveCode("kasper@example.com", "ABC123")).thenReturn(null)
        whenever(invitationRepository.save(any<Invitation>())).thenAnswer {
            (it.arguments[0] as Invitation).copy(id = 1)
        }
        doThrow(RuntimeException("realtime unavailable"))
            .whenever(invitationRealtimeService)
            .publish(any(), any(), any())

        operations.inviteUserToCollective("kasper@example.com", "ABC123", "Emma")

        verify(invitationRepository).save(any<Invitation>())
        verify(invitationRealtimeService).publish(eq("kasper@example.com"), eq("INVITATION_CREATED"), any())
    }

    @Test
    fun `get collective code for user returns stored join code`() {
        whenever(memberRepository.findById(5)).thenReturn(
            Optional.of(member("Kasper", "kasper@example.com", id = 5, collectiveCode = "ABC123")),
        )

        val result = operations.getCollectiveCodeForUser(5)

        assertEquals("ABC123", result.joinCode)
    }

    @Test
    fun `is google calendar connected delegates to service`() {
        val member = member("Kasper", "kasper@example.com")
        whenever(memberRepository.findByName("Kasper")).thenReturn(member)
        whenever(googleCalendarService.isConnected(member)).thenReturn(true)

        val connected = operations.isGoogleCalendarConnected("Kasper")

        assertTrue(connected)
        verify(googleCalendarService).isConnected(member)
    }

    @Test
    fun `is google calendar connected returns false when member is missing`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(null)

        val connected = operations.isGoogleCalendarConnected("Kasper")

        assertFalse(connected)
        verify(googleCalendarService, never()).isConnected(any())
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
