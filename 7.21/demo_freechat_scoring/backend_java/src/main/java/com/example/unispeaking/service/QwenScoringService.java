package com.example.unispeaking.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.unispeaking.service.ielts.IeltsPromptCatalog;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class QwenScoringService {
    private IeltsPromptCatalog ieltsPrompts;

    public QwenScoringService() {}

    @Autowired
    public QwenScoringService(IeltsPromptCatalog ieltsPrompts) {
        this.ieltsPrompts = ieltsPrompts;
    }
    @Value("${dashscope.api.key}")
    private String apiKey;

    @Value("${qwen.scoring.model:qwen-plus}")
    private String scoringModel;

    @Value("${qwen.ielts.judge.model:qwen-plus}")
    private String ieltsJudgeModel;

    @Value("${qwen.compatible.endpoint:https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions}")
    private String compatibleEndpoint;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private static final String LANGUAGE_PROMPT = """
You are an English speaking assessment service. Score the learner's RAW transcript without silently correcting it. Use the provided recent conversation to judge whether the reply is relevant and whether a short reply is valid. Return JSON only with: grammar_score (0-100), vocab_score (0-100), naturalness_score (0-100), feedback (concise Chinese), corrected_expression, suggested_expressions (array of 1-2 strings), and sentences (array of objects with original, feedback, corrected). Do not punish a contextually valid short answer; the caller may omit language aggregation for it.
""";

    private static final String REFERENCE_PROMPT = """
You perform context-constrained ASR correction for pronunciation assessment. Preserve the learner's actual grammar, tense, articles, number, word choice, and intent. You may only normalize punctuation/case or replace at most two highly confident probable ASR misrecognitions when context makes the intended sound-alike word unambiguous. Never improve grammar or rewrite the sentence. Return JSON only: {"pronunciation_reference":"...","changes":[{"original":"...","replacement":"...","type":"probable_asr_error","confidence":0.0,"reason":"..."}]}. If uncertain, return the raw transcript unchanged with an empty changes array.
""";

    private static final String TASK_PROMPT = """
You assess completion of a spoken English practice task from the full conversation. Return JSON only with task_completion_score, relevance_score, coherence_score (each 0-100), task_performance_score calculated as 40% task completion + 30% relevance + 30% coherence, and feedback in concise Chinese.
""";

    private static final String SCENARIO_PROMPT = """
You design concise English scenario-learning material for Chinese learners. Return JSON only with: title, goal, words, phrases, sentences. words must contain 6 objects with text and meaning. phrases must contain 4 objects with text and meaning; each phrase must be a reusable 2-6 word chunk rather than a complete sentence. sentences must contain 4 objects with text and meaning. All meaning fields must be concise Simplified Chinese. Keep all English natural, practical, clearly related to the requested scenario, and appropriate for the supplied learner level. Explicit user requirements about learner age, language difficulty, role, permitted Chinese support, and topic boundaries override default assumptions. Sentences must be complete spoken sentences suitable for read-aloud pronunciation practice and later role-play. Do not include Markdown.
""";

    public CompletableFuture<Map<String, Object>> evaluateGrammar(String text) {
        return evaluateLanguage(text, List.of());
    }

    public CompletableFuture<Map<String, Object>> evaluateLanguage(
            String rawTranscript,
            List<Map<String, String>> context
    ) {
        String user = "Recent conversation:\n" + contextText(context) +
                "\n\nRAW learner transcript:\n" + rawTranscript;
        return callJson(LANGUAGE_PROMPT, user).thenApply(json -> {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("grammar_score", boundedInt(json, "grammar_score"));
            result.put("vocab_score", boundedInt(json, "vocab_score"));
            result.put("naturalness_score", boundedInt(json, "naturalness_score"));
            result.put("feedback", text(json, "feedback"));
            result.put("corrected_expression", text(json, "corrected_expression"));
            result.put("suggested_expressions", stringList(json.get("suggested_expressions")));
            result.put("sentences", objectList(json.get("sentences")));
            return result;
        });
    }

    public CompletableFuture<Map<String, Object>> buildPronunciationReference(
            String rawTranscript,
            List<Map<String, String>> context
    ) {
        String user = "Recent conversation:\n" + contextText(context) +
                "\n\nRAW transcript:\n" + rawTranscript;
        return callJson(REFERENCE_PROMPT, user)
                .thenApply(json -> validateReference(rawTranscript, json))
                .exceptionally(error -> referenceFallback(rawTranscript, "correction_unavailable"));
    }

    public CompletableFuture<Map<String, Object>> evaluateTaskPerformance(
            String taskGoal,
            List<Map<String, String>> conversation
    ) {
        String user = "Task goal:\n" + (taskGoal == null ? "" : taskGoal) +
                "\n\nConversation:\n" + contextText(conversation);
        return callJson(TASK_PROMPT, user).thenApply(json -> {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("task_completion_score", boundedInt(json, "task_completion_score"));
            result.put("relevance_score", boundedInt(json, "relevance_score"));
            result.put("coherence_score", boundedInt(json, "coherence_score"));
            double calculated = 0.4 * number(result.get("task_completion_score"))
                    + 0.3 * number(result.get("relevance_score"))
                    + 0.3 * number(result.get("coherence_score"));
            result.put("task_performance_score", round1(calculated));
            result.put("feedback", text(json, "feedback"));
            return result;
        });
    }

    public CompletableFuture<Map<String, Object>> generateScenarioContent(String topic, int learnerLevel) {
        String normalizedTopic = topic == null || topic.isBlank() ? "ordering coffee" : topic.trim();
        String user = "Scenario: " + normalizedTopic + "\nLearner level: " + learnerLevel;
        return callJson(SCENARIO_PROMPT, user).thenApply(json -> {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("title", text(json, "title"));
            result.put("goal", text(json, "goal"));
            result.put("words", learningItems(json.get("words"), 8));
            result.put("phrases", learningItems(json.get("phrases"), 6));
            result.put("sentences", learningItems(json.get("sentences"), 6));
            return result;
        });
    }

    public CompletableFuture<Map<String, Object>> evaluateIeltsLanguageEvidence(Map<String, Object> structuredInput) {
        try {
            String user = objectMapper.writeValueAsString(structuredInput == null ? Map.of() : structuredInput);
            return callJson(ieltsPrompt("language"), user, configured(scoringModel))
                    .thenApply(json -> objectMapper.convertValue(json, new TypeReference<>() {}));
        } catch (Exception error) {
            return CompletableFuture.failedFuture(error);
        }
    }

    public CompletableFuture<Map<String, Object>> evaluateIeltsJudge(Map<String, Object> structuredInput) {
        try {
            String user = objectMapper.writeValueAsString(structuredInput == null ? Map.of() : structuredInput);
            return callJson(ieltsPrompt("judge"), user, configured(ieltsJudgeModel))
                    .thenApply(json -> objectMapper.convertValue(json, new TypeReference<>() {}));
        } catch (Exception error) {
            return CompletableFuture.failedFuture(error);
        }
    }

    public CompletableFuture<Map<String, Object>> evaluateIelts(Map<String, Object> structuredInput) {
        return evaluateIeltsLanguageEvidence(structuredInput).thenCompose(language -> {
            Map<String, Object> combined = new LinkedHashMap<>(structuredInput == null ? Map.of() : structuredInput);
            combined.put("language_evidence", language);
            return evaluateIeltsJudge(combined);
        });
    }

    Map<String, Object> parseIeltsJsonForTest(String rawJson) throws Exception {
        JsonNode json = objectMapper.readTree(rawJson);
        if (json == null || !json.isObject()) throw new IllegalArgumentException("Qwen IELTS response must be a JSON object");
        return objectMapper.convertValue(json, new TypeReference<>() {});
    }

    private CompletableFuture<JsonNode> callJson(String systemPrompt, String userContent) {
        return callJson(systemPrompt, userContent, configured(scoringModel));
    }

    private CompletableFuture<JsonNode> callJson(String systemPrompt, String userContent, String model) {
        if (apiKey == null || apiKey.isBlank() || "your_api_key_here".equals(apiKey)) {
            return CompletableFuture.failedFuture(
                    new IllegalStateException("DASHSCOPE_API_KEY is not configured"));
        }
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", model);
            body.put("messages", List.of(
                    Map.of("role", "system", "content", systemPrompt),
                    Map.of("role", "user", "content", userContent)
            ));
            body.put("response_format", Map.of("type", "json_object"));
            body.put("temperature", 0.1);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(configured(compatibleEndpoint)))
                    .timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(
                            objectMapper.writeValueAsString(body), StandardCharsets.UTF_8))
                    .build();
            return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                    .thenApply(response -> {
                        try {
                            if (response.statusCode() != 200) {
                                throw new IllegalStateException("Qwen API status " + response.statusCode());
                            }
                            JsonNode root = objectMapper.readTree(response.body());
                            return objectMapper.readTree(
                                    root.path("choices").path(0).path("message").path("content").asText());
                        } catch (Exception error) {
                            throw new RuntimeException(error);
                        }
                    });
        } catch (Exception error) {
            return CompletableFuture.failedFuture(error);
        }
    }

    private String configured(String value) {
        return value == null || value.isBlank() ? "qwen-plus" : value.trim();
    }

    private String ieltsPrompt(String kind) {
        if (ieltsPrompts == null) throw new IllegalStateException("IELTS prompt catalog is not configured");
        return "judge".equals(kind) ? ieltsPrompts.judge() : ieltsPrompts.languageEvidence();
    }

    private Map<String, Object> validateReference(String raw, JsonNode json) {
        JsonNode changesNode = json.get("changes");
        if (changesNode == null || !changesNode.isArray() || changesNode.size() == 0) {
            return referenceFallback(raw, "unchanged");
        }
        if (changesNode.size() > 2) return referenceFallback(raw, "too_many_changes");

        String candidate = raw;
        List<Map<String, Object>> accepted = new ArrayList<>();
        for (JsonNode change : changesNode) {
            String original = text(change, "original").trim();
            String replacement = text(change, "replacement").trim();
            double confidence = change.path("confidence").asDouble(0.0);
            if (!"probable_asr_error".equals(text(change, "type")) || confidence < 0.90
                    || !singleWord(original) || !singleWord(replacement)
                    || looksLikeGrammarChange(original, replacement)) {
                return referenceFallback(raw, "confidence_or_scope_rejected");
            }
            Pattern pattern = Pattern.compile("(?i)\\b" + Pattern.quote(original) + "\\b");
            Matcher matcher = pattern.matcher(candidate);
            if (!matcher.find()) return referenceFallback(raw, "original_not_found");
            candidate = matcher.replaceFirst(Matcher.quoteReplacement(replacement));
            accepted.add(Map.of(
                    "original", original,
                    "replacement", replacement,
                    "type", "probable_asr_error",
                    "confidence", confidence,
                    "reason", text(change, "reason")
            ));
        }
        String proposed = text(json, "pronunciation_reference").trim();
        if (!normalize(candidate).equalsIgnoreCase(normalize(proposed))) {
            return referenceFallback(raw, "unlisted_rewrite_rejected");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("pronunciation_reference", candidate);
        result.put("changes", accepted);
        result.put("confidence", accepted.stream()
                .mapToDouble(change -> ((Number) change.get("confidence")).doubleValue()).min().orElse(1.0));
        result.put("status", "corrected");
        return result;
    }

    private Map<String, Object> referenceFallback(String raw, String reason) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("pronunciation_reference", raw == null ? "" : raw.trim());
        result.put("changes", List.of());
        result.put("confidence", 1.0);
        result.put("status", reason);
        return result;
    }

    private String contextText(List<Map<String, String>> context) {
        if (context == null || context.isEmpty()) return "(none)";
        int start = Math.max(0, context.size() - 10);
        StringBuilder text = new StringBuilder();
        for (int i = start; i < context.size(); i++) {
            Map<String, String> message = context.get(i);
            text.append(message.getOrDefault("role", "unknown"))
                    .append(": ").append(message.getOrDefault("text", "")).append('\n');
        }
        return text.toString();
    }

    private int boundedInt(JsonNode json, String field) {
        return Math.max(0, Math.min(100, json.path(field).asInt(0)));
    }
    private String text(JsonNode json, String field) { return json == null ? "" : json.path(field).asText(""); }
    private boolean singleWord(String value) { return value != null && value.matches("[A-Za-z][A-Za-z'-]*"); }
    private boolean looksLikeGrammarChange(String original, String replacement) {
        String left = original.toLowerCase(Locale.ROOT);
        String right = replacement.toLowerCase(Locale.ROOT);
        Set<String> articles = Set.of("a", "an", "the");
        Set<String> auxiliaries = Set.of("am", "is", "are", "was", "were", "be", "been", "being",
                "have", "has", "had", "do", "does", "did", "will", "would", "can", "could");
        Set<Set<String>> irregularForms = Set.of(
                Set.of("go", "went", "gone"), Set.of("come", "came"), Set.of("see", "saw", "seen"),
                Set.of("eat", "ate", "eaten"), Set.of("take", "took", "taken"),
                Set.of("make", "made"), Set.of("say", "said"), Set.of("get", "got", "gotten")
        );
        if ((articles.contains(left) || articles.contains(right)) && !left.equals(right)) return true;
        if (auxiliaries.contains(left) && auxiliaries.contains(right) && !left.equals(right)) return true;
        if (irregularForms.stream().anyMatch(forms -> forms.contains(left) && forms.contains(right))) return true;
        String shorter = left.length() <= right.length() ? left : right;
        String longer = left.length() > right.length() ? left : right;
        return longer.startsWith(shorter) && longer.length() - shorter.length() <= 3;
    }
    private String normalize(String value) { return value == null ? "" : value.replaceAll("[^A-Za-z']+", " ").trim().replaceAll("\\s+", " "); }
    private double number(Object value) { return value instanceof Number ? ((Number) value).doubleValue() : 0.0; }
    private double round1(double value) { return Math.round(value * 10.0) / 10.0; }
    private List<String> stringList(JsonNode node) {
        if (node == null || !node.isArray()) return List.of();
        List<String> result = new ArrayList<>();
        node.forEach(item -> result.add(item.asText()));
        return result;
    }
    private List<Map<String, Object>> objectList(JsonNode node) {
        if (node == null || !node.isArray()) return List.of();
        return objectMapper.convertValue(node, new TypeReference<>() {});
    }

    private List<Map<String, String>> learningItems(JsonNode node, int maxItems) {
        if (node == null || !node.isArray()) return List.of();
        List<Map<String, String>> result = new ArrayList<>();
        for (JsonNode item : node) {
            String itemText = text(item, "text").trim();
            if (itemText.isBlank()) continue;
            result.add(Map.of(
                    "text", itemText,
                    "meaning", text(item, "meaning").trim()
            ));
            if (result.size() >= maxItems) break;
        }
        return result;
    }
}
