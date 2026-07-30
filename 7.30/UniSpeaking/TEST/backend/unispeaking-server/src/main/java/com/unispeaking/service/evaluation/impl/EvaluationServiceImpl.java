package com.unispeaking.service.evaluation.impl;

import com.unispeaking.domain.dto.evaluation.DialogueEvaluationResult;
import com.unispeaking.domain.dto.evaluation.DialogueReportResult;
import com.unispeaking.domain.dto.evaluation.DialogueTurnEvaluationCommand;
import com.unispeaking.domain.dto.evaluation.DialogueTurnEvaluationResult;
import com.unispeaking.domain.dto.evaluation.PhonemeScore;
import com.unispeaking.domain.dto.evaluation.SentenceEvaluationResponse;
import com.unispeaking.domain.dto.evaluation.WordPronunciationScore;
import com.unispeaking.domain.dto.scene.CustomSceneDialogueTurnResponse;
import com.unispeaking.domain.dto.scene.LearningContentItem;
import com.unispeaking.domain.dto.scene.ScenarioDialogueStateResponse;
import com.unispeaking.domain.dto.session.Message;
import com.unispeaking.domain.po.scene.CustomSceneDefinition;
import com.unispeaking.domain.po.session.AbstractSceneSession;
import com.unispeaking.domain.vo.scene.SceneType;
import com.unispeaking.infrastructure.persistence.evaluation.repository.PracticeResultUtteranceRepository;
import com.unispeaking.infrastructure.persistence.evaluation.repository.PracticeSessionEvaluationRepository;
import com.unispeaking.infrastructure.persistence.evaluation.model.PracticeSessionEvaluationContext;
import com.unispeaking.infrastructure.persistence.evaluation.ConversationReportPersistenceCoordinator;
import com.unispeaking.infrastructure.persistence.evaluation.model.CustomTurnEvaluation;
import com.unispeaking.infrastructure.persistence.evaluation.model.PracticeResultUtterance;
import com.unispeaking.infrastructure.persistence.evaluation.repository.SessionEvaluationRepository;
import com.unispeaking.infrastructure.persistence.repository.SessionMessageRepository;
import com.unispeaking.infrastructure.persistence.evaluation.repository.SceneSentenceReadingRepository;
import com.unispeaking.infrastructure.persistence.evaluation.repository.TurnEvaluationRepository;
import com.unispeaking.infrastructure.persistence.repository.SceneRepository;
import com.unispeaking.service.session.runtime.SessionRuntimeStore;
import com.unispeaking.service.evaluation.EvaluationService;
import com.unispeaking.service.auth.AuthService;
import com.unispeaking.service.evaluation.support.PcmWavValidator;
import com.unispeaking.service.evaluation.support.ConversationScoreCalculation;
import com.unispeaking.service.evaluation.support.ConversationScoreCalculator;
import com.unispeaking.service.evaluation.support.TurnScoreContribution;
import com.unispeaking.service.evaluation.support.TurnSpeechScoreCalculator;
import com.unispeaking.service.evaluation.support.EvaluationLlmClient;
import com.unispeaking.service.evaluation.support.PronunciationAssessmentClient;
import com.unispeaking.service.evaluation.support.EvaluationErrorCode;
import com.unispeaking.service.evaluation.support.EvaluationException;
import com.unispeaking.service.evaluation.support.ConversationEvaluationQueryHandler;
import com.unispeaking.service.evaluation.support.ConversationLanguageAssessment;
import com.unispeaking.service.evaluation.support.EndingTone;
import com.unispeaking.service.evaluation.support.PronunciationAssessmentResult;
import com.unispeaking.service.evaluation.support.PronunciationPhonemeResult;
import com.unispeaking.service.evaluation.support.PronunciationWordResult;
import com.unispeaking.service.evaluation.support.TurnLanguageFeedback;
import com.unispeaking.service.evaluation.support.WordReadStatus;
import com.unispeaking.service.evaluation.support.TooShortEvaluationPolicy;
import com.unispeaking.service.evaluation.support.EnglishWordCounter;
import com.unispeaking.service.evaluation.support.DialogueTurnEvaluationHistory;
import com.unispeaking.service.evaluation.support.DialogueTurnEvaluationPromptInput;
import com.unispeaking.service.evaluation.support.UnavailableTurnEvaluationPolicy;
import com.unispeaking.service.scene.impl.ScenarioDialogueStateMachine;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

/**
 * 最新评分接口的默认实现。
 */
@Service
@Profile("!test")
public class EvaluationServiceImpl implements EvaluationService {

