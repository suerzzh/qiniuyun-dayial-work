package com.unispeaking.scenariodemo.service;

import com.unispeaking.scenariodemo.domain.EventType;
import com.unispeaking.scenariodemo.domain.ScenarioEvent;
import com.unispeaking.scenariodemo.domain.ScenarioSession;
import com.unispeaking.scenariodemo.domain.Speaker;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class QwenEventExtractor {
    private static final String SYSTEM_PROMPT = """
            You are a semantic event extractor for a task-oriented conversation state machine.
            Analyze the newest transcript in the context of current state and order.
            Return JSON only, without Markdown:
            {"type":"ORDER_UPDATE","values":{"slot_key":"semantic value"},"previousValues":{},"confidence":0.95,"correctedTranscript":"..."}

            The type field must be exactly one of these values:
            GREETING_STARTED: the AI role begins the scenario with a greeting or opening question.
            ORDER_UPDATE: the user provides one or more required slot values defined by this scenario.
            CORRECTION: the user changes an existing slot. Put new values in values and old ones in previousValues.
            USER_CONFIRMED: the user clearly confirms the AI's FINAL recap, or answers an explicit
            "is everything correct / are we all set" completion question. This may be emitted even
            if the tracked stage still says COLLECTING_INFORMATION because extraction can lag.
            A yes/no answer to an ordinary slot question (receipt, payment, preference, date, etc.)
            is ORDER_UPDATE, never USER_CONFIRMED.
            AI_CLOSED: only when the AI gives an explicit final farewell after the task is done,
            with no follow-up question and no next business step. "Got it", "here is your change",
            or asking about a receipt is not closing. "Have a great day" / "Take care" is closing.
            UNEXPECTED_REQUEST: relevant transcript but none of the above applies.
            NONE: filler, partial speech, or a normal AI turn that changes no scenario state.

            Keep slot keys exactly as defined by the scenario. Understand meaning semantically.
            Observable completed actions can fill a slot with values such as "completed" or "yes";
            do not require the learner to literally name the slot. A correction overrides old data.
            For USER_CONFIRMED, include in values any required slots that are clearly satisfied by
            the full recent conversation but missing from current state.

            Also produce correctedTranscript for the newest USER transcript. Make only high-confidence,
            minimal phonetic corrections using the immediately preceding AI question and conversation
            context. Example: if the AI offered "fries, apple slices, or carrots" and ASR produced
            "Price", correctedTranscript should be "Fries." Preserve what the learner actually meant;
            never rewrite grammar or invent content. If no correction is needed, copy the transcript.
            """;

    private final ObjectMapper mapper;
    private final HttpClient client;
    private final String endpoint;
    private final String model;
    private final String apiKey;

    public QwenEventExtractor(
            ObjectMapper mapper,
            @Value("${demo.qwen.endpoint}") String endpoint,
            @Value("${demo.qwen.extractor-model}") String model,
            @Value("${demo.qwen.api-key}") String apiKey) {
        this.mapper = mapper;
        this.endpoint = endpoint;
        this.model = model;
        this.apiKey = apiKey;
        this.client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    public ScenarioEvent extract(ScenarioSession session, Speaker speaker, String transcript) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("DASHSCOPE_API_KEY is not configured");
        }
        try {
            String context = mapper.writeValueAsString(Map.of(
                    "scenario", session.getDefinition(),
                    "stage", session.getStage(),
                    "status", session.getStatus(),
                    "order", session.getOrder(),
                    "recentConversation", session.getConversation().stream()
                            .skip(Math.max(0, session.getConversation().size() - 16L)).toList(),
                    "speaker", speaker,
                    "newestTranscript", transcript));
            Map<String, Object> payload = Map.of(
                    "model", model,
                    "messages", List.of(
                            Map.of("role", "system", "content", SYSTEM_PROMPT),
                            Map.of("role", "user", "content", context)),
                    "temperature", 0,
                    "enable_thinking", false,
                    "response_format", Map.of("type", "json_object"));
            HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(25))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Qwen extractor HTTP " + response.statusCode() + ": " + response.body());
            }
            JsonNode root = mapper.readTree(response.body());
            String content = root.path("choices").path(0).path("message").path("content").asText();
            return parse(content, transcript);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Qwen extractor was interrupted", exception);
        } catch (Exception exception) {
            throw exception instanceof IllegalStateException state ? state
                    : new IllegalStateException("Cannot extract scenario event: " + exception.getMessage(), exception);
        }
    }

    private ScenarioEvent parse(String content, String originalTranscript) throws Exception {
        String json = content.trim();
        if (json.startsWith("```")) {
            json = json.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "");
        }
        JsonNode node = mapper.readTree(json);
        String type = node.path("type").asText("NONE");
        if ("EVENT".equals(type)) {
            type = node.path("values").isObject() && !node.path("values").isEmpty()
                    ? "ORDER_UPDATE" : "NONE";
        }
        String correctedTranscript = node.path("correctedTranscript").asText(null);
        boolean transcriptChanged = correctedTranscript != null && !correctedTranscript.isBlank()
                && !correctedTranscript.trim().equals(originalTranscript.trim());
        if ("NONE".equals(type) && !transcriptChanged) return null;
        EventType eventType = "NONE".equals(type) ? EventType.TRANSCRIPT_CORRECTED : EventType.valueOf(type);
        return new ScenarioEvent(
                eventType,
                stringMap(node.path("values")),
                stringMap(node.path("previousValues")),
                node.path("confidence").asDouble(0.5),
                correctedTranscript,
                Instant.now());
    }

    private Map<String, String> stringMap(JsonNode node) {
        if (!node.isObject()) return Map.of();
        Map<String, String> values = new java.util.LinkedHashMap<>();
        node.properties().forEach(entry -> values.put(entry.getKey(), entry.getValue().asText()));
        return values;
    }
}
