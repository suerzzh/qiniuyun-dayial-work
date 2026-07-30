package com.unispeaking.service.evaluation.support;

import com.unispeaking.domain.dto.session.Message;
import com.unispeaking.exception.BusinessException;
import com.unispeaking.provider.AiProviderRegistry;
import com.unispeaking.service.evaluation.support.ConversationLanguageAssessment;
import com.unispeaking.service.evaluation.support.TurnLanguageFeedback;
import com.unispeaking.service.evaluation.support.ConversationLanguageAssessmentParser;
import com.unispeaking.service.evaluation.support.EvaluationJsonDocumentParser;
import com.unispeaking.service.evaluation.support.TurnLanguageFeedbackParser;
import com.unispeaking.service.evaluation.support.ConversationReportEvaluationPromptBuilder;
import com.unispeaking.service.evaluation.support.DialogueTurnEvaluationPromptBuilder;
import com.unispeaking.service.evaluation.support.DialogueTurnEvaluationPromptInput;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * 评分模块调用 LLM 的受控边界。
 */
@Component
public final class EvaluationLlmClient {

	private static final Logger LOGGER = LoggerFactory.getLogger(
			EvaluationLlmClient.class);

	private final AiProviderRegistry registry;
	private final EvaluationProviderFailureTranslator failureTranslator;
	private final ConversationReportEvaluationPromptBuilder reportPromptBuilder;
	private final DialogueTurnEvaluationPromptBuilder turnPromptBuilder;
	private final ConversationLanguageAssessmentParser reportParser;
	private final TurnLanguageFeedbackParser turnParser;

	public EvaluationLlmClient(
			AiProviderRegistry registry,
			EvaluationProviderFailureTranslator failureTranslator,
			ConversationReportEvaluationPromptBuilder reportPromptBuilder,
			DialogueTurnEvaluationPromptBuilder turnPromptBuilder,
			ObjectMapper objectMapper) {
		this.registry = Objects.requireNonNull(registry, "registry must not be null");
		this.failureTranslator = Objects.requireNonNull(
				failureTranslator,
				"failureTranslator must not be null");
		this.reportPromptBuilder = Objects.requireNonNull(
				reportPromptBuilder,
				"reportPromptBuilder must not be null");
		this.turnPromptBuilder = Objects.requireNonNull(
				turnPromptBuilder,
				"turnPromptBuilder must not be null");
		EvaluationJsonDocumentParser documentParser =
				new EvaluationJsonDocumentParser(
						Objects.requireNonNull(
								objectMapper,
								"objectMapper must not be null"));
		this.reportParser = new ConversationLanguageAssessmentParser(documentParser);
		this.turnParser = new TurnLanguageFeedbackParser(documentParser);
	}

	public ConversationLanguageAssessment assessDialogue(List<Message> dialogue) {
		String prompt = reportPromptBuilder.build(dialogue);
		try {
			return reportParser.parse(execute(prompt));
		}
		catch (EvaluationException exception) {
			if (!isMalformedResponse(exception)) {
				throw exception;
			}
			LOGGER.warn(
					"conversation report response malformed; retrying once code={}",
					exception.errorCode().code());
			return reportParser.parse(execute(prompt + """

					Your previous attempt could not be parsed. Try once more. Return only
					one JSON object matching the required schema. Do not add fields,
					Markdown, comments, NaN, trailing commas, or explanatory prose.
					"""));
		}
	}

	public TurnLanguageFeedback assessTurn(
			DialogueTurnEvaluationPromptInput input) {
		return turnParser.parse(execute(turnPromptBuilder.build(input)));
	}

	private String execute(String prompt) {
		try {
			return registry.executeLlmTaskRouted(prompt, null).response();
		}
		catch (BusinessException exception) {
			throw failureTranslator.translate(exception);
		}
	}

	private boolean isMalformedResponse(EvaluationException exception) {
		return exception.errorCode()
				== EvaluationErrorCode.PROVIDER_RESPONSE_INVALID
				|| exception.errorCode()
				== EvaluationErrorCode.PROVIDER_RESPONSE_INCOMPLETE;
	}
}