	private static final Logger LOGGER = LoggerFactory.getLogger(
			EvaluationServiceImpl.class);
	private static final BigDecimal SENTENCE_PASS_SCORE = new BigDecimal("80");

	private final PronunciationAssessmentClient pronunciationClient;
	private final EvaluationLlmClient llmClient;
	private final PracticeSessionEvaluationRepository sessionRepository;
	private final PracticeResultUtteranceRepository utteranceRepository;
	private final ConversationReportPersistenceCoordinator reportPersistence;
	private final ConversationEvaluationQueryHandler queryHandler;
	private final SessionRuntimeStore sessionStateStore;
	private final SceneRepository sceneRepository;
	private final SessionMessageRepository sessionMessageRepository;
	private final TurnEvaluationRepository turnEvaluationRepository;
	private final SessionEvaluationRepository sessionEvaluationRepository;
	private final SceneSentenceReadingRepository sceneSentenceReadingRepository;
	private final AuthService authService;
	private final ScenarioDialogueStateMachine stateMachine;

	public EvaluationServiceImpl(
			PronunciationAssessmentClient pronunciationClient,
			EvaluationLlmClient llmClient,
			PracticeSessionEvaluationRepository sessionRepository,
			PracticeResultUtteranceRepository utteranceRepository,
			ConversationReportPersistenceCoordinator reportPersistence,
			ConversationEvaluationQueryHandler queryHandler,
			SessionRuntimeStore sessionStateStore,
			SceneRepository sceneRepository,
			SessionMessageRepository sessionMessageRepository,
			TurnEvaluationRepository turnEvaluationRepository,
			SessionEvaluationRepository sessionEvaluationRepository,
			SceneSentenceReadingRepository sceneSentenceReadingRepository,
			AuthService authService,
			ScenarioDialogueStateMachine stateMachine) {
		this.pronunciationClient = Objects.requireNonNull(
				pronunciationClient,
				"pronunciationClient must not be null");
		this.llmClient = Objects.requireNonNull(llmClient, "llmClient must not be null");
		this.sessionRepository = Objects.requireNonNull(
				sessionRepository,
				"sessionRepository must not be null");
		this.utteranceRepository = Objects.requireNonNull(
				utteranceRepository,
				"utteranceRepository must not be null");
		this.reportPersistence = Objects.requireNonNull(
				reportPersistence,
				"reportPersistence must not be null");
		this.queryHandler = Objects.requireNonNull(
				queryHandler,
				"queryHandler must not be null");
		this.sessionStateStore = Objects.requireNonNull(
				sessionStateStore,
				"sessionStateStore must not be null");
		this.sceneRepository = Objects.requireNonNull(
				sceneRepository,
				"sceneRepository must not be null");
		this.sessionMessageRepository = Objects.requireNonNull(
				sessionMessageRepository,
				"sessionMessageRepository must not be null");
		this.turnEvaluationRepository = Objects.requireNonNull(
				turnEvaluationRepository,
				"turnEvaluationRepository must not be null");
		this.sessionEvaluationRepository = Objects.requireNonNull(
				sessionEvaluationRepository,
				"sessionEvaluationRepository must not be null");
		this.sceneSentenceReadingRepository = Objects.requireNonNull(
				sceneSentenceReadingRepository,
				"sceneSentenceReadingRepository must not be null");
		this.authService = Objects.requireNonNull(
				authService,
				"authService must not be null");
		this.stateMachine = Objects.requireNonNull(
				stateMachine,
				"stateMachine must not be null");
	}

	@Override
	public SentenceEvaluationResponse evaluateSentenceReading(
			String sceneId,
			String sentenceId,
			byte[] audio) {
		CustomSceneDefinition scene = requireOwnedScene(sceneId);
		LearningContentItem sentence = scene.sentenceList().stream()
				.filter(item -> item.contentId().equals(sentenceId))
				.findFirst()
				.orElseThrow(() -> new EvaluationException(
						EvaluationErrorCode.SENTENCE_NOT_FOUND));
		PcmWavValidator.validate(audio);
		PronunciationAssessmentResult assessment =
				pronunciationClient.evaluate(sentence.englishText(), audio);
		sceneSentenceReadingRepository.saveAttempt(
				sceneId,
				sentence,
				assessment);
		return new SentenceEvaluationResponse(
				assessment.overallScore(),
				assessment.overallScore().compareTo(SENTENCE_PASS_SCORE) >= 0,
				mapWords(assessment.words()));
	}

