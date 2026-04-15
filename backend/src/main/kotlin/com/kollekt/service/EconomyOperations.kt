package com.kollekt.service

import com.kollekt.api.dto.BalanceDto
import com.kollekt.api.dto.CreateExpenseRequest
import com.kollekt.api.dto.CreatePantEntryRequest
import com.kollekt.api.dto.EconomySummaryDto
import com.kollekt.api.dto.ExpenseDto
import com.kollekt.api.dto.PantEntryDto
import com.kollekt.api.dto.PantSummaryDto
import com.kollekt.api.dto.PayOptionDto
import com.kollekt.api.dto.SettleUpResponse
import com.kollekt.api.dto.UpdateExpenseRequest
import com.kollekt.api.dto.UpdatePantEntryRequest
import com.kollekt.domain.Expense
import com.kollekt.domain.PantEntry
import com.kollekt.domain.PersonalSettlement
import com.kollekt.domain.SettlementCheckpoint
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.ExpenseRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.PantEntryRepository
import com.kollekt.repository.PersonalSettlementRepository
import com.kollekt.repository.SettlementCheckpointRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import kotlin.math.roundToInt

@Service
class EconomyOperations(
    private val memberRepository: MemberRepository,
    private val expenseRepository: ExpenseRepository,
    private val settlementCheckpointRepository: SettlementCheckpointRepository,
    private val personalSettlementRepository: PersonalSettlementRepository,
    private val pantEntryRepository: PantEntryRepository,
    private val collectiveRepository: CollectiveRepository,
    private val eventPublisher: IntegrationEventPublisher,
    private val realtimeUpdateService: RealtimeUpdateService,
    private val notificationService: NotificationService,
    private val collectiveAccessService: CollectiveAccessService,
    private val statsCacheService: StatsCacheService,
) {
    fun getExpenses(memberName: String): List<ExpenseDto> {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        return expenseRepository
            .findAllByCollectiveCode(collectiveCode)
            .sortedWith(compareByDescending<Expense> { it.date }.thenByDescending { it.id })
            .map { it.toDto() }
    }

    @Transactional
    fun createExpense(
        request: CreateExpenseRequest,
        actorName: String,
    ): ExpenseDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
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
                    deadlineDate = request.deadlineDate,
                ),
            )

        statsCacheService.clearAllCaches()
        val dto = saved.toDto()
        eventPublisher.economyEvent("EXPENSE_CREATED", dto)
        realtimeUpdateService.publish(collectiveCode, "EXPENSE_CREATED", dto)

        val perPerson = request.amount / participants.size
        val debtors = participants.filter { it != actorName }
        for (debtor in debtors) {
            notificationService.createParameterizedNotification(
                userName = debtor,
                type = "EXPENSE_OWED",
                params =
                    mapOf(
                        "paidBy" to actorName,
                        "description" to request.description,
                        "amount" to "%.0f".format(perPerson.toDouble()),
                    ),
            )
        }

        return dto
    }

    @Transactional
    fun deleteExpense(
        id: Long,
        actorName: String,
    ) {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val expense = expenseRepository.findById(id).orElseThrow { IllegalArgumentException("Expense not found") }
        if (expense.collectiveCode != collectiveCode) throw IllegalArgumentException("Not in your collective")
        if (expense.paidBy != actorName) throw IllegalArgumentException("Only the payer can delete this expense")
        expenseRepository.delete(expense)
        statsCacheService.clearAllCaches()
        realtimeUpdateService.publish(collectiveCode, "EXPENSE_DELETED", mapOf("id" to id))
    }

    @Transactional
    fun updateExpense(
        id: Long,
        request: UpdateExpenseRequest,
        actorName: String,
    ): ExpenseDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val expense = expenseRepository.findById(id).orElseThrow { IllegalArgumentException("Expense not found") }
        if (expense.collectiveCode != collectiveCode) throw IllegalArgumentException("Not in your collective")
        if (expense.paidBy != actorName) throw IllegalArgumentException("Only the payer can edit this expense")
        val updated =
            expenseRepository.save(
                expense.copy(description = request.description, amount = request.amount, category = request.category),
            )
        statsCacheService.clearAllCaches()
        val dto = updated.toDto()
        realtimeUpdateService.publish(collectiveCode, "EXPENSE_UPDATED", dto)
        return dto
    }

    fun getBalances(memberName: String): List<BalanceDto> {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val allExpenses = expenseRepository.findAllByCollectiveCode(collectiveCode)

        if (allExpenses.isEmpty()) return emptyList()

        val members = memberRepository.findAllByCollectiveCode(collectiveCode).map { it.name }
        val memberCheckpoints =
            members.associateWith { member ->
                latestSettledExpenseIdForMember(collectiveCode, member)
            }
        val personalSettlements = personalSettlementRepository.findAllByCollectiveCode(collectiveCode)
        return calculateBalances(allExpenses, members, memberCheckpoints, personalSettlements)
    }

    fun getPantSummary(memberName: String): PantSummaryDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val collective = collectiveRepository.findByJoinCode(collectiveCode)
        val entries =
            pantEntryRepository
                .findAllByCollectiveCode(collectiveCode)
                .sortedWith(compareByDescending<PantEntry> { it.date }.thenByDescending { it.id })
                .map { it.toDto() }

        return PantSummaryDto(
            currentAmount = entries.sumOf { it.amount },
            goalAmount = collective?.pantGoal ?: 1000,
            entries = entries,
        )
    }

    fun getPayOptions(memberName: String): List<PayOptionDto> {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val allExpenses = expenseRepository.findAllByCollectiveCode(collectiveCode)
        if (allExpenses.isEmpty()) return emptyList()

        val members = memberRepository.findAllByCollectiveCode(collectiveCode).map { it.name }
        val memberSet = members.toSet()
        val payerCheckpoint = latestSettledExpenseIdForMember(collectiveCode, memberName)
        val personalSettlements = personalSettlementRepository.findAllByCollectiveCode(collectiveCode)

        return members
            .asSequence()
            .filter { it != memberName }
            .mapNotNull { creditorName ->
                val creditorCheckpoint = latestSettledExpenseIdForMember(collectiveCode, creditorName)
                val bilateralDebt =
                    calculateBilateralDebt(
                        allExpenses,
                        memberName,
                        creditorName,
                        memberSet,
                        payerCheckpoint,
                        creditorCheckpoint,
                    )
                val alreadyPaidByPayer =
                    personalSettlements
                        .asSequence()
                        .filter { it.paidBy == memberName && it.paidTo == creditorName }
                        .sumOf { it.amount }
                val alreadyPaidByCreditor =
                    personalSettlements
                        .asSequence()
                        .filter { it.paidBy == creditorName && it.paidTo == memberName }
                        .sumOf { it.amount }
                val netOwed = (bilateralDebt - alreadyPaidByPayer + alreadyPaidByCreditor).coerceAtLeast(0)

                if (netOwed > 0) PayOptionDto(name = creditorName, amount = netOwed) else null
            }.sortedByDescending { it.amount }
            .toList()
    }

    @Transactional
    fun updatePantGoal(
        memberName: String,
        goal: Int,
    ) {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val collective =
            collectiveRepository.findByJoinCode(collectiveCode)
                ?: throw IllegalStateException("Collective not found")
        collectiveRepository.save(collective.copy(pantGoal = goal))
    }

    @Transactional
    fun addPantEntry(
        request: CreatePantEntryRequest,
        actorName: String,
    ): PantEntryDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
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

    @Transactional
    fun deletePantEntry(
        id: Long,
        actorName: String,
    ) {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val entry = pantEntryRepository.findById(id).orElseThrow { IllegalArgumentException("Pant entry not found") }
        if (entry.collectiveCode != collectiveCode) throw IllegalArgumentException("Not in your collective")
        if (entry.addedBy != actorName) throw IllegalArgumentException("Only the person who added this entry can delete it")
        pantEntryRepository.delete(entry)
        statsCacheService.clearAllCaches()
        realtimeUpdateService.publish(collectiveCode, "PANT_DELETED", mapOf("id" to id))
    }

    @Transactional
    fun updatePantEntry(
        id: Long,
        request: UpdatePantEntryRequest,
        actorName: String,
    ): PantEntryDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val entry = pantEntryRepository.findById(id).orElseThrow { IllegalArgumentException("Pant entry not found") }
        if (entry.collectiveCode != collectiveCode) throw IllegalArgumentException("Not in your collective")
        if (entry.addedBy != actorName) throw IllegalArgumentException("Only the person who added this entry can edit it")
        val updated = pantEntryRepository.save(entry.copy(bottles = request.bottles, amount = request.amount))
        statsCacheService.clearAllCaches()
        val dto = updated.toDto()
        realtimeUpdateService.publish(collectiveCode, "PANT_UPDATED", dto)
        return dto
    }

    fun getEconomySummary(memberName: String): EconomySummaryDto =
        EconomySummaryDto(
            expenses = getExpenses(memberName),
            balances = getBalances(memberName),
            pantSummary = getPantSummary(memberName),
        )

    @Transactional
    fun settleUp(memberName: String): SettleUpResponse {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val lastExpenseId = expenseRepository.findTopByCollectiveCodeOrderByIdDesc(collectiveCode)?.id ?: 0L

        // Clear personal settlements so the checkpoint is the single source of truth
        personalSettlementRepository.deleteAllByCollectiveCodeAndPaidBy(collectiveCode, memberName)

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

    @Transactional
    fun settleWith(
        payerName: String,
        creditorName: String,
    ) {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(payerName)
        val allExpenses = expenseRepository.findAllByCollectiveCode(collectiveCode)
        val members = memberRepository.findAllByCollectiveCode(collectiveCode).map { it.name }.toSet()

        val payerCheckpoint = latestSettledExpenseIdForMember(collectiveCode, payerName)
        val creditorCheckpoint = latestSettledExpenseIdForMember(collectiveCode, creditorName)

        val alreadyPaidByPayer =
            personalSettlementRepository
                .findAllByCollectiveCodeAndPaidByAndPaidTo(collectiveCode, payerName, creditorName)
                .sumOf { it.amount }
        val alreadyPaidByCreditor =
            personalSettlementRepository
                .findAllByCollectiveCodeAndPaidByAndPaidTo(collectiveCode, creditorName, payerName)
                .sumOf { it.amount }

        val bilateralDebt =
            calculateBilateralDebt(allExpenses, payerName, creditorName, members, payerCheckpoint, creditorCheckpoint)
        val netOwed = (bilateralDebt - alreadyPaidByPayer + alreadyPaidByCreditor).coerceAtLeast(0)

        if (netOwed <= 0) return

        personalSettlementRepository.save(
            PersonalSettlement(
                collectiveCode = collectiveCode,
                paidBy = payerName,
                paidTo = creditorName,
                amount = netOwed,
            ),
        )

        val payload = mapOf("paidBy" to payerName, "paidTo" to creditorName, "amount" to netOwed)
        realtimeUpdateService.publish(collectiveCode, "BALANCES_SETTLED", payload)
    }

    fun notifyUpcomingExpenseDeadlines() {
        val tomorrow = LocalDate.now().plusDays(1)
        val expenses = expenseRepository.findAllByDeadlineDate(tomorrow)
        for (expense in expenses) {
            val debtors = expense.participantNames.filter { it != expense.paidBy }
            for (debtor in debtors) {
                notificationService.createParameterizedNotification(
                    userName = debtor,
                    type = "EXPENSE_DEADLINE_SOON",
                    params = mapOf("description" to expense.description, "date" to expense.deadlineDate.toString()),
                )
            }
        }
    }

    fun notifyExpiredExpenseDeadlines() {
        val today = LocalDate.now()
        val expenses = expenseRepository.findAllByDeadlineDate(today)
        for (expense in expenses) {
            val debtors = expense.participantNames.filter { it != expense.paidBy }
            for (debtor in debtors) {
                notificationService.createParameterizedNotification(
                    userName = debtor,
                    type = "EXPENSE_OVERDUE",
                    params = mapOf("description" to expense.description, "date" to expense.deadlineDate.toString()),
                )
            }
        }
    }

    private fun latestSettledExpenseIdForMember(
        collectiveCode: String,
        memberName: String,
    ): Long =
        settlementCheckpointRepository
            .findTopByCollectiveCodeAndSettledByOrderByIdDesc(collectiveCode, memberName)
            ?.lastExpenseId
            ?: 0L

    private fun calculateBalances(
        expenses: List<Expense>,
        members: List<String>,
        memberCheckpoints: Map<String, Long> = emptyMap(),
        personalSettlements: List<PersonalSettlement> = emptyList(),
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
                val checkpoint = memberCheckpoints[member] ?: 0L
                if (expense.id > checkpoint) {
                    perMember[member] = perMember.getValue(member) - split
                    perMember[expense.paidBy] = perMember.getOrDefault(expense.paidBy, 0.0) + split
                }
            }
        }

        personalSettlements.forEach { settlement ->
            perMember[settlement.paidBy] = perMember.getOrDefault(settlement.paidBy, 0.0) + settlement.amount
            perMember[settlement.paidTo] = perMember.getOrDefault(settlement.paidTo, 0.0) - settlement.amount
        }

        return perMember
            .map { (name, amount) -> BalanceDto(name = name, amount = amount.roundToInt()) }
            .sortedByDescending { it.amount }
    }

    private fun calculateBilateralDebt(
        expenses: List<Expense>,
        debtor: String,
        creditor: String,
        allMembers: Set<String>,
        debtorCheckpoint: Long,
        creditorCheckpoint: Long,
    ): Int {
        var debtorOwesCreditor = 0.0
        var creditorOwesDebtor = 0.0

        expenses.forEach { expense ->
            val participants =
                (
                    if (expense.participantNames.isEmpty()) allMembers else expense.participantNames
                ).intersect(allMembers)

            if (participants.isEmpty()) return@forEach

            val split = expense.amount.toDouble() / participants.size

            if (expense.paidBy == creditor && debtor in participants && expense.id > debtorCheckpoint) {
                debtorOwesCreditor += split
            }

            if (expense.paidBy == debtor && creditor in participants && expense.id > creditorCheckpoint) {
                creditorOwesDebtor += split
            }
        }

        return (debtorOwesCreditor - creditorOwesDebtor).roundToInt().coerceAtLeast(0)
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
            deadlineDate = deadlineDate,
        )

    private fun PantEntry.toDto() = PantEntryDto(id, bottles, amount, addedBy, date)
}
