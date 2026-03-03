package com.kollekt

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication class KollektApplication

fun main(args: Array<String>) {
    runApplication<KollektApplication>(*args)
}
