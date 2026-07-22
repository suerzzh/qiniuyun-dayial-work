package com.example.unispeaking.service.ielts;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.util.ArrayList;
import java.util.List;

public class IeltsTurn {
    public record SpeechChunk(long startMs, Long endMs) {}

    private final String turnId;
    private final int part;
    private final String questionId;
    private final String questionTextSnapshot;
    private final boolean part2LongTurn;
    private final boolean scoringEligible;
    private final long openedAtMs;
    private final List<SpeechChunk> speechChunks = new ArrayList<>();
    private String rawTranscript = "";
    private byte[] audio = new byte[0];
    private boolean completed;
    private boolean audioReady;
    private Long completedAtMs;
    private String completionReason;

    public IeltsTurn(String turnId, int part, String questionId, String questionTextSnapshot,
                     boolean part2LongTurn, long openedAtMs) {
        this(turnId, part, questionId, questionTextSnapshot, part2LongTurn, part >= 1 && part <= 3, openedAtMs);
    }

    public IeltsTurn(String turnId, int part, String questionId, String questionTextSnapshot,
                     boolean part2LongTurn, boolean scoringEligible, long openedAtMs) {
        this.turnId = turnId;
        this.part = part;
        this.questionId = questionId;
        this.questionTextSnapshot = questionTextSnapshot;
        this.part2LongTurn = part2LongTurn;
        this.scoringEligible = scoringEligible;
        this.openedAtMs = openedAtMs;
    }

    public synchronized void speechStarted(long timestampMs) {
        if (completed) return;
        if (!speechChunks.isEmpty() && speechChunks.getLast().endMs() == null) return;
        speechChunks.add(new SpeechChunk(timestampMs, null));
    }
    public synchronized void speechStopped(long timestampMs) {
        if (speechChunks.isEmpty()) return;
        SpeechChunk last = speechChunks.getLast();
        if (last.endMs() == null) speechChunks.set(speechChunks.size() - 1,
                new SpeechChunk(last.startMs(), Math.max(last.startMs(), timestampMs)));
    }
    public synchronized void complete(long timestampMs, String reason) {
        speechStopped(timestampMs);
        completed = true;
        completedAtMs = Math.max(openedAtMs, timestampMs);
        completionReason = reason;
    }

    public String turnId() { return turnId; }
    public int part() { return part; }
    public String questionId() { return questionId; }
    public String questionTextSnapshot() { return questionTextSnapshot; }
    public boolean part2LongTurn() { return part2LongTurn; }
    public boolean scoringEligible() { return scoringEligible; }
    public long openedAtMs() { return openedAtMs; }
    public synchronized List<SpeechChunk> speechChunks() { return List.copyOf(speechChunks); }
    public String rawTranscript() { return rawTranscript; }
    public void setRawTranscript(String value) { rawTranscript = value == null ? "" : value.trim(); }
    @JsonIgnore public byte[] audio() { return audio.clone(); }
    public int audioByteLength() { return audio.length; }
    public void setAudio(byte[] audio) { this.audio = audio == null ? new byte[0] : audio.clone(); }
    public boolean completed() { return completed; }
    public boolean audioReady() { return audioReady; }
    public void setAudioReady(boolean audioReady) { this.audioReady = audioReady; }
    public Long completedAtMs() { return completedAtMs; }
    public String completionReason() { return completionReason; }
}
