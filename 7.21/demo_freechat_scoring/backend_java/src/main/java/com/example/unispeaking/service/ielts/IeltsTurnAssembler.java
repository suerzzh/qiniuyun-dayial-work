package com.example.unispeaking.service.ielts;

import com.example.unispeaking.service.audio.PcmAudioCapture;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * IELTS protocol adapter over the same PCM assumptions as free chat: 16 kHz,
 * signed 16-bit mono, ring buffer, pre-roll and post-roll. Logical turn end is
 * explicit; a Realtime VAD stop only closes a speech chunk.
 */
public class IeltsTurnAssembler {
    private final PcmAudioCapture capture;
    private final Map<String, BufferedTurn> buffered = new ConcurrentHashMap<>();
    private final Set<String> eventIds = ConcurrentHashMap.newKeySet();

    public IeltsTurnAssembler(int preRollMs, int postRollMs, int ringCapacityMs) {
        this.capture = new PcmAudioCapture(preRollMs, postRollMs, ringCapacityMs);
    }

    public boolean acceptEvent(String eventId) {
        return eventId == null || eventId.isBlank() || eventIds.add(eventId);
    }

    public synchronized IeltsTurn open(String turnId, int part, String questionId,
                                       String questionText, boolean longTurn, long timestampMs) {
        return open(turnId, part, questionId, questionText, longTurn, part >= 1 && part <= 3, timestampMs);
    }

    public synchronized IeltsTurn open(String turnId, int part, String questionId,
                                       String questionText, boolean longTurn, boolean scoringEligible, long timestampMs) {
        if (turnId == null || turnId.isBlank()) throw new IllegalArgumentException("turn_id is required");
        if (buffered.containsKey(turnId)) return buffered.get(turnId).turn;
        IeltsTurn turn = new IeltsTurn(turnId, part, questionId, questionText, longTurn, scoringEligible, timestampMs);
        BufferedTurn value = new BufferedTurn(turn);
        buffered.put(turnId, value);
        capture.start(turnId);
        return turn;
    }

    public synchronized void appendPcm(byte[] pcm) {
        capture.append(pcm);
        buffered.forEach((id, value) -> {
            if (value.turn.completed() && !value.turn.audioReady() && capture.isReady(id)) finishAudio(id, value);
        });
    }

    public synchronized void speechStarted(String turnId, long timestampMs) {
        require(turnId).turn.speechStarted(timestampMs);
    }

    public synchronized void speechStopped(String turnId, long timestampMs) {
        require(turnId).turn.speechStopped(timestampMs);
        // Deliberately no logical completion here, including the old 800ms VAD path.
    }

    public synchronized void transcript(String turnId, String text) {
        require(turnId).turn.setRawTranscript(text);
    }

    public synchronized void complete(String turnId, long timestampMs, String reason) {
        BufferedTurn value = require(turnId);
        value.turn.complete(timestampMs, reason);
        capture.requestFinish(turnId);
        if (capture.isReady(turnId)) finishAudio(turnId, value);
    }

    public synchronized void finishStream() {
        capture.finishAll();
        buffered.forEach((id, value) -> { if (value.turn.completed() && !value.turn.audioReady()) finishAudio(id, value); });
    }

    public IeltsTurn turn(String turnId) { return require(turnId).turn; }

    private BufferedTurn require(String turnId) {
        BufferedTurn value = buffered.get(turnId);
        if (value == null) throw new IllegalArgumentException("Unknown turn_id: " + turnId);
        return value;
    }

    private void finishAudio(String turnId, BufferedTurn value) {
        value.turn.setAudio(capture.audio(turnId));
        value.turn.setAudioReady(true);
    }

    private static final class BufferedTurn {
        private final IeltsTurn turn;
        private BufferedTurn(IeltsTurn turn) { this.turn = turn; }
    }
}
