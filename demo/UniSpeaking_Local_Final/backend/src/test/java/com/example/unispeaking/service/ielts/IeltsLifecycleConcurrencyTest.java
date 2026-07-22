package com.example.unispeaking.service.ielts;

import com.example.unispeaking.model.ielts.IeltsAttempt;
import com.example.unispeaking.model.ielts.IeltsReport;
import com.example.unispeaking.model.ielts.IeltsScoringStatus;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.net.URI;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class IeltsLifecycleConcurrencyTest {
    @Test
    void scoringWaitsUntilStreamEndHasFlushedTheAttempt() throws Exception {
        IeltsAttemptRegistry registry = new IeltsAttemptRegistry();
        IeltsAttempt attempt = attempt("att-barrier");
        registry.put(attempt);
        IeltsScoringStreamHandler handler = new IeltsScoringStreamHandler(registry);
        WebSocketSession socket = socket("socket-barrier", attempt.getAttemptId());
        handler.afterConnectionEstablished(socket);

        AtomicInteger starts = new AtomicInteger();
        CompletableFuture<IeltsReport> scoring = registry.startScoring(attempt.getAttemptId(), () -> {
            starts.incrementAndGet();
            return CompletableFuture.completedFuture(null);
        });

        assertEquals(0, starts.get(), "finalize must wait for stream.end");
        assertFalse(scoring.isDone());

        handler.handleMessage(socket, new TextMessage("{\"type\":\"stream.end\",\"event_id\":\"end-1\"}"));

        scoring.join();
        assertEquals(1, starts.get());
    }

    @Test
    void abandonCancelsPendingScoringClosesStreamAndRejectsLaterMessages() throws Exception {
        IeltsAttemptRegistry registry = new IeltsAttemptRegistry();
        IeltsAttempt attempt = attempt("att-abandon");
        registry.put(attempt);
        IeltsScoringStreamHandler handler = new IeltsScoringStreamHandler(registry);
        WebSocketSession socket = socket("socket-abandon", attempt.getAttemptId());
        handler.afterConnectionEstablished(socket);
        CompletableFuture<IeltsReport> scoring = registry.startScoring(
                attempt.getAttemptId(), CompletableFuture::new);

        attempt.setScoringStatus(IeltsScoringStatus.ABANDONED);
        handler.handleMessage(socket, new TextMessage("{\"type\":\"part.started\",\"part\":\"part3\"}"));

        assertTrue(scoring.isCancelled());
        assertEquals(IeltsScoringStatus.ABANDONED, attempt.getScoringStatus());
        assertNull(attempt.getCurrentPart(), "an abandoned stream must no longer mutate its attempt");
        verify(socket, atLeastOnce()).close(any(CloseStatus.class));
    }

    @Test
    void deleteCancelsScoringAndInvalidatesTheExistingSocketIdempotently() throws Exception {
        IeltsAttemptRegistry registry = new IeltsAttemptRegistry();
        IeltsAttempt attempt = attempt("att-delete");
        registry.put(attempt);
        IeltsScoringStreamHandler handler = new IeltsScoringStreamHandler(registry);
        WebSocketSession socket = socket("socket-delete", attempt.getAttemptId());
        handler.afterConnectionEstablished(socket);
        CompletableFuture<IeltsReport> scoring = registry.startScoring(
                attempt.getAttemptId(), CompletableFuture::new);

        assertSame(attempt, registry.remove(attempt.getAttemptId()));
        assertNull(registry.remove(attempt.getAttemptId()));
        handler.handleMessage(socket, new TextMessage("{\"type\":\"part.started\",\"part\":\"part2\"}"));

        assertTrue(scoring.isCancelled());
        assertNull(attempt.getCurrentPart(), "a deleted stream must no longer mutate its attempt");
        verify(socket, atLeastOnce()).close(any(CloseStatus.class));
    }

    @Test
    void repeatedConcurrentFinalizeRequestsShareOneDeferredScoringFuture() throws Exception {
        IeltsAttemptRegistry registry = new IeltsAttemptRegistry();
        IeltsAttempt attempt = attempt("att-repeat");
        registry.put(attempt);
        IeltsScoringStreamHandler handler = new IeltsScoringStreamHandler(registry);
        WebSocketSession socket = socket("socket-repeat", attempt.getAttemptId());
        handler.afterConnectionEstablished(socket);
        AtomicInteger starts = new AtomicInteger();

        CompletableFuture<IeltsReport> first = registry.startScoring(attempt.getAttemptId(), () -> {
            starts.incrementAndGet();
            return CompletableFuture.completedFuture(null);
        });
        CompletableFuture<IeltsReport> second = registry.startScoring(attempt.getAttemptId(), () -> {
            starts.incrementAndGet();
            return CompletableFuture.completedFuture(null);
        });

        assertSame(first, second);
        handler.handleMessage(socket, new TextMessage("{\"type\":\"stream.end\"}"));
        CompletableFuture.allOf(first, second).join();
        assertEquals(1, starts.get());
    }

    @Test
    void abandonCancelsTheAlreadyRunningInnerProviderChain() throws Exception {
        IeltsAttemptRegistry registry = new IeltsAttemptRegistry();
        IeltsAttempt attempt = attempt("att-inner-cancel");
        registry.put(attempt);
        IeltsScoringStreamHandler handler = new IeltsScoringStreamHandler(registry);
        WebSocketSession socket = socket("socket-inner-cancel", attempt.getAttemptId());
        handler.afterConnectionEstablished(socket);
        CompletableFuture<IeltsReport> inner = new CompletableFuture<>();
        CompletableFuture<IeltsReport> scoring = registry.startScoring(attempt.getAttemptId(), () -> inner);
        handler.handleMessage(socket, new TextMessage("{\"type\":\"stream.end\"}"));
        assertFalse(scoring.isDone());

        attempt.setScoringStatus(IeltsScoringStatus.ABANDONED);

        assertTrue(scoring.isCancelled());
        assertTrue(inner.isCancelled(), "cancelling the HTTP scoring future must reach the provider chain");
    }

    @Test
    void aNormallyClosedSocketIsUnregisteredFromLaterAttemptInvalidation() throws Exception {
        IeltsAttemptRegistry registry = new IeltsAttemptRegistry();
        IeltsAttempt attempt = attempt("att-closed-socket");
        registry.put(attempt);
        IeltsScoringStreamHandler handler = new IeltsScoringStreamHandler(registry);
        WebSocketSession socket = socket("socket-closed", attempt.getAttemptId());
        handler.afterConnectionEstablished(socket);
        handler.afterConnectionClosed(socket, CloseStatus.NORMAL);
        clearInvocations(socket);

        attempt.setScoringStatus(IeltsScoringStatus.ABANDONED);

        verify(socket, never()).close(any(CloseStatus.class));
    }

    private static IeltsAttempt attempt(String id) {
        return new IeltsAttempt(id, "full_mock", Map.of());
    }

    private static WebSocketSession socket(String socketId, String attemptId) {
        WebSocketSession socket = mock(WebSocketSession.class);
        when(socket.getUri()).thenReturn(URI.create(
                "ws://localhost/api/ielts/scoring-stream?attempt_id=" + attemptId));
        when(socket.getId()).thenReturn(socketId);
        when(socket.isOpen()).thenReturn(true);
        return socket;
    }
}
