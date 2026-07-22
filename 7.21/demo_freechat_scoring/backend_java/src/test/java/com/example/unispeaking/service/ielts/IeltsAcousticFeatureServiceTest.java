package com.example.unispeaking.service.ielts;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class IeltsAcousticFeatureServiceTest {
    @Test
    void calculatesObjectiveMetricsAndLeavesUnreliableValuesUnavailable() {
        var turn = new IeltsTurn("t1", 2, "q1", "Describe a place", true, 1_000);
        turn.speechStarted(2_000);
        turn.speechStopped(7_000);
        turn.speechStarted(10_000);
        turn.speechStopped(14_000);
        turn.setRawTranscript("Um, uh, this is a place I really like and visit often.");
        turn.complete(16_000, "USER_DONE");

        var metrics = new IeltsAcousticFeatureService().calculate(turn);
        assertEquals(15_000L, metrics.answerDurationMs());
        assertEquals(9_000L, metrics.speechDurationMs());
        assertEquals(0.4, metrics.silenceRatio(), 0.0001);
        assertEquals(1, metrics.pauseCount());
        assertEquals(1, metrics.longPauseCount());
        assertEquals(1_000L, metrics.responseLatencyMs());
        assertEquals(5_000L, metrics.part2ContinuousSpeakingDurationMs());
        assertTrue(metrics.fillerCount() >= 2);
        assertNull(metrics.audioSignalQuality(), "no signal analysis means unavailable, never invented");
    }
}
