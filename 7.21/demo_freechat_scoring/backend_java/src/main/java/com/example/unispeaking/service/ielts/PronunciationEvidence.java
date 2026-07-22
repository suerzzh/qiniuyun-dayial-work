package com.example.unispeaking.service.ielts;

import java.util.Map;

/** Raw ISE observation only. It intentionally has no IELTS band field. */
public record PronunciationEvidence(
        String provider,
        String providerMode,
        String confidence,
        Map<String, Object> result,
        String rawProviderResult,
        String error
) {
    public static PronunciationEvidence failure(String message) {
        return new PronunciationEvidence("XFYUN_ISE", null, null, Map.of(), null, message);
    }
}
