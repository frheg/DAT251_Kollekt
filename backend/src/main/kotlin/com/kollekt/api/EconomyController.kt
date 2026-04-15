@file:Suppress("ktlint:standard:no-wildcard-imports")

package com.kollekt.api

import com.kollekt.api.dto.*
import com.kollekt.service.EconomyOperations
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/economy")
class EconomyController(
    private val economyOperations: EconomyOperations,
) {
    @GetMapping("/expenses")
    fun getExpenses(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): List<ExpenseDto> {
        requireTokenSubject(jwt, memberName)
        return economyOperations.getExpenses(memberName)
    }

    @PostMapping("/expenses")
    @ResponseStatus(HttpStatus.CREATED)
    fun createExpense(
        @RequestBody request: CreateExpenseRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): ExpenseDto = economyOperations.createExpense(request, jwt.subject)

    @PatchMapping("/expenses/{id}")
    fun updateExpense(
        @PathVariable id: Long,
        @RequestBody request: UpdateExpenseRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): ExpenseDto = economyOperations.updateExpense(id, request, jwt.subject)

    @DeleteMapping("/expenses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteExpense(
        @PathVariable id: Long,
        @AuthenticationPrincipal jwt: Jwt,
    ) = economyOperations.deleteExpense(id, jwt.subject)

    @GetMapping("/balances")
    fun getBalances(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): List<BalanceDto> {
        requireTokenSubject(jwt, memberName)
        return economyOperations.getBalances(memberName)
    }

    @GetMapping("/pant")
    fun getPantSummary(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): PantSummaryDto {
        requireTokenSubject(jwt, memberName)
        return economyOperations.getPantSummary(memberName)
    }

    @PostMapping("/pant")
    @ResponseStatus(HttpStatus.CREATED)
    fun addPant(
        @RequestBody request: CreatePantEntryRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): PantEntryDto = economyOperations.addPantEntry(request, jwt.subject)

    @PatchMapping("/pant/{id}")
    fun updatePantEntry(
        @PathVariable id: Long,
        @RequestBody request: UpdatePantEntryRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): PantEntryDto = economyOperations.updatePantEntry(id, request, jwt.subject)

    @DeleteMapping("/pant/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deletePantEntry(
        @PathVariable id: Long,
        @AuthenticationPrincipal jwt: Jwt,
    ) = economyOperations.deletePantEntry(id, jwt.subject)

    @GetMapping("/pay-options")
    fun getPayOptions(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): List<PayOptionDto> {
        requireTokenSubject(jwt, memberName)
        return economyOperations.getPayOptions(memberName)
    }

    @PatchMapping("/pant/goal")
    fun updatePantGoal(
        @RequestBody request: UpdatePantGoalRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        requireTokenSubject(jwt, request.memberName)
        economyOperations.updatePantGoal(request.memberName, request.goal)
    }

    @GetMapping("/summary")
    fun getSummary(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): EconomySummaryDto {
        requireTokenSubject(jwt, memberName)
        return economyOperations.getEconomySummary(memberName)
    }

    @PostMapping("/settle-up")
    fun settleUp(
        @RequestBody request: SettleUpRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): SettleUpResponse {
        requireTokenSubject(jwt, request.memberName)
        return economyOperations.settleUp(jwt.subject)
    }

    @PostMapping("/settle-with")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun settleWith(
        @RequestBody request: SettleWithRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ) = economyOperations.settleWith(jwt.subject, request.creditorName)
}
