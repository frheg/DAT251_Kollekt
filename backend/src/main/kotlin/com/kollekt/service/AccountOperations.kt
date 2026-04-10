package com.kollekt.service

import com.kollekt.api.dto.AuthResponse
import com.kollekt.api.dto.CreateUserRequest
import com.kollekt.api.dto.LoginRequest
import com.kollekt.api.dto.RefreshTokenRequest
import com.kollekt.api.dto.UserDto
import com.kollekt.domain.Member
import com.kollekt.repository.MemberRepository
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service

@Service
class AccountOperations(
    private val memberRepository: MemberRepository,
    private val passwordEncoder: PasswordEncoder,
    private val tokenService: TokenService,
) {
    fun createUser(
        request: CreateUserRequest,
        clearCaches: () -> Unit,
        memberToUserDto: (Member) -> UserDto,
    ): AuthResponse {
        val name = request.name.trim()
        val email = request.email.trim().lowercase()
        val password = request.password.trim()

        if (name.isBlank()) throw IllegalArgumentException("Name is required")
        if (email.isBlank()) throw IllegalArgumentException("Email is required")
        if (password.length < 8) throw IllegalArgumentException("Password must be at least 8 characters")

        if (memberRepository.findByName(name) != null) {
            throw IllegalArgumentException("User with name '$name' already exists")
        }

        if (memberRepository.findByEmail(email) != null) {
            throw IllegalArgumentException("User with email '$email' already exists")
        }

        val saved =
            memberRepository.save(
                Member(
                    name = name,
                    email = email,
                    passwordHash = passwordEncoder.encode(password),
                ),
            )

        clearCaches()
        return toAuthResponse(saved, memberToUserDto)
    }

    fun resetPassword(
        memberName: String?,
        email: String?,
        newPassword: String,
    ) {
        val member =
            when {
                !email.isNullOrBlank() -> memberRepository.findByEmail(email.trim().lowercase())
                !memberName.isNullOrBlank() -> memberRepository.findByName(memberName.trim())
                else -> null
            } ?: throw IllegalArgumentException("User not found")

        memberRepository.save(member.copy(passwordHash = passwordEncoder.encode(newPassword)))
    }

    fun login(
        request: LoginRequest,
        memberToUserDto: (Member) -> UserDto,
    ): AuthResponse {
        val name = request.name.trim()
        val password = request.password.trim()

        if (name.isBlank()) throw IllegalArgumentException("Name is required")
        if (password.isBlank()) throw IllegalArgumentException("Password is required")

        val user =
            memberRepository.findByName(name)
                ?: throw IllegalArgumentException("User '$name' not found")

        val hash =
            user.passwordHash
                ?: throw IllegalArgumentException("User '$name' has no password configured")

        if (!passwordEncoder.matches(password, hash)) {
            throw IllegalArgumentException("Invalid name or password")
        }

        return toAuthResponse(user, memberToUserDto)
    }

    fun getUserByName(
        name: String,
        memberToUserDto: (Member) -> UserDto,
    ): UserDto {
        val user =
            memberRepository.findByName(name)
                ?: throw IllegalArgumentException("User '$name' not found")
        return memberToUserDto(user)
    }

    fun refreshToken(
        request: RefreshTokenRequest,
        memberToUserDto: (Member) -> UserDto,
    ): AuthResponse {
        val refreshResult = tokenService.rotateRefreshToken(request.refreshToken)
        val user =
            memberRepository.findByName(refreshResult.subject)
                ?: throw IllegalArgumentException("User '${refreshResult.subject}' not found")
        return toAuthResponse(user, memberToUserDto)
    }

    fun logout(
        accessTokenJwt: Jwt,
        refreshToken: String?,
    ) {
        tokenService.revokeAccessToken(accessTokenJwt)
        if (!refreshToken.isNullOrBlank()) {
            tokenService.revokeRefreshToken(refreshToken)
        }
    }

    private fun toAuthResponse(
        member: Member,
        memberToUserDto: (Member) -> UserDto,
    ): AuthResponse {
        val token = tokenService.issueTokenPair(member)
        return AuthResponse(
            accessToken = token.accessToken,
            refreshToken = token.refreshToken,
            tokenType = token.tokenType,
            expiresIn = token.expiresIn,
            user = memberToUserDto(member),
        )
    }
}
