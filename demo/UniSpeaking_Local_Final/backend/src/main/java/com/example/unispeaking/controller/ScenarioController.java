package com.example.unispeaking.controller;

import com.example.unispeaking.model.ScenarioState;
import com.example.unispeaking.service.QwenScoringService;
import com.example.unispeaking.service.ScenarioRegistry;
import com.example.unispeaking.service.XfyunIseService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/scenarios")
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {
        RequestMethod.GET, RequestMethod.POST, RequestMethod.OPTIONS
})
public class ScenarioController {
    private final QwenScoringService qwenScoringService;
    private final XfyunIseService xfyunIseService;
    private final ScenarioRegistry scenarioRegistry;

    public ScenarioController(
            QwenScoringService qwenScoringService,
            XfyunIseService xfyunIseService,
            ScenarioRegistry scenarioRegistry
    ) {
        this.qwenScoringService = qwenScoringService;
        this.xfyunIseService = xfyunIseService;
        this.scenarioRegistry = scenarioRegistry;
    }

    @PostMapping
    public ResponseEntity<?> createScenario(@RequestBody Map<String, Object> request) {
        String topic = String.valueOf(request.getOrDefault("topic", "ordering coffee")).trim();
        int learnerLevel = request.get("learner_level") instanceof Number
                ? Math.max(1, Math.min(6, ((Number) request.get("learner_level")).intValue())) : 3;
        if (topic.isBlank()) return ResponseEntity.badRequest().body(Map.of("error", "请输入场景主题"));
        if (topic.length() > 4_000) {
            return ResponseEntity.badRequest().body(Map.of("error", "场景要求不能超过 4000 个字符"));
        }
        try {
            Map<String, Object> generated = qwenScoringService
                    .generateScenarioContent(topic, learnerLevel).join();
            String scenarioId = UUID.randomUUID().toString().replace("-", "");
            Map<String, Object> content = normalizeContent(generated, scenarioId, topic);
            ScenarioState scenario = new ScenarioState(scenarioId, topic, learnerLevel, content);
            scenarioRegistry.put(scenario);
            return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(scenario));
        } catch (Exception error) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
                    "error", "场景内容生成失败，请稍后重试",
                    "detail", rootCause(error)
            ));
        }
    }

    @GetMapping("/{scenarioId}")
    public ResponseEntity<?> getScenario(@PathVariable String scenarioId) {
        ScenarioState scenario = scenarioRegistry.get(scenarioId);
        return scenario == null
                ? ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "场景不存在"))
                : ResponseEntity.ok(toResponse(scenario));
    }

    @PostMapping(value = "/{scenarioId}/reading-attempts", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> scoreReadingAttempt(
            @PathVariable String scenarioId,
            @RequestParam("sentence_id") String sentenceId,
            @RequestPart("audio") MultipartFile audio
    ) {
        ScenarioState scenario = scenarioRegistry.get(scenarioId);
        if (scenario == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "场景不存在"));
        }
        Map<String, Object> sentence = findSentence(scenario, sentenceId);
        if (sentence == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "跟读句子不存在"));
        }
        try {
            byte[] audioBytes = audio.getBytes();
            if (audioBytes.length < 3_200) {
                return ResponseEntity.badRequest().body(Map.of("error", "录音时间太短，请完整朗读句子"));
            }
            String referenceText = String.valueOf(sentence.get("text"));
            Map<String, Object> pronunciation = xfyunIseService
                    .evaluatePronunciation(audioBytes, referenceText).join();
            double performance = round1(
                    0.6 * number(pronunciation.get("accuracy_score"))
                            + 0.4 * number(pronunciation.get("fluency_score")));
            Map<String, Object> attempt = new LinkedHashMap<>();
            attempt.put("attempt_id", UUID.randomUUID().toString().replace("-", ""));
            attempt.put("sentence_id", sentenceId);
            attempt.put("reference_text", referenceText);
            attempt.put("pronunciation_performance", performance);
            attempt.put("pronunciation", pronunciation);
            attempt.put("audio_duration_ms", Math.max(0, (audioBytes.length - 44) / 32));
            attempt.put("created_at", Instant.now().toString());
            scenario.getReadingAttempts().add(attempt);
            return ResponseEntity.ok(attempt);
        } catch (Exception error) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
                    "error", "跟读评分失败，请重试",
                    "detail", rootCause(error)
            ));
        }
    }

    @GetMapping("/{scenarioId}/report")
    public ResponseEntity<?> getScenarioReport(@PathVariable String scenarioId) {
        ScenarioState scenario = scenarioRegistry.get(scenarioId);
        if (scenario == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "场景不存在"));
        }
        Map<String, Double> bestBySentence = new LinkedHashMap<>();
        for (Map<String, Object> attempt : scenario.getReadingAttempts()) {
            String sentenceId = String.valueOf(attempt.get("sentence_id"));
            double score = number(attempt.get("pronunciation_performance"));
            bestBySentence.merge(sentenceId, score, Math::max);
        }
        double average = bestBySentence.values().stream().mapToDouble(Double::doubleValue).average().orElse(0);
        int totalSentences = contentList(scenario.getContent().get("sentences")).size();
        return ResponseEntity.ok(Map.of(
                "scenario_id", scenarioId,
                "reading", Map.of(
                        "completed_sentences", bestBySentence.size(),
                        "total_sentences", totalSentences,
                        "average_pronunciation", bestBySentence.isEmpty() ? 0 : round1(average),
                        "best_by_sentence", bestBySentence,
                        "attempts", scenario.getReadingAttempts()
                )
        ));
    }

    private Map<String, Object> normalizeContent(
            Map<String, Object> generated, String scenarioId, String topic) {
        Map<String, Object> content = new LinkedHashMap<>();
        String title = String.valueOf(generated.getOrDefault("title", topic)).trim();
        String goal = String.valueOf(generated.getOrDefault("goal", topic)).trim();
        content.put("title", title.isBlank() ? topic : title);
        content.put("goal", goal.isBlank() ? topic : goal);
        content.put("words", withIds(generated.get("words"), "word"));
        content.put("phrases", withIds(generated.get("phrases"), "phrase"));
        content.put("sentences", withIds(generated.get("sentences"), "sentence"));
        content.put("scenario_id", scenarioId);
        return content;
    }

    private List<Map<String, Object>> withIds(Object value, String prefix) {
        List<Map<String, Object>> result = new ArrayList<>();
        int index = 0;
        for (Map<String, Object> item : contentList(value)) {
            String text = String.valueOf(item.getOrDefault("text", "")).trim();
            if (text.isBlank()) continue;
            result.add(new LinkedHashMap<>(Map.of(
                    "id", prefix + "_" + (++index),
                    "text", text,
                    "meaning", String.valueOf(item.getOrDefault("meaning", "")).trim()
            )));
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> contentList(Object value) {
        return value instanceof List<?> ? (List<Map<String, Object>>) value : List.of();
    }

    private Map<String, Object> findSentence(ScenarioState scenario, String sentenceId) {
        return contentList(scenario.getContent().get("sentences")).stream()
                .filter(item -> sentenceId.equals(item.get("id"))).findFirst().orElse(null);
    }

    private Map<String, Object> toResponse(ScenarioState scenario) {
        Map<String, Object> response = new LinkedHashMap<>(scenario.getContent());
        response.put("topic", scenario.getTopic());
        response.put("learner_level", scenario.getLearnerLevel());
        response.put("reading_attempt_count", scenario.getReadingAttempts().size());
        return response;
    }

    private double number(Object value) {
        return value instanceof Number ? ((Number) value).doubleValue() : 0.0;
    }
    private double round1(double value) { return Math.round(value * 10.0) / 10.0; }
    private String rootCause(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null) current = current.getCause();
        return current.getMessage() == null ? current.getClass().getSimpleName() : current.getMessage();
    }
}
