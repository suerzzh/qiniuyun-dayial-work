package com.unispeaking.scenariodemo.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ScenarioSession {
    private final String id = UUID.randomUUID().toString();
    private final Instant createdAt = Instant.now();
    private final ScenarioDefinition definition;
    private final Map<String, String> order = new LinkedHashMap<>();
    private final List<ConversationTurn> conversation = new ArrayList<>();
    private final List<ScenarioEvent> events = new ArrayList<>();
    private final List<ControlInstruction> controlInstructions = new ArrayList<>();
    private ScenarioStage stage = ScenarioStage.GREETING;
    private String status = "waiting_for_conversation";
    private int revision;
    private int processingEvents;
    private String lastError;

    public ScenarioSession() {
        this(ScenarioDefinition.coffeeOrder());
    }

    public ScenarioSession(ScenarioDefinition definition) {
        this.definition = definition;
    }

    public int addTurn(Speaker speaker, String text) {
        int number = conversation.size() + 1;
        conversation.add(new ConversationTurn(number, speaker, text, Instant.now()));
        return number;
    }

    public void correctTurn(int turnNumber, String correctedText) {
        if (turnNumber <= 0 || turnNumber > conversation.size()
                || correctedText == null || correctedText.isBlank()) return;
        ConversationTurn original = conversation.get(turnNumber - 1);
        conversation.set(turnNumber - 1,
                new ConversationTurn(original.number(), original.speaker(), correctedText.trim(), original.occurredAt()));
    }

    public void startProcessing() {
        processingEvents++;
        lastError = null;
    }

    public void finishProcessing() {
        processingEvents = Math.max(0, processingEvents - 1);
    }

    public void failProcessing(String message) {
        finishProcessing();
        lastError = message;
    }

    public void apply(ScenarioEvent event) {
        events.add(event);
        switch (event.type()) {
            case GREETING_STARTED -> transitionTo(ScenarioStage.GREETING, "waiting_for_order");
            case ORDER_UPDATE -> {
                order.putAll(event.values());
                if (hasAllRequiredSlots()) {
                    transitionTo(ScenarioStage.CONFIRMATION, "pending_confirmation");
                } else {
                    transitionTo(ScenarioStage.COLLECTING_INFORMATION, "collecting_information");
                }
            }
            case CORRECTION -> {
                order.putAll(event.values());
                revision++;
                if (hasAllRequiredSlots()) {
                    transitionTo(ScenarioStage.CONFIRMATION, "pending_confirmation");
                } else {
                    transitionTo(ScenarioStage.COLLECTING_INFORMATION, "collecting_information");
                }
            }
            case USER_CONFIRMED -> {
                order.putAll(event.values());
                if (hasAllRequiredSlots()) {
                    transitionTo(ScenarioStage.COMPLETED, "completed");
                    if (controlInstructions.isEmpty()) {
                        controlInstructions.add(ControlInstruction.closeNaturally(definition.goal()));
                    }
                } else {
                    transitionTo(ScenarioStage.COLLECTING_INFORMATION, "confirmation_rejected_missing_slots");
                }
            }
            case AI_CLOSED -> {
                if (stage == ScenarioStage.COMPLETED) {
                    transitionTo(ScenarioStage.CLOSING, "closed");
                } else {
                    // Keep tracking instead of failing the whole extractor pipeline. This is
                    // visible in the UI as a diagnostic if the model tries to leave too early.
                    status = "premature_closing_detected";
                }
            }
            case UNEXPECTED_REQUEST -> status = "needs_recovery";
            case TRANSCRIPT_CORRECTED -> { }
        }
    }

    private boolean hasAllRequiredSlots() {
        return definition.requiredSlotKeys().stream()
                .allMatch(key -> order.containsKey(key) && !order.get(key).isBlank());
    }

    private void transitionTo(ScenarioStage next, String nextStatus) {
        stage = next;
        status = nextStatus;
    }

    public String getId() { return id; }
    public ScenarioDefinition getDefinition() { return definition; }
    public Instant getCreatedAt() { return createdAt; }
    public Map<String, String> getOrder() { return Map.copyOf(order); }
    public List<ConversationTurn> getConversation() { return List.copyOf(conversation); }
    public List<ScenarioEvent> getEvents() { return List.copyOf(events); }
    public List<ControlInstruction> getControlInstructions() { return List.copyOf(controlInstructions); }
    public ScenarioStage getStage() { return stage; }
    public String getStatus() { return status; }
    public int getRevision() { return revision; }
    public int getProcessingEvents() { return processingEvents; }
    public String getLastError() { return lastError; }
}
