package com.kollekt.config

import com.kollekt.domain.*
import com.kollekt.repository.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import org.springframework.boot.CommandLineRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class DataSeeder {
    @Bean
    fun seedData(
            memberRepository: MemberRepository,
            taskRepository: TaskRepository,
            shoppingItemRepository: ShoppingItemRepository,
            eventRepository: EventRepository,
            chatMessageRepository: ChatMessageRepository,
            expenseRepository: ExpenseRepository,
            pantEntryRepository: PantEntryRepository,
            achievementRepository: AchievementRepository,
    ) = CommandLineRunner {
        if (memberRepository.count() == 0L) {
            memberRepository.saveAll(
                    listOf(
                            Member(name = "Emma", level = 15, xp = 3240),
                            Member(name = "Kasper", level = 12, xp = 2450),
                            Member(name = "Fredric", level = 11, xp = 2180),
                            Member(name = "Lars", level = 10, xp = 1950),
                            Member(name = "Sofia", level = 9, xp = 1720),
                            Member(name = "Marcus", level = 8, xp = 1480),
                            Member(name = "Lina", level = 7, xp = 1250),
                            Member(name = "Erik", level = 6, xp = 980),
                    ),
            )
        }

        if (taskRepository.count() == 0L) {
            taskRepository.saveAll(
                    listOf(
                            TaskItem(
                                    title = "Vaske bad",
                                    assignee = "Kasper",
                                    dueDate = LocalDate.now(),
                                    category = TaskCategory.CLEANING,
                                    completed = false,
                                    xp = 50,
                                    recurring = true
                            ),
                            TaskItem(
                                    title = "Tømme søppel",
                                    assignee = "Kasper",
                                    dueDate = LocalDate.now(),
                                    category = TaskCategory.CLEANING,
                                    completed = false,
                                    xp = 30,
                                    recurring = false
                            ),
                            TaskItem(
                                    title = "Handle dopapir",
                                    assignee = "Fredric",
                                    dueDate = LocalDate.now().plusDays(1),
                                    category = TaskCategory.SHOPPING,
                                    completed = false,
                                    xp = 20,
                                    recurring = false
                            ),
                            TaskItem(
                                    title = "Støvsuge fellesareal",
                                    assignee = "Emma",
                                    dueDate = LocalDate.now().plusDays(2),
                                    category = TaskCategory.CLEANING,
                                    completed = false,
                                    xp = 40,
                                    recurring = true
                            ),
                            TaskItem(
                                    title = "Vaske kjøkken",
                                    assignee = "Lars",
                                    dueDate = LocalDate.now().minusDays(1),
                                    category = TaskCategory.CLEANING,
                                    completed = true,
                                    xp = 50,
                                    recurring = true
                            ),
                    ),
            )
        }

        if (shoppingItemRepository.count() == 0L) {
            shoppingItemRepository.saveAll(
                    listOf(
                            ShoppingItem(item = "Dopapir", addedBy = "Kasper", completed = false),
                            ShoppingItem(item = "Kluter", addedBy = "Emma", completed = false),
                            ShoppingItem(
                                    item = "Oppvaskmiddel",
                                    addedBy = "Fredric",
                                    completed = true
                            ),
                    ),
            )
        }

        if (eventRepository.count() == 0L) {
            eventRepository.saveAll(
                    listOf(
                            CalendarEvent(
                                    title = "Filmkveld",
                                    date = LocalDate.now().plusDays(1),
                                    time = LocalTime.of(19, 0),
                                    type = EventType.MOVIE,
                                    organizer = "Emma",
                                    attendees = 5
                            ),
                            CalendarEvent(
                                    title = "Vors",
                                    date = LocalDate.now().plusDays(3),
                                    time = LocalTime.of(21, 0),
                                    type = EventType.PARTY,
                                    organizer = "Kasper",
                                    attendees = 8
                            ),
                            CalendarEvent(
                                    title = "Pizza & Gaming",
                                    date = LocalDate.now().plusDays(6),
                                    time = LocalTime.of(18, 0),
                                    type = EventType.DINNER,
                                    organizer = "Fredric",
                                    attendees = 4
                            ),
                    ),
            )
        }

        if (chatMessageRepository.count() == 0L) {
            chatMessageRepository.saveAll(
                    listOf(
                            ChatMessage(
                                    sender = "Fredric",
                                    text = "Hei! Noen som vil ha filmkveld på onsdag?",
                                    timestamp = LocalDateTime.now().minusHours(2)
                            ),
                            ChatMessage(
                                    sender = "Emma",
                                    text = "Ja! Hva skal vi se?",
                                    timestamp = LocalDateTime.now().minusHours(2).plusMinutes(2)
                            ),
                            ChatMessage(
                                    sender = "Lars",
                                    text = "Stemmer for Dune 2!",
                                    timestamp = LocalDateTime.now().minusHours(1).plusMinutes(5)
                            ),
                    ),
            )
        }

        if (expenseRepository.count() == 0L) {
            expenseRepository.saveAll(
                    listOf(
                            Expense(
                                    description = "Dopapir & kluter",
                                    amount = 156,
                                    paidBy = "Fredric",
                                    category = "Husholdning",
                                    date = LocalDate.now().minusDays(1),
                                    splitBetween = 8
                            ),
                            Expense(
                                    description = "Pizza til filmkveld",
                                    amount = 320,
                                    paidBy = "Kasper",
                                    category = "Mat",
                                    date = LocalDate.now().minusDays(2),
                                    splitBetween = 5
                            ),
                            Expense(
                                    description = "Oppvaskmiddel & rengjøring",
                                    amount = 245,
                                    paidBy = "Emma",
                                    category = "Husholdning",
                                    date = LocalDate.now().minusDays(3),
                                    splitBetween = 8
                            ),
                            Expense(
                                    description = "Kaffe til fellesskap",
                                    amount = 189,
                                    paidBy = "Lars",
                                    category = "Mat",
                                    date = LocalDate.now().minusDays(4),
                                    splitBetween = 8
                            ),
                    ),
            )
        }

        if (pantEntryRepository.count() == 0L) {
            pantEntryRepository.saveAll(
                    listOf(
                            PantEntry(
                                    bottles = 15,
                                    amount = 45,
                                    addedBy = "Fredric",
                                    date = LocalDate.now().minusDays(1)
                            ),
                            PantEntry(
                                    bottles = 22,
                                    amount = 66,
                                    addedBy = "Emma",
                                    date = LocalDate.now().minusDays(3)
                            ),
                            PantEntry(
                                    bottles = 8,
                                    amount = 24,
                                    addedBy = "Kasper",
                                    date = LocalDate.now().minusDays(5)
                            ),
                    ),
            )
        }

        if (achievementRepository.count() == 0L) {
            achievementRepository.saveAll(
                    listOf(
                            Achievement(
                                    title = "Tidlig fugl",
                                    description = "Fullfør 5 oppgaver før 10:00",
                                    icon = "A1",
                                    unlocked = true
                            ),
                            Achievement(
                                    title = "Ukestreak",
                                    description = "Fullfør oppgaver 7 dager på rad",
                                    icon = "A2",
                                    unlocked = true
                            ),
                            Achievement(
                                    title = "Vaskekonge",
                                    description = "Fullfør 20 vaskeoppgaver",
                                    icon = "A3",
                                    unlocked = true,
                                    progress = 20,
                                    total = 20
                            ),
                            Achievement(
                                    title = "Handlehelt",
                                    description = "Fullfør 15 handleturer",
                                    icon = "A4",
                                    unlocked = false,
                                    progress = 8,
                                    total = 15
                            ),
                            Achievement(
                                    title = "Sosial sjef",
                                    description = "Arranger 5 events",
                                    icon = "A5",
                                    unlocked = false,
                                    progress = 3,
                                    total = 5
                            ),
                            Achievement(
                                    title = "Økonomiansvarlig",
                                    description = "Betal for 10 felles utgifter",
                                    icon = "A6",
                                    unlocked = false,
                                    progress = 6,
                                    total = 10
                            ),
                    ),
            )
        }
    }
}
