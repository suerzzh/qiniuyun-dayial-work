package com.example.unispeaking.model.ielts;

import com.example.unispeaking.service.ielts.IeltsTurn;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

public class IeltsAttempt {
    private final String attemptId;
    private final String mode;
    private final Map<String, Object> paperSnapshot;
    private final String promptVersion;
    private final String timingProfile;
    private final Instant createdAt = Instant.now();
    private final List<IeltsTurn> turns = new CopyOnWriteArrayList<>();
    private final Object lifecycleLock = new Object();
    private final CompletableFuture<Void> streamFinalized = new CompletableFuture<>();
    private final java.util.Set<Runnable> streamInvalidators = ConcurrentHashMap.newKeySet();
    private final java.util.Set<CompletableFuture<?>> scoringFutures = ConcurrentHashMap.newKeySet();
    private volatile boolean active = true;
    private volatile CompletableFuture<?> primaryScoringFuture;
    private volatile String currentPart;
    private volatile String questionId;
    private volatile String questionTextSnapshot;
    private volatile IeltsScoringStatus scoringStatus = IeltsScoringStatus.COLLECTING;
    private volatile IeltsReport report;

    public IeltsAttempt(String attemptId, String mode, Map<String, Object> paperSnapshot) {
        this.attemptId = attemptId;
        this.mode = mode == null || mode.isBlank() ? "full_mock" : mode;
        this.paperSnapshot = immutableMap(paperSnapshot);
        this.promptVersion = text(this.paperSnapshot.get("promptVersion"), "unknown");
        this.timingProfile = text(this.paperSnapshot.get("timingProfile"), "real_exam");
    }

    public String getAttemptId() { return attemptId; }
    public String getMode() { return mode; }
    public Map<String, Object> getPaperSnapshot() { return paperSnapshot; }
    public String getPromptVersion() { return promptVersion; }
    public String getTimingProfile() { return timingProfile; }
    public Instant getCreatedAt() { return createdAt; }
    public List<IeltsTurn> getTurns() { return List.copyOf(turns); }
    public void addTurn(IeltsTurn turn) {
        synchronized (lifecycleLock) {
            if (active) turns.add(turn);
        }
    }
    public IeltsTurn findTurn(String turnId) {
        return turns.stream().filter(turn -> turn.turnId().equals(turnId)).findFirst().orElse(null);
    }
    public String getCurrentPart() { return currentPart; }
    public void setCurrentPart(String currentPart) {
        synchronized (lifecycleLock) {
            if (active) this.currentPart = currentPart;
        }
    }
    public String getQuestionId() { return questionId; }
    public String getQuestionTextSnapshot() { return questionTextSnapshot; }
    public void setCurrentQuestion(String questionId, String questionTextSnapshot) {
        synchronized (lifecycleLock) {
            if (!active) return;
            this.questionId = questionId;
            this.questionTextSnapshot = questionTextSnapshot;
        }
    }
    public IeltsScoringStatus getScoringStatus() { return scoringStatus; }
    public void setScoringStatus(IeltsScoringStatus scoringStatus) {
        if (scoringStatus == IeltsScoringStatus.ABANDONED) {
            terminate(true);
            return;
        }
        synchronized (lifecycleLock) {
            if (active) this.scoringStatus = scoringStatus;
        }
    }
    public IeltsReport getReport() { return report; }
    public void setReport(IeltsReport report) {
        synchronized (lifecycleLock) {
            if (active) this.report = report;
        }
    }

    public boolean beginScoring() {
        synchronized (lifecycleLock) {
            if (!active) return false;
            scoringStatus = IeltsScoringStatus.SCORING;
            return true;
        }
    }

    public boolean publishReport(IeltsReport report) {
        synchronized (lifecycleLock) {
            if (!active) return false;
            this.report = report;
            scoringStatus = report.scoringStatus();
            return true;
        }
    }

    public boolean isActive() { return active; }
    public CompletableFuture<Void> streamFinalized() { return streamFinalized; }
    public void markStreamFinalized() {
        if (active) streamFinalized.complete(null);
    }

    public void trackScoringFuture(CompletableFuture<?> future) {
        boolean cancel;
        synchronized (lifecycleLock) {
            cancel = !active;
            if (!cancel) scoringFutures.add(future);
        }
        if (cancel) {
            future.cancel(true);
        } else {
            future.whenComplete((result, error) -> scoringFutures.remove(future));
        }
    }

    public void trackPrimaryScoringFuture(CompletableFuture<?> future) {
        boolean cancel;
        synchronized (lifecycleLock) {
            cancel = !active;
            if (!cancel) primaryScoringFuture = future;
        }
        if (cancel) future.cancel(true);
    }

    public void registerStreamInvalidator(Runnable invalidator) {
        boolean invalidateNow;
        synchronized (lifecycleLock) {
            invalidateNow = !active;
            if (!invalidateNow) streamInvalidators.add(invalidator);
        }
        if (invalidateNow) invalidator.run();
    }

    public void unregisterStreamInvalidator(Runnable invalidator) {
        streamInvalidators.remove(invalidator);
    }

    public void invalidate() { terminate(false); }

    private void terminate(boolean abandoned) {
        List<CompletableFuture<?>> futures;
        CompletableFuture<?> primary;
        List<Runnable> invalidators;
        synchronized (lifecycleLock) {
            if (!active) return;
            active = false;
            if (abandoned) scoringStatus = IeltsScoringStatus.ABANDONED;
            primary = primaryScoringFuture;
            primaryScoringFuture = null;
            futures = List.copyOf(scoringFutures);
            scoringFutures.clear();
            invalidators = List.copyOf(streamInvalidators);
            streamInvalidators.clear();
        }
        if (primary != null) primary.cancel(true);
        futures.forEach(future -> future.cancel(true));
        streamFinalized.cancel(false);
        invalidators.forEach(Runnable::run);
    }

    private static Map<String, Object> immutableMap(Map<?, ?> source) {
        if (source == null || source.isEmpty()) return Map.of();
        Map<String, Object> copy = new LinkedHashMap<>();
        source.forEach((key, value) -> copy.put(String.valueOf(key), immutableValue(value)));
        return Collections.unmodifiableMap(copy);
    }

    private static Object immutableValue(Object value) {
        if (value instanceof Map<?, ?> map) return immutableMap(map);
        if (value instanceof List<?> list) {
            List<Object> copy = new ArrayList<>(list.size());
            list.forEach(item -> copy.add(immutableValue(item)));
            return Collections.unmodifiableList(copy);
        }
        return value;
    }

    private static String text(Object value, String fallback) {
        return value instanceof String text && !text.isBlank() ? text.trim() : fallback;
    }
}
