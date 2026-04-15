package com.kollekt.config

import com.kollekt.repository.MemberRepository
import com.kollekt.service.RealtimeUpdateService
import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler
import org.springframework.web.util.UriComponentsBuilder

@Component
class CollectiveWebSocketHandler(
    private val memberRepository: MemberRepository,
    private val realtimeUpdateService: RealtimeUpdateService,
) : TextWebSocketHandler() {
    override fun afterConnectionEstablished(session: WebSocketSession) {
        val uri =
            session.uri ?: run {
                session.close(CloseStatus.BAD_DATA.withReason("Missing URI"))
                return
            }
        val queryParams = UriComponentsBuilder.fromUri(uri).build().queryParams
        val memberName = queryParams.getFirst("memberName")?.trim()
        if (memberName.isNullOrBlank()) {
            session.close(CloseStatus.BAD_DATA.withReason("Missing memberName"))
            return
        }

        val member = memberRepository.findByName(memberName)
        val collectiveCode = member?.collectiveCode
        if (collectiveCode.isNullOrBlank()) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Member has no collective"))
            return
        }

        session.attributes["collectiveCode"] = collectiveCode
        session.attributes["memberName"] = memberName
        realtimeUpdateService.register(collectiveCode, session)
        val count = realtimeUpdateService.getOnlineCount(collectiveCode)
        // Private bootstrap: tell the connecting session exactly how many are online right now
        realtimeUpdateService.sendTo(session, "MEMBER_ONLINE", mapOf("count" to count))
        // Broadcast to everyone else so their counts update
        realtimeUpdateService.publishExcluding(collectiveCode, session, "MEMBER_ONLINE", mapOf("count" to count))
    }

    override fun afterConnectionClosed(
        session: WebSocketSession,
        status: CloseStatus,
    ) {
        val collectiveCode = session.attributes["collectiveCode"] as? String ?: return
        realtimeUpdateService.unregister(collectiveCode, session)
        val count = realtimeUpdateService.getOnlineCount(collectiveCode)
        realtimeUpdateService.publish(collectiveCode, "MEMBER_OFFLINE", mapOf("count" to count))
    }

    override fun handleTextMessage(
        session: WebSocketSession,
        message: TextMessage,
    ) {
        if (message.payload == "ping") {
            session.sendMessage(TextMessage("""{"type":"pong"}"""))
        }
    }
}
