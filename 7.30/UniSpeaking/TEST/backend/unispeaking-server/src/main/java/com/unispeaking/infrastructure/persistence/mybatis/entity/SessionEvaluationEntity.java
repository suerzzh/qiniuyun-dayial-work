package com.unispeaking.infrastructure.persistence.mybatis.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.unispeaking.infrastructure.persistence.evaluation.support.PostgresTextArrayTypeHandler;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@TableName(value = "session_evaluation", autoResultMap = true)
public class SessionEvaluationEntity {

	@TableId(type = IdType.INPUT)
	private String sessionId;
	private BigDecimal accuracyScore;
	private BigDecimal fluencyScore;
	private BigDecimal grammarScore;
	private BigDecimal vocabularyScore;
	private BigDecimal naturalnessScore;
	private BigDecimal finalScore;
	private String summary;
	@TableField(typeHandler = PostgresTextArrayTypeHandler.class)
	private String[] strengths;
	@TableField(typeHandler = PostgresTextArrayTypeHandler.class)
	private String[] improvements;
	private OffsetDateTime createdAt;
	private OffsetDateTime updatedAt;
}
