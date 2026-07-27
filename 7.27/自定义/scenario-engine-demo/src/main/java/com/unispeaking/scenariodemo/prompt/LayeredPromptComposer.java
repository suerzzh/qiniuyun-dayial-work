package com.unispeaking.scenariodemo.prompt;

import com.unispeaking.scenariodemo.domain.PromptProfile;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.stream.Collectors;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class LayeredPromptComposer {
    private final String base = text("prompts/base.txt");
    private final Map<String, String> coaches = properties("prompts/coaches.properties");
    private final Map<String, String> difficulties = properties("prompts/difficulties.properties");
    private final Map<String, String> speeds = properties("prompts/speeds.properties");
    private final Map<String, String> corrections = properties("prompts/corrections.properties");
    private final String memoryTemplate = text("prompts/memory.txt");
    private final String customSceneTemplate = text("prompts/scenes/custom.txt");

    public String composeCustom(
            PromptProfile profile,
            String sceneName,
            String aiRole,
            String sceneGoal,
            Map<String, String> requiredOutcomes) {
        List<String> layers = new ArrayList<>();
        layers.add(base);
        layers.add(required(coaches, profile.coach(), "coach"));
        layers.add(required(difficulties, profile.difficulty(), "difficulty"));
        layers.add(required(speeds, profile.speed(), "speed"));
        layers.add(required(corrections, profile.correction(), "correction"));
        if (!profile.memory().isBlank()) {
            layers.add(memoryTemplate.replace("{{memory_summary}}", profile.memory()));
        }
        layers.add(customSceneTemplate
                .replace("{{ai_role}}", aiRole)
                .replace("{{scene_name}}", sceneName)
                .replace("{{scene_goal}}", sceneGoal));
        layers.add(outcomeGuardrails(requiredOutcomes));
        return layers.stream().map(String::trim).filter(value -> !value.isBlank())
                .collect(Collectors.joining("\n\n"));
    }

    private String outcomeGuardrails(Map<String, String> outcomes) {
        String list = outcomes.entrySet().stream()
                .map(entry -> "- " + entry.getKey() + ": " + entry.getValue())
                .collect(Collectors.joining("\n"));
        return """
                Required scenario outcomes before the final recap:
                %s

                Guide the learner through missing outcomes without mentioning this list. Do not silently
                assume missing information. After all outcomes are covered, recap once and ask one explicit
                final confirmation. Accept corrections. After the learner confirms, say one short farewell,
                do not ask another question, and do not mention a state machine.
                """.formatted(list);
    }

    private static String required(Map<String, String> values, String key, String layer) {
        String value = values.get(key);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Missing " + layer + " prompt for key: " + key);
        }
        return value;
    }

    private static String text(String path) {
        try {
            return new ClassPathResource(path).getContentAsString(StandardCharsets.UTF_8).trim();
        } catch (IOException exception) {
            throw new IllegalStateException("Cannot load prompt resource: " + path, exception);
        }
    }

    private static Map<String, String> properties(String path) {
        Properties source = new Properties();
        try (InputStream input = new ClassPathResource(path).getInputStream()) {
            source.load(new java.io.InputStreamReader(input, StandardCharsets.UTF_8));
        } catch (IOException exception) {
            throw new IllegalStateException("Cannot load prompt resource: " + path, exception);
        }
        Map<String, String> result = new LinkedHashMap<>();
        source.stringPropertyNames().stream().sorted()
                .forEach(key -> result.put(key, source.getProperty(key).trim()));
        return Map.copyOf(result);
    }
}
