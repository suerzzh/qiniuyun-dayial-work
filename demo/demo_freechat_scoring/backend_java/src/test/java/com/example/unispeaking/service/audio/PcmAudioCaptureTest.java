package com.example.unispeaking.service.audio;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PcmAudioCaptureTest {
    @Test
    void overlappingNextTurnDoesNotDiscardPreviousPostRoll() {
        var capture = new PcmAudioCapture(500, 700, 5_000);
        capture.start("old");
        capture.append(new byte[3_200]);
        capture.requestFinish("old");
        capture.start("next");
        capture.append(new byte[22_400]);
        assertTrue(capture.isReady("old"));
        assertEquals(25_600, capture.audio("old").length);
        assertFalse(capture.isReady("next"));
    }
}
