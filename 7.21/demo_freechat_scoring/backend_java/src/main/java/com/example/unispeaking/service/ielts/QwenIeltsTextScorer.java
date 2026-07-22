package com.example.unispeaking.service.ielts;

import com.example.unispeaking.service.QwenScoringService;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Service
public class QwenIeltsTextScorer implements IeltsTwoStageTextScorer {
    private final QwenScoringService qwen;

    public QwenIeltsTextScorer(QwenScoringService qwen) { this.qwen = qwen; }

    @Override
    public CompletableFuture<Map<String, Object>> languageEvidence(Map<String, Object> structuredInput) {
        return qwen.evaluateIeltsLanguageEvidence(structuredInput);
    }

    @Override
    public CompletableFuture<Map<String, Object>> holisticJudge(Map<String, Object> structuredInput) {
        return qwen.evaluateIeltsJudge(structuredInput);
    }
}
