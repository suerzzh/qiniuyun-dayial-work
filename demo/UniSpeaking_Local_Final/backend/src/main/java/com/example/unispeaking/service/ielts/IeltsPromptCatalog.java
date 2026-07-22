package com.example.unispeaking.service.ielts;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Component
public class IeltsPromptCatalog {
    private final String version;
    private final String examinerSystem;
    private final String languageEvidence;
    private final String judge;

    public IeltsPromptCatalog(
            @Value("${ielts.prompt.version:ielts-2026-07-21.1}") String version,
            @Value("${ielts.prompt.examiner-resource:classpath:prompts/ielts/examiner-system.txt}") Resource examiner,
            @Value("${ielts.prompt.language-resource:classpath:prompts/ielts/language-evidence.txt}") Resource language,
            @Value("${ielts.prompt.judge-resource:classpath:prompts/ielts/judge.txt}") Resource judge) {
        this.version = version == null || version.isBlank() ? "ielts-2026-07-21.1" : version.trim();
        this.examinerSystem = read(examiner, "examiner");
        this.languageEvidence = read(language, "language evidence");
        this.judge = read(judge, "judge");
    }

    public String version() { return version; }
    public String examinerSystem() { return examinerSystem; }
    public String languageEvidence() { return languageEvidence; }
    public String judge() { return judge; }

    private static String read(Resource resource, String label) {
        try (var input = resource.getInputStream()) {
            String value = new String(input.readAllBytes(), StandardCharsets.UTF_8).trim();
            if (value.isBlank()) throw new IllegalStateException("IELTS " + label + " prompt is empty");
            return value;
        } catch (IOException error) {
            throw new IllegalStateException("Cannot load IELTS " + label + " prompt", error);
        }
    }
}
