package com.unispeaking.infrastructure.persistence.mybatis.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.OffsetDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@TableName("session_message")
public class SessionMessageEntity {

	private String sceneId;
	private String sessionId;
	private Integer messageNo;
	private Integer owner;
	private String content;
	private String audioUrl;
	private OffsetDateTime createdAt;
	private OffsetDateTime updateAt;
}
