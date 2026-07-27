package com.unispeaking.scenariodemo.service;

import com.unispeaking.scenariodemo.domain.PromptProfile;
import com.unispeaking.scenariodemo.domain.ScenarioSession;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class RealtimeSessionConfigFactory {
    private final String voiceOverride;
    private final Map<String, String> coachVoices;
    private final String transcriptionModel;
    private final String vadType;

    public RealtimeSessionConfigFactory(
            @Value("${demo.realtime.voice-override:}") String voiceOverride,
            @Value("${demo.realtime.coach-voices.clara:Serena}") String claraVoice,
            @Value("${demo.realtime.coach-voices.james:Raymond}") String jamesVoice,
            @Value("${demo.realtime.coach-voices.leo:Ryan}") String leoVoice,
            @Value("${demo.realtime.coach-voices.david:Andre}") String davidVoice,
            @Value("${demo.realtime.coach-voices.emily:Mione}") String emilyVoice,
            @Value("${demo.realtime.coach-voices.arthur:Harvey}") String arthurVoice,
            @Value("${demo.realtime.transcription-model:qwen3-asr-flash-realtime}") String transcriptionModel,
            @Value("${demo.realtime.vad-type:semantic_vad}") String vadType) {
        this.voiceOverride = voiceOverride == null ? "" : voiceOverride.trim();
        this.coachVoices = Map.of(
                "clara", claraVoice,
                "james", jamesVoice,
                "leo", leoVoice,
                "david", davidVoice,
                "emily", emilyVoice,
                "arthur", arthurVoice);
        this.transcriptionModel = transcriptionModel;
        this.vadType = vadType;
    }

    public RealtimeSessionConfiguration create(ScenarioSession scenario) {
        PromptProfile profile = scenario.getDefinition().promptProfile();
        String instructions = scenario.getDefinition().realtimeInstruction();
        String voice = voiceOverride.isBlank() ? coachVoices.get(profile.coach()) : voiceOverride;

        Map<String, Object> providerSession = new LinkedHashMap<>();
        providerSession.put("modalities", List.of("text", "audio"));
        providerSession.put("voice", voice);
        providerSession.put("instructions", instructions);
        providerSession.put("input_audio_format", "pcm");
        providerSession.put("output_audio_format", "pcm");
        providerSession.put("input_audio_transcription", Map.of("model", transcriptionModel));
        providerSession.put("turn_detection", Map.of(
                "type", vadType,
                "threshold", 0.5,
                "prefix_padding_ms", 500,
                "silence_duration_ms", 800));

        return new RealtimeSessionConfiguration(
                scenario.getId(),
                profile,
                instructions.length(),
                sha256(instructions),
                Map.copyOf(providerSession));
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    public record RealtimeSessionConfiguration(
            String sessionId,
            PromptProfile profile,
            int promptLength,
            String promptSha256,
            Map<String, Object> session) {
    }
}
