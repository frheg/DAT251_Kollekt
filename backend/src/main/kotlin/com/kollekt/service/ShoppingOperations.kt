package com.kollekt.service

import com.kollekt.api.dto.CreateExpenseRequest
import com.kollekt.api.dto.CreateShoppingItemRequest
import com.kollekt.api.dto.MarkSupplyBoughtRequest
import com.kollekt.api.dto.ShoppingItemDto
import com.kollekt.api.dto.UpdateShoppingItemRequest
import com.kollekt.domain.MemberStatus
import com.kollekt.domain.ShoppingItem
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.ShoppingItemRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
class ShoppingOperations(
    private val shoppingItemRepository: ShoppingItemRepository,
    private val memberRepository: MemberRepository,
    private val eventPublisher: IntegrationEventPublisher,
    private val notificationService: NotificationService,
    private val collectiveAccessService: CollectiveAccessService,
    private val economyOperations: EconomyOperations,
) {
    fun getShoppingItems(memberName: String): List<ShoppingItemDto> {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        return shoppingItemRepository.findAllByCollectiveCode(collectiveCode).map { it.toDto() }
    }

    @Transactional
    fun createShoppingItem(
        request: CreateShoppingItemRequest,
        actorName: String,
    ): ShoppingItemDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val saved =
            shoppingItemRepository.save(
                ShoppingItem(
                    item = request.item,
                    addedBy = actorName,
                    collectiveCode = collectiveCode,
                ),
            )
        eventPublisher.taskEvent("SHOPPING_ITEM_CREATED", saved.toDto())

        val others =
            memberRepository
                .findAllByCollectiveCode(collectiveCode)
                .filter { it.status == MemberStatus.ACTIVE && it.name != actorName }
                .map { it.name }
        if (others.isNotEmpty()) {
            notificationService.createParameterizedGroupNotification(
                userNames = others,
                type = "SHOPPING_ITEM_ADDED",
                params = mapOf("actorName" to actorName, "item" to request.item),
            )
        }

        return saved.toDto()
    }

    @Transactional
    fun toggleShoppingItem(
        itemId: Long,
        memberName: String,
    ): ShoppingItemDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val item =
            shoppingItemRepository.findByIdAndCollectiveCode(itemId, collectiveCode)
                ?: throw IllegalArgumentException("Shopping item $itemId not found")

        val nowCompleted = !item.completed
        val updated =
            shoppingItemRepository.save(
                item.copy(
                    completed = nowCompleted,
                    completedAt = if (nowCompleted) LocalDateTime.now() else null,
                ),
            )
        eventPublisher.taskEvent("SHOPPING_ITEM_TOGGLED", updated.toDto())
        return updated.toDto()
    }

    @Transactional
    fun deleteShoppingItem(
        itemId: Long,
        memberName: String,
    ) {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val item =
            shoppingItemRepository.findByIdAndCollectiveCode(itemId, collectiveCode)
                ?: throw IllegalArgumentException("Shopping item $itemId not found")

        shoppingItemRepository.deleteById(item.id)
        eventPublisher.taskEvent("SHOPPING_ITEM_DELETED", mapOf("id" to itemId))
    }

    @Transactional
    fun updateShoppingItem(
        itemId: Long,
        request: UpdateShoppingItemRequest,
        memberName: String,
    ): ShoppingItemDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val item =
            shoppingItemRepository.findByIdAndCollectiveCode(itemId, collectiveCode)
                ?: throw IllegalArgumentException("Shopping item $itemId not found")

        val updated = shoppingItemRepository.save(item.copy(item = request.item))
        eventPublisher.taskEvent("SHOPPING_ITEM_UPDATED", updated.toDto())
        return updated.toDto()
    }

    @Transactional
    fun cleanupBoughtItems() {
        val threshold = LocalDateTime.now().minusDays(1)
        shoppingItemRepository
            .findAll()
            .filter { it.completed && it.completedAt != null && it.completedAt.isBefore(threshold) }
            .forEach { shoppingItemRepository.deleteById(it.id) }
    }

    @Transactional
    fun markSupplyBought(
        itemId: Long,
        request: MarkSupplyBoughtRequest,
        memberName: String,
    ): ShoppingItemDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val item =
            shoppingItemRepository.findByIdAndCollectiveCode(itemId, collectiveCode)
                ?: throw IllegalArgumentException("Shopping item $itemId not found")

        val updated = shoppingItemRepository.save(item.copy(completed = true, completedAt = LocalDateTime.now()))

        economyOperations.createExpense(
            CreateExpenseRequest(
                description = item.item,
                amount = request.amount,
                paidBy = request.paidBy,
                category = "SUPPLIES",
                date = request.date,
                participantNames = request.participantNames,
                deadlineDate = request.deadlineDate,
            ),
            memberName,
        )

        eventPublisher.taskEvent("SHOPPING_ITEM_BOUGHT", updated.toDto())
        return updated.toDto()
    }

    private fun ShoppingItem.toDto() = ShoppingItemDto(id, item, addedBy, completed)
}
