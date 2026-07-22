package com.example.unispeaking.service;

import com.example.unispeaking.service.ielts.IeltsPromptCatalog;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class QwenScoringServicePromptLanguageTest {
    @Autowired IeltsPromptCatalog prompts;

    @Test
    void ieltsPromptsAreVersionedResourcesWithChineseFeedbackAndDeterministicBoundaries() {
        assertTrue(prompts.version().startsWith("ielts-"));
        assertTrue(prompts.languageEvidence().contains("Simplified Chinese"));
        assertTrue(prompts.languageEvidence().contains("raw_transcript"));
        assertTrue(prompts.languageEvidence().contains("INTRODUCTION"));
        assertTrue(prompts.judge().contains("Do not return overall_band"));
        assertTrue(prompts.judge().contains("iFlytek is evidence only"));
        assertTrue(prompts.examinerSystem().contains("Speak only English"));
        assertTrue(prompts.examinerSystem().contains("Never select, rewrite, skip or invent a question"));
    }
}
