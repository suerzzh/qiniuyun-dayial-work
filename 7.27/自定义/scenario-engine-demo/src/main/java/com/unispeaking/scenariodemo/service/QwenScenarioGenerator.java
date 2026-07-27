package com.unispeaking.scenariodemo.service;

import com.unispeaking.scenariodemo.domain.PromptProfile;
import com.unispeaking.scenariodemo.domain.ScenarioDefinition;
import com.unispeaking.scenariodemo.prompt.LayeredPromptComposer;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class QwenScenarioGenerator {
    private static final String SYSTEM_PROMPT = """
            Create a practical English speaking role-play scenario from the user's topic.
            Return JSON only, without Markdown, using exactly this shape:
            {
              "goal":"...",
              "aiRole":"...",
              "userRole":"...",
              "requiredSlots":{"short_snake_case_key":"what completion means"},
              "maxTurns":12
            }
            Use 3 to 5 observable required slots. They are semantic success conditions, not keywords.
            Required slots must contain business content that must be collected BEFORE the final recap.
            Never create a slot for confirmation, agreement, saying yes, closing, or conversation completion;
            the state machine handles final confirmation separately.
            For ordering or purchasing scenarios, cover the actual configurable choices. Include an
            item/product slot and a size_or_quantity slot whenever the item can naturally vary by size
            or quantity. Also consider customization, side/options, fulfillment, and payment as relevant.
            Do not silently assume a default size or quantity.
            """;

    private final ObjectMapper mapper;
    private final LayeredPromptComposer promptComposer;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final String endpoint;
    private final String model;
    private final String apiKey;

    public QwenScenarioGenerator(
            ObjectMapper mapper,
            LayeredPromptComposer promptComposer,
            @Value("${demo.qwen.endpoint}") String endpoint,
            @Value("${demo.qwen.generator-model}") String model,
            @Value("${demo.qwen.api-key}") String apiKey) {
        this.mapper = mapper;
        this.promptComposer = promptComposer;
        this.endpoint = endpoint;
        this.model = model;
        this.apiKey = apiKey;
    }

    public ScenarioDefinition generate(String requestedTopic, PromptProfile profile) {
        String topic = requestedTopic == null || requestedTopic.isBlank()
                ? "Order coffee at a café" : requestedTopic.trim();
        if (apiKey == null || apiKey.isBlank()) throw new IllegalStateException("DASHSCOPE_API_KEY is not configured");
        try {
            Map<String, Object> payload = Map.of(
                    "model", model,
                    "messages", List.of(
                            Map.of("role", "system", "content", SYSTEM_PROMPT),
                            Map.of("role", "user", "content", topic)),
                    "temperature", 0.2,
                    "enable_thinking", false,
                    "response_format", Map.of("type", "json_object"));
            HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(30))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Qwen scenario generator HTTP " + response.statusCode() + ": " + response.body());
            }
            JsonNode root = mapper.readTree(response.body());
            String content = root.path("choices").path(0).path("message").path("content").asText().trim();
            if (content.startsWith("```")) {
                content = content.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "");
            }
            JsonNode generated = mapper.readTree(content);
            Map<String, String> slots = new LinkedHashMap<>();
            generated.path("requiredSlots").properties()
                    .forEach(entry -> slots.put(entry.getKey(), entry.getValue().asText()));
            slots.entrySet().removeIf(entry -> {
                String normalized = (entry.getKey() + " " + entry.getValue()).toLowerCase();
                return normalized.contains("confirm") || normalized.contains("saying yes")
                        || normalized.contains("final agreement") || normalized.contains("close the conversation");
            });
            if (isOrderingTopic(topic) && slots.keySet().stream().noneMatch(this::isSizeOrQuantitySlot)) {
                if (slots.size() >= 5) {
                    String removable = slots.keySet().stream()
                            .filter(key -> !key.contains("item") && !key.contains("product"))
                            .reduce((first, second) -> second).orElse(null);
                    if (removable != null) slots.remove(removable);
                }
                slots.put("size_or_quantity",
                        "learner specifies the applicable size, portion, or quantity; never assume a default");
            }
            if (slots.isEmpty()) throw new IllegalStateException("Qwen generated no required slots");
            String goal = generated.path("goal").asText();
            String aiRole = generated.path("aiRole").asText();
            String userRole = generated.path("userRole").asText();
            String instruction = promptComposer.composeCustom(profile, topic, aiRole, goal, slots);
            return new ScenarioDefinition(
                    topic,
                    goal,
                    aiRole,
                    userRole,
                    slots,
                    generated.path("maxTurns").asInt(12),
                    instruction,
                    profile);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Qwen scenario generation was interrupted", exception);
        } catch (Exception exception) {
            throw exception instanceof IllegalStateException state ? state
                    : new IllegalStateException("Cannot generate scenario: " + exception.getMessage(), exception);
        }
    }

    private boolean isOrderingTopic(String topic) {
        String normalized = topic.toLowerCase();
        return normalized.contains("order") || normalized.contains("buy")
                || normalized.contains("purchase") || normalized.contains("shopping")
                || normalized.contains("点单") || normalized.contains("点餐") || normalized.contains("买");
    }

    private boolean isSizeOrQuantitySlot(String key) {
        String normalized = key.toLowerCase();
        return normalized.contains("size") || normalized.contains("quantity")
                || normalized.contains("portion") || normalized.contains("amount");
    }
}