	@Override
	public CustomSceneDialogueTurnResponse evaluateCustomSceneTurn(
			String sceneId,
			String sessionId,
			int turnNo,
			String transcript,
			byte[] audio) {
		AbstractSceneSession session = requireOwnedCustomSession(
				sceneId,
				sessionId);
		ScenarioDialogueStateResponse state = stateMachine.getState(sessionId);
		DialogueTurnEvaluationCommand command =
				new DialogueTurnEvaluationCommand(
						session.getId(),
						turnNo,
						audio,
						transcript);
		DialogueTurnEvaluationResult evaluation;
		try {
			evaluation = evaluateDialogueTurn(command);
		}
		catch (EvaluationException exception) {
			if (!isRecoverableTurnFailure(exception)) {
				throw exception;
			}
			evaluation = UnavailableTurnEvaluationPolicy.createResult(
					turnNo,
					transcript);
			turnEvaluationRepository.upsert(toCustomTurn(
					session,
					evaluation,
					List.of()));
			LOGGER.warn(
					"custom turn scoring unavailable sceneId={} sessionId={} "
							+ "turnNo={} code={}",
					sceneId,
					sessionId,
					turnNo,
					exception.errorCode().code());
		}
		return new CustomSceneDialogueTurnResponse(
				evaluation,
				state);
	}

	@Override
	public DialogueTurnEvaluationResult evaluateDialogueTurn(
			DialogueTurnEvaluationCommand command) {
		if (command == null || command.turnNo() < 1) {
			throw new EvaluationException(EvaluationErrorCode.INVALID_REQUEST);
		}
		AbstractSceneSession runtimeSession =
				findCustomRuntimeSession(command.sessionId());
		if (runtimeSession != null) {
			return evaluateCustomSceneTurn(runtimeSession, command);
		}
		UUID sessionId = parseUuid(command.sessionId());
		PracticeSessionEvaluationContext context = requireSession(sessionId);
		EnglishWordCounter.Analysis text =
				EnglishWordCounter.analyze(command.transcript());
		if (text.classification() == EnglishWordCounter.Classification.EMPTY) {
			throw new EvaluationException(EvaluationErrorCode.TRANSCRIPT_REQUIRED);
		}
		if (text.classification() == EnglishWordCounter.Classification.TOO_SHORT) {
			DialogueTurnEvaluationResult result =
					TooShortEvaluationPolicy.createResult(
							command.turnNo(),
							command.transcript());
			utteranceRepository.upsert(toTooShortRow(sessionId, result));
			return result;
		}

		PcmWavValidator.validate(command.audio());
		PronunciationAssessmentResult assessment =
				pronunciationClient.evaluate(command.transcript(), command.audio());
		TurnSpeechScoreCalculator.calculate(assessment);
		TurnLanguageFeedback feedback = llmClient.assessTurn(
				buildTurnPrompt(
						context,
						command.turnNo(),
						command.transcript()));
		DialogueTurnEvaluationResult result = new DialogueTurnEvaluationResult(
				command.turnNo(),
				command.transcript(),
				assessment.overallScore(),
				assessment.rhythmScore(),
				assessment.toneScore(),
				assessment.integrityScore(),
				assessment.pronunciationScore(),
				assessment.fluencyScore(),
				feedback.feedbackSummary(),
				feedback.suggestedExpression(),
				mapWords(assessment.words()));
		utteranceRepository.upsert(
				toPersistedTurn(sessionId, result, assessment));
		return result;
	}

	@Override
	public DialogueReportResult generateDialogueReport(
			String sessionId,
			List<Message> dialogue) {
		if (findCustomRuntimeSession(sessionId) != null) {
			return generateDialogueReport(sessionId);
		}
		UUID id = parseUuid(sessionId);
		requireSession(id);
		List<Message> immutableDialogue = validateDialogue(dialogue);
		List<PracticeResultUtterance> savedTurns =
				utteranceRepository.findAll(id);
		List<PracticeResultUtterance> scorableTurns = savedTurns.stream()
				.filter(turn -> !TooShortEvaluationPolicy.isTooShort(
						turn.overallScore(),
						turn.rhythmScore(),
						turn.toneScore(),
						turn.integrityScore(),
						turn.pronunciationScore(),
						turn.fluencyScore(),
						turn.feedbackSummary()))
				.sorted(Comparator.comparingInt(
						PracticeResultUtterance::utteranceNo))
				.toList();
		if (scorableTurns.isEmpty()) {
			throw new EvaluationException(
					EvaluationErrorCode.NO_SCORABLE_UTTERANCES);
		}

		ConversationLanguageAssessment language =
				llmClient.assessDialogue(immutableDialogue);
		List<TurnScoreContribution> contributions = scorableTurns.stream()
				.map(this::toContribution)
				.toList();
		ConversationScoreCalculation scores =
				ConversationScoreCalculator.calculate(contributions, language);
		DialogueReportResult report = new DialogueReportResult(
				scores.accuracyScore(),
				scores.fluencyScore(),
				scores.grammarScore(),
				scores.vocabularyScore(),
				scores.naturalnessScore(),
				scores.finalScore(),
				language.summary(),
				language.strengths(),
				language.improvements());

		persistDialogueContext(id, immutableDialogue, savedTurns);
		reportPersistence.save(id, report);
		return report;
	}

