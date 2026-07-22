package com.example.unispeaking.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;

class QwenScoringServiceInvalidJsonTest {
    @Test
    void invalidJsonIsRejectedForProviderFailureDegradation() {
        QwenScoringService service = new QwenScoringService();
        assertThrows(Exception.class, () -> service.parseIeltsJsonForTest("not-json"));
        assertThrows(IllegalArgumentException.class, () -> service.parseIeltsJsonForTest("[]"));
    }
}
