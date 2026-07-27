package com.unispeaking.scenariodemo.service;

import com.unispeaking.scenariodemo.domain.PromptProfile;
import com.unispeaking.scenariodemo.domain.ScenarioEvent;
import com.unispeaking.scenariodemo.domain.ScenarioSession;
import com.unispeaking.scenariodemo.domain.Speaker;
import com.unispeaking.scenariodemo.prompt.PromptProfileDefaults;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.stereotype.Service;

@Service
public class LiveScenarioService {
    private final Map<String, ScenarioSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, CompletableFuture<Void>> extractionChains = new ConcurrentHashMap<>();
    private final ExecutorService extractorExecutor = Executors.newVirtualThreadPerTaskExecutor();
    private final QwenEventExtractor extractor;
    private final QwenScenarioGenerator scenarioGenerator;
    private final PromptProfileDefaults promptDefaults;

    public LiveScenarioService(
            QwenEventExtractor extractor,
            QwenScenarioGenerator scenarioGenerator,
            PromptProfileDefaults promptDefaults) {
        this.extractor = extractor;
        this.scenarioGenerator = scenarioGenerator;
        this.promptDefaults = promptDefaults;
    }

    public ScenarioSession create(String topic, PromptProfile requestedProfile) {
        PromptProfile profile = promptDefaults.resolve(requestedProfile);
        ScenarioSession session = new ScenarioSession(scenarioGenerator.generate(topic, profile));
        sessions.put(session.getId(), session);
        return session;
    }

    public ScenarioSession get(String id) {
        ScenarioSession session = sessions.get(id);
        if (session == null) throw new SessionNotFoundException(id);
        return session;
    }

    public ScenarioSession acceptTranscript(String id, Speaker speaker, String transcript) {
        ScenarioSession session = get(id);
        if (transcript == null || transcript.isBlank()) return session;
        int turnNumber;
        synchronized (session) {
            turnNumber = session.addTurn(speaker, transcript.trim());
            if (speaker == Speaker.AI) {
                return session;
            }
            session.startProcessing();
        }
        extractionChains.compute(id, (key, previous) -> {
            CompletableFuture<Void> start = previous == null
                    ? CompletableFuture.completedFuture(null) : previous.exceptionally(ignored -> null);
            return start.thenRunAsync(
                    () -> extractAndApply(session, speaker, transcript.trim(), turnNumber), extractorExecutor);
        });
        return session;
    }

    private void extractAndApply(ScenarioSession session, Speaker speaker, String transcript, int turnNumber) {
        try {
            ScenarioEvent event = extractor.extract(session, speaker, transcript);
            synchronized (session) {
                if (event != null) {
                    session.correctTurn(turnNumber, event.correctedTranscript());
                    session.apply(event);
                }
                session.finishProcessing();
            }
        } catch (Exception exception) {
            synchronized (session) {
                session.failProcessing(exception.getMessage());
            }
        }
    }

    public ScenarioSession reset(String id) {
        ScenarioSession previous = get(id);
        String topic = previous.getDefinition().topic();
        PromptProfile profile = previous.getDefinition().promptProfile();
        sessions.remove(id);
        extractionChains.remove(id);
        return create(topic, profile);
    }

    public ScenarioSession close(String id) {
        ScenarioSession session = get(id);
        synchronized (session) {
            if (session.getStage() == com.unispeaking.scenariodemo.domain.ScenarioStage.COMPLETED) {
                session.apply(ScenarioEvent.of(
                        com.unispeaking.scenariodemo.domain.EventType.AI_CLOSED, Map.of(), 1.0));
            }
            return session;
        }
    }
}
