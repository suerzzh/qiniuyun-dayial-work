package com.unispeaking.domain.dto.scene;

import com.unispeaking.domain.vo.realtime.ProviderType;
import jakarta.validation.constraints.NotBlank;

public record StartCustomSceneDialogueRequest(
		@NotBlank String offerSdp,
		ProviderType provider,
		String model,
		String voice,
		Boolean translationEnabled) {
}
