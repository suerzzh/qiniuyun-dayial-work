package com.unispeaking.infrastructure.persistence.mybatis.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.unispeaking.infrastructure.persistence.mybatis.typehandler.PostgresJsonbStringTypeHandler;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@TableName(value = "sentence", autoResultMap = true)
public class SceneSentenceEntity {

	@TableId(value = "id", type = IdType.INPUT)
	private String id;
	private String sentenceId;
	private String sceneId;
	private String sentence;
	private String translation;
	private BigDecimal overallScore;
	@TableField(typeHandler = PostgresJsonbStringTypeHandler.class)
	private String scoreDetail;
	private OffsetDateTime createdAt;
	private OffsetDateTime updatedAt;
}
