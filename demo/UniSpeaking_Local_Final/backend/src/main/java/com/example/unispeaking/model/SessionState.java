package com.example.unispeaking.model;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ConcurrentHashMap;

public class SessionState {
    private String sessionId;
    private String conversationId;
    private String learnerLevel = "Intermediate"; // default
    private String providerSessionId;
    private boolean scoringEnabled;
    private String lessonFocus = "";
    private volatile boolean ended;
    // Map of turnId -> evaluation results (e.g. Map with keys "pronunciation", "grammar", "text")
    private final Map<String, Map<String, Object>> turnEvaluations = new ConcurrentHashMap<>();
    private final List<Map<String, String>> conversationMessages = new CopyOnWriteArrayList<>();

    public SessionState(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getConversationId() {
        return conversationId;
    }

    public void setConversationId(String conversationId) {
        this.conversationId = conversationId;
    }

    public String getLearnerLevel() {
        return learnerLevel;
    }

    public void setLearnerLevel(String learnerLevel) {
        this.learnerLevel = learnerLevel;
    }

    public String getProviderSessionId() { return providerSessionId; }
    public void setProviderSessionId(String providerSessionId) { this.providerSessionId = providerSessionId; }

    public Map<String, Map<String, Object>> getTurnEvaluations() {
        return turnEvaluations;
    }

    public boolean isScoringEnabled() { return scoringEnabled; }
    public void setScoringEnabled(boolean scoringEnabled) { this.scoringEnabled = scoringEnabled; }
    public String getLessonFocus() { return lessonFocus; }
    public void setLessonFocus(String lessonFocus) { this.lessonFocus = lessonFocus == null ? "" : lessonFocus; }
    public boolean isEnded() { return ended; }
    public void setEnded(boolean ended) { this.ended = ended; }
    public List<Map<String, String>> getConversationMessages() { return conversationMessages; }

    public void addConversationMessage(String role, String text) {
        if (text == null || text.isBlank()) return;
        conversationMessages.add(Map.of("role", role, "text", text.trim()));
    }
}
