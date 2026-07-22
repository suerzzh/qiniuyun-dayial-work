package com.example.unispeaking.service.ielts;

import java.util.concurrent.CompletableFuture;

@FunctionalInterface
public interface PronunciationEvidenceProvider {
    CompletableFuture<PronunciationEvidence> evaluate(IeltsTurn turn);
}
