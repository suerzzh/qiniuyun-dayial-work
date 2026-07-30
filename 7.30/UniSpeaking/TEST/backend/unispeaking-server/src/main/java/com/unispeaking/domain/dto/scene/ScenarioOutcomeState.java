package com.unispeaking.domain.dto.scene;

public record ScenarioOutcomeState(
		String outcomeId,
		String description,
		String evidence,
		boolean satisfied) {
}
