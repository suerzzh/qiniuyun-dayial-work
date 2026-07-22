package com.example.unispeaking.service.ielts;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

public class IeltsBandCalculator {
    public record Result(Double rawAverage, Double overallBand, String status, List<String> missingDimensions) {}

    public Result calculate(Double fc, Double lr, Double gra, Double pronunciation) {
        String[] names = {"fluency_coherence", "lexical_resource", "grammatical_range_accuracy", "pronunciation"};
        Double[] bands = {fc, lr, gra, pronunciation};
        List<String> missing = new ArrayList<>();
        for (int i = 0; i < bands.length; i++) {
            if (bands[i] == null) missing.add(names[i]);
            else validate(bands[i]);
        }
        if (!missing.isEmpty()) return new Result(null, null, "PARTIAL", List.copyOf(missing));
        double average = (fc + lr + gra + pronunciation) / 4.0;
        double rounded = BigDecimal.valueOf(average * 2.0)
                .setScale(0, RoundingMode.HALF_UP).doubleValue() / 2.0;
        return new Result(average, rounded, "COMPLETE", List.of());
    }

    public static void validate(Double band) {
        if (band == null) return;
        if (!Double.isFinite(band) || band < 0 || band > 9 || Math.abs(band * 2 - Math.rint(band * 2)) > 0.00001) {
            throw new IllegalArgumentException("IELTS band must be between 0 and 9 in 0.5 steps");
        }
    }
}
