package com.kollekt.api

import com.kollekt.api.dto.*
import com.kollekt.service.KollektService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/economy")
class EconomyController(private val service: KollektService) {
    @GetMapping("/expenses") fun getExpenses(): List<ExpenseDto> = service.getExpenses()

    @PostMapping("/expenses")
    @ResponseStatus(HttpStatus.CREATED)
    fun createExpense(@RequestBody request: CreateExpenseRequest): ExpenseDto =
            service.createExpense(request)

    @GetMapping("/balances") fun getBalances(): List<BalanceDto> = service.getBalances()

    @GetMapping("/pant") fun getPantSummary(): PantSummaryDto = service.getPantSummary()

    @PostMapping("/pant")
    @ResponseStatus(HttpStatus.CREATED)
    fun addPant(@RequestBody request: CreatePantEntryRequest): PantEntryDto =
            service.addPantEntry(request)

    @GetMapping("/summary") fun getSummary(): EconomySummaryDto = service.getEconomySummary()
}
