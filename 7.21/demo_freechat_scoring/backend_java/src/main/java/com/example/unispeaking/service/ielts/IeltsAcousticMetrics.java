package com.example.unispeaking.service.ielts;

public record IeltsAcousticMetrics(
        Long answerDurationMs,
        Long speechDurationMs,
        Double silenceRatio,
        Integer wordCount,
        Double speechRateWpm,
        Integer pauseCount,
        Integer longPauseCount,
        Integer fillerCount,
        Long responseLatencyMs,
        Long part2ContinuousSpeakingDurationMs,
        Double audioSignalQuality
) {}
