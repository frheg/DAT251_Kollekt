package com.kollekt.api

import com.kollekt.api.dto.AchievementDto
import com.kollekt.api.dto.DashboardResponse
import com.kollekt.api.dto.DrinkingQuestionDto
import com.kollekt.api.dto.LeaderboardResponse
import com.kollekt.service.KollektService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class StatsController(private val service: KollektService) {
        @GetMapping("/dashboard")
        fun getDashboard(
                @RequestParam memberName: String,
                @AuthenticationPrincipal jwt: Jwt,
        ): DashboardResponse {
                requireTokenSubject(jwt, memberName)
                return service.getDashboard(memberName)
        }

        @GetMapping("/leaderboard")
        fun getLeaderboard(
                @RequestParam memberName: String,
                @AuthenticationPrincipal jwt: Jwt,
        ): LeaderboardResponse {
                requireTokenSubject(jwt, memberName)
                return service.getLeaderboard(memberName)
        }

        @GetMapping("/achievements")
        fun getAchievements(): List<AchievementDto> = service.getAchievements()

        @GetMapping("/drinking-game/question")
        fun getQuestion(
                @RequestParam memberName: String,
                @AuthenticationPrincipal jwt: Jwt,
        ): DrinkingQuestionDto {
                requireTokenSubject(jwt, memberName)
                return service.getDrinkingQuestion(memberName)
        }
}
