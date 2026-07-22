package com.example.unispeaking.model.ielts;

import java.util.List;

public record TaskAchievementResult(
        Integer score, Double confidence, List<String> positiveEvidence,
        List<String> limitingEvidence, String unavailableReason) {
    public TaskAchievementResult {
        validate(score);
        positiveEvidence = positiveEvidence == null ? List.of() : List.copyOf(positiveEvidence);
        limitingEvidence = limitingEvidence == null ? List.of() : List.copyOf(limitingEvidence);
    }

    public static void validate(Integer score) {
        if (score != null && (score < 0 || score > 100))
            throw new IllegalArgumentException("task achievement score must be an integer from 0 to 100");
    }

    public static TaskAchievementResult unavailable(String reason) {
        return new TaskAchievementResult(null, null, List.of(), List.of(), reason);
    }
}
