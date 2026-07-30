package com.unispeaking.infrastructure.persistence.evaluation.model;

import com.unispeaking.infrastructure.persistence.evaluation.model.PracticeResultUtterance;
import java.math.BigDecimal;
import java.util.List;

public record CustomTurnEvaluation(
		String sceneId,
		String sessionId,
		int turnNo,
		String transcript,
		BigDecimal overallScore,
		BigDecimal rhythmScore,
		BigDecimal toneScore,
		BigDecimal integrityScore,
		BigDecimal pronunciationScore,
		BigDecimal fluencyScore,
		String feedbackSummary,
		String suggestedExpression,
		List<PracticeResultUtterance.Word> words) {

	public CustomTurnEvaluation {
		words = words == null ? List.of() : List.copyOf(words);
	}
}
