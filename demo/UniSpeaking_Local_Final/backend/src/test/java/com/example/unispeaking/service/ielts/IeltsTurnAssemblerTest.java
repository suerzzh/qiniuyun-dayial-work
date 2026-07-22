package com.example.unispeaking.service.ielts;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class IeltsTurnAssemblerTest {
    @Test
    void part2VadStopsOnlyCloseChunksAndExplicitCompletionClosesLogicalTurn() {
        var assembler = new IeltsTurnAssembler(500, 700, 5_000);
        assembler.appendPcm(new byte[16_000]);
        assembler.open("turn-p2", 2, "q-p2", "Describe a person", true, 10_000);

        assembler.speechStarted("turn-p2", 11_000);
        assembler.appendPcm(new byte[32_000]);
        assembler.speechStopped("turn-p2", 12_000);
        assertFalse(assembler.turn("turn-p2").completed());

        assembler.speechStarted("turn-p2", 14_500);
        assembler.appendPcm(new byte[32_000]);
        assembler.speechStopped("turn-p2", 15_500);
        assertFalse(assembler.turn("turn-p2").completed(), "ordinary VAD must not end Part 2");

        assembler.transcript("turn-p2", "I would like to describe my teacher.");
        assembler.complete("turn-p2", 16_000, "USER_DONE");
        assembler.appendPcm(new byte[22_400]);

        var turn = assembler.turn("turn-p2");
        assertTrue(turn.completed());
        assertTrue(turn.audioReady());
        assertEquals(2, turn.speechChunks().size());
        assertTrue(turn.audio().length >= 16_000 + 64_000 + 22_400);
    }

    @Test
    void duplicateEventIdsAreIgnored() {
        var assembler = new IeltsTurnAssembler(500, 700, 5_000);
        assertTrue(assembler.acceptEvent("evt-1"));
        assertFalse(assembler.acceptEvent("evt-1"));
    }
}
