package com.example.unispeaking.model;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

public class ScenarioState {
    private final String scenarioId;
    private final String topic;
    private final int learnerLevel;
    private final Map<String, Object> content;
    private final CopyOnWriteArrayList<Map<String, Object>> readingAttempts = new CopyOnWriteArrayList<>();

    public ScenarioState(String scenarioId, String topic, int learnerLevel, Map<String, Object> content) {
        this.scenarioId = scenarioId;
        this.topic = topic;
        this.learnerLevel = learnerLevel;
        this.content = content;
    }

    public String getScenarioId() { return scenarioId; }
    public String getTopic() { return topic; }
    public int getLearnerLevel() { return learnerLevel; }
    public Map<String, Object> getContent() { return content; }
    public List<Map<String, Object>> getReadingAttempts() { return readingAttempts; }
}
