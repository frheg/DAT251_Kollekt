package com.kollekt.api

import com.kollekt.api.dto.*
import com.kollekt.service.KollektService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/economy")
class EconomyController(private val service: KollektService) {
    @GetMapping("/expenses")
    fun getExpenses(@RequestParam memberName: String): List<ExpenseDto> =
            service.getExpenses(memberName)

    @PostMapping("/expenses")
    @ResponseStatus(HttpStatus.CREATED)
    fun createExpense(@RequestBody request: CreateExpenseRequest): ExpenseDto =
            service.createExpense(request)

    @GetMapping("/balances")
    fun getBalances(@RequestParam memberName: String): List<BalanceDto> =
            service.getBalances(memberName)

    @GetMapping("/pant")
    fun getPantSummary(@RequestParam memberName: String): PantSummaryDto =
            service.getPantSummary(memberName)

    @PostMapping("/pant")
    @ResponseStatus(HttpStatus.CREATED)
    fun addPant(@RequestBody request: CreatePantEntryRequest): PantEntryDto =
            service.addPantEntry(request)

    @GetMapping("/summary")
    fun getSummary(@RequestParam memberName: String): EconomySummaryDto =
            service.getEconomySummary(memberName)

    @PostMapping("/settle-up")
    fun settleUp(@RequestBody request: SettleUpRequest): SettleUpResponse =
            service.settleUp(request)
}
