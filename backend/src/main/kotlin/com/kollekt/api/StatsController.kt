package com.kollekt.api

import com.kollekt.api.dto.AchievementDto
import com.kollekt.api.dto.DashboardResponse
import com.kollekt.api.dto.DrinkingQuestionDto
import com.kollekt.api.dto.LeaderboardPeriod
import com.kollekt.api.dto.LeaderboardResponse
import com.kollekt.api.dto.MonthlyPrizeRequest
import com.kollekt.service.StatsService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class StatsController(
    private val statsService: StatsService,
) {
    @GetMapping("/dashboard")
    fun getDashboard(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): DashboardResponse {
        requireTokenSubject(jwt, memberName)
        return statsService.getDashboard(memberName)
    }

    @GetMapping("/leaderboard")
    fun getLeaderboard(
        @RequestParam memberName: String,
        @RequestParam(defaultValue = "OVERALL") period: LeaderboardPeriod,
        @AuthenticationPrincipal jwt: Jwt,
    ): LeaderboardResponse {
        requireTokenSubject(jwt, memberName)
        return statsService.getLeaderboard(memberName, period)
    }

    @GetMapping("/monthly-prize")
    fun getMonthlyPrize(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): String? {
        requireTokenSubject(jwt, memberName)
        return statsService.getMonthlyPrize(memberName)
    }

    @PostMapping("/monthly-prize")
    fun setMonthlyPrize(
        @RequestParam memberName: String,
        @RequestBody request: MonthlyPrizeRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        requireTokenSubject(jwt, memberName)
        statsService.setMonthlyPrize(memberName, request.prize)
    }

    @GetMapping("/achievements")
    fun getAchievements(): List<AchievementDto> = statsService.getAchievements()

    @GetMapping("/drinking-game/question")
    fun getQuestion(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): DrinkingQuestionDto {
        requireTokenSubject(jwt, memberName)
        return statsService.getDrinkingQuestion(memberName)
    }
}
