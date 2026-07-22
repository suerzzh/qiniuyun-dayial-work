package com.example.unispeaking.controller;

import com.example.unispeaking.model.ielts.IeltsAttempt;
import com.example.unispeaking.model.ielts.IeltsScoringStatus;
import com.example.unispeaking.service.ielts.IeltsAttemptRegistry;
import com.example.unispeaking.service.ielts.IeltsScoringOrchestrator;
import com.example.unispeaking.service.ielts.IeltsPromptCatalog;
import com.example.unispeaking.service.ielts.IeltsTurn;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/ielts/attempts")
@CrossOrigin(origins = {"http://127.0.0.1:8080", "http://localhost:8080"})
public class IeltsAttemptController {
    private final IeltsAttemptRegistry registry;
    private final IeltsScoringOrchestrator orchestrator;
    private final IeltsPromptCatalog prompts;

    public IeltsAttemptController(IeltsAttemptRegistry registry, IeltsScoringOrchestrator orchestrator,
                                  IeltsPromptCatalog prompts) {
        this.registry = registry;
        this.orchestrator = orchestrator;
        this.prompts = prompts;
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> request) {
        String mode = String.valueOf(request.getOrDefault("mode", "full_mock"));
        if (!Set.of("full_mock", "practice_part").contains(mode))
            return ResponseEntity.badRequest().body(Map.of("error", "mode must be full_mock or practice_part"));
        String id = "att_" + UUID.randomUUID().toString().replace("-", "");
        IeltsAttempt attempt = new IeltsAttempt(id, mode, map(request.get("paper_snapshot")));
        registry.put(attempt);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("attempt_id", id);
        response.put("mode", mode);
        response.put("scoring_status", attempt.getScoringStatus());
        response.put("prompt_version", attempt.getPromptVersion());
        response.put("timing_profile", attempt.getTimingProfile());
        response.put("scoring_ws_url", "/api/ielts/scoring-stream?attempt_id=" + id);
        response.put("realtime_session_config", realtimeConfig(mode));
        return ResponseEntity.status(201).body(response);
    }

    @GetMapping("/{attemptId}")
    public ResponseEntity<?> get(@PathVariable String attemptId) {
        IeltsAttempt attempt = registry.get(attemptId);
        return attempt == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(snapshot(attempt));
    }

    @PostMapping("/{attemptId}/finalize")
    public ResponseEntity<?> finalizeAttempt(@PathVariable String attemptId) {
        IeltsAttempt attempt = registry.get(attemptId);
        if (attempt == null) return ResponseEntity.notFound().build();
        if (attempt.getReport() != null) return ResponseEntity.ok(attempt.getReport());
        CompletableFuture<?> running = registry.scoring(attemptId);
        if (running == null) {
            attempt.setScoringStatus(IeltsScoringStatus.FINALIZING);
            registry.startScoring(attemptId, () -> orchestrator.score(attempt));
        }
        return ResponseEntity.accepted().body(Map.of(
                "attempt_id", attemptId,
                "scoring_status", attempt.getScoringStatus(),
                "report_url", "/api/ielts/attempts/" + attemptId + "/report"));
    }

    @GetMapping("/{attemptId}/scoring-status")
    public ResponseEntity<?> status(@PathVariable String attemptId) {
        IeltsAttempt attempt = registry.get(attemptId);
        return attempt == null ? ResponseEntity.notFound().build()
                : ResponseEntity.ok(Map.of("attempt_id", attemptId, "scoring_status", attempt.getScoringStatus()));
    }

    @GetMapping("/{attemptId}/report")
    public ResponseEntity<?> report(@PathVariable String attemptId) {
        IeltsAttempt attempt = registry.get(attemptId);
        if (attempt == null) return ResponseEntity.notFound().build();
        if (attempt.getReport() == null) return ResponseEntity.accepted().body(
                Map.of("attempt_id", attemptId, "scoring_status", attempt.getScoringStatus()));
        return ResponseEntity.ok(attempt.getReport());
    }

    @PostMapping("/{attemptId}/abandon")
    public ResponseEntity<?> abandon(@PathVariable String attemptId) {
        IeltsAttempt attempt = registry.get(attemptId);
        if (attempt == null) return ResponseEntity.notFound().build();
        attempt.setScoringStatus(IeltsScoringStatus.ABANDONED);
        return ResponseEntity.ok(Map.of("attempt_id", attemptId, "scoring_status", IeltsScoringStatus.ABANDONED));
    }

    @DeleteMapping("/{attemptId}")
    public ResponseEntity<?> delete(@PathVariable String attemptId) {
        return registry.remove(attemptId) == null ? ResponseEntity.notFound().build() : ResponseEntity.noContent().build();
    }

    private Map<String, Object> snapshot(IeltsAttempt attempt) {
        List<Map<String, Object>> turns = attempt.getTurns().stream().map(this::turnSnapshot).toList();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("attempt_id", attempt.getAttemptId());
        response.put("mode", attempt.getMode());
        response.put("current_part", attempt.getCurrentPart());
        response.put("question_id", attempt.getQuestionId());
        response.put("question_text_snapshot", attempt.getQuestionTextSnapshot());
        response.put("scoring_status", attempt.getScoringStatus());
        response.put("prompt_version", attempt.getPromptVersion());
        response.put("timing_profile", attempt.getTimingProfile());
        response.put("turns", turns);
        return response;
    }

    private Map<String, Object> turnSnapshot(IeltsTurn turn) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("turn_id", turn.turnId());
        item.put("part", turn.part());
        item.put("question_id", turn.questionId());
        item.put("question_text_snapshot", turn.questionTextSnapshot());
        item.put("raw_transcript", turn.rawTranscript());
        item.put("audio_segment", Map.of("format", "PCM_S16LE", "sample_rate", 16000,
                "channels", 1, "byte_length", turn.audioByteLength()));
        item.put("speech_chunks", turn.speechChunks());
        item.put("completed", turn.completed());
        item.put("turn_type", turn.part() == 0 ? "INTRODUCTION" : turn.part2LongTurn() ? "PART2_LONG_TURN" : "STANDARD");
        item.put("scoring_eligible", turn.scoringEligible());
        return item;
    }

    private Map<String, Object> realtimeConfig(String mode) {
        return Map.of(
                "input_audio_format", "pcm",
                "input_audio_transcription", Map.of("model", "qwen3-asr-flash-realtime"),
                "turn_detection", Map.of(
                        "type", "server_vad",
                        "threshold", 0.5,
                        "prefix_padding_ms", 500,
                        "silence_duration_ms", 800,
                        "create_response", false,
                        "interrupt_response", false),
                "instructions", prompts.examinerSystem()
        );
    }

    @SuppressWarnings("unchecked") private Map<String, Object> map(Object value) {
        return value instanceof Map<?, ?> raw ? (Map<String, Object>) raw : Map.of();
    }
}
