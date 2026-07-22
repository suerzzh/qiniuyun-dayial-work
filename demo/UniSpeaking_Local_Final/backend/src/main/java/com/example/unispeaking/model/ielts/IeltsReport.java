package com.example.unispeaking.model.ielts;

import com.example.unispeaking.service.ielts.PronunciationEvidence;

import java.util.List;
import java.util.Map;

public record IeltsReport(
        String attemptId,
        IeltsScoringStatus scoringStatus,
        Double overallBand,
        List<Double> bandRange,
        Double confidence,
        IeltsDimensionResult fc,
        IeltsDimensionResult lr,
        IeltsDimensionResult gra,
        IeltsDimensionResult pronunciation,
        List<String> positiveEvidence,
        List<String> limitingEvidence,
        Map<String, String> partSummaries,
        List<PronunciationEvidence> pronunciationEvidence,
        List<String> dataQualityWarnings,
        String disclaimer
) {}
