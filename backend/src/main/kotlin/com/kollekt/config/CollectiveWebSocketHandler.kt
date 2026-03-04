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
        val uri = session.uri ?: run {
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
        realtimeUpdateService.register(collectiveCode, session)
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        val collectiveCode = session.attributes["collectiveCode"] as? String ?: return
        realtimeUpdateService.unregister(collectiveCode, session)
    }

    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
        if (message.payload == "ping") {
            session.sendMessage(TextMessage("""{"type":"pong"}"""))
        }
    }
}
