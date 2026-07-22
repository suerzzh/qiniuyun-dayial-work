package com.example.unispeaking.service.ielts;

import java.util.LinkedHashMap;
import java.util.Map;

public class IeltsClientEventPolicy {
    public Map<String, Object> turnScored(String mode, String attemptId, String turnId,
                                          Map<String, Object> privateEvidence) {
        Map<String, Object> event = new LinkedHashMap<>();
        if ("full_mock".equals(mode)) {
            event.put("type", "scoring.status");
            event.put("status", "TURN_CAPTURED");
        } else {
            // MVP intentionally uses exam-end feedback for both modes.
            event.put("type", "scoring.status");
            event.put("status", "TURN_CAPTURED");
        }
        event.put("attempt_id", attemptId);
        event.put("turn_id", turnId);
        return event;
    }
}
