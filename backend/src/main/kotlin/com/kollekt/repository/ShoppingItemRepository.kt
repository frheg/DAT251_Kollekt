package com.kollekt.repository

import com.kollekt.domain.ShoppingItem
import org.springframework.data.jpa.repository.JpaRepository

interface ShoppingItemRepository : JpaRepository<ShoppingItem, Long> {
    fun findAllByCollectiveCode(collectiveCode: String): List<ShoppingItem>
    fun findByIdAndCollectiveCode(id: Long, collectiveCode: String): ShoppingItem?
}
