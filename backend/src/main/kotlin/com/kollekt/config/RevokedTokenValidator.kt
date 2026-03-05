package com.kollekt.config

import com.kollekt.service.TokenStoreService
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.OAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult
import org.springframework.security.oauth2.jwt.Jwt

class RevokedTokenValidator(
    private val tokenStoreService: TokenStoreService,
) : OAuth2TokenValidator<Jwt> {
    override fun validate(token: Jwt): OAuth2TokenValidatorResult {
        val jti = token.id ?: return OAuth2TokenValidatorResult.success()
        return if (tokenStoreService.isAccessTokenRevoked(jti)) {
            OAuth2TokenValidatorResult.failure(
                OAuth2Error("invalid_token", "Token has been revoked", null),
            )
        } else {
            OAuth2TokenValidatorResult.success()
        }
    }
}
