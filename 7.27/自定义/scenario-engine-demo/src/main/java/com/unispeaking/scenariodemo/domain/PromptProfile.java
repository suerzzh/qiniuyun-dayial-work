package com.unispeaking.scenariodemo.domain;

import java.util.Set;

public record PromptProfile(
        String coach,
        String difficulty,
        String speed,
        String correction,
        String memory) {
    private static final Set<String> COACHES =
            Set.of("clara", "james", "leo", "david", "emily", "arthur");
    private static final Set<String> DIFFICULTIES =
            Set.of("starter", "basic", "connected", "fluent");
    private static final Set<String> SPEEDS =
            Set.of("0.5", "1.0", "1.5", "2.0");
    private static final Set<String> CORRECTIONS =
            Set.of("minimal", "moderate", "active");

    public PromptProfile {
        coach = normalizedOption("coach", coach, COACHES);
        difficulty = normalizedOption("difficulty", difficulty, DIFFICULTIES);
        speed = normalizedOption("speed", speed, SPEEDS);
        correction = normalizedOption("correction", correction, CORRECTIONS);
        memory = memory == null ? "" : memory.trim();
    }

    public static PromptProfile defaults() {
        return new PromptProfile("clara", "basic", "1.0", "moderate", "");
    }

    private static String normalizedOption(String name, String value, Set<String> allowed) {
        String normalized = value == null ? "" : value.trim().toLowerCase();
        if (!allowed.contains(normalized)) {
            throw new IllegalArgumentException(
                    "Unsupported " + name + " '" + value + "'. Allowed values: " + allowed);
        }
        return normalized;
    }
}
