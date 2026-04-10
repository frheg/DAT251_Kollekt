package com.kollekt.service

import com.kollekt.api.dto.CreateShoppingItemRequest
import com.kollekt.api.dto.ShoppingItemDto
import com.kollekt.domain.ShoppingItem
import com.kollekt.repository.ShoppingItemRepository
import org.springframework.stereotype.Service

@Service
class ShoppingOperations(
    private val shoppingItemRepository: ShoppingItemRepository,
    private val eventPublisher: IntegrationEventPublisher,
) {
    fun getShoppingItems(
        memberName: String,
        requireCollectiveCodeByMemberName: (String) -> String,
    ): List<ShoppingItemDto> {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        return shoppingItemRepository.findAllByCollectiveCode(collectiveCode).map { it.toDto() }
    }

    fun createShoppingItem(
        request: CreateShoppingItemRequest,
        actorName: String,
        requireCollectiveCodeByMemberName: (String) -> String,
    ): ShoppingItemDto {
        val collectiveCode = requireCollectiveCodeByMemberName(actorName)
        val saved =
            shoppingItemRepository.save(
                ShoppingItem(
                    item = request.item,
                    addedBy = actorName,
                    collectiveCode = collectiveCode,
                ),
            )
        eventPublisher.taskEvent("SHOPPING_ITEM_CREATED", saved.toDto())
        return saved.toDto()
    }

    fun toggleShoppingItem(
        itemId: Long,
        memberName: String,
        requireCollectiveCodeByMemberName: (String) -> String,
    ): ShoppingItemDto {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val item =
            shoppingItemRepository.findByIdAndCollectiveCode(itemId, collectiveCode)
                ?: throw IllegalArgumentException("Shopping item $itemId not found")

        val updated = shoppingItemRepository.save(item.copy(completed = !item.completed))
        eventPublisher.taskEvent("SHOPPING_ITEM_TOGGLED", updated.toDto())
        return updated.toDto()
    }

    fun deleteShoppingItem(
        itemId: Long,
        memberName: String,
        requireCollectiveCodeByMemberName: (String) -> String,
    ) {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val item =
            shoppingItemRepository.findByIdAndCollectiveCode(itemId, collectiveCode)
                ?: throw IllegalArgumentException("Shopping item $itemId not found")

        shoppingItemRepository.deleteById(item.id)
        eventPublisher.taskEvent("SHOPPING_ITEM_DELETED", mapOf("id" to itemId))
    }

    private fun ShoppingItem.toDto() = ShoppingItemDto(id, item, addedBy, completed)
}
