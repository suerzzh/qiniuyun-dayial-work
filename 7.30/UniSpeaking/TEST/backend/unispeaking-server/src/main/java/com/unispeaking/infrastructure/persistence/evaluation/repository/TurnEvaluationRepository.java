package com.unispeaking.infrastructure.persistence.evaluation.repository;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.unispeaking.infrastructure.persistence.evaluation.support.EvaluationJsonbCodec;
import com.unispeaking.infrastructure.persistence.evaluation.model.PronunciationDetailsJson;
import com.unispeaking.infrastructure.persistence.evaluation.model.CustomTurnEvaluation;
import com.unispeaking.infrastructure.persistence.evaluation.model.PracticeResultUtterance;
import com.unispeaking.infrastructure.persistence.mybatis.entity.TurnEvaluationEntity;
import com.unispeaking.infrastructure.persistence.mybatis.mapper.TurnEvaluationMapper;
import com.unispeaking.service.evaluation.support.EvaluationErrorCode;
import com.unispeaking.service.evaluation.support.EvaluationException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Repository;

@Repository
public class TurnEvaluationRepository {

	private final TurnEvaluationMapper mapper;
	private final EvaluationJsonbCodec jsonbCodec;

	public TurnEvaluationRepository(
			TurnEvaluationMapper mapper,
			EvaluationJsonbCodec jsonbCodec) {
		this.mapper = mapper;
		this.jsonbCodec = jsonbCodec;
	}

	public synchronized void upsert(CustomTurnEvaluation evaluation) {
		try {
			TurnEvaluationEntity existing = mapper.selectOne(query(
					evaluation.sessionId(),
					evaluation.turnNo()));
			TurnEvaluationEntity entity = toEntity(evaluation);
			if (existing == null) {
				entity.setId(UUID.randomUUID());
				entity.setCreatedAt(OffsetDateTime.now());
				entity.setUpdatedAt(entity.getCreatedAt());
				if (mapper.insert(entity) != 1) {
					throw persistenceFailure();
				}
				return;
			}
			entity.setId(existing.getId());
			entity.setCreatedAt(existing.getCreatedAt());
			entity.setUpdatedAt(OffsetDateTime.now());
			if (mapper.updateById(entity) != 1) {
				throw persistenceFailure();
			}
		}
		catch (EvaluationException exception) {
			throw exception;
		}
		catch (RuntimeException exception) {
			throw persistenceFailure();
		}
	}

	public List<CustomTurnEvaluation> findAll(String sessionId) {
		try {
			return mapper.selectList(new LambdaQueryWrapper<TurnEvaluationEntity>()
							.eq(TurnEvaluationEntity::getSessionId, sessionId)
							.orderByAsc(TurnEvaluationEntity::getTurnNo))
					.stream()
					.map(this::toDomain)
					.toList();
		}
		catch (EvaluationException exception) {
			throw exception;
		}
		catch (RuntimeException exception) {
			throw persistenceFailure();
		}
	}

	public List<CustomTurnEvaluation> findBefore(String sessionId, int turnNo) {
		try {
			return mapper.selectList(new LambdaQueryWrapper<TurnEvaluationEntity>()
							.eq(TurnEvaluationEntity::getSessionId, sessionId)
							.lt(TurnEvaluationEntity::getTurnNo, turnNo)
							.orderByAsc(TurnEvaluationEntity::getTurnNo))
					.stream()
					.map(this::toDomain)
					.toList();
		}
		catch (EvaluationException exception) {
			throw exception;
		}
		catch (RuntimeException exception) {
			throw persistenceFailure();
		}
	}

	private LambdaQueryWrapper<TurnEvaluationEntity> query(
			String sessionId,
			int turnNo) {
		return new LambdaQueryWrapper<TurnEvaluationEntity>()
				.eq(TurnEvaluationEntity::getSessionId, sessionId)
				.eq(TurnEvaluationEntity::getTurnNo, turnNo);
	}

	private TurnEvaluationEntity toEntity(CustomTurnEvaluation evaluation) {
		TurnEvaluationEntity entity = new TurnEvaluationEntity();
		entity.setSceneId(evaluation.sceneId());
		entity.setSessionId(evaluation.sessionId());
		entity.setTurnNo(evaluation.turnNo());
		entity.setTranscript(evaluation.transcript());
		entity.setOverallScore(evaluation.overallScore());
		entity.setRhythmScore(evaluation.rhythmScore());
		entity.setToneScore(evaluation.toneScore());
		entity.setIntegrityScore(evaluation.integrityScore());
		entity.setPronunciationScore(evaluation.pronunciationScore());
		entity.setFluencyScore(evaluation.fluencyScore());
		entity.setFeedbackSummary(evaluation.feedbackSummary());
		entity.setSuggestedExpression(evaluation.suggestedExpression());
		entity.setPronunciationDetails(jsonbCodec.encodePronunciationDetails(
				new PronunciationDetailsJson(evaluation.words().stream()
						.map(this::toJsonWord)
						.toList())));
		return entity;
	}

	private CustomTurnEvaluation toDomain(TurnEvaluationEntity entity) {
		PronunciationDetailsJson details = jsonbCodec.decodePronunciationDetails(
				entity.getPronunciationDetails());
		return new CustomTurnEvaluation(
				entity.getSceneId(),
				entity.getSessionId(),
				entity.getTurnNo(),
				entity.getTranscript(),
				entity.getOverallScore(),
				entity.getRhythmScore(),
				entity.getToneScore(),
				entity.getIntegrityScore(),
				entity.getPronunciationScore(),
				entity.getFluencyScore(),
				entity.getFeedbackSummary(),
				entity.getSuggestedExpression(),
				details.words().stream()
						.map(this::toWord)
						.toList());
	}

	private PronunciationDetailsJson.Word toJsonWord(
			PracticeResultUtterance.Word word) {
		return new PronunciationDetailsJson.Word(
				word.index(),
				word.text(),
				word.pronunciationScore(),
				word.phonemes().stream()
						.map(phoneme -> new PronunciationDetailsJson.Phoneme(
								phoneme.index(),
								phoneme.expectedPhoneme(),
								phoneme.actualPhoneme(),
								phoneme.pronunciationScore(),
								phoneme.startPosition(),
								phoneme.endPosition()))
						.toList());
	}

	private PracticeResultUtterance.Word toWord(
			PronunciationDetailsJson.Word word) {
		return new PracticeResultUtterance.Word(
				word.index(),
				word.text(),
				word.pronunciationScore(),
				word.phonemes().stream()
						.map(phoneme -> new PracticeResultUtterance.Phoneme(
								phoneme.index(),
								phoneme.expectedPhoneme(),
								phoneme.actualPhoneme(),
								phoneme.pronunciationScore(),
								phoneme.startPosition(),
								phoneme.endPosition()))
						.toList());
	}

	private EvaluationException persistenceFailure() {
		return new EvaluationException(EvaluationErrorCode.PERSISTENCE_FAILED);
	}
}
