@file:Suppress("ktlint:standard:no-wildcard-imports")

package com.kollekt.config

import com.kollekt.domain.*
import com.kollekt.repository.AchievementRepository
import org.springframework.boot.CommandLineRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class DataSeeder {
    @Bean
    fun seedData(achievementRepository: AchievementRepository) =
        CommandLineRunner {
            if (achievementRepository.count() == 0L) {
                achievementRepository.saveAll(
                    listOf(
                        Achievement(
                            title = "Tidlig fugl",
                            description = "Fullfør 5 oppgaver før 10:00",
                            icon = "A1",
                            unlocked = true,
                        ),
                        Achievement(
                            title = "Ukestreak",
                            description = "Fullfør oppgaver 7 dager på rad",
                            icon = "A2",
                            unlocked = true,
                        ),
                        Achievement(
                            title = "Vaskekonge",
                            description = "Fullfør 20 vaskeoppgaver",
                            icon = "A3",
                            unlocked = true,
                            progress = 20,
                            total = 20,
                        ),
                        Achievement(
                            title = "Handlehelt",
                            description = "Fullfør 15 handleturer",
                            icon = "A4",
                            unlocked = false,
                            progress = 8,
                            total = 15,
                        ),
                        Achievement(
                            title = "Sosial sjef",
                            description = "Arranger 5 events",
                            icon = "A5",
                            unlocked = false,
                            progress = 3,
                            total = 5,
                        ),
                        Achievement(
                            title = "Økonomiansvarlig",
                            description = "Betal for 10 felles utgifter",
                            icon = "A6",
                            unlocked = false,
                            progress = 6,
                            total = 10,
                        ),
                    ),
                )
            }
        }
}
