package com.kollekt.service

import com.kollekt.api.dto.CreateShoppingItemRequest
import com.kollekt.domain.ShoppingItem
import com.kollekt.repository.ShoppingItemRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class ShoppingOperationsTest {
    private lateinit var shoppingItemRepository: ShoppingItemRepository
    private lateinit var eventPublisher: IntegrationEventPublisher
    private lateinit var operations: ShoppingOperations

    @BeforeEach
    fun setUp() {
        shoppingItemRepository = mock()
        eventPublisher = mock()
        operations = ShoppingOperations(shoppingItemRepository, eventPublisher)
    }

    @Test
    fun `get shopping items maps collective scoped results`() {
        whenever(shoppingItemRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                ShoppingItem(id = 1, item = "Milk", addedBy = "Emma", collectiveCode = "ABC123", completed = false),
                ShoppingItem(id = 2, item = "Soap", addedBy = "Kasper", collectiveCode = "ABC123", completed = true),
            ),
        )

        val result = operations.getShoppingItems("Kasper") { "ABC123" }

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
            ) { "ABC123" }

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

        val result = operations.toggleShoppingItem(9, "Kasper") { "ABC123" }

        assertTrue(result.completed)
        verify(eventPublisher).taskEvent("SHOPPING_ITEM_TOGGLED", result)
    }
}
