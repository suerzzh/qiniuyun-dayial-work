package com.example.unispeaking.service.ielts;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

public interface IeltsTwoStageTextScorer extends IeltsTextScorer {
    CompletableFuture<Map<String, Object>> languageEvidence(Map<String, Object> structuredInput);
    CompletableFuture<Map<String, Object>> holisticJudge(Map<String, Object> combinedInput);

    @Override default CompletableFuture<Map<String, Object>> score(Map<String, Object> structuredInput) {
        return languageEvidence(structuredInput).thenCompose(language -> {
            Map<String, Object> combined = new java.util.LinkedHashMap<>(structuredInput);
            combined.put("language_evidence", language);
            return holisticJudge(combined);
        });
    }
}
