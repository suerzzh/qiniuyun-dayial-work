package com.unispeaking.service.evaluation.support;

import java.math.BigDecimal;
import java.util.List;

public record PronunciationAssessmentResult(
		BigDecimal overallScore,
		BigDecimal rhythmScore,
		BigDecimal toneScore,
		BigDecimal integrityScore,
		BigDecimal pronunciationScore,
		BigDecimal fluencyScore,
		EndingTone endingTone,
		List<PronunciationWordResult> words) {
}