	@Override
	public DialogueReportResult generateDialogueReport(String sessionId) {
		AbstractSceneSession session = requireCustomRuntimeSession(sessionId);
		List<Message> dialogue = validateDialogue(
				sessionMessageRepository.findMessages(sessionId));
		List<CustomTurnEvaluation> savedTurns = ensureTurnRecords(
				session,
				dialogue,
				turnEvaluationRepository.findAll(sessionId));
		List<CustomTurnEvaluation> scorableTurns = savedTurns.stream()
				.filter(turn -> !isUnscorable(turn))
				.sorted(Comparator.comparingInt(CustomTurnEvaluation::turnNo))
				.toList();
		if (scorableTurns.isEmpty()) {
			DialogueReportResult report = unavailableDialogueReport();
			sessionEvaluationRepository.save(session.getId(), report);
			return report;
		}

		requireCompleteLearnerTurns(dialogue, savedTurns);
		ConversationLanguageAssessment language =
				assessCustomDialogueLanguage(
						sessionId,
						dialogue,
						scorableTurns);
		ConversationScoreCalculation scores = ConversationScoreCalculator.calculate(
				scorableTurns.stream()
						.map(this::toContribution)
						.toList(),
				language);
		DialogueReportResult report = new DialogueReportResult(
				scores.accuracyScore(),
				scores.fluencyScore(),
				scores.grammarScore(),
				scores.vocabularyScore(),
				scores.naturalnessScore(),
				scores.finalScore(),
				language.summary(),
				language.strengths(),
				language.improvements());
		sessionEvaluationRepository.save(session.getId(), report);
		return report;
	}

	@Override
	public DialogueEvaluationResult getDialogueEvaluation(String sessionId) {
		return queryHandler.handle(parseUuid(sessionId));
	}

	@Override
	public DialogueReportResult getDialogueReport(String sessionId) {
		requireCustomRuntimeSession(sessionId);
		return sessionEvaluationRepository.find(sessionId)
				.orElseThrow(() -> new EvaluationException(
						EvaluationErrorCode.RESULT_INCOMPLETE));
	}

	@Override
	public DialogueReportResult getDialogueReport(
			String sceneId,
			String sessionId) {
		requireOwnedCustomSession(sceneId, sessionId);
		return getDialogueReport(sessionId);
	}

	private PracticeSessionEvaluationContext requireSession(UUID sessionId) {
		return sessionRepository.findBySessionId(sessionId)
				.orElseThrow(() -> new EvaluationException(
						EvaluationErrorCode.SESSION_NOT_FOUND));
	}

	private DialogueTurnEvaluationResult evaluateCustomSceneTurn(
			AbstractSceneSession session,
			DialogueTurnEvaluationCommand command) {
		EnglishWordCounter.Analysis text =
				EnglishWordCounter.analyze(command.transcript());
		if (text.classification() == EnglishWordCounter.Classification.EMPTY) {
			throw new EvaluationException(EvaluationErrorCode.TRANSCRIPT_REQUIRED);
		}
		if (text.classification() == EnglishWordCounter.Classification.TOO_SHORT) {
			DialogueTurnEvaluationResult result =
					TooShortEvaluationPolicy.createResult(
							command.turnNo(),
							command.transcript());
			turnEvaluationRepository.upsert(toCustomTurn(
					session,
					result,
					List.of()));
			return result;
		}

		PcmWavValidator.validate(command.audio());
		PronunciationAssessmentResult assessment =
				pronunciationClient.evaluate(command.transcript(), command.audio());
		TurnSpeechScoreCalculator.calculate(assessment);
		TurnLanguageFeedback feedback = llmClient.assessTurn(
				buildCustomTurnPrompt(session, command));
		DialogueTurnEvaluationResult result = new DialogueTurnEvaluationResult(
				command.turnNo(),
				command.transcript(),
				assessment.overallScore(),
				assessment.rhythmScore(),
				assessment.toneScore(),
				assessment.integrityScore(),
				assessment.pronunciationScore(),
				assessment.fluencyScore(),
				feedback.feedbackSummary(),
				feedback.suggestedExpression(),
				mapWords(assessment.words()));
		turnEvaluationRepository.upsert(toCustomTurn(
				session,
				result,
				toPersistedWords(assessment)));
		return result;
	}

