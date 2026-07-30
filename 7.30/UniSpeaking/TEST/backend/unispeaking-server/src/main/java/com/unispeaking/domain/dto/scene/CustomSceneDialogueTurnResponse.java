package com.unispeaking.domain.dto.scene;

import com.unispeaking.domain.dto.evaluation.DialogueTurnEvaluationResult;

public record CustomSceneDialogueTurnResponse(
		DialogueTurnEvaluationResult evaluation,
		ScenarioDialogueStateResponse state) {
}
