package com.kollekt.api

import com.kollekt.api.dto.CreateShoppingItemRequest
import com.kollekt.api.dto.CreateTaskRequest
import com.kollekt.api.dto.ShoppingItemDto
import com.kollekt.api.dto.TaskDto
import com.kollekt.service.KollektService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/tasks")
class TaskController(private val service: KollektService) {
    @GetMapping fun getTasks(): List<TaskDto> = service.getTasks()

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun createTask(@RequestBody request: CreateTaskRequest): TaskDto = service.createTask(request)

    @PatchMapping("/{taskId}/toggle")
    fun toggleTask(@PathVariable taskId: Long): TaskDto = service.toggleTask(taskId)

    @GetMapping("/shopping")
    fun getShoppingItems(): List<ShoppingItemDto> = service.getShoppingItems()

    @PostMapping("/shopping")
    @ResponseStatus(HttpStatus.CREATED)
    fun createShoppingItem(@RequestBody request: CreateShoppingItemRequest): ShoppingItemDto =
            service.createShoppingItem(request)

    @PatchMapping("/shopping/{itemId}/toggle")
    fun toggleShoppingItem(@PathVariable itemId: Long): ShoppingItemDto =
            service.toggleShoppingItem(itemId)

    @DeleteMapping("/shopping/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteShoppingItem(@PathVariable itemId: Long) = service.deleteShoppingItem(itemId)
}
