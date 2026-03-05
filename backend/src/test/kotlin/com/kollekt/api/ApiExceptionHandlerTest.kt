@file:Suppress("ktlint:standard:no-wildcard-imports")

package com.kollekt.api

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus

class ApiExceptionHandlerTest {
    private val handler = ApiExceptionHandler()

    @Test
    fun `illegal argument maps to 400 with message`() {
        val response = handler.handleIllegalArgument(IllegalArgumentException("Bad input"))

        assertEquals(HttpStatus.BAD_REQUEST, response.statusCode)
        assertEquals(mapOf("error" to "Bad input"), response.body)
    }

    @Test
    fun `illegal argument maps to default message when null`() {
        val response = handler.handleIllegalArgument(IllegalArgumentException())

        assertEquals(HttpStatus.BAD_REQUEST, response.statusCode)
        assertEquals(mapOf("error" to "Bad request"), response.body)
    }

    @Test
    fun `general exception maps to 500`() {
        val response = handler.handleGeneral(RuntimeException("Boom"))

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.statusCode)
        assertEquals(mapOf("error" to "Boom"), response.body)
    }
}
