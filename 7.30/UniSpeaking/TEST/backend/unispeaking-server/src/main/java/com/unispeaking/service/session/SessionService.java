package com.unispeaking.service.session;

import com.unispeaking.domain.dto.request.StartFreeChatRequest;
import com.unispeaking.domain.dto.scene.CompleteCustomSceneDialogueResponse;
import com.unispeaking.domain.dto.scene.ScenarioDialogueStateResponse;
import com.unispeaking.domain.dto.scene.StartCustomSceneDialogueRequest;
import com.unispeaking.domain.dto.scene.StartSceneSessionResponse;
import com.unispeaking.domain.dto.session.Message;
import com.unispeaking.domain.dto.session.StartSessionResponse;
import com.unispeaking.domain.dto.translation.TranslateTextResponse;
import com.unispeaking.domain.vo.scene.SceneType;

public interface SessionService {

	StartSessionResponse startSession(SceneType sceneType, String prompt);

	StartSceneSessionResponse startFreeChat(StartFreeChatRequest request);

	StartSceneSessionResponse startCustomScene(
			String sceneId,
			StartCustomSceneDialogueRequest request);

	void addMessage(String userId, String sessionId, Message message);

	void endSession(String userId, String sessionId, String stopTime);

	CompleteCustomSceneDialogueResponse completeCustomScene(
			String sceneId,
			String sessionId,
			String stopTime);

	ScenarioDialogueStateResponse advanceCustomSceneState(
			String sceneId,
			String sessionId,
			int turnNo,
			String transcript);

	ScenarioDialogueStateResponse getCustomSceneState(
			String sceneId,
			String sessionId);

	TranslateTextResponse translate(String sessionId, String text);
}
