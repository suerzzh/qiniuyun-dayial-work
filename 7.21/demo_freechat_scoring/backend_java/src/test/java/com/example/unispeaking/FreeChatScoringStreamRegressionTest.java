package com.example.unispeaking;

import com.example.unispeaking.model.SessionState;
import com.example.unispeaking.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.*;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FreeChatScoringStreamRegressionTest {
    @Test
    void existingFreeChatPcmWebSocketStillCompletesAProviderScoredTurn() throws Exception {
        SessionRegistry registry = new SessionRegistry();
        SessionState state = new SessionState("free-1");
        state.setScoringEnabled(true);
        registry.put(state);

        QwenScoringService qwen = mock(QwenScoringService.class);
        when(qwen.buildPronunciationReference(anyString(), anyList())).thenReturn(
                CompletableFuture.completedFuture(Map.of("pronunciation_reference", "I like this city very much",
                        "changes", List.of(), "confidence", 1.0, "status", "unchanged")));
        when(qwen.evaluateLanguage(anyString(), anyList())).thenReturn(CompletableFuture.completedFuture(Map.of(
                "grammar_score", 80, "vocab_score", 75, "naturalness_score", 78)));
        XfyunIseService xfyun = mock(XfyunIseService.class);
        when(xfyun.evaluatePronunciation(any(byte[].class), anyString())).thenReturn(
                CompletableFuture.completedFuture(new java.util.LinkedHashMap<>(Map.of(
                        "accuracy_score", 80.0, "fluency_score", 75.0, "words", List.of()))));

        ScoringStreamHandler handler = new ScoringStreamHandler(registry, xfyun, qwen);
        WebSocketSession socket = mock(WebSocketSession.class);
        when(socket.getUri()).thenReturn(URI.create("ws://localhost/api/scoring-stream?session_id=free-1"));
        when(socket.getId()).thenReturn("socket-1");
        when(socket.isOpen()).thenReturn(true);

        handler.afterConnectionEstablished(socket);
        handler.handleMessage(socket, new BinaryMessage(new byte[16_000]));
        handler.handleMessage(socket, new TextMessage("{\"type\":\"turn.speech_started\",\"turn_id\":\"t1\"}"));
        handler.handleMessage(socket, new BinaryMessage(new byte[32_000]));
        handler.handleMessage(socket, new TextMessage("{\"type\":\"turn.speech_stopped\",\"turn_id\":\"t1\"}"));
        handler.handleMessage(socket, new BinaryMessage(new byte[22_400]));
        handler.handleMessage(socket, new TextMessage("{\"type\":\"turn.transcript_completed\",\"turn_id\":\"t1\",\"text\":\"I like this city very much\"}"));

        for (int i = 0; i < 50 && !state.getTurnEvaluations().containsKey("t1"); i++) Thread.sleep(10);
        assertEquals("scored", state.getTurnEvaluations().get("t1").get("status"));
        assertNotNull(state.getTurnEvaluations().get("t1").get("turn_score"));
        verify(xfyun).evaluatePronunciation(any(byte[].class), eq("I like this city very much"));
    }
}
