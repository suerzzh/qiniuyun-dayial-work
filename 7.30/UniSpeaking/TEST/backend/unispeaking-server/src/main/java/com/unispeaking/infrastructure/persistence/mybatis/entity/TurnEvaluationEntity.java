package com.unispeaking.infrastructure.persistence.mybatis.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.unispeaking.infrastructure.persistence.mybatis.typehandler.PostgresJsonbStringTypeHandler;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@TableName("turn_evaluation")
public class TurnEvaluationEntity {

	@TableId(type = IdType.INPUT)
	private UUID id;
	private String sceneId;
	private String sessionId;
	private Integer turnNo;
	private String transcript;
	private BigDecimal overallScore;
	private BigDecimal rhythmScore;
	private BigDecimal toneScore;
	private BigDecimal integrityScore;
	private BigDecimal pronunciationScore;
	private BigDecimal fluencyScore;
	private String feedbackSummary;
	private String suggestedExpression;
	@TableField(typeHandler = PostgresJsonbStringTypeHandler.class)
	private String pronunciationDetails;
	private OffsetDateTime createdAt;
	private OffsetDateTime updatedAt;
}
