package com.unispeaking.scenariodemo.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.unispeaking.scenariodemo.domain.PromptProfile;
import com.unispeaking.scenariodemo.domain.ScenarioDefinition;
import com.unispeaking.scenariodemo.domain.ScenarioSession;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RealtimeSessionConfigFactoryTest {
    private final RealtimeSessionConfigFactory factory = new RealtimeSessionConfigFactory(
            "",
            "Serena",
            "Raymond",
            "Ryan",
            "Andre",
            "Mione",
            "Harvey",
            "qwen3-asr-flash-realtime",
            "semantic_vad");

    @Test
    void mapsTheSelectedProfileAndFullPromptIntoTheBackendSessionConfiguration() {
        PromptProfile profile = new PromptProfile("leo", "fluent", "1.5", "active", "Likes travel.");
        ScenarioSession scenario = session(profile, "FULL LAYERED PROMPT FOR LEO");

        RealtimeSessionConfigFactory.RealtimeSessionConfiguration result = factory.create(scenario);
        Map<String, Object> providerSession = result.session();

        assertEquals(profile, result.profile());
        assertEquals("FULL LAYERED PROMPT FOR LEO", providerSession.get("instructions"));
        assertEquals("Ryan", providerSession.get("voice"));
        assertEquals(List.of("text", "audio"), providerSession.get("modalities"));
        assertEquals(
                Map.of("model", "qwen3-asr-flash-realtime"),
                providerSession.get("input_audio_transcription"));
        assertEquals(
                Map.of(
                        "type", "semantic_vad",
                        "threshold", 0.5,
                        "prefix_padding_ms", 500,
                        "silence_duration_ms", 800),
                providerSession.get("turn_detection"));
        assertEquals("FULL LAYERED PROMPT FOR LEO".length(), result.promptLength());
    }

    @Test
    void changingCoachChangesBothPromptMetadataAndVoice() {
        var clara = factory.create(session(
                new PromptProfile("clara", "basic", "1.0", "moderate", ""),
                "CLARA PROMPT"));
        var james = factory.create(session(
                new PromptProfile("james", "basic", "1.0", "moderate", ""),
                "JAMES PROMPT"));

        assertNotEquals(clara.session().get("voice"), james.session().get("voice"));
        assertNotEquals(clara.promptSha256(), james.promptSha256());
    }

    @Test
    void globalVoiceOverrideWinsWhenExplicitlyConfigured() {
        RealtimeSessionConfigFactory overridden = new RealtimeSessionConfigFactory(
                "Katerina",
                "Serena",
                "Raymond",
                "Ryan",
                "Andre",
                "Mione",
                "Harvey",
                "qwen3-asr-flash-realtime",
                "semantic_vad");

        var result = overridden.create(session(PromptProfile.defaults(), "PROMPT"));

        assertEquals("Katerina", result.session().get("voice"));
    }

    private ScenarioSession session(PromptProfile profile, String prompt) {
        return new ScenarioSession(new ScenarioDefinition(
                "topic",
                "goal",
                "role",
                "learner",
                Map.of("outcome", "done"),
                10,
                prompt,
                profile));
    }
}
