package com.example.unispeaking.service;

import com.example.unispeaking.model.ScenarioState;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ScenarioRegistry {
    private final Map<String, ScenarioState> scenarios = new ConcurrentHashMap<>();

    public ScenarioState get(String scenarioId) { return scenarios.get(scenarioId); }
    public void put(ScenarioState scenario) { scenarios.put(scenario.getScenarioId(), scenario); }
}
