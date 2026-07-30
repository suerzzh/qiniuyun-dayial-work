package com.unispeaking.service.session.runtime;

import com.unispeaking.domain.po.session.AbstractSceneSession;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Holds only active runtime sessions. Durable conversation data is persisted
 * by the Redis and MyBatis repositories.
 */
@Component
public class SessionRuntimeStore {

	private final Map<String, AbstractSceneSession> sessions =
			new ConcurrentHashMap<>();

	public void save(AbstractSceneSession session) {
		sessions.put(session.getId(), session);
	}

	public Optional<AbstractSceneSession> findById(String sessionId) {
		return Optional.ofNullable(sessions.get(sessionId));
	}

	public void remove(String sessionId) {
		sessions.remove(sessionId);
	}
}
