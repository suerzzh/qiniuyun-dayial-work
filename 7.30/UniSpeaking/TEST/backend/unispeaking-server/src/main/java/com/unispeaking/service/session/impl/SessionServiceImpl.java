package com.unispeaking.service.session.impl;

import com.unispeaking.common.logging.RealtimeFlowLog;
import com.unispeaking.component.SessionIdGenerator;
import com.unispeaking.domain.dto.command.StartCommand;
import com.unispeaking.domain.dto.evaluation.DialogueReportResult;
import com.unispeaking.domain.dto.request.StartFreeChatRequest;
import com.unispeaking.domain.dto.scene.CompleteCustomSceneDialogueResponse;
import com.unispeaking.domain.dto.scene.SceneFlowResponse;
import com.unispeaking.domain.dto.scene.SceneGenerationRequest;
import com.unispeaking.domain.dto.scene.SceneGenerationResponse;
import com.unispeaking.domain.dto.scene.ScenarioDialogueStateResponse;
import com.unispeaking.domain.dto.scene.StartCustomSceneDialogueRequest;
import com.unispeaking.domain.dto.scene.StartSceneSessionResponse;
import com.unispeaking.domain.dto.session.Message;
import com.unispeaking.domain.dto.session.StartSessionResponse;
import com.unispeaking.domain.dto.translation.TranslateTextResponse;
import com.unispeaking.domain.po.conversation.ConversationMessage;
import com.unispeaking.domain.po.scene.CustomSceneDefinition;
import com.unispeaking.domain.po.session.AbstractSceneSession;
import com.unispeaking.domain.po.session.CustomSceneSession;
import com.unispeaking.domain.po.session.FreeChatSceneSession;
import com.unispeaking.domain.vo.conversation.SpeakerType;
import com.unispeaking.domain.vo.prompt.SessionPrompt;
import com.unispeaking.domain.vo.realtime.ProviderType;
import com.unispeaking.domain.vo.realtime.RealtimeConnectionResult;
import com.unispeaking.domain.vo.scene.SceneFlowStage;
import com.unispeaking.domain.vo.scene.SceneType;
import com.unispeaking.domain.vo.session.SessionStatus;
import com.unispeaking.exception.BusinessException;
import com.unispeaking.exception.SessionNotFoundException;
import com.unispeaking.infrastructure.persistence.repository.SessionMessageRepository;
import com.unispeaking.provider.AiProviderRegistry;
import com.unispeaking.infrastructure.persistence.repository.FreeChatConversationStore;
import com.unispeaking.infrastructure.persistence.repository.SceneRepository;
import com.unispeaking.service.session.runtime.SessionRuntimeStore;
import com.unispeaking.service.auth.AuthService;
import com.unispeaking.service.evaluation.EvaluationService;
import com.unispeaking.service.profile.ProfileService;
import com.unispeaking.service.prompt.FiveLayerPromptService;
import com.unispeaking.service.realtime.RealtimeConnectionService;
import com.unispeaking.service.scene.SceneFlowService;
import com.unispeaking.service.scene.SceneService;
import com.unispeaking.service.scene.impl.ScenarioDialogueStateMachine;
import com.unispeaking.service.session.SessionService;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class SessionServiceImpl implements SessionService {

	private final AuthService authService;
	private final SceneService sceneService;
	private final SceneFlowService sceneFlowService;
	private final SceneRepository sceneRepository;
	private final SessionRuntimeStore sessionStore;
	private final SessionIdGenerator sessionIdGenerator;
	private final FreeChatConversationStore freeChatStore;
	private final SessionMessageRepository sessionMessageRepository;
	private final RealtimeConnectionService realtimeConnectionService;
	private final EvaluationService evaluationService;
	private final ScenarioDialogueStateMachine stateMachine;
	private final ProfileService profileService;
	private final FiveLayerPromptService promptService;
	private final AiProviderRegistry providerRegistry;

	public SessionServiceImpl(
			AuthService authService,
			SceneService sceneService,
			SceneFlowService sceneFlowService,
			SceneRepository sceneRepository,
			SessionRuntimeStore sessionStore,
			SessionIdGenerator sessionIdGenerator,
			FreeChatConversationStore freeChatStore,
			SessionMessageRepository sessionMessageRepository,
			RealtimeConnectionService realtimeConnectionService,
			EvaluationService evaluationService,
			ScenarioDialogueStateMachine stateMachine,
			ProfileService profileService,
			FiveLayerPromptService promptService,
			AiProviderRegistry providerRegistry) {
		this.authService = authService;
		this.sceneService = sceneService;
		this.sceneFlowService = sceneFlowService;
		this.sceneRepository = sceneRepository;
		this.sessionStore = sessionStore;
		this.sessionIdGenerator = sessionIdGenerator;
		this.freeChatStore = freeChatStore;
		this.sessionMessageRepository = sessionMessageRepository;
		this.realtimeConnectionService = realtimeConnectionService;
		this.evaluationService = evaluationService;
		this.stateMachine = stateMachine;
		this.profileService = profileService;
		this.promptService = promptService;
		this.providerRegistry = providerRegistry;
	}

	@Override
	public StartSessionResponse startSession(SceneType sceneType, String prompt) {
		String userId = authService.requireUserId(null);
		SceneType type = sceneType == null ? SceneType.FREE_CHAT : sceneType;
		AbstractSceneSession session = type == SceneType.FREE_CHAT
				? new FreeChatSceneSession(sessionIdGenerator.generate(), userId)
				: new CustomSceneSession(sessionIdGenerator.generate(), userId);
		session.setSceneType(type);
		session.setPrompt(new SessionPrompt(requirePrompt(prompt)));
		sessionStore.save(session);
		RealtimeFlowLog.info(
				"session.start sessionId={} userId={} sceneType={} startTime={} prompt={}",
				session.getId(),
				userId,
				type,
				session.getCreatedAt(),
				RealtimeFlowLog.textSummary(prompt));
		return new StartSessionResponse(
				session.getId(),
				session.getCreatedAt().toString());
	}

	@Override
	public StartSceneSessionResponse startFreeChat(StartFreeChatRequest request) {
		SceneGenerationResponse scene = sceneService.generateScene(
				new SceneGenerationRequest(
						null,
						null,
						SceneType.FREE_CHAT,
						null));
		SceneFlowResponse flow = sceneFlowService.createFlow(scene.sceneId());
		StartSessionResponse started = startSession(
				SceneType.FREE_CHAT,
				scene.scenePrompt());
		RealtimeConnectionResult connection = connect(
				started.sessionId(),
				scene.sceneId(),
				scene.scenePrompt(),
				SceneType.FREE_CHAT,
				request.offerSdp(),
				request.provider(),
				request.model(),
				request.voice(),
				request.translationEnabled());
		AbstractSceneSession session = requireOwnedSession(
				authService.requireUserId(null),
				started.sessionId());
		return response(
				scene,
				"Free Chat",
				flow.stage(),
				false,
				started,
				session,
				connection);
	}

	@Override
	public StartSceneSessionResponse startCustomScene(
			String sceneId,
			StartCustomSceneDialogueRequest request) {
		String userId = authService.requireUserId(null);
		CustomSceneDefinition definition = requireOwnedScene(sceneId, userId);
		sceneFlowService.getByCurrentStage(sceneId, SceneFlowStage.DIALOGUE);
		SceneGenerationResponse scene = sceneRepository.findGeneratedById(sceneId)
				.orElseThrow(() -> new BusinessException(
						"CUSTOM_SCENE_NOT_FOUND",
						"自定义场景不存在"));
		String basePrompt = resolvePrompt(scene, definition, userId);
		StartSessionResponse started = startSession(
				SceneType.CUSTOM_SCENE,
				basePrompt);
		stateMachine.start(started.sessionId(), definition);
		try {
			RealtimeConnectionResult connection = connect(
					started.sessionId(),
					sceneId,
					basePrompt,
					SceneType.CUSTOM_SCENE,
					request.offerSdp(),
					request.provider(),
					request.model(),
					request.voice(),
					request.translationEnabled());
			AbstractSceneSession session = requireOwnedSession(
					userId,
					started.sessionId());
			return response(
					scene,
					definition.title(),
					SceneFlowStage.DIALOGUE,
					true,
					started,
					session,
					connection);
		}
		catch (RuntimeException exception) {
			stateMachine.remove(started.sessionId());
			throw exception;
		}
	}

	@Override
	public void addMessage(String userId, String sessionId, Message message) {
		validateMessage(message);
		AbstractSceneSession session = requireOwnedSession(userId, sessionId);
		int messageNo = session.getMessages().size() + 1;
		ConversationMessage stored = new ConversationMessage(
				"msg_" + UUID.randomUUID(),
				session.getId(),
				message.owner() == 0 ? SpeakerType.ASSISTANT : SpeakerType.USER,
				message.content().trim(),
				message.audio(),
				Instant.now());
		if (session.getSceneType() == SceneType.CUSTOM_SCENE) {
			if (session.getSceneId() == null || session.getSceneId().isBlank()) {
				throw new BusinessException(
						"SESSION_SCENE_NOT_BOUND",
						"custom scene session is not bound to a scene");
			}
			sessionMessageRepository.append(
					session.getSceneId(),
					session.getId(),
					messageNo,
					message);
		}
		else {
			freeChatStore.append(stored);
		}
		session.addMessage(stored);
		sessionStore.save(session);
		RealtimeFlowLog.info(
				"session.addMessage sessionId={} messageNo={} owner={} content={} audioBytes={}",
				session.getId(),
				messageNo,
				message.owner(),
				RealtimeFlowLog.textSummary(message.content()),
				message.audio() == null ? 0 : message.audio().length);
	}

	@Override
	public void endSession(String userId, String sessionId, String stopTime) {
		AbstractSceneSession session = requireOwnedSession(userId, sessionId);
		if (session.getStatus() != SessionStatus.COMPLETED) {
			session.complete(parseStopTime(stopTime));
			sessionStore.save(session);
		}
		RealtimeFlowLog.info(
				"session.end sessionId={} status={} stopTime={}",
				session.getId(),
				session.getStatus(),
				session.getEndedAt());
	}

	@Override
	public CompleteCustomSceneDialogueResponse completeCustomScene(
			String sceneId,
			String sessionId,
			String stopTime) {
		String userId = authService.requireUserId(null);
		requireOwnedScene(sceneId, userId);
		AbstractSceneSession session = requireOwnedSession(userId, sessionId);
		requireCustomSceneBinding(session, sceneId);
		ScenarioDialogueStateResponse state =
				stateMachine.beginClosing(sessionId);
		String endedAt = stopTime == null || stopTime.isBlank()
				? Instant.now().toString()
				: stopTime.trim();
		endSession(userId, sessionId, endedAt);
		DialogueReportResult report =
				evaluationService.generateDialogueReport(sessionId);
		sceneFlowService.completeFlow(sceneId, true);
		stateMachine.remove(sessionId);
		return new CompleteCustomSceneDialogueResponse(
				sceneId,
				sessionId,
				endedAt,
				report,
				state);
	}

	@Override
	public ScenarioDialogueStateResponse advanceCustomSceneState(
			String sceneId,
			String sessionId,
			int turnNo,
			String transcript) {
		String userId = authService.requireUserId(null);
		requireOwnedScene(sceneId, userId);
		requireCustomSceneBinding(
				requireOwnedSession(userId, sessionId),
				sceneId);
		return stateMachine.advance(sessionId, turnNo, transcript);
	}

	@Override
	public ScenarioDialogueStateResponse getCustomSceneState(
			String sceneId,
			String sessionId) {
		String userId = authService.requireUserId(null);
		requireOwnedScene(sceneId, userId);
		requireCustomSceneBinding(
				requireOwnedSession(userId, sessionId),
				sceneId);
		return stateMachine.getState(sessionId);
	}

	@Override
	public TranslateTextResponse translate(String sessionId, String text) {
		String userId = authService.requireUserId(null);
		requireOwnedSession(userId, sessionId);
		if (text == null || text.isBlank()) {
			throw new BusinessException(
					"TRANSLATION_TEXT_REQUIRED",
					"待翻译文本不能为空");
		}
		String source = text.strip();
		if (source.length() > 4000) {
			throw new BusinessException(
					"TRANSLATION_TEXT_TOO_LONG",
					"待翻译文本不能超过4000个字符");
		}
		String prompt = """
				Translate the text enclosed in <source> into natural Simplified Chinese.
				Preserve the original meaning, tone, names, numbers, and punctuation.
				Return only the translation. Do not explain, annotate, or quote the source.

				<source>
				%s
				</source>
				""".formatted(source);
		String translated = providerRegistry.executeLlmTask(
				AiProviderRegistry.QWEN_LLM_PLUS,
				prompt,
				null);
		if (translated == null || translated.isBlank()) {
			throw new BusinessException(
					"TRANSLATION_EMPTY",
					"翻译模型没有返回有效文本");
		}
		return new TranslateTextResponse(
				source,
				translated.strip(),
				"zh-CN");
	}

	private RealtimeConnectionResult connect(
			String sessionId,
			String sceneId,
			String prompt,
			SceneType sceneType,
			String offerSdp,
			ProviderType provider,
			String model,
			String voice,
			Boolean translationEnabled) {
		AbstractSceneSession session = sessionStore.findById(sessionId)
				.orElseThrow(() -> new SessionNotFoundException(sessionId));
		ProviderType providerType = provider == null ? ProviderType.QWEN : provider;
		String voiceId = voice == null || voice.isBlank()
				? "Katerina"
				: voice.trim();
		session.setSceneId(sceneId);
		session.setSceneType(sceneType);
		session.setProviderType(providerType);
		session.setModel(model);
		session.setVoiceId(voiceId);
		session.setPrompt(new SessionPrompt(prompt));
		session.markConnecting();
		sessionStore.save(session);
		StartCommand command = new StartCommand(
				sceneType,
				session.getUserId(),
				sceneId,
				offerSdp,
				prompt,
				providerType,
				model,
				voiceId,
				translationEnabled);
		try {
			RealtimeConnectionResult connection =
					realtimeConnectionService.connect(
							providerType,
							session,
							session.getPrompt(),
							command);
			if (connection.providerSessionId() != null
					&& !connection.providerSessionId().isBlank()) {
				session.bindProviderSession(connection.providerSessionId());
			}
			session.setCredentialExpiresAt(connection.credentialExpiresAt());
			session.waitForClient();
			sessionStore.save(session);
			return connection;
		}
		catch (RuntimeException exception) {
			session.fail("REALTIME_CONNECTION_FAILED", exception.getMessage());
			sessionStore.save(session);
			throw exception;
		}
	}

	private StartSceneSessionResponse response(
			SceneGenerationResponse scene,
			String sceneName,
			SceneFlowStage stage,
			boolean scoringEnabled,
			StartSessionResponse started,
			AbstractSceneSession session,
			RealtimeConnectionResult connection) {
		return new StartSceneSessionResponse(
				scene.sceneId(),
				sceneName,
				session.getSceneType(),
				scene.wordList(),
				scene.phraseList(),
				scene.sentenceList(),
				stage,
				scoringEnabled,
				started.sessionId(),
				session.getProviderSessionId(),
				connection.answerSdp(),
				connection.credentialExpiresAt(),
				session.getVoiceId(),
				session.getStatus(),
				started.startTime(),
				session.getPrompt().systemPrompt());
	}

	private CustomSceneDefinition requireOwnedScene(
			String sceneId,
			String userId) {
		CustomSceneDefinition scene = sceneRepository
				.findCustomDefinitionById(sceneId)
				.orElseThrow(() -> new BusinessException(
						"CUSTOM_SCENE_NOT_FOUND",
						"自定义场景不存在"));
		if (!userId.equals(scene.userId())) {
			throw new BusinessException(
					"CUSTOM_SCENE_ACCESS_DENIED",
					"当前用户无权访问该场景");
		}
		return scene;
	}

	private AbstractSceneSession requireOwnedSession(
			String userId,
			String sessionId) {
		if (userId == null || userId.isBlank()) {
			throw new BusinessException("AUTHENTICATION_REQUIRED", "请先登录");
		}
		AbstractSceneSession session = sessionStore.findById(sessionId)
				.orElseThrow(() -> new SessionNotFoundException(sessionId));
		if (!userId.equals(session.getUserId())) {
			throw new BusinessException(
					"SESSION_ACCESS_DENIED",
					"当前用户无权访问该会话");
		}
		return session;
	}

	private void requireCustomSceneBinding(
			AbstractSceneSession session,
			String sceneId) {
		if (session.getSceneType() != SceneType.CUSTOM_SCENE
				|| !sceneId.equals(session.getSceneId())) {
			throw new BusinessException(
					"SESSION_ACCESS_DENIED",
					"当前会话不属于该场景");
		}
	}

	private String resolvePrompt(
			SceneGenerationResponse scene,
			CustomSceneDefinition definition,
			String userId) {
		if (scene.scenePrompt() != null && !scene.scenePrompt().isBlank()) {
			return scene.scenePrompt();
		}
		return String.join("\n\n", promptService.compose(
				profileService.getProfile(userId),
				sceneRepository.findByType(SceneType.CUSTOM_SCENE).orElse(null),
				SceneType.CUSTOM_SCENE,
				definition.title(),
				"",
				scene.wordList(),
				scene.phraseList(),
				scene.sentenceList(),
				definition));
	}

	private void validateMessage(Message message) {
		if (message == null
				|| message.owner() == null
				|| (message.owner() != 0 && message.owner() != 1)
				|| message.content() == null
				|| message.content().isBlank()) {
			throw new BusinessException(
					"INVALID_SESSION_MESSAGE",
					"message owner must be 0 or 1 and content must not be blank");
		}
	}

	private String requirePrompt(String prompt) {
		if (prompt == null || prompt.isBlank()) {
			throw new BusinessException(
					"SESSION_PROMPT_REQUIRED",
					"session prompt must not be blank");
		}
		return prompt;
	}

	private Instant parseStopTime(String stopTime) {
		if (stopTime == null || stopTime.isBlank()) {
			return Instant.now();
		}
		try {
			return Instant.parse(stopTime.trim());
		}
		catch (DateTimeParseException exception) {
			throw new BusinessException(
					"INVALID_STOP_TIME",
					"stopTime must use ISO-8601 format");
		}
	}
}
