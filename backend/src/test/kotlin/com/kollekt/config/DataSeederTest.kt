package com.kollekt.config

import com.kollekt.domain.Achievement
import com.kollekt.repository.AchievementRepository
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

@ExtendWith(MockitoExtension::class)
class DataSeederTest {
    @Mock lateinit var achievementRepository: AchievementRepository

    @Test
    fun `does not seed when data already exists`() {
        whenever(achievementRepository.count()).thenReturn(1L)

        val runner =
            DataSeeder().seedData(achievementRepository)

        runner.run()

        verify(achievementRepository, never()).saveAll(org.mockito.kotlin.any<Iterable<Achievement>>())
    }

    @Test
    fun `seeds achievements when none exist`() {
        whenever(achievementRepository.count()).thenReturn(0L)

        val runner =
            DataSeeder().seedData(achievementRepository)

        runner.run()

        verify(achievementRepository).saveAll(org.mockito.kotlin.any<Iterable<Achievement>>())
    }
}
