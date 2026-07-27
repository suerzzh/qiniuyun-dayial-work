package com.unispeaking.scenariodemo.domain;

import java.time.Instant;
import java.util.Map;

public record ScenarioEvent(
        EventType type,
        Map<String, String> values,
        Map<String, String> previousValues,
        double confidence,
        String correctedTranscript,
        Instant occurredAt) {

    public ScenarioEvent {
        values = values == null ? Map.of() : Map.copyOf(values);
        previousValues = previousValues == null ? Map.of() : Map.copyOf(previousValues);
        occurredAt = occurredAt == null ? Instant.now() : occurredAt;
    }

    public static ScenarioEvent of(EventType type, Map<String, String> values, double confidence) {
        return new ScenarioEvent(type, values, Map.of(), confidence, null, Instant.now());
    }

    public static ScenarioEvent correction(
            Map<String, String> oldValues,
            Map<String, String> newValues,
            double confidence) {
        return new ScenarioEvent(EventType.CORRECTION, newValues, oldValues, confidence, null, Instant.now());
    }
}
