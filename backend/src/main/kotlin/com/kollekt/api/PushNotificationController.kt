package com.kollekt.api

import com.kollekt.domain.PushDeviceToken
import com.kollekt.repository.PushDeviceTokenRepository
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

@RestController
@RequestMapping("/api/push")
class PushNotificationController(
    private val pushDeviceTokenRepository: PushDeviceTokenRepository,
) {
    data class DeviceTokenRequest(
        val token: String,
        val platform: String,
    )

    @PostMapping("/device-token")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun registerDeviceToken(
        @RequestBody request: DeviceTokenRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        require(request.token.isNotBlank() && request.platform.isNotBlank())
        pushDeviceTokenRepository.save(
            PushDeviceToken(
                token = request.token,
                memberName = jwt.subject,
                platform = request.platform,
                updatedAt = Instant.now(),
            ),
        )
    }

    @DeleteMapping("/device-token")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun removeDeviceToken(
        @RequestParam token: String,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        pushDeviceTokenRepository.findById(token).ifPresent { entry ->
            if (entry.memberName == jwt.subject) {
                pushDeviceTokenRepository.delete(entry)
            }
        }
    }
}
