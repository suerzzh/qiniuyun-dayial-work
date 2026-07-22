package com.example.unispeaking.service.ielts;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class StrictMockPolicyTest {
    @Test
    void strictMockOnlyEmitsStatusBeforeReportIsReady() {
        var policy = new IeltsClientEventPolicy();
        Map<String, Object> event = policy.turnScored("full_mock", "att-1", "t1", Map.of("band", 7));
        assertEquals("scoring.status", event.get("type"));
        assertFalse(event.containsKey("score"));
        assertFalse(event.containsKey("corrected_expression"));
        assertFalse(event.containsKey("suggested_expressions"));
    }
}
