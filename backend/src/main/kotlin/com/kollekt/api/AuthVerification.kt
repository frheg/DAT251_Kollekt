package com.kollekt.api

import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt

fun requireTokenSubject(jwt: Jwt, memberName: String) {
    if (jwt.subject != memberName) {
        throw AccessDeniedException("Token subject does not match requested member")
    }
}
