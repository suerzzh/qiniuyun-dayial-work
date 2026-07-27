package com.unispeaking.scenariodemo.domain;

import java.util.List;
import java.util.Map;

public record ScenarioDefinition(
        String topic,
        String goal,
        String aiRole,
        String userRole,
        Map<String, String> requiredSlots,
        int maxTurns,
        String realtimeInstruction,
        PromptProfile promptProfile) {

    public ScenarioDefinition {
        requiredSlots = Map.copyOf(requiredSlots);
        maxTurns = maxTurns <= 0 ? 12 : maxTurns;
        promptProfile = promptProfile == null ? PromptProfile.defaults() : promptProfile;
    }

    public ScenarioDefinition(
            String topic,
            String goal,
            String aiRole,
            String userRole,
            Map<String, String> requiredSlots,
            int maxTurns,
            String realtimeInstruction) {
        this(topic, goal, aiRole, userRole, requiredSlots, maxTurns, realtimeInstruction, PromptProfile.defaults());
    }

    public static ScenarioDefinition coffeeOrder() {
        return new ScenarioDefinition(
                "Order coffee at a café",
                "Complete a coffee order and confirm it",
                "friendly barista",
                "customer",
                Map.of(
                        "drink", "chosen drink",
                        "size", "drink size",
                        "temperature", "hot or iced",
                        "payment", "payment method"),
                10,
                "You are a friendly café barista. Speak natural, concise English. Help the learner order a drink, confirm the full order, accept corrections, and close naturally only after confirmation.",
                PromptProfile.defaults());
    }

    public List<String> requiredSlotKeys() {
        return requiredSlots.keySet().stream().sorted().toList();
    }
}
