package com.unispeaking.infrastructure.persistence.evaluation.repository;

import com.unispeaking.domain.dto.scene.LearningContentItem;
import com.unispeaking.infrastructure.persistence.evaluation.support.EvaluationJsonbCodec;
import com.unispeaking.infrastructure.persistence.evaluation.model.ReadingDetailsJson;
import com.unispeaking.infrastructure.persistence.mybatis.entity.SceneSentenceEntity;
import com.unispeaking.infrastructure.persistence.mybatis.mapper.SceneSentenceMapper;
import com.unispeaking.service.evaluation.support.EvaluationErrorCode;
import com.unispeaking.service.evaluation.support.EvaluationException;
import com.unispeaking.service.evaluation.support.PronunciationAssessmentResult;
import com.unispeaking.service.evaluation.support.PronunciationPhonemeResult;
import com.unispeaking.service.evaluation.support.PronunciationWordResult;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Repository;

/**
 * Persists every custom-scene sentence reading as a separate sentence row.
 */
@Repository
public class SceneSentenceReadingRepository {

	private final SceneSentenceMapper sentenceMapper;
	private final EvaluationJsonbCodec jsonbCodec;

	public SceneSentenceReadingRepository(
			SceneSentenceMapper sentenceMapper,
			EvaluationJsonbCodec jsonbCodec) {
		this.sentenceMapper = Objects.requireNonNull(
				sentenceMapper,
				"sentenceMapper must not be null");
		this.jsonbCodec = Objects.requireNonNull(
				jsonbCodec,
				"jsonbCodec must not be null");
	}

	public String saveAttempt(
			String sceneId,
			LearningContentItem sentence,
			PronunciationAssessmentResult assessment) {
		Objects.requireNonNull(sentence, "sentence must not be null");
		Objects.requireNonNull(assessment, "assessment must not be null");

		String readingId = "sentence_reading_" + compactId();
		SceneSentenceEntity entity = new SceneSentenceEntity();
		entity.setId(readingId);
		entity.setSentenceId(sentence.contentId());
		entity.setSceneId(sceneId);
		entity.setSentence(sentence.englishText());
		entity.setTranslation(sentence.chineseText());
		entity.setOverallScore(assessment.overallScore());
		entity.setScoreDetail(jsonbCodec.encodeReadingDetails(
				toReadingDetails(assessment)));

		try {
			if (sentenceMapper.insert(entity) != 1) {
				throw persistenceFailure();
			}
			return readingId;
		}
		catch (EvaluationException exception) {
			throw exception;
		}
		catch (RuntimeException exception) {
			throw persistenceFailure();
		}
	}

	private ReadingDetailsJson toReadingDetails(
			PronunciationAssessmentResult assessment) {
		List<ReadingDetailsJson.Word> words = assessment.words().stream()
				.map(this::toReadingWord)
				.toList();
		return new ReadingDetailsJson(
				assessment.overallScore(),
				assessment.pronunciationScore(),
				assessment.fluencyScore(),
				assessment.integrityScore(),
				assessment.rhythmScore(),
				assessment.endingTone(),
				words);
	}

	private ReadingDetailsJson.Word toReadingWord(
			PronunciationWordResult word) {
		return new ReadingDetailsJson.Word(
				word.index(),
				word.word(),
				word.readStatus(),
				word.overallScore(),
				word.pronunciationScore(),
				word.isProminent(),
				word.phonemes().stream()
						.map(this::toReadingPhoneme)
						.toList());
	}

	private ReadingDetailsJson.Phoneme toReadingPhoneme(
			PronunciationPhonemeResult phoneme) {
		return new ReadingDetailsJson.Phoneme(
				phoneme.index(),
				phoneme.expectedPhoneme(),
				phoneme.actualPhoneme(),
				phoneme.pronunciationScore(),
				phoneme.startPosition(),
				phoneme.endPosition());
	}

	private String compactId() {
		return UUID.randomUUID().toString().replace("-", "");
	}

	private EvaluationException persistenceFailure() {
		return new EvaluationException(EvaluationErrorCode.PERSISTENCE_FAILED);
	}
}
