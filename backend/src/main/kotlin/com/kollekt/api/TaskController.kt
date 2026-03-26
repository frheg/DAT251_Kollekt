@file:Suppress("ktlint:standard:no-wildcard-imports")

package com.kollekt.api

import com.kollekt.api.dto.CreateShoppingItemRequest
import com.kollekt.api.dto.CreateTaskRequest
import com.kollekt.api.dto.ShoppingItemDto
import com.kollekt.api.dto.TaskDto
import com.kollekt.service.KollektService
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
    private val service: KollektService,
) {
    @GetMapping
    fun getTasks(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): List<TaskDto> {
        requireTokenSubject(jwt, memberName)
        return service.getTasks(memberName)
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun createTask(
        @RequestBody request: CreateTaskRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): TaskDto {
        return service.createTask(request, jwt.subject)
    }

    @PostMapping("/{taskId}/regret")
    fun regretTask(
        @PathVariable taskId: Long,
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): TaskDto {
        requireTokenSubject(jwt, memberName)
        return service.regretTask(taskId, memberName)
    }

    @PatchMapping("/{taskId}/feedback")
    fun giveTaskFeedback(
        @PathVariable taskId: Long,
        @RequestParam memberName: String,
        @RequestBody feedback: Map<String, String>,
        @AuthenticationPrincipal jwt: Jwt,
    ): TaskDto {
        requireTokenSubject(jwt, memberName)
        val feedbackText = feedback["feedback"] ?: ""
        return service.giveTaskFeedback(taskId, memberName, feedbackText)
    }

    @PatchMapping("/{taskId}")
    fun updateTask(
        @PathVariable taskId: Long,
        @RequestBody request: Map<String, Any>,
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): TaskDto {
        requireTokenSubject(jwt, memberName)
        return service.updateTask(taskId, request, memberName)
    }

    @PatchMapping("/{taskId}/toggle")
    fun toggleTask(
        @PathVariable taskId: Long,
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): TaskDto {
        requireTokenSubject(jwt, memberName)
        return service.toggleTask(taskId, memberName)
    }

    @DeleteMapping("/{taskId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteTask(
        @PathVariable taskId: Long,
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        requireTokenSubject(jwt, memberName)
        service.deleteTask(taskId, memberName)
    }

    @GetMapping("/shopping")
    fun getShoppingItems(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): List<ShoppingItemDto> {
        requireTokenSubject(jwt, memberName)
        return service.getShoppingItems(memberName)
    }

    @PostMapping("/shopping")
    @ResponseStatus(HttpStatus.CREATED)
    fun createShoppingItem(
        @RequestBody request: CreateShoppingItemRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): ShoppingItemDto {
        return service.createShoppingItem(request, jwt.subject)
    }

    @PatchMapping("/shopping/{itemId}/toggle")
    fun toggleShoppingItem(
        @PathVariable itemId: Long,
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): ShoppingItemDto {
        requireTokenSubject(jwt, memberName)
        return service.toggleShoppingItem(itemId, memberName)
    }

    @DeleteMapping("/shopping/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteShoppingItem(
        @PathVariable itemId: Long,
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        requireTokenSubject(jwt, memberName)
        service.deleteShoppingItem(itemId, memberName)
    }
}
