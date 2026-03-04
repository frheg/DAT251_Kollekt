plugins {
    kotlin("jvm") version "1.9.25"
    kotlin("plugin.spring") version "1.9.25"
    kotlin("plugin.jpa") version "1.9.25"
    id("org.springframework.boot") version "3.4.4"
    id("io.spring.dependency-management") version "1.1.7"
    jacoco
}

group = "com.kollekt"
version = "0.1.0"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-data-redis")
    implementation("org.springframework.kafka:spring-kafka")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlin:kotlin-reflect")

    runtimeOnly("org.postgresql:postgresql")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.2.1")
    testImplementation("org.springframework.kafka:spring-kafka-test")
    testImplementation("com.h2database:h2")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

kotlin {
    compilerOptions {
        freeCompilerArgs.addAll("-Xjsr305=strict")
    }
}

tasks.withType<Test> {
    useJUnitPlatform()

    // Some dependencies (notably kafka test jars) include junit-platform.properties on the classpath.
    // Force deterministic, single-threaded execution to avoid CI-only flakiness.
    systemProperty("junit.jupiter.execution.parallel.enabled", "false")
    systemProperty("junit.jupiter.execution.parallel.mode.default", "same_thread")
    systemProperty("junit.jupiter.execution.parallel.mode.classes.default", "same_thread")
    maxParallelForks = 1

    val isCi = System.getenv("CI")?.toBoolean() == true
    testLogging {
        events("FAILED")
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
        showStandardStreams = isCi
    }
}

jacoco {
    toolVersion = "0.8.12"
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)
    classDirectories.setFrom(
        files(
            classDirectories.files.map {
                fileTree(it) {
                    exclude(
                        "**/com/kollekt/domain/**",
                        "**/com/kollekt/repository/**",
                        "**/com/kollekt/api/**",
                        "**/com/kollekt/config/**",
                        "**/com/kollekt/KollektApplication*",
                    )
                }
            },
        ),
    )
    reports {
        xml.required.set(true)
        html.required.set(true)
        csv.required.set(false)
    }
}

tasks.jacocoTestCoverageVerification {
    dependsOn(tasks.test)
    classDirectories.setFrom(tasks.jacocoTestReport.get().classDirectories)
    violationRules {
        rule {
            limit {
                counter = "LINE"
                value = "COVEREDRATIO"
                minimum = "0.60".toBigDecimal()
            }
        }
    }
}

tasks.check {
    dependsOn(tasks.jacocoTestCoverageVerification)
}

tasks.test {
    finalizedBy(tasks.jacocoTestReport)
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
    kotlinOptions.jvmTarget = "21"
}
