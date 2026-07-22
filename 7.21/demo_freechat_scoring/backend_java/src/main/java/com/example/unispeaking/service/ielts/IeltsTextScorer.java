package com.example.unispeaking.service.ielts;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

@FunctionalInterface
public interface IeltsTextScorer {
    CompletableFuture<Map<String, Object>> score(Map<String, Object> structuredInput);
}