	private DialogueTurnEvaluationPromptInput buildCustomTurnPrompt(
			AbstractSceneSession session,
			DialogueTurnEvaluationCommand command) {
		CustomSceneDefinition scene = sceneRepository
				.findCustomDefinitionById(session.getSceneId())
				.orElseThrow(() -> new EvaluationException(
						EvaluationErrorCode.SESSION_NOT_FOUND));
		List<Message> messages =
				sessionMessageRepository.findMessages(session.getId());
		List<DialogueTurnEvaluationHistory> history =
				turnEvaluationRepository.findBefore(
								session.getId(),
								command.turnNo())
						.stream()
						.map(turn -> new DialogueTurnEvaluationHistory(
								turn.turnNo(),
								findAiText(messages, turn.turnNo()),
								turn.transcript()))
						.toList();
		return new DialogueTurnEvaluationPromptInput(
				SceneType.CUSTOM_SCENE.name(),
				scene.background(),
				scene.aiRole(),
				scene.userRole(),
				scene.learningGoal(),
				history,
				findAiText(messages, command.turnNo()),
				command.transcript());
	}

	private DialogueTurnEvaluationPromptInput buildTurnPrompt(
			PracticeSessionEvaluationContext context,
			int turnNo,
			String transcript) {
		List<DialogueTurnEvaluationHistory> history =
				utteranceRepository.findBefore(context.sessionId(), turnNo)
						.stream()
						.map(turn -> new DialogueTurnEvaluationHistory(
								turn.utteranceNo(),
								turn.aiText(),
								turn.transcript()))
						.toList();
		return new DialogueTurnEvaluationPromptInput(
				context.practiceMode(),
				context.background(),
				context.aiRole(),
				context.userRole(),
				context.learningGoal(),
				history,
				null,
				transcript);
	}

	private TurnScoreContribution toContribution(
			PracticeResultUtterance utterance) {
		return TurnSpeechScoreCalculator.calculate(
				toAssessment(utterance)).toContribution();
	}

	private TurnScoreContribution toContribution(
			CustomTurnEvaluation evaluation) {
		return TurnSpeechScoreCalculator.calculate(
				toAssessment(evaluation)).toContribution();
	}

	private PronunciationAssessmentResult toAssessment(
			PracticeResultUtterance utterance) {
		List<PronunciationWordResult> words = utterance.words().stream()
				.map(word -> new PronunciationWordResult(
						word.index(),
						word.text(),
						WordReadStatus.NORMAL,
						word.pronunciationScore(),
						word.pronunciationScore(),
						null,
						word.phonemes().stream()
								.map(phoneme -> new PronunciationPhonemeResult(
										phoneme.index(),
										phoneme.expectedPhoneme(),
										phoneme.actualPhoneme(),
										phoneme.pronunciationScore(),
										phoneme.startPosition(),
										phoneme.endPosition()))
								.toList()))
				.toList();
		return new PronunciationAssessmentResult(
				utterance.overallScore(),
				utterance.rhythmScore(),
				utterance.toneScore(),
				utterance.integrityScore(),
				utterance.pronunciationScore(),
				utterance.fluencyScore(),
				EndingTone.UNKNOWN,
				words);
	}

	private PronunciationAssessmentResult toAssessment(
			CustomTurnEvaluation evaluation) {
		List<PronunciationWordResult> words = evaluation.words().stream()
				.map(word -> new PronunciationWordResult(
						word.index(),
						word.text(),
						WordReadStatus.NORMAL,
						word.pronunciationScore(),
						word.pronunciationScore(),
						null,
						word.phonemes().stream()
								.map(phoneme -> new PronunciationPhonemeResult(
										phoneme.index(),
										phoneme.expectedPhoneme(),
										phoneme.actualPhoneme(),
										phoneme.pronunciationScore(),
										phoneme.startPosition(),
										phoneme.endPosition()))
								.toList()))
				.toList();
		return new PronunciationAssessmentResult(
				evaluation.overallScore(),
				evaluation.rhythmScore(),
				evaluation.toneScore(),
				evaluation.integrityScore(),
				evaluation.pronunciationScore(),
				evaluation.fluencyScore(),
				EndingTone.UNKNOWN,
				words);
	}

