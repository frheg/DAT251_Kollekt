package com.kollekt.api

import com.kollekt.api.dto.CreateShoppingItemRequest
import com.kollekt.api.dto.CreateTaskRequest
import com.kollekt.api.dto.ShoppingItemDto
import com.kollekt.api.dto.TaskDto
import com.kollekt.service.KollektService
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/tasks")
class TaskController(private val service: KollektService) {
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
        ): TaskDto = service.createTask(request, jwt.subject)

        @PatchMapping("/{taskId}/toggle")
        fun toggleTask(
                @PathVariable taskId: Long,
                @RequestParam memberName: String,
                @RequestParam(required = false) completed: Boolean?,
                @AuthenticationPrincipal jwt: Jwt,
        ): TaskDto {
                requireTokenSubject(jwt, memberName)
                return service.toggleTask(taskId, memberName, completed)
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
        ): ShoppingItemDto = service.createShoppingItem(request, jwt.subject)

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
