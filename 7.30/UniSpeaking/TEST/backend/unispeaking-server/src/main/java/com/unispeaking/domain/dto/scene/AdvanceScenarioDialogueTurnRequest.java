package com.unispeaking.domain.dto.scene;

import jakarta.validation.constraints.NotBlank;

public record AdvanceScenarioDialogueTurnRequest(
		@NotBlank(message = "用户转写不能为空")
		String transcript) {
}