	private PracticeResultUtterance toTooShortRow(
			UUID sessionId,
			DialogueTurnEvaluationResult result) {
		return new PracticeResultUtterance(
				sessionId,
				result.turnNo(),
				result.transcript(),
				null,
				result.overallScore(),
				result.rhythmScore(),
				result.toneScore(),
				result.integrityScore(),
				result.pronunciationScore(),
				result.fluencyScore(),
				result.feedbackSummary(),
				result.suggestedExpression(),
				List.of());
	}

	private PracticeResultUtterance toPersistedTurn(
			UUID sessionId,
			DialogueTurnEvaluationResult result,
			PronunciationAssessmentResult assessment) {
		return new PracticeResultUtterance(
				sessionId,
				result.turnNo(),
				result.transcript(),
				null,
				result.overallScore(),
				result.rhythmScore(),
				result.toneScore(),
				result.integrityScore(),
				result.pronunciationScore(),
				result.fluencyScore(),
				result.feedbackSummary(),
				result.suggestedExpression(),
				toPersistedWords(assessment));
	}

	private List<PracticeResultUtterance.Word> toPersistedWords(
			PronunciationAssessmentResult assessment) {
		return assessment.words().stream()
				.filter(word -> word.phonemes().stream().anyMatch(
						phoneme -> phoneme.startPosition() >= 0
								&& phoneme.endPosition()
										> phoneme.startPosition()))
				.map(word -> new PracticeResultUtterance.Word(
						word.index(),
						word.word(),
						word.pronunciationScore(),
						word.phonemes().stream()
								.filter(phoneme ->
										phoneme.startPosition() >= 0
												&& phoneme.endPosition()
												> phoneme.startPosition())
								.map(phoneme -> new PracticeResultUtterance.Phoneme(
										phoneme.index(),
										phoneme.expectedPhoneme(),
										phoneme.actualPhoneme(),
										phoneme.pronunciationScore(),
										phoneme.startPosition(),
										phoneme.endPosition()))
								.toList()))
				.toList();
	}

	private CustomTurnEvaluation toCustomTurn(
			AbstractSceneSession session,
			DialogueTurnEvaluationResult result,
			List<PracticeResultUtterance.Word> words) {
		return new CustomTurnEvaluation(
				session.getSceneId(),
				session.getId(),
				result.turnNo(),
				result.transcript(),
				result.overallScore(),
				result.rhythmScore(),
				result.toneScore(),
				result.integrityScore(),
				result.pronunciationScore(),
				result.fluencyScore(),
				result.feedbackSummary(),
				result.suggestedExpression(),
				words);
	}

	private AbstractSceneSession findCustomRuntimeSession(String sessionId) {
		if (sessionId == null || sessionId.isBlank()) {
			return null;
		}
		return sessionStateStore.findById(sessionId)
				.filter(session -> session.getSceneType() == SceneType.CUSTOM_SCENE)
				.orElse(null);
	}

	private CustomSceneDefinition requireOwnedScene(String sceneId) {
		String userId = authService.requireUserId(null);
		CustomSceneDefinition scene = sceneRepository
				.findCustomDefinitionById(sceneId)
				.orElseThrow(() -> new EvaluationException(
						EvaluationErrorCode.SENTENCE_NOT_FOUND));
		if (!userId.equals(scene.userId())) {
			throw new EvaluationException(
					EvaluationErrorCode.SENTENCE_NOT_FOUND);
		}
		return scene;
	}

	private AbstractSceneSession requireOwnedCustomSession(
			String sceneId,
			String sessionId) {
		String userId = authService.requireUserId(null);
		CustomSceneDefinition scene = sceneRepository
				.findCustomDefinitionById(sceneId)
				.orElseThrow(() -> new EvaluationException(
						EvaluationErrorCode.SESSION_NOT_FOUND));
		AbstractSceneSession session = requireCustomRuntimeSession(sessionId);
		if (!userId.equals(scene.userId())
				|| !userId.equals(session.getUserId())
				|| !sceneId.equals(session.getSceneId())) {
			throw new EvaluationException(
					EvaluationErrorCode.SESSION_NOT_FOUND);
		}
		return session;
	}

	private AbstractSceneSession requireCustomRuntimeSession(String sessionId) {
		AbstractSceneSession session = findCustomRuntimeSession(sessionId);
		if (session == null
				|| session.getSceneId() == null
				|| session.getSceneId().isBlank()) {
			throw new EvaluationException(EvaluationErrorCode.SESSION_NOT_FOUND);
		}
		return session;
	}

