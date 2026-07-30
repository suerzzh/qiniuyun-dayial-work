package com.unispeaking.infrastructure.persistence.evaluation.repository;

import com.unispeaking.domain.dto.evaluation.DialogueReportResult;
import com.unispeaking.infrastructure.persistence.mybatis.entity.SessionEvaluationEntity;
import com.unispeaking.infrastructure.persistence.mybatis.mapper.SessionEvaluationMapper;
import com.unispeaking.service.evaluation.support.EvaluationErrorCode;
import com.unispeaking.service.evaluation.support.EvaluationException;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public class SessionEvaluationRepository {

	private final SessionEvaluationMapper mapper;

	public SessionEvaluationRepository(SessionEvaluationMapper mapper) {
		this.mapper = mapper;
	}

	public synchronized void save(String sessionId, DialogueReportResult report) {
		try {
			SessionEvaluationEntity existing = mapper.selectById(sessionId);
			SessionEvaluationEntity entity = toEntity(sessionId, report);
			if (existing == null) {
				entity.setCreatedAt(OffsetDateTime.now());
				entity.setUpdatedAt(entity.getCreatedAt());
				if (mapper.insert(entity) != 1) {
					throw persistenceFailure();
				}
				return;
			}
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

	public Optional<DialogueReportResult> find(String sessionId) {
		try {
			SessionEvaluationEntity entity = mapper.selectById(sessionId);
			return entity == null ? Optional.empty() : Optional.of(toDomain(entity));
		}
		catch (RuntimeException exception) {
			throw persistenceFailure();
		}
	}

	private SessionEvaluationEntity toEntity(
			String sessionId,
			DialogueReportResult report) {
		SessionEvaluationEntity entity = new SessionEvaluationEntity();
		entity.setSessionId(sessionId);
		entity.setAccuracyScore(report.accuracyScore());
		entity.setFluencyScore(report.fluencyScore());
		entity.setGrammarScore(report.grammarScore());
		entity.setVocabularyScore(report.vocabularyScore());
		entity.setNaturalnessScore(report.naturalnessScore());
		entity.setFinalScore(report.finalScore());
		entity.setSummary(report.summary());
		entity.setStrengths(report.strengths().toArray(String[]::new));
		entity.setImprovements(report.improvements().toArray(String[]::new));
		return entity;
	}

	private DialogueReportResult toDomain(SessionEvaluationEntity entity) {
		return new DialogueReportResult(
				entity.getAccuracyScore(),
				entity.getFluencyScore(),
				entity.getGrammarScore(),
				entity.getVocabularyScore(),
				entity.getNaturalnessScore(),
				entity.getFinalScore(),
				entity.getSummary(),
				entity.getStrengths() == null
						? java.util.List.of()
						: Arrays.asList(entity.getStrengths()),
				entity.getImprovements() == null
						? java.util.List.of()
						: Arrays.asList(entity.getImprovements()));
	}

	private EvaluationException persistenceFailure() {
		return new EvaluationException(EvaluationErrorCode.PERSISTENCE_FAILED);
	}
}
