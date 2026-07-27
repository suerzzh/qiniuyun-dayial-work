package com.unispeaking.scenariodemo.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;
import org.junit.jupiter.api.Test;

class ScenarioSessionTest {
    @Test
    void allSlotsRequireConfirmationInsteadOfCompletingImmediately() {
        ScenarioSession session = new ScenarioSession();
        session.apply(ScenarioEvent.of(EventType.GREETING_STARTED, Map.of(), 1));
        session.apply(ScenarioEvent.of(EventType.ORDER_UPDATE, Map.of(
                "drink", "latte", "size", "medium", "temperature", "iced", "payment", "card"), .99));

        assertEquals(ScenarioStage.CONFIRMATION, session.getStage());
        assertEquals("pending_confirmation", session.getStatus());
        assertEquals(0, session.getControlInstructions().size());
    }

    @Test
    void correctionUpdatesValueAndReturnsToConfirmation() {
        ScenarioSession session = completeOrderUpToConfirmation();
        session.apply(ScenarioEvent.correction(Map.of("size", "medium"), Map.of("size", "large"), .99));

        assertEquals("large", session.getOrder().get("size"));
        assertEquals(ScenarioStage.CONFIRMATION, session.getStage());
        assertEquals(1, session.getRevision());
    }

    @Test
    void confirmationTriggersExactlyOneClosingInstruction() {
        ScenarioSession session = completeOrderUpToConfirmation();
        session.apply(ScenarioEvent.of(EventType.USER_CONFIRMED, Map.of(), .99));

        assertEquals(ScenarioStage.COMPLETED, session.getStage());
        assertEquals(1, session.getControlInstructions().size());
        assertEquals("session.update", session.getControlInstructions().getFirst().type());
    }

    @Test
    void finalConfirmationCannotCompleteWithMissingSlots() {
        ScenarioSession session = new ScenarioSession();
        session.apply(ScenarioEvent.of(EventType.GREETING_STARTED, Map.of(), 1));
        session.apply(ScenarioEvent.of(EventType.ORDER_UPDATE, Map.of("payment", "card"), .95));
        session.apply(ScenarioEvent.of(EventType.USER_CONFIRMED, Map.of(), .99));

        assertEquals(ScenarioStage.COLLECTING_INFORMATION, session.getStage());
        assertEquals("confirmation_rejected_missing_slots", session.getStatus());
        assertEquals(0, session.getControlInstructions().size());
    }

    @Test
    void prematureAiClosingIsDiagnosticInsteadOfStateMachineFailure() {
        ScenarioSession session = new ScenarioSession();
        session.apply(ScenarioEvent.of(EventType.AI_CLOSED, Map.of(), .95));

        assertEquals(ScenarioStage.GREETING, session.getStage());
        assertEquals("premature_closing_detected", session.getStatus());
    }

    @Test
    void customScenarioUsesItsOwnRequiredSlots() {
        ScenarioDefinition definition = new ScenarioDefinition(
                "Discuss a delay", "Agree on a recovery plan", "manager", "engineer",
                Map.of("delay_reason", "reason", "new_deadline", "deadline"), 8, "Stay in role");
        ScenarioSession session = new ScenarioSession(definition);
        session.apply(ScenarioEvent.of(EventType.ORDER_UPDATE,
                Map.of("delay_reason", "dependency arrived late"), .95));
        assertEquals(ScenarioStage.COLLECTING_INFORMATION, session.getStage());

        session.apply(ScenarioEvent.of(EventType.ORDER_UPDATE,
                Map.of("new_deadline", "Friday"), .95));
        assertEquals(ScenarioStage.CONFIRMATION, session.getStage());
    }

    @Test
    void correctedTranscriptReplacesTheOriginalTurn() {
        ScenarioSession session = new ScenarioSession();
        int turn = session.addTurn(Speaker.USER, "Price.");
        session.correctTurn(turn, "Fries.");

        assertEquals("Fries.", session.getConversation().getFirst().text());
    }

    private ScenarioSession completeOrderUpToConfirmation() {
        ScenarioSession session = new ScenarioSession();
        session.apply(ScenarioEvent.of(EventType.GREETING_STARTED, Map.of(), 1));
        session.apply(ScenarioEvent.of(EventType.ORDER_UPDATE, Map.of(
                "drink", "latte", "size", "medium", "temperature", "iced", "payment", "card"), .99));
        return session;
    }
}
