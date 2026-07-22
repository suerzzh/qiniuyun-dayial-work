package com.example.unispeaking.model.ielts;

import java.util.List;

public record IeltsDimensionResult(
        String code,
        Double band,
        Double confidence,
        List<String> positiveEvidence,
        List<String> limitingEvidence,
        String unavailableReason
) {
    public static IeltsDimensionResult unavailable(String code, String reason) {
        return new IeltsDimensionResult(code, null, null, List.of(), List.of(), reason);
    }
}
