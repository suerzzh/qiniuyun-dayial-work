package com.unispeaking.service.evaluation;

import com.unispeaking.domain.dto.evaluation.DialogueEvaluationResult;
import com.unispeaking.domain.dto.evaluation.DialogueReportResult;
import com.unispeaking.domain.dto.evaluation.DialogueTurnEvaluationCommand;
import com.unispeaking.domain.dto.evaluation.DialogueTurnEvaluationResult;
import com.unispeaking.domain.dto.evaluation.SentenceEvaluationResponse;
import com.unispeaking.domain.dto.scene.CustomSceneDialogueTurnResponse;
import com.unispeaking.domain.dto.session.Message;
import java.util.List;

public interface EvaluationService {
	SentenceEvaluationResponse evaluateSentenceReading(
			String sceneId,
			String sentenceId,
			byte[] audio);

	CustomSceneDialogueTurnResponse evaluateCustomSceneTurn(
			String sceneId,
			String sessionId,
			int turnNo,
			String transcript,
			byte[] audio);

	DialogueTurnEvaluationResult evaluateDialogueTurn(
			DialogueTurnEvaluationCommand command);

	DialogueReportResult generateDialogueReport(
			String sessionId,
			List<Message> dialogue);

	/**
	 * 从已持久化的会话消息和逐轮评分生成自定义场景最终报告。
	 */
	DialogueReportResult generateDialogueReport(String sessionId);

	DialogueReportResult getDialogueReport(String sessionId);

	DialogueReportResult getDialogueReport(String sceneId, String sessionId);

	DialogueEvaluationResult getDialogueEvaluation(String sessionId);
}