	private boolean isTooShort(CustomTurnEvaluation turn) {
		return TooShortEvaluationPolicy.isTooShort(
				turn.overallScore(),
				turn.rhythmScore(),
				turn.toneScore(),
				turn.integrityScore(),
				turn.pronunciationScore(),
				turn.fluencyScore(),
				turn.feedbackSummary());
	}

	private boolean isUnscorable(CustomTurnEvaluation turn) {
		return isTooShort(turn)
				|| UnavailableTurnEvaluationPolicy.isUnavailable(
						new UnavailableTurnEvaluationPolicy.CustomScores(
								turn.overallScore(),
								turn.rhythmScore(),
								turn.toneScore(),
								turn.integrityScore(),
								turn.pronunciationScore(),
								turn.fluencyScore(),
								turn.feedbackSummary()));
	}

	private List<CustomTurnEvaluation> ensureTurnRecords(
			AbstractSceneSession session,
			List<Message> dialogue,
			List<CustomTurnEvaluation> savedTurns) {
		Map<Integer, CustomTurnEvaluation> byTurn = new HashMap<>();
		for (CustomTurnEvaluation turn : savedTurns) {
			byTurn.put(turn.turnNo(), turn);
		}
		int turnNo = 0;
		for (Message message : dialogue) {
			if (message.owner() != 1) {
				continue;
			}
			turnNo++;
			if (byTurn.containsKey(turnNo)) {
				continue;
			}
			DialogueTurnEvaluationResult unavailable =
					UnavailableTurnEvaluationPolicy.createResult(
							turnNo,
							message.content());
			CustomTurnEvaluation record = toCustomTurn(
					session,
					unavailable,
					List.of());
			turnEvaluationRepository.upsert(record);
			byTurn.put(turnNo, record);
			LOGGER.warn(
					"backfilled missing custom turn evaluation sessionId={} turnNo={}",
					session.getId(),
					turnNo);
		}
		return byTurn.values().stream()
				.sorted(Comparator.comparingInt(CustomTurnEvaluation::turnNo))
				.toList();
	}

	private boolean isRecoverableTurnFailure(EvaluationException exception) {
		return switch (exception.errorCode()) {
			case TRANSCRIPT_REQUIRED,
					AUDIO_REQUIRED,
					AUDIO_UNSUPPORTED,
					AUDIO_INVALID,
					PROVIDER_NOT_CONFIGURED,
					PROVIDER_CALL_FAILED,
					PROVIDER_REJECTED,
					PROVIDER_RESPONSE_INVALID,
					PROVIDER_RESPONSE_INCOMPLETE,
					PROMPT_TEMPLATE_INVALID -> true;
			default -> false;
		};
	}

	private ConversationLanguageAssessment assessCustomDialogueLanguage(
			String sessionId,
			List<Message> dialogue,
			List<CustomTurnEvaluation> scorableTurns) {
		try {
			return llmClient.assessDialogue(dialogue);
		}
		catch (EvaluationException exception) {
			if (!isRecoverableReportFailure(exception)) {
				throw exception;
			}
			BigDecimal baseline = scorableTurns.stream()
					.map(CustomTurnEvaluation::overallScore)
					.reduce(BigDecimal.ZERO, BigDecimal::add)
					.divide(
							BigDecimal.valueOf(scorableTurns.size()),
							1,
							RoundingMode.HALF_UP);
			LOGGER.warn(
					"custom dialogue language assessment unavailable; "
							+ "using conservative fallback sessionId={} code={}",
					sessionId,
					exception.errorCode().code());
			return new ConversationLanguageAssessment(
					baseline,
					baseline,
					baseline,
					"语音评分已完成；语言模型返回格式异常，语法、词汇和文本自然度暂按本次有效回答的平均表现保守估计。",
					List.of(),
					List.of("稍后可重新练习，以获取更详细的语法、词汇和地道表达反馈。"));
		}
	}

	private boolean isRecoverableReportFailure(EvaluationException exception) {
		return switch (exception.errorCode()) {
			case PROVIDER_NOT_CONFIGURED,
					PROVIDER_CALL_FAILED,
					PROVIDER_REJECTED,
					PROVIDER_RESPONSE_INVALID,
					PROVIDER_RESPONSE_INCOMPLETE -> true;
			default -> false;
		};
	}

