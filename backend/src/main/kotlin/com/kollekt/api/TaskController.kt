@file:Suppress("ktlint:standard:no-wildcard-imports")

package com.kollekt.api

import com.kollekt.api.dto.CreateShoppingItemRequest
import com.kollekt.api.dto.CreateTaskRequest
import com.kollekt.api.dto.GiveTaskFeedbackRequest
import com.kollekt.api.dto.MarkSupplyBoughtRequest
import com.kollekt.api.dto.ShoppingItemDto
import com.kollekt.api.dto.TaskDto
import com.kollekt.api.dto.UpdateShoppingItemRequest
import com.kollekt.service.ShoppingOperations
import com.kollekt.service.TaskOperations
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/tasks")
class TaskController(
    private val taskOperations: TaskOperations,
    private val shoppingOperations: ShoppingOperations,
) {
    @GetMapping
    fun getTasks(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): List<TaskDto> {
        requireTokenSubject(jwt, memberName)
        return taskOperations.getTasks(memberName)
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun createTask(
        @RequestBody request: CreateTaskRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): TaskDto = taskOperations.createTask(request, jwt.subject)

    @PostMapping("/{taskId}/regret")
    fun regretTask(
        @PathVariable taskId: Long,
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): TaskDto {
        requireTokenSubject(jwt, memberName)
        return taskOperations.regretTask(taskId, memberName)
    }

    @PostMapping("/{taskId}/regret-missed")
    fun regretMissedTask(
        @PathVariable taskId: Long,
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): TaskDto {
        requireTokenSubject(jwt, memberName)
        return taskOperations.regretMissedTask(taskId, memberName)
    }

    @PatchMapping("/{taskId}/feedback")
    fun giveTaskFeedback(
        @PathVariable taskId: Long,
        @RequestParam memberName: String,
        @RequestBody request: GiveTaskFeedbackRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): TaskDto {
        requireTokenSubject(jwt, memberName)
        return taskOperations.giveTaskFeedback(
            taskId,
            memberName,
            request.message,
            request.anonymous,
            request.imageData,
            request.imageMimeType,
        )
    }

    @PatchMapping("/{taskId}")
    fun updateTask(
        @PathVariable taskId: Long,
        @RequestBody request: Map<String, Any>,
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): TaskDto {
        requireTokenSubject(jwt, memberName)
        return taskOperations.updateTask(taskId, request, memberName)
    }

    @PatchMapping("/{taskId}/toggle")
    fun toggleTask(
        @PathVariable taskId: Long,
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): TaskDto {
        requireTokenSubject(jwt, memberName)
        return taskOperations.toggleTask(taskId, memberName)
    }

    @DeleteMapping("/{taskId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteTask(
        @PathVariable taskId: Long,
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        requireTokenSubject(jwt, memberName)
        taskOperations.deleteTask(taskId, memberName)
    }

    @GetMapping("/shopping")
    fun getShoppingItems(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): List<ShoppingItemDto> {
        requireTokenSubject(jwt, memberName)
        return shoppingOperations.getShoppingItems(memberName)
    }

    @PostMapping("/shopping")
    @ResponseStatus(HttpStatus.CREATED)
    fun createShoppingItem(
        @RequestBody request: CreateShoppingItemRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): ShoppingItemDto = shoppingOperations.createShoppingItem(request, jwt.subject)

    @PatchMapping("/shopping/{itemId}")
    fun updateShoppingItem(
        @PathVariable itemId: Long,
        @RequestParam memberName: String,
        @RequestBody request: UpdateShoppingItemRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): ShoppingItemDto {
        requireTokenSubject(jwt, memberName)
        return shoppingOperations.updateShoppingItem(itemId, request, memberName)
    }

    @PostMapping("/shopping/{itemId}/bought")
    fun markSupplyBought(
        @PathVariable itemId: Long,
        @RequestParam memberName: String,
        @RequestBody request: MarkSupplyBoughtRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): ShoppingItemDto {
        requireTokenSubject(jwt, memberName)
        return shoppingOperations.markSupplyBought(itemId, request, memberName)
    }

    @PatchMapping("/shopping/{itemId}/toggle")
    fun toggleShoppingItem(
        @PathVariable itemId: Long,
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): ShoppingItemDto {
        requireTokenSubject(jwt, memberName)
        return shoppingOperations.toggleShoppingItem(itemId, memberName)
    }

    @DeleteMapping("/shopping/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteShoppingItem(
        @PathVariable itemId: Long,
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        requireTokenSubject(jwt, memberName)
        shoppingOperations.deleteShoppingItem(itemId, memberName)
    }
}
