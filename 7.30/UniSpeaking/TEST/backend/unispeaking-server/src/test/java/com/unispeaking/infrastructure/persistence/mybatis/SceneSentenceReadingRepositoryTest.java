package com.unispeaking.infrastructure.persistence.mybatis;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.unispeaking.domain.dto.scene.LearningContentItem;
import com.unispeaking.infrastructure.persistence.evaluation.repository.SceneSentenceReadingRepository;
import com.unispeaking.infrastructure.persistence.evaluation.support.EvaluationJsonbCodec;
import com.unispeaking.infrastructure.persistence.mybatis.entity.SceneSentenceEntity;
import com.unispeaking.infrastructure.persistence.mybatis.mapper.SceneSentenceMapper;
import com.unispeaking.service.evaluation.support.EndingTone;
import com.unispeaking.service.evaluation.support.PronunciationAssessmentResult;
import com.unispeaking.service.evaluation.support.PronunciationPhonemeResult;
import com.unispeaking.service.evaluation.support.PronunciationWordResult;
import com.unispeaking.service.evaluation.support.WordReadStatus;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.ObjectMapper;

class SceneSentenceReadingRepositoryTest {

	@Test
	void insertsANewSentenceRowForEveryReading() {
		SceneSentenceMapper mapper = mock(SceneSentenceMapper.class);
		when(mapper.insert(any(SceneSentenceEntity.class))).thenReturn(1);
		EvaluationJsonbCodec codec =
				new EvaluationJsonbCodec(new ObjectMapper());
		SceneSentenceReadingRepository repository =
				new SceneSentenceReadingRepository(mapper, codec);
		LearningContentItem sentence = new LearningContentItem(
				"sentence_abc",
				"I need something for a headache.",
				"我需要一些治头痛的药。",
				"");
		PronunciationAssessmentResult assessment = assessment();

		String firstId = repository.saveAttempt(
				"custom_scene1",
				sentence,
				assessment);
		String secondId = repository.saveAttempt(
				"custom_scene1",
				sentence,
				assessment);

		assertTrue(firstId.startsWith("sentence_reading_"));
		assertTrue(secondId.startsWith("sentence_reading_"));
		assertNotEquals(firstId, secondId);
		ArgumentCaptor<SceneSentenceEntity> rows =
				ArgumentCaptor.forClass(SceneSentenceEntity.class);
		verify(mapper, times(2)).insert(rows.capture());
		SceneSentenceEntity first = rows.getAllValues().getFirst();
		assertEquals("sentence_abc", first.getSentenceId());
		assertEquals("custom_scene1", first.getSceneId());
		assertEquals(new BigDecimal("82"), first.getOverallScore());
		assertEquals(
				assessment.overallScore(),
				codec.decodeReadingDetails(first.getScoreDetail()).overallScore());
	}

	private PronunciationAssessmentResult assessment() {
		PronunciationPhonemeResult phoneme =
				new PronunciationPhonemeResult(
						0,
						"h",
						"h",
						new BigDecimal("83"),
						0,
						18);
		PronunciationWordResult word = new PronunciationWordResult(
				0,
				"headache",
				WordReadStatus.NORMAL,
				new BigDecimal("82"),
				new BigDecimal("83"),
				false,
				List.of(phoneme));
		return new PronunciationAssessmentResult(
				new BigDecimal("82"),
				new BigDecimal("80"),
				new BigDecimal("78"),
				new BigDecimal("85"),
				new BigDecimal("83"),
				new BigDecimal("81"),
				EndingTone.FALL,
				List.of(word));
	}
}
