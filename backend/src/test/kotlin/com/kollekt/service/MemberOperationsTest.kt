package com.kollekt.service

import com.kollekt.domain.Member
import com.kollekt.domain.MemberStatus
import com.kollekt.domain.TaskCategory
import com.kollekt.domain.TaskItem
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.TaskRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.check
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.redis.core.RedisTemplate
import java.time.LocalDate

class MemberOperationsTest {
    private lateinit var memberRepository: MemberRepository
    private lateinit var taskRepository: TaskRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var taskOperations: TaskOperations
    private lateinit var redisTemplate: RedisTemplate<String, Any>
    private lateinit var userProfileService: UserProfileService
    private lateinit var collectiveAccessService: CollectiveAccessService
    private lateinit var statsCacheService: StatsCacheService
    private lateinit var operations: MemberOperations

    @BeforeEach
    fun setUp() {
        memberRepository = mock()
        taskRepository = mock()
        collectiveRepository = mock()
        taskOperations = mock()
        redisTemplate = mock()
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("dashboard:*")
        doReturn(emptySet<String>()).whenever(redisTemplate).keys("leaderboard:*")
        userProfileService = UserProfileService(memberRepository)
        collectiveAccessService = CollectiveAccessService(memberRepository, collectiveRepository)
        statsCacheService = StatsCacheService(redisTemplate)
        operations =
            MemberOperations(
                memberRepository,
                taskRepository,
                taskOperations,
                userProfileService,
                collectiveAccessService,
                statsCacheService,
            )
    }

    @Test
    fun `leave collective redistributes incomplete tasks to least loaded member`() {
        val kasper = member("Kasper", "kasper@example.com")
        val emma = member("Emma", "emma@example.com", id = 2)
        val ola = member("Ola", "ola@example.com", id = 3)
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(listOf(kasper, emma, ola))
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                task(id = 1, title = "Trash", assignee = "Kasper", xp = 20),
                task(id = 2, title = "Floors", assignee = "Emma", xp = 30),
            ),
        )
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        operations.leaveCollective("Kasper")

        verify(memberRepository).save(kasper.copy(collectiveCode = null))
        verify(redisTemplate).keys("dashboard:*")
        verify(redisTemplate).keys("leaderboard:*")
        verify(taskRepository).save(
            check {
                assertEquals(1L, it.id)
                assertEquals("Ola", it.assignee)
            },
        )
    }

    @Test
    fun `update member status triggers task regeneration only on actual change`() {
        val kasper = member("Kasper", "kasper@example.com").copy(status = MemberStatus.ACTIVE)
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)

        operations.updateMemberStatus("Kasper", MemberStatus.AWAY)

        verify(memberRepository).save(kasper.copy(status = MemberStatus.AWAY))
        verify(taskOperations).regenerateRecurringTasksForCollective("ABC123")
    }

    @Test
    fun `get collective members sorts by name before mapping`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Ola", "ola@example.com", id = 3),
                member("Emma", "emma@example.com", id = 2),
            ),
        )

        val result = operations.getCollectiveMembers("Kasper")

        assertEquals(listOf("Emma", "Ola"), result.map { it.name })
    }

    @Test
    fun `add and remove friend updates user profile state`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(memberRepository.findByName("Emma")).thenReturn(member("Emma", "emma@example.com", id = 2))

        operations.addFriend("Kasper", "Emma")
        val withFriend = userProfileService.getUserByName("Kasper")
        operations.removeFriend("Kasper", "Emma")
        val withoutFriend = userProfileService.getUserByName("Kasper")

        assertEquals(listOf("Emma"), withFriend.friends.map { it.name })
        assertTrue(withoutFriend.friends.isEmpty())
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

    private fun task(
        id: Long,
        title: String,
        assignee: String,
        xp: Int,
    ) = TaskItem(
        id = id,
        title = title,
        assignee = assignee,
        collectiveCode = "ABC123",
        dueDate = LocalDate.now().plusDays(1),
        category = TaskCategory.CLEANING,
        xp = xp,
    )
}
