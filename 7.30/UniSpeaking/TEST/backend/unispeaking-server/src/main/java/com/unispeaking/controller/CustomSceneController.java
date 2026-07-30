package com.unispeaking.controller;

import com.unispeaking.domain.dto.evaluation.DialogueReportResult;
import com.unispeaking.domain.dto.evaluation.SentenceEvaluationResponse;
import com.unispeaking.domain.dto.request.CustomSceneRequest;
import com.unispeaking.domain.dto.request.TtsRequest;
import com.unispeaking.domain.dto.response.ApiResponse;
import com.unispeaking.domain.dto.scene.AdvanceSceneStageRequest;
import com.unispeaking.domain.dto.scene.AdvanceScenarioDialogueTurnRequest;
import com.unispeaking.domain.dto.scene.CompleteCustomSceneDialogueRequest;
import com.unispeaking.domain.dto.scene.CompleteCustomSceneDialogueResponse;
import com.unispeaking.domain.dto.scene.CompleteSceneFlowRequest;
import com.unispeaking.domain.dto.scene.CreateSceneFlowRequest;
import com.unispeaking.domain.dto.scene.CustomSceneDialogueTurnResponse;
import com.unispeaking.domain.dto.scene.CustomSceneGenerationResponse;
import com.unispeaking.domain.dto.scene.LearningContentItem;
import com.unispeaking.domain.dto.scene.SceneFlowResponse;
import com.unispeaking.domain.dto.scene.ScenarioDialogueStateResponse;
import com.unispeaking.domain.dto.scene.StartCustomSceneDialogueRequest;
import com.unispeaking.domain.dto.scene.StartSceneSessionResponse;
import com.unispeaking.domain.dto.translation.TranslateTextRequest;
import com.unispeaking.domain.dto.translation.TranslateTextResponse;
import com.unispeaking.domain.vo.scene.SceneFlowStage;
import com.unispeaking.service.evaluation.EvaluationService;
import com.unispeaking.service.scene.SceneFlowService;
import com.unispeaking.service.scene.SceneService;
import com.unispeaking.service.session.SessionService;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/custom-scenes")
public class CustomSceneController {

	private final SceneService sceneService;
	private final SceneFlowService sceneFlowService;
	private final SessionService sessionService;
	private final EvaluationService evaluationService;

	public CustomSceneController(
			SceneService sceneService,
			SceneFlowService sceneFlowService,
			SessionService sessionService,
			EvaluationService evaluationService) {
		this.sceneService = sceneService;
		this.sceneFlowService = sceneFlowService;
		this.sessionService = sessionService;
		this.evaluationService = evaluationService;
	}

	@PostMapping("/generate")
	public ApiResponse<CustomSceneGenerationResponse> generate(
			@Valid @RequestBody CustomSceneRequest request) {
		return ApiResponse.success(sceneService.generateCustomScene(request));
	}

	@PostMapping("/flows")
	public ApiResponse<SceneFlowResponse> createFlow(
			@RequestBody CreateSceneFlowRequest request) {
		return ApiResponse.success(sceneFlowService.createFlow(request.sceneId()));
	}

	@PostMapping("/flows/advance")
	public ApiResponse<SceneFlowResponse> advanceStage(
			@RequestBody AdvanceSceneStageRequest request) {
		return ApiResponse.success(sceneFlowService.advanceStage(
				request.sceneId(),
				request.stage()));
	}

	@PostMapping("/flows/complete")
	public ApiResponse<Void> completeFlow(
			@RequestBody CompleteSceneFlowRequest request) {
		sceneFlowService.completeFlow(request.sceneId(), request.completed());
		return ApiResponse.success(null);
	}

	@GetMapping("/flows/{sceneId}/content")
	public ApiResponse<List<LearningContentItem>> getByCurrentStage(
			@PathVariable String sceneId,
			@RequestParam(required = false) SceneFlowStage stage) {
		return ApiResponse.success(
				sceneFlowService.getByCurrentStage(sceneId, stage));
	}

