package com.kollekt.service

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.kollekt.api.dto.CreateMessageRequest
import com.kollekt.api.dto.CreatePollRequest
import com.kollekt.api.dto.MessageDto
import com.kollekt.api.dto.PollDto
import com.kollekt.api.dto.PollOptionDto
import com.kollekt.api.dto.ReactionDto
import com.kollekt.domain.ChatMessage
import com.kollekt.domain.MemberStatus
import com.kollekt.repository.ChatMessageRepository
import com.kollekt.repository.MemberRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.time.LocalDateTime
import java.util.Base64

@Service
class ChatOperations(
    private val chatMessageRepository: ChatMessageRepository,
    private val memberRepository: MemberRepository,
    private val eventPublisher: IntegrationEventPublisher,
    private val realtimeUpdateService: RealtimeUpdateService,
    private val notificationService: NotificationService,
    private val collectiveAccessService: CollectiveAccessService,
) {
    private val objectMapper = jacksonObjectMapper()
    private val allowedReactionEmojis = setOf("👍", "❤️", "😂", "🎉", "😮")
    private val maxChatImageBytes = 5 * 1024 * 1024L

    fun getMessages(memberName: String): List<MessageDto> {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        return chatMessageRepository
            .findAllByCollectiveCode(collectiveCode)
            .sortedBy { it.timestamp }
            .map { it.toDto() }
    }

    @Transactional
    fun createMessage(
        request: CreateMessageRequest,
        actorName: String,
    ): MessageDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val normalizedText = request.text.trim()
        require(normalizedText.isNotBlank()) { "Message text is required" }
        val saved =
            chatMessageRepository.save(
                ChatMessage(
                    sender = actorName,
                    collectiveCode = collectiveCode,
                    text = normalizedText,
                    timestamp = LocalDateTime.now(),
                ),
            )

        val dto = saved.toDto()
        eventPublisher.chatEvent("MESSAGE_CREATED", dto)
        realtimeUpdateService.publish(collectiveCode, "MESSAGE_CREATED", dto)
        notifyOtherMembers(collectiveCode, actorName, normalizedText, "NEW_MESSAGE")
        return dto
    }

    @Transactional
    fun createImageMessage(
        image: MultipartFile,
        caption: String?,
        actorName: String,
    ): MessageDto {
        require(!image.isEmpty) { "Image is required" }
        val contentType =
            image.contentType
                ?.trim()
                .orEmpty()
                .lowercase()
        require(contentType.startsWith("image/")) { "Only image uploads are supported" }
        require(image.size <= maxChatImageBytes) { "Image is too large (max 5 MB)" }

        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val normalizedCaption = caption?.trim().orEmpty()
        val payload = Base64.getEncoder().encodeToString(image.bytes)

        val saved =
            chatMessageRepository.save(
                ChatMessage(
                    sender = actorName,
                    collectiveCode = collectiveCode,
                    text = normalizedCaption,
                    imageData = payload,
                    imageMimeType = contentType,
                    imageFileName = image.originalFilename?.take(255),
                    timestamp = LocalDateTime.now(),
                ),
            )

        val dto = saved.toDto()
        eventPublisher.chatEvent("MESSAGE_CREATED", dto)
        realtimeUpdateService.publish(collectiveCode, "MESSAGE_CREATED", dto)
        val previewText = if (normalizedCaption.isNotBlank()) normalizedCaption else "[Image]"
        notifyOtherMembers(collectiveCode, actorName, previewText, "NEW_MESSAGE")
        return dto
    }

    @Transactional
    fun addReaction(
        messageId: Long,
        emoji: String,
        actorName: String,
    ): MessageDto {
        require(emoji in allowedReactionEmojis) { "Unsupported reaction" }

        val message =
            chatMessageRepository
                .findById(messageId)
                .orElseThrow { IllegalArgumentException("Message not found") }

        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        require(message.collectiveCode == collectiveCode) { "Message not found" }

        val reactions =
            message
                .reactionMap()
                .mapValues { (_, users) -> users.toMutableSet() }
                .toMutableMap()

        reactions.values.forEach { users -> users.remove(actorName) }
        reactions.entries.removeIf { (_, users) -> users.isEmpty() }

        val users = reactions.getOrPut(emoji) { mutableSetOf() }
        users.add(actorName)

        val updated =
            chatMessageRepository.save(
                message.copy(reactions = objectMapper.writeValueAsString(reactions.toJsonMap())),
            )

        val dto = updated.toDto()
        realtimeUpdateService.publish(collectiveCode, "MESSAGE_REACTION_UPDATED", dto)
        return dto
    }

    @Transactional
    fun removeReaction(
        messageId: Long,
        emoji: String,
        actorName: String,
    ): MessageDto {
        require(emoji in allowedReactionEmojis) { "Unsupported reaction" }

        val message =
            chatMessageRepository
                .findById(messageId)
                .orElseThrow { IllegalArgumentException("Message not found") }

        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        require(message.collectiveCode == collectiveCode) { "Message not found" }

        val reactions = message.reactionMap().toMutableMap()
        val users = reactions[emoji]?.toMutableSet() ?: mutableSetOf()
        users.remove(actorName)

        if (users.isEmpty()) {
            reactions.remove(emoji)
        } else {
            reactions[emoji] = users
        }

        val updated =
            chatMessageRepository.save(
                message.copy(reactions = objectMapper.writeValueAsString(reactions.toJsonMap())),
            )

        val dto = updated.toDto()
        realtimeUpdateService.publish(collectiveCode, "MESSAGE_REACTION_UPDATED", dto)
        return dto
    }

    @Transactional
    fun createPoll(
        request: CreatePollRequest,
        actorName: String,
    ): MessageDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)

        val question = request.question.trim()
        require(question.isNotBlank()) { "Poll question is required" }

        val options =
            request.options
                .map { it.trim() }
                .filter { it.isNotBlank() }
                .distinct()
        require(options.size in 2..6) { "Poll must have between 2 and 6 unique options" }

        val payload =
            PollPayload(
                question = question,
                options =
                    options.mapIndexed { index, text ->
                        PollOptionPayload(id = index, text = text, users = emptyList())
                    },
            )

        val saved =
            chatMessageRepository.save(
                ChatMessage(
                    sender = actorName,
                    collectiveCode = collectiveCode,
                    text = "📊 $question",
                    timestamp = LocalDateTime.now(),
                    poll = objectMapper.writeValueAsString(payload),
                ),
            )

        val dto = saved.toDto()
        eventPublisher.chatEvent("MESSAGE_CREATED", dto)
        realtimeUpdateService.publish(collectiveCode, "MESSAGE_CREATED", dto)
        notifyOtherMembers(collectiveCode, actorName, "📊 $question", "NEW_MESSAGE")
        return dto
    }

    @Transactional
    fun votePoll(
        messageId: Long,
        optionId: Int,
        actorName: String,
    ): MessageDto {
        val message =
            chatMessageRepository
                .findById(messageId)
                .orElseThrow { IllegalArgumentException("Message not found") }

        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        require(message.collectiveCode == collectiveCode) { "Message not found" }

        val poll = message.pollPayload() ?: throw IllegalArgumentException("Message is not a poll")
        require(poll.options.any { it.id == optionId }) { "Invalid poll option" }

        val updatedOptions =
            poll.options.map { option ->
                val usersWithoutActor = option.users.filter { it != actorName }
                if (option.id == optionId) {
                    option.copy(users = (usersWithoutActor + actorName).distinct().sorted())
                } else {
                    option.copy(users = usersWithoutActor.sorted())
                }
            }

        val updated =
            chatMessageRepository.save(
                message.copy(
                    poll = objectMapper.writeValueAsString(poll.copy(options = updatedOptions)),
                ),
            )

        val dto = updated.toDto()
        realtimeUpdateService.publish(collectiveCode, "MESSAGE_POLL_UPDATED", dto)
        return dto
    }

    private fun notifyOtherMembers(
        collectiveCode: String,
        sender: String,
        text: String,
        type: String,
    ) {
        val others =
            memberRepository.findAllByCollectiveCode(collectiveCode)
                .filter { it.status == MemberStatus.ACTIVE && it.name != sender }
                .map { it.name }
        if (others.isEmpty()) return
        val preview = if (text.length > 60) text.take(60) + "..." else text
        notificationService.createGroupNotification(others, "$sender: \"$preview\"", type)
    }

    private data class PollPayload(
        val question: String,
        val options: List<PollOptionPayload>,
    )

    private data class PollOptionPayload(
        val id: Int,
        val text: String,
        val users: List<String> = emptyList(),
    )

    private fun ChatMessage.reactionMap(): Map<String, Set<String>> {
        if (reactions.isBlank()) return emptyMap()
        return try {
            objectMapper.readValue<Map<String, Set<String>>>(reactions)
        } catch (_: Exception) {
            emptyMap()
        }
    }

    private fun ChatMessage.pollPayload(): PollPayload? {
        val raw = poll?.trim().orEmpty()
        if (raw.isBlank()) return null
        return try {
            objectMapper.readValue<PollPayload>(raw)
        } catch (_: Exception) {
            null
        }
    }

    private fun Map<String, Set<String>>.toJsonMap(): Map<String, List<String>> = mapValues { (_, value) -> value.toList().sorted() }

    private fun ChatMessage.toDto() =
        MessageDto(
            id = id,
            sender = sender,
            text = text,
            imageData = imageData,
            imageMimeType = imageMimeType,
            imageFileName = imageFileName,
            timestamp = timestamp,
            reactions =
                reactionMap()
                    .map { (emoji, users) -> ReactionDto(emoji, users.toList().sorted()) }
                    .sortedBy { it.emoji },
            poll =
                pollPayload()?.let { payload ->
                    PollDto(
                        question = payload.question,
                        options =
                            payload.options
                                .sortedBy { it.id }
                                .map { PollOptionDto(id = it.id, text = it.text, users = it.users.sorted()) },
                    )
                },
        )
}
