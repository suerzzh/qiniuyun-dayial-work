package com.example.unispeaking.service.ielts;

import com.example.unispeaking.model.ielts.IeltsAttempt;
import com.example.unispeaking.model.ielts.IeltsReport;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

@Component
public class IeltsAttemptRegistry {
    private final Map<String, IeltsAttempt> attempts = new ConcurrentHashMap<>();
    private final Map<String, CompletableFuture<IeltsReport>> scoring = new ConcurrentHashMap<>();
    public IeltsAttempt get(String id) { return attempts.get(id); }
    public void put(IeltsAttempt attempt) { attempts.put(attempt.getAttemptId(), attempt); }
    public synchronized IeltsAttempt remove(String id) {
        IeltsAttempt attempt = attempts.remove(id);
        scoring.remove(id);
        if (attempt != null) attempt.invalidate();
        return attempt;
    }
    public CompletableFuture<IeltsReport> scoring(String id) { return scoring.get(id); }
    public synchronized CompletableFuture<IeltsReport> startScoring(
            String id, Supplier<CompletableFuture<IeltsReport>> supplier) {
        CompletableFuture<IeltsReport> existing = scoring.get(id);
        if (existing != null) return existing;
        IeltsAttempt attempt = attempts.get(id);
        if (attempt == null || !attempt.isActive()) return cancelledFuture();
        CompletableFuture<IeltsReport> future = attempt.streamFinalized().thenCompose(ignored -> {
            if (!attempt.isActive()) return cancelledFuture();
            try {
                CompletableFuture<IeltsReport> inner = supplier.get();
                attempt.trackScoringFuture(inner);
                return inner;
            } catch (Throwable error) {
                return CompletableFuture.failedFuture(error);
            }
        });
        scoring.put(id, future);
        attempt.trackPrimaryScoringFuture(future);
        return future;
    }

    private static <T> CompletableFuture<T> cancelledFuture() {
        CompletableFuture<T> future = new CompletableFuture<>();
        future.cancel(false);
        return future;
    }
}