	@PostMapping("/{sceneId}/sessions")
	public ApiResponse<StartSceneSessionResponse> startDialogue(
			@PathVariable String sceneId,
			@Valid @RequestBody StartCustomSceneDialogueRequest request) {
		return ApiResponse.success(
				sessionService.startCustomScene(sceneId, request));
	}

	@PostMapping(
			value = "/{sceneId}/sessions/{sessionId}/turns/{turnNo}/evaluation",
			consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ApiResponse<CustomSceneDialogueTurnResponse> evaluateDialogueTurn(
			@PathVariable String sceneId,
			@PathVariable String sessionId,
			@PathVariable int turnNo,
			@RequestParam String transcript,
			@RequestParam(required = false) MultipartFile audio)
			throws IOException {
		return ApiResponse.success(
				evaluationService.evaluateCustomSceneTurn(
						sceneId,
						sessionId,
						turnNo,
						transcript,
						audio == null ? null : audio.getBytes()));
	}

	@PostMapping("/{sceneId}/sessions/{sessionId}/turns/{turnNo}/state")
	public ApiResponse<ScenarioDialogueStateResponse> advanceDialogueState(
			@PathVariable String sceneId,
			@PathVariable String sessionId,
			@PathVariable int turnNo,
			@Valid @RequestBody AdvanceScenarioDialogueTurnRequest request) {
		return ApiResponse.success(
				sessionService.advanceCustomSceneState(
						sceneId,
						sessionId,
						turnNo,
						request.transcript()));
	}

	@PostMapping("/{sceneId}/sessions/{sessionId}/complete")
	public ApiResponse<CompleteCustomSceneDialogueResponse> completeDialogue(
			@PathVariable String sceneId,
			@PathVariable String sessionId,
			@RequestBody(required = false)
					CompleteCustomSceneDialogueRequest request) {
		return ApiResponse.success(sessionService.completeCustomScene(
				sceneId,
				sessionId,
				request == null ? null : request.stopTime()));
	}

	@GetMapping("/{sceneId}/sessions/{sessionId}/evaluation")
	public ApiResponse<DialogueReportResult> getDialogueEvaluation(
			@PathVariable String sceneId,
			@PathVariable String sessionId) {
		return ApiResponse.success(
				evaluationService.getDialogueReport(sceneId, sessionId));
	}

	@GetMapping("/{sceneId}/sessions/{sessionId}/state")
	public ApiResponse<ScenarioDialogueStateResponse> getDialogueState(
			@PathVariable String sceneId,
			@PathVariable String sessionId) {
		return ApiResponse.success(
				sessionService.getCustomSceneState(sceneId, sessionId));
	}

	@PostMapping(
			value = "/{sceneId}/sentences/{sentenceId}/evaluation",
			consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ApiResponse<SentenceEvaluationResponse> evaluateSentence(
			@PathVariable String sceneId,
			@PathVariable String sentenceId,
			@RequestPart("audio") MultipartFile audio) throws IOException {
		return ApiResponse.success(
				evaluationService.evaluateSentenceReading(
						sceneId,
						sentenceId,
						audio.getBytes()));
	}

	@PostMapping(
			value = "/{sceneId}/speech",
			produces = "audio/wav")
	public ResponseEntity<byte[]> synthesizeSpeech(
			@PathVariable String sceneId,
			@Valid @RequestBody TtsRequest request) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.contentType(MediaType.parseMediaType("audio/wav"))
				.body(sceneService.synthesizeSpeech(
						sceneId,
						request.text(),
						request.model()));
	}

	@PostMapping("/{sceneId}/translations")
	public ApiResponse<TranslateTextResponse> translate(
			@PathVariable String sceneId,
			@Valid @RequestBody TranslateTextRequest request) {
		return ApiResponse.success(
				sceneService.translate(sceneId, request.text()));
	}
}
