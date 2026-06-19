package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/**
 * APNs/FCM device token registered by a mobile client, associated with the
 * authenticated member. The token is the natural key so re-registration upserts.
 */
@Entity
@Table(name = "push_device_tokens")
data class PushDeviceToken(
    @Id @Column(name = "token") val token: String = "",
    @Column(name = "member_name", nullable = false) val memberName: String = "",
    @Column(name = "platform", nullable = false) val platform: String = "",
    @Column(name = "updated_at", nullable = false) val updatedAt: Instant = Instant.EPOCH,
)