	private DialogueReportResult unavailableDialogueReport() {
		return new DialogueReportResult(
				BigDecimal.ZERO,
				BigDecimal.ZERO,
				BigDecimal.ZERO,
				BigDecimal.ZERO,
				BigDecimal.ZERO,
				BigDecimal.ZERO,
				"本次对话已保存，但有效英文语音不足，暂时无法生成完整五维评分。",
				List.of(),
				List.of("请使用完整英文句子完成至少一轮回答后再试。"));
	}

	private String findAiText(List<Message> messages, int learnerTurnNo) {
		int learnerTurn = 0;
		String latestAiText = null;
		for (Message message : messages) {
			if (message.owner() == 0) {
				latestAiText = message.content();
				continue;
			}
			learnerTurn++;
			if (learnerTurn == learnerTurnNo) {
				return latestAiText;
			}
		}
		return null;
	}

	private void requireCompleteLearnerTurns(
			List<Message> dialogue,
			List<CustomTurnEvaluation> savedTurns) {
		long learnerTurns = dialogue.stream()
				.filter(message -> message.owner() == 1)
				.count();
		if (learnerTurns != savedTurns.size()) {
			throw new EvaluationException(EvaluationErrorCode.RESULT_INCOMPLETE);
		}
		for (int index = 0; index < savedTurns.size(); index++) {
			if (savedTurns.get(index).turnNo() != index + 1) {
				throw new EvaluationException(
						EvaluationErrorCode.RESULT_INCOMPLETE);
			}
		}
	}

	private void persistDialogueContext(
			UUID sessionId,
			List<Message> dialogue,
			List<PracticeResultUtterance> savedTurns) {
		Map<Integer, PracticeResultUtterance> byTurn = new HashMap<>();
		for (PracticeResultUtterance turn : savedTurns) {
			byTurn.put(turn.utteranceNo(), turn);
		}

		int learnerTurn = 0;
		String latestAiText = null;
		for (Message message : dialogue) {
			if (message.owner() == 0) {
				latestAiText = message.content();
				continue;
			}
			learnerTurn++;
			PracticeResultUtterance saved = byTurn.get(learnerTurn);
			if (saved == null) {
				throw new EvaluationException(
						EvaluationErrorCode.RESULT_INCOMPLETE);
			}
			utteranceRepository.upsert(new PracticeResultUtterance(
					sessionId,
					saved.utteranceNo(),
					saved.transcript(),
					latestAiText,
					saved.overallScore(),
					saved.rhythmScore(),
					saved.toneScore(),
					saved.integrityScore(),
					saved.pronunciationScore(),
					saved.fluencyScore(),
					saved.feedbackSummary(),
					saved.suggestedExpression(),
					saved.words()));
			latestAiText = null;
		}
		if (learnerTurn != savedTurns.size()) {
			throw new EvaluationException(EvaluationErrorCode.RESULT_INCOMPLETE);
		}
	}

	private List<Message> validateDialogue(List<Message> dialogue) {
		if (dialogue == null || dialogue.isEmpty()) {
			throw new EvaluationException(EvaluationErrorCode.INVALID_REQUEST);
		}
		List<Message> copy = List.copyOf(dialogue);
		boolean hasLearner = false;
		for (Message message : copy) {
			if (message == null
					|| message.owner() == null
					|| message.content() == null
					|| message.content().isBlank()
					|| (message.owner() != 0 && message.owner() != 1)) {
				throw new EvaluationException(EvaluationErrorCode.INVALID_REQUEST);
			}
			hasLearner |= message.owner() == 1;
		}
		if (!hasLearner) {
			throw new EvaluationException(
					EvaluationErrorCode.NO_SCORABLE_UTTERANCES);
		}
		return copy;
	}

	private List<WordPronunciationScore> mapWords(
			List<PronunciationWordResult> words) {
		List<WordPronunciationScore> mapped = new ArrayList<>();
		for (PronunciationWordResult word : words) {
			List<PhonemeScore> phonemes = word.phonemes().stream()
					.map(phoneme -> new PhonemeScore(
							phoneme.expectedPhoneme(),
							phoneme.actualPhoneme(),
							phoneme.pronunciationScore()))
					.toList();
			mapped.add(new WordPronunciationScore(
					word.word(),
					word.pronunciationScore(),
					phonemes));
		}
		return List.copyOf(mapped);
	}

	private UUID parseUuid(String value) {
		if (value == null || value.isBlank()) {
			throw new EvaluationException(EvaluationErrorCode.INVALID_REQUEST);
		}
		try {
			return UUID.fromString(value.trim());
		}
		catch (IllegalArgumentException exception) {
			throw new EvaluationException(EvaluationErrorCode.INVALID_REQUEST);
		}
	}
}
