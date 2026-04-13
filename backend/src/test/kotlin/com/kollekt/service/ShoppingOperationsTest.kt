package com.kollekt.service

import com.kollekt.api.dto.CreateShoppingItemRequest
import com.kollekt.api.dto.UpdateShoppingItemRequest
import com.kollekt.domain.Member
import com.kollekt.domain.ShoppingItem
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.ShoppingItemRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.LocalDateTime

class ShoppingOperationsTest {
    private lateinit var shoppingItemRepository: ShoppingItemRepository
    private lateinit var memberRepository: MemberRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var eventPublisher: IntegrationEventPublisher
    private lateinit var notificationService: NotificationService
    private lateinit var collectiveAccessService: CollectiveAccessService
    private lateinit var operations: ShoppingOperations

    @BeforeEach
    fun setUp() {
        shoppingItemRepository = mock()
        memberRepository = mock()
        collectiveRepository = mock()
        eventPublisher = mock()
        notificationService = mock()
        collectiveAccessService = CollectiveAccessService(memberRepository, collectiveRepository)
        operations =
            ShoppingOperations(
                shoppingItemRepository,
                memberRepository,
                eventPublisher,
                notificationService,
                collectiveAccessService,
                mock(),
            )
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
    }

    @Test
    fun `get shopping items maps collective scoped results`() {
        whenever(shoppingItemRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                ShoppingItem(id = 1, item = "Milk", addedBy = "Emma", collectiveCode = "ABC123", completed = false),
                ShoppingItem(id = 2, item = "Soap", addedBy = "Kasper", collectiveCode = "ABC123", completed = true),
            ),
        )

        val result = operations.getShoppingItems("Kasper")

        assertEquals(listOf("Milk", "Soap"), result.map { it.item })
        assertEquals(listOf(false, true), result.map { it.completed })
    }

    @Test
    fun `create shopping item uses actor scoped collective and publishes event`() {
        whenever(shoppingItemRepository.save(any<ShoppingItem>())).thenAnswer { it.arguments[0] as ShoppingItem }

        val result =
            operations.createShoppingItem(
                request = CreateShoppingItemRequest(item = "Bread", addedBy = "Ignored"),
                actorName = "Kasper",
            )

        assertEquals("Bread", result.item)
        assertEquals("Kasper", result.addedBy)
        verify(eventPublisher).taskEvent("SHOPPING_ITEM_CREATED", result)
    }

    @Test
    fun `toggle shopping item flips completion and publishes update`() {
        whenever(shoppingItemRepository.findByIdAndCollectiveCode(9, "ABC123")).thenReturn(
            ShoppingItem(id = 9, item = "Milk", addedBy = "Emma", collectiveCode = "ABC123", completed = false),
        )
        whenever(shoppingItemRepository.save(any<ShoppingItem>())).thenAnswer { it.arguments[0] as ShoppingItem }

        val result = operations.toggleShoppingItem(9, "Kasper")

        assertTrue(result.completed)
        verify(eventPublisher).taskEvent("SHOPPING_ITEM_TOGGLED", result)
    }

    @Test
    fun `toggle from completed to incomplete sets completedAt to null`() {
        whenever(shoppingItemRepository.findByIdAndCollectiveCode(9, "ABC123")).thenReturn(
            ShoppingItem(
                id = 9,
                item = "Milk",
                addedBy = "Emma",
                collectiveCode = "ABC123",
                completed = true,
                completedAt = LocalDateTime.now(),
            ),
        )
        whenever(shoppingItemRepository.save(any<ShoppingItem>())).thenAnswer { it.arguments[0] as ShoppingItem }

        val result = operations.toggleShoppingItem(9, "Kasper")

        assertFalse(result.completed)
        verify(eventPublisher).taskEvent("SHOPPING_ITEM_TOGGLED", result)
    }

    @Test
    fun `delete shopping item removes item and publishes event`() {
        whenever(shoppingItemRepository.findByIdAndCollectiveCode(5, "ABC123")).thenReturn(
            ShoppingItem(id = 5, item = "Bread", addedBy = "Kasper", collectiveCode = "ABC123", completed = false),
        )

        operations.deleteShoppingItem(5, "Kasper")

        verify(shoppingItemRepository).deleteById(5)
        verify(eventPublisher).taskEvent("SHOPPING_ITEM_DELETED", mapOf("id" to 5L))
    }

    @Test
    fun `update shopping item saves new name and publishes event`() {
        whenever(shoppingItemRepository.findByIdAndCollectiveCode(3, "ABC123")).thenReturn(
            ShoppingItem(id = 3, item = "Old item", addedBy = "Kasper", collectiveCode = "ABC123", completed = false),
        )
        whenever(shoppingItemRepository.save(any<ShoppingItem>())).thenAnswer { it.arguments[0] as ShoppingItem }

        val result = operations.updateShoppingItem(3, UpdateShoppingItemRequest(item = "New item"), "Kasper")

        assertEquals("New item", result.item)
        verify(eventPublisher).taskEvent("SHOPPING_ITEM_UPDATED", result)
    }

    @Test
    fun `cleanup deletes items completed more than one day ago`() {
        val old =
            ShoppingItem(
                id = 1,
                item = "Milk",
                addedBy = "Kasper",
                collectiveCode = "ABC123",
                completed = true,
                completedAt = LocalDateTime.now().minusDays(2),
            )
        val recent =
            ShoppingItem(
                id = 2,
                item = "Bread",
                addedBy = "Kasper",
                collectiveCode = "ABC123",
                completed = true,
                completedAt = LocalDateTime.now(),
            )
        val incomplete = ShoppingItem(id = 3, item = "Eggs", addedBy = "Kasper", collectiveCode = "ABC123", completed = false)
        whenever(shoppingItemRepository.findAll()).thenReturn(listOf(old, recent, incomplete))

        operations.cleanupBoughtItems()

        verify(shoppingItemRepository).deleteById(1)
        verify(shoppingItemRepository, never()).deleteById(2)
        verify(shoppingItemRepository, never()).deleteById(3)
    }

    private fun member(
        name: String,
        email: String,
        collectiveCode: String? = "ABC123",
    ) = Member(
        name = name,
        email = email,
        collectiveCode = collectiveCode,
    )
}
