@file:Suppress("ktlint:standard:no-wildcard-imports")

package com.kollekt.api

import com.kollekt.api.dto.*
import com.kollekt.service.KollektService
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/economy")
class EconomyController(
    private val service: KollektService,
) {
    @GetMapping("/expenses")
    fun getExpenses(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): List<ExpenseDto> {
        requireTokenSubject(jwt, memberName)
        return service.getExpenses(memberName)
    }

    @PostMapping("/expenses")
    @ResponseStatus(HttpStatus.CREATED)
    fun createExpense(
        @RequestBody request: CreateExpenseRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): ExpenseDto = service.createExpense(request, jwt.subject)

    @GetMapping("/balances")
    fun getBalances(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): List<BalanceDto> {
        requireTokenSubject(jwt, memberName)
        return service.getBalances(memberName)
    }

    @GetMapping("/pant")
    fun getPantSummary(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): PantSummaryDto {
        requireTokenSubject(jwt, memberName)
        return service.getPantSummary(memberName)
    }

    @PostMapping("/pant")
    @ResponseStatus(HttpStatus.CREATED)
    fun addPant(
        @RequestBody request: CreatePantEntryRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): PantEntryDto = service.addPantEntry(request, jwt.subject)

    @GetMapping("/summary")
    fun getSummary(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): EconomySummaryDto {
        requireTokenSubject(jwt, memberName)
        return service.getEconomySummary(memberName)
    }

    @PostMapping("/settle-up")
    fun settleUp(
        @RequestBody request: SettleUpRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): SettleUpResponse {
        requireTokenSubject(jwt, request.memberName)
        return service.settleUp(jwt.subject)
    }
}
