package com.kollekt.service

import com.kollekt.api.dto.CreateShoppingItemRequest
import com.kollekt.domain.Member
import com.kollekt.domain.ShoppingItem
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.MemberRepository
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
    private lateinit var memberRepository: MemberRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var eventPublisher: IntegrationEventPublisher
    private lateinit var collectiveAccessService: CollectiveAccessService
    private lateinit var operations: ShoppingOperations

    @BeforeEach
    fun setUp() {
        shoppingItemRepository = mock()
        memberRepository = mock()
        collectiveRepository = mock()
        eventPublisher = mock()
        collectiveAccessService = CollectiveAccessService(memberRepository, collectiveRepository)
        operations = ShoppingOperations(shoppingItemRepository, eventPublisher, collectiveAccessService, mock())
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
