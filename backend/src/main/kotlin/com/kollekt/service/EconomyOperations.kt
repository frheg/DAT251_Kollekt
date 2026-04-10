package com.kollekt.service

import com.kollekt.api.dto.BalanceDto
import com.kollekt.api.dto.CreateExpenseRequest
import com.kollekt.api.dto.CreatePantEntryRequest
import com.kollekt.api.dto.EconomySummaryDto
import com.kollekt.api.dto.ExpenseDto
import com.kollekt.api.dto.PantEntryDto
import com.kollekt.api.dto.PantSummaryDto
import com.kollekt.api.dto.SettleUpResponse
import com.kollekt.domain.Expense
import com.kollekt.domain.PantEntry
import com.kollekt.domain.SettlementCheckpoint
import com.kollekt.repository.ExpenseRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.PantEntryRepository
import com.kollekt.repository.SettlementCheckpointRepository
import org.springframework.stereotype.Service
import kotlin.math.roundToInt

@Service
class EconomyOperations(
    private val memberRepository: MemberRepository,
    private val expenseRepository: ExpenseRepository,
    private val settlementCheckpointRepository: SettlementCheckpointRepository,
    private val pantEntryRepository: PantEntryRepository,
    private val eventPublisher: IntegrationEventPublisher,
    private val realtimeUpdateService: RealtimeUpdateService,
) {
    fun getExpenses(
        memberName: String,
        requireCollectiveCodeByMemberName: (String) -> String,
    ): List<ExpenseDto> {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        return expenseRepository
            .findAllByCollectiveCode(collectiveCode)
            .sortedByDescending { it.date }
            .map { it.toDto() }
    }

    fun createExpense(
        request: CreateExpenseRequest,
        actorName: String,
        requireCollectiveCodeByMemberName: (String) -> String,
        clearCaches: () -> Unit,
    ): ExpenseDto {
        val collectiveCode = requireCollectiveCodeByMemberName(actorName)
        val collectiveMembers =
            memberRepository
                .findAllByCollectiveCode(collectiveCode)
                .map { it.name }
                .toSet()

        if (collectiveMembers.isEmpty()) {
            throw IllegalArgumentException("Collective '$collectiveCode' has no members")
        }

        val requestedParticipants =
            request.participantNames
                .map { it.trim() }
                .filter { it.isNotBlank() }
                .toSet()

        val participants = if (requestedParticipants.isEmpty()) collectiveMembers else requestedParticipants
        val invalidParticipants = participants - collectiveMembers
        if (invalidParticipants.isNotEmpty()) {
            throw IllegalArgumentException("Participants not in collective: ${invalidParticipants.joinToString(", ")}")
        }

        val saved =
            expenseRepository.save(
                Expense(
                    description = request.description,
                    amount = request.amount,
                    paidBy = actorName,
                    collectiveCode = collectiveCode,
                    category = request.category,
                    date = request.date,
                    participantNames = participants,
                ),
            )

        clearCaches()
        val dto = saved.toDto()
        eventPublisher.economyEvent("EXPENSE_CREATED", dto)
        realtimeUpdateService.publish(collectiveCode, "EXPENSE_CREATED", dto)
        return dto
    }

    fun getBalances(
        memberName: String,
        requireCollectiveCodeByMemberName: (String) -> String,
    ): List<BalanceDto> {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val checkpointExpenseId = latestSettledExpenseId(collectiveCode)
        val expenses =
            expenseRepository
                .findAllByCollectiveCode(collectiveCode)
                .filter { it.id > checkpointExpenseId }

        if (expenses.isEmpty()) return emptyList()

        val members = memberRepository.findAllByCollectiveCode(collectiveCode).map { it.name }
        return calculateBalances(expenses, members)
    }

    fun getPantSummary(
        memberName: String,
        requireCollectiveCodeByMemberName: (String) -> String,
        goal: Int = 1000,
    ): PantSummaryDto {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val entries =
            pantEntryRepository
                .findAllByCollectiveCode(collectiveCode)
                .sortedByDescending { it.date }
                .map { it.toDto() }

        return PantSummaryDto(
            currentAmount = entries.sumOf { it.amount },
            goalAmount = goal,
            entries = entries,
        )
    }

    fun addPantEntry(
        request: CreatePantEntryRequest,
        actorName: String,
        requireCollectiveCodeByMemberName: (String) -> String,
    ): PantEntryDto {
        val collectiveCode = requireCollectiveCodeByMemberName(actorName)
        val saved =
            pantEntryRepository.save(
                PantEntry(
                    bottles = request.bottles,
                    amount = request.amount,
                    addedBy = actorName,
                    collectiveCode = collectiveCode,
                    date = request.date,
                ),
            )

        val dto = saved.toDto()
        eventPublisher.economyEvent("PANT_ADDED", dto)
        realtimeUpdateService.publish(collectiveCode, "PANT_ADDED", dto)
        return dto
    }

    fun getEconomySummary(
        memberName: String,
        requireCollectiveCodeByMemberName: (String) -> String,
    ): EconomySummaryDto =
        EconomySummaryDto(
            expenses = getExpenses(memberName, requireCollectiveCodeByMemberName),
            balances = getBalances(memberName, requireCollectiveCodeByMemberName),
            pantSummary = getPantSummary(memberName, requireCollectiveCodeByMemberName),
        )

    fun settleUp(
        memberName: String,
        requireCollectiveCodeByMemberName: (String) -> String,
    ): SettleUpResponse {
        val collectiveCode = requireCollectiveCodeByMemberName(memberName)
        val lastExpenseId = expenseRepository.findTopByCollectiveCodeOrderByIdDesc(collectiveCode)?.id ?: 0L

        val checkpoint =
            settlementCheckpointRepository.save(
                SettlementCheckpoint(
                    collectiveCode = collectiveCode,
                    settledBy = memberName,
                    lastExpenseId = lastExpenseId,
                ),
            )

        val payload =
            mapOf(
                "collectiveCode" to collectiveCode,
                "settledBy" to memberName,
                "lastExpenseId" to lastExpenseId,
                "settledAt" to checkpoint.createdAt.toString(),
            )

        eventPublisher.economyEvent("BALANCES_SETTLED", payload)
        realtimeUpdateService.publish(collectiveCode, "BALANCES_SETTLED", payload)

        return SettleUpResponse(
            collectiveCode = collectiveCode,
            settledBy = memberName,
            lastExpenseId = lastExpenseId,
            settledAt = checkpoint.createdAt,
        )
    }

    private fun latestSettledExpenseId(collectiveCode: String): Long =
        settlementCheckpointRepository
            .findTopByCollectiveCodeOrderByIdDesc(collectiveCode)
            ?.lastExpenseId
            ?: 0L

    private fun calculateBalances(
        expenses: List<Expense>,
        members: List<String>,
    ): List<BalanceDto> {
        if (members.isEmpty()) return emptyList()

        val perMember = members.associateWith { 0.0 }.toMutableMap()
        val memberSet = members.toSet()

        expenses.forEach { expense ->
            val participants =
                (
                    if (expense.participantNames.isEmpty()) memberSet else expense.participantNames
                ).intersect(memberSet)

            if (participants.isEmpty()) return@forEach

            val split = expense.amount.toDouble() / participants.size.toDouble()
            participants.forEach { member ->
                perMember[member] = perMember.getValue(member) - split
            }

            perMember[expense.paidBy] = perMember.getOrDefault(expense.paidBy, 0.0) + expense.amount.toDouble()
        }

        return perMember
            .map { (name, amount) -> BalanceDto(name = name, amount = amount.roundToInt()) }
            .sortedByDescending { it.amount }
    }

    private fun Expense.toDto() =
        ExpenseDto(
            id = id,
            description = description,
            amount = amount,
            paidBy = paidBy,
            category = category,
            date = date,
            participantNames = participantNames.sorted(),
        )

    private fun PantEntry.toDto() = PantEntryDto(id, bottles, amount, addedBy, date)
}
