package com.kollekt.repository

import com.kollekt.domain.ShoppingItem
import org.springframework.data.jpa.repository.JpaRepository

interface ShoppingItemRepository : JpaRepository<ShoppingItem, Long>
