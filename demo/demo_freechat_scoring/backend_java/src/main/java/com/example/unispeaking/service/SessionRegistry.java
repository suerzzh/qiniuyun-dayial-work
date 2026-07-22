package com.example.unispeaking.service;

import com.example.unispeaking.model.SessionState;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SessionRegistry {
    private final Map<String, SessionState> sessions = new ConcurrentHashMap<>();

    public SessionState get(String sessionId) { return sessions.get(sessionId); }
    public void put(SessionState state) { sessions.put(state.getSessionId(), state); }
    public SessionState remove(String sessionId) { return sessions.remove(sessionId); }
    public Collection<SessionState> all() { return sessions.values(); }
}
