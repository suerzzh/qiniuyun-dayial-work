package com.unispeaking.scenariodemo.prompt;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.unispeaking.scenariodemo.domain.PromptProfile;
import java.util.Map;
import org.junit.jupiter.api.Test;

class LayeredPromptComposerTest {
    private final LayeredPromptComposer composer = new LayeredPromptComposer();

    @Test
    void customScenarioContainsEverySelectedPromptLayer() {
        PromptProfile profile = new PromptProfile(
                "james",
                "fluent",
                "2.0",
                "active",
                "The learner often travels for work.");

        String prompt = composer.composeCustom(
                profile,
                "airport check-in",
                "airline check-in agent",
                "check in for a flight",
                Map.of("destination", "flight destination"));

        assertTrue(prompt.contains("You are an AI English speaking coach."));
        assertTrue(prompt.contains("You are James"));
        assertTrue(prompt.contains("The learner is relatively fluent."));
        assertTrue(prompt.contains("Speaking speed: 2.0."));
        assertTrue(prompt.contains("Briefly correct the main error"));
        assertTrue(prompt.contains("Relevant learner memory: The learner often travels for work."));
        assertTrue(prompt.contains("Act as airline check-in agent in airport check-in."));
        assertTrue(prompt.contains("The learner’s goal is to check in for a flight."));
        assertTrue(prompt.contains("- destination: flight destination"));
    }

    @Test
    void emptyMemoryDoesNotInjectTheMemoryLayer() {
        String prompt = composer.composeCustom(
                PromptProfile.defaults(),
                "coffee shop",
                "barista",
                "order a coffee",
                Map.of("drink", "chosen drink"));

        assertTrue(!prompt.contains("Relevant learner memory:"));
    }

    @Test
    void unknownPromptOptionIsRejectedBeforeAResourcePathCanBeBuilt() {
        assertThrows(IllegalArgumentException.class,
                () -> new PromptProfile("../../secret", "basic", "1.0", "moderate", ""));
    }
}
