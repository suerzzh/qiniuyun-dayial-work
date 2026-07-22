package com.example.unispeaking.service.ielts;

import com.example.unispeaking.service.XfyunIseService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Service
public class XfyunPronunciationEvidenceProvider implements PronunciationEvidenceProvider {
    private final XfyunIseService xfyun;
    private final String configuredMode;

    public XfyunPronunciationEvidenceProvider(
            XfyunIseService xfyun,
            @Value("${xfyun.ielts.mode:read_sentence}") String configuredMode) {
        this.xfyun = xfyun;
        this.configuredMode = configuredMode == null ? "read_sentence" : configuredMode;
    }

    @Override
    public CompletableFuture<PronunciationEvidence> evaluate(IeltsTurn turn) {
        if (turn.audioByteLength() == 0 || turn.rawTranscript().isBlank()) {
            return CompletableFuture.failedFuture(new IllegalArgumentException("audio or raw transcript missing"));
        }
        // The current account/API implementation exposes read_sentence only. We never
        // label that as free-speech coverage; it is explicitly low-confidence evidence.
        return xfyun.evaluatePronunciation(turn.audio(), turn.rawTranscript()).thenApply(result -> {
            if (result == null || result.isEmpty()) throw new IllegalStateException("ISE returned an empty result");
            if (result.containsKey("parse_error")) throw new IllegalStateException("ISE result could not be parsed");
            Map<String, Object> copy = new LinkedHashMap<>(result);
            Object rawValue = copy.remove("raw_provider_result");
            String raw = rawValue == null ? null : String.valueOf(rawValue);
            String actualMode = String.valueOf(copy.getOrDefault("provider_mode", "read_sentence"));
            String confidence = "topic".equalsIgnoreCase(configuredMode) && "topic".equalsIgnoreCase(actualMode)
                    ? "NORMAL" : "LOW";
            return new PronunciationEvidence("XFYUN_ISE", actualMode, confidence, copy, raw, null);
        });
    }
}
