package com.unispeaking.scenariodemo.domain;

import java.time.Instant;

public record ControlInstruction(String type, String instruction, Instant occurredAt) {
    public static ControlInstruction closeNaturally(String goal) {
        return new ControlInstruction(
                "session.update",
                "The learner has confirmed that the scenario goal is completed: " + goal
                        + ". Close the conversation naturally. Do not introduce new topics.",
                Instant.now());
    }
}
