package com.kollekt.service

import com.kollekt.api.dto.UserDto
import com.kollekt.domain.Member
import com.kollekt.domain.MemberStatus
import com.kollekt.domain.TaskCategory
import com.kollekt.domain.TaskItem
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.TaskRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.check
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.LocalDate

class MemberOperationsTest {
    private lateinit var memberRepository: MemberRepository
    private lateinit var taskRepository: TaskRepository
    private lateinit var operations: MemberOperations

    @BeforeEach
    fun setUp() {
        memberRepository = mock()
        taskRepository = mock()
        operations = MemberOperations(memberRepository, taskRepository)
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

        var regenerated = false
        operations.updateMemberStatus("Kasper", MemberStatus.AWAY) { regenerated = true }

        verify(memberRepository).save(kasper.copy(status = MemberStatus.AWAY))
        assertTrue(regenerated)
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

        val result =
            operations.getCollectiveMembers("Kasper") { member ->
                UserDto(id = member.id, name = member.name, email = member.email, collectiveCode = member.collectiveCode)
            }

        assertEquals(listOf("Emma", "Ola"), result.map { it.name })
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
