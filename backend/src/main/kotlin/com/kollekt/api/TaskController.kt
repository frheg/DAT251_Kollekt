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
    @GetMapping
    fun getTasks(@RequestParam memberName: String): List<TaskDto> = service.getTasks(memberName)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun createTask(@RequestBody request: CreateTaskRequest): TaskDto = service.createTask(request)

    @PatchMapping("/{taskId}/toggle")
    fun toggleTask(
            @PathVariable taskId: Long,
            @RequestParam memberName: String,
            @RequestParam(required = false) completed: Boolean?,
    ): TaskDto = service.toggleTask(taskId, memberName, completed)

    @GetMapping("/shopping")
    fun getShoppingItems(@RequestParam memberName: String): List<ShoppingItemDto> =
            service.getShoppingItems(memberName)

    @PostMapping("/shopping")
    @ResponseStatus(HttpStatus.CREATED)
    fun createShoppingItem(@RequestBody request: CreateShoppingItemRequest): ShoppingItemDto =
            service.createShoppingItem(request)

    @PatchMapping("/shopping/{itemId}/toggle")
    fun toggleShoppingItem(
            @PathVariable itemId: Long,
            @RequestParam memberName: String,
    ): ShoppingItemDto = service.toggleShoppingItem(itemId, memberName)

    @DeleteMapping("/shopping/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteShoppingItem(@PathVariable itemId: Long, @RequestParam memberName: String) =
            service.deleteShoppingItem(itemId, memberName)
}
