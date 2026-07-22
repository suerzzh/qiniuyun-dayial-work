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
    public IeltsAttempt remove(String id) { scoring.remove(id); return attempts.remove(id); }
    public CompletableFuture<IeltsReport> scoring(String id) { return scoring.get(id); }
    public CompletableFuture<IeltsReport> startScoring(String id, Supplier<CompletableFuture<IeltsReport>> supplier) {
        return scoring.computeIfAbsent(id, ignored -> supplier.get());
    }
}
