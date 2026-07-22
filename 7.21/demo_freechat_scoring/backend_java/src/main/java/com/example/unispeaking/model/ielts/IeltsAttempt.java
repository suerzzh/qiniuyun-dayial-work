package com.example.unispeaking.model.ielts;

import com.example.unispeaking.service.ielts.IeltsTurn;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

public class IeltsAttempt {
    private final String attemptId;
    private final String mode;
    private final Map<String, Object> paperSnapshot;
    private final String promptVersion;
    private final String timingProfile;
    private final Instant createdAt = Instant.now();
    private final List<IeltsTurn> turns = new CopyOnWriteArrayList<>();
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
    public void addTurn(IeltsTurn turn) { turns.add(turn); }
    public IeltsTurn findTurn(String turnId) {
        return turns.stream().filter(turn -> turn.turnId().equals(turnId)).findFirst().orElse(null);
    }
    public String getCurrentPart() { return currentPart; }
    public void setCurrentPart(String currentPart) { this.currentPart = currentPart; }
    public String getQuestionId() { return questionId; }
    public String getQuestionTextSnapshot() { return questionTextSnapshot; }
    public void setCurrentQuestion(String questionId, String questionTextSnapshot) {
        this.questionId = questionId;
        this.questionTextSnapshot = questionTextSnapshot;
    }
    public IeltsScoringStatus getScoringStatus() { return scoringStatus; }
    public void setScoringStatus(IeltsScoringStatus scoringStatus) { this.scoringStatus = scoringStatus; }
    public IeltsReport getReport() { return report; }
    public void setReport(IeltsReport report) { this.report = report; }

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
