package com.kollekt.config


import com.kollekt.domain.Achievement
import com.kollekt.domain.CalendarEvent
import com.kollekt.domain.ChatMessage
import com.kollekt.domain.Expense
import com.kollekt.domain.Member
import com.kollekt.domain.PantEntry
import com.kollekt.domain.ShoppingItem
import com.kollekt.domain.TaskItem
import com.kollekt.repository.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

@ExtendWith(MockitoExtension::class)
class DataSeederTest {
    @Mock lateinit var memberRepository: MemberRepository
    @Mock lateinit var taskRepository: TaskRepository
    @Mock lateinit var shoppingItemRepository: ShoppingItemRepository
    @Mock lateinit var eventRepository: EventRepository
    @Mock lateinit var chatMessageRepository: ChatMessageRepository
    @Mock lateinit var expenseRepository: ExpenseRepository
    @Mock lateinit var pantEntryRepository: PantEntryRepository
    @Mock lateinit var achievementRepository: AchievementRepository

    @Test
    fun `does not seed when data already exists`() {
        whenever(memberRepository.count()).thenReturn(1L)
        whenever(taskRepository.count()).thenReturn(1L)
        whenever(shoppingItemRepository.count()).thenReturn(1L)
        whenever(eventRepository.count()).thenReturn(1L)
        whenever(chatMessageRepository.count()).thenReturn(1L)
        whenever(expenseRepository.count()).thenReturn(1L)
        whenever(pantEntryRepository.count()).thenReturn(1L)
        whenever(achievementRepository.count()).thenReturn(1L)

        val runner =
            DataSeeder().seedData(
                memberRepository,
                taskRepository,
                shoppingItemRepository,
                eventRepository,
                chatMessageRepository,
                expenseRepository,
                pantEntryRepository,
                achievementRepository,
            )

        runner.run()

        verify(memberRepository, never()).saveAll(org.mockito.kotlin.any<Iterable<Member>>())
        verify(taskRepository, never()).saveAll(org.mockito.kotlin.any<Iterable<TaskItem>>())
        verify(shoppingItemRepository, never()).saveAll(org.mockito.kotlin.any<Iterable<ShoppingItem>>())
        verify(eventRepository, never()).saveAll(org.mockito.kotlin.any<Iterable<CalendarEvent>>())
        verify(chatMessageRepository, never()).saveAll(org.mockito.kotlin.any<Iterable<ChatMessage>>())
        verify(expenseRepository, never()).saveAll(org.mockito.kotlin.any<Iterable<Expense>>())
        verify(pantEntryRepository, never()).saveAll(org.mockito.kotlin.any<Iterable<PantEntry>>())
        verify(achievementRepository, never()).saveAll(org.mockito.kotlin.any<Iterable<Achievement>>())
    }

    @Test
    fun `seeds members when none exist`() {
        whenever(memberRepository.count()).thenReturn(0L)
        whenever(taskRepository.count()).thenReturn(1L)
        whenever(shoppingItemRepository.count()).thenReturn(1L)
        whenever(eventRepository.count()).thenReturn(1L)
        whenever(chatMessageRepository.count()).thenReturn(1L)
        whenever(expenseRepository.count()).thenReturn(1L)
        whenever(pantEntryRepository.count()).thenReturn(1L)
        whenever(achievementRepository.count()).thenReturn(1L)

        val runner =
            DataSeeder().seedData(
                memberRepository,
                taskRepository,
                shoppingItemRepository,
                eventRepository,
                chatMessageRepository,
                expenseRepository,
                pantEntryRepository,
                achievementRepository,
            )

        runner.run()

        verify(memberRepository).saveAll(org.mockito.kotlin.any<Iterable<Member>>())
        verify(taskRepository, never()).saveAll(org.mockito.kotlin.any<Iterable<TaskItem>>())
        verify(shoppingItemRepository, never()).saveAll(org.mockito.kotlin.any<Iterable<ShoppingItem>>())
        verify(eventRepository, never()).saveAll(org.mockito.kotlin.any<Iterable<CalendarEvent>>())
        verify(chatMessageRepository, never()).saveAll(org.mockito.kotlin.any<Iterable<ChatMessage>>())
        verify(expenseRepository, never()).saveAll(org.mockito.kotlin.any<Iterable<Expense>>())
        verify(pantEntryRepository, never()).saveAll(org.mockito.kotlin.any<Iterable<PantEntry>>())
        verify(achievementRepository, never()).saveAll(org.mockito.kotlin.any<Iterable<Achievement>>())
    }
}
