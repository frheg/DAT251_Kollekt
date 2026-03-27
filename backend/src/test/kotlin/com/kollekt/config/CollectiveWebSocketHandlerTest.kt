package com.kollekt.config

import com.kollekt.domain.Member
import com.kollekt.repository.MemberRepository
import com.kollekt.service.RealtimeUpdateService
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argThat
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import java.net.URI

class CollectiveWebSocketHandlerTest {
    private val memberRepository: MemberRepository = mock()
    private val realtimeUpdateService: RealtimeUpdateService = mock()
    private val session: WebSocketSession = mock()
    private val attributes = mutableMapOf<String, Any>()
    private val handler = TestableCollectiveWebSocketHandler(memberRepository, realtimeUpdateService)

    private class TestableCollectiveWebSocketHandler(
        memberRepository: MemberRepository,
        realtimeUpdateService: RealtimeUpdateService,
    ) : CollectiveWebSocketHandler(memberRepository, realtimeUpdateService) {
        fun receiveText(
            session: WebSocketSession,
            message: TextMessage,
        ) = handleTextMessage(session, message)
    }

    @Test
    fun `afterConnectionEstablished closes when uri is missing`() {
        whenever(session.uri).thenReturn(null)

        handler.afterConnectionEstablished(session)

        verify(session).close(
            argThat { code == CloseStatus.BAD_DATA.code && reason == "Missing URI" },
        )
        verify(realtimeUpdateService, never()).register(any(), any())
    }

    @Test
    fun `afterConnectionEstablished closes when member name is missing`() {
        whenever(session.uri).thenReturn(URI("ws://localhost/ws/collective"))

        handler.afterConnectionEstablished(session)

        verify(session).close(
            argThat { code == CloseStatus.BAD_DATA.code && reason == "Missing memberName" },
        )
    }

    @Test
    fun `afterConnectionEstablished closes when member has no collective`() {
        whenever(session.uri).thenReturn(URI("ws://localhost/ws/collective?memberName=Kasper"))
        whenever(memberRepository.findByName("Kasper")).thenReturn(
            Member(id = 1, name = "Kasper", email = "kasper@example.com", collectiveCode = null),
        )

        handler.afterConnectionEstablished(session)

        verify(session).close(
            argThat { code == CloseStatus.NOT_ACCEPTABLE.code && reason == "Member has no collective" },
        )
    }

    @Test
    fun `afterConnectionEstablished stores collective and registers session`() {
        whenever(session.uri).thenReturn(URI("ws://localhost/ws/collective?memberName=Kasper"))
        whenever(session.attributes).thenReturn(attributes)
        whenever(memberRepository.findByName("Kasper")).thenReturn(
            Member(id = 1, name = "Kasper", email = "kasper@example.com", collectiveCode = "ABC123"),
        )

        handler.afterConnectionEstablished(session)

        verify(realtimeUpdateService).register("ABC123", session)
        kotlin.test.assertEquals("ABC123", attributes["collectiveCode"])
    }

    @Test
    fun `afterConnectionClosed unregisters stored collective`() {
        whenever(session.attributes).thenReturn(mutableMapOf<String, Any>("collectiveCode" to "ABC123"))

        handler.afterConnectionClosed(session, CloseStatus.NORMAL)

        verify(realtimeUpdateService).unregister("ABC123", session)
    }

    @Test
    fun `handleTextMessage responds to ping`() {
        handler.receiveText(session, TextMessage("ping"))

        verify(session).sendMessage(TextMessage("""{"type":"pong"}"""))
    }
}
