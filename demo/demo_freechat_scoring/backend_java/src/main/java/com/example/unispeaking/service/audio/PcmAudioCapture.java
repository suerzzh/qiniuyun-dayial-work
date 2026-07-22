package com.example.unispeaking.service.audio;

import java.io.ByteArrayOutputStream;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** Shared 16 kHz / 16-bit / mono ring, pre-roll and post-roll capture. */
public class PcmAudioCapture {
    public static final int BYTES_PER_MS = 32;
    private final int preRollBytes;
    private final int postRollBytes;
    private final int ringCapacityBytes;
    private final Map<String, Capture> captures = new ConcurrentHashMap<>();
    private byte[] ring = new byte[0];
    private final Set<Capture> active = ConcurrentHashMap.newKeySet();

    public PcmAudioCapture(int preRollMs, int postRollMs, int ringCapacityMs) {
        this.preRollBytes = preRollMs * BYTES_PER_MS;
        this.postRollBytes = postRollMs * BYTES_PER_MS;
        this.ringCapacityBytes = ringCapacityMs * BYTES_PER_MS;
    }

    public synchronized void start(String turnId) {
        if (captures.containsKey(turnId)) return;
        Capture capture = new Capture();
        int pre = Math.min(preRollBytes, ring.length);
        capture.audio.write(ring, ring.length - pre, pre);
        captures.put(turnId, capture);
        active.add(capture);
    }

    public synchronized void append(byte[] pcm) {
        if (pcm == null || pcm.length == 0) return;
        for (Capture current : Set.copyOf(active)) {
            current.audio.writeBytes(pcm);
            if (current.finishRequested) {
                current.tailRemaining -= pcm.length;
                if (current.tailRemaining <= 0) {
                    current.ready = true;
                    active.remove(current);
                }
            }
        }
        int capacity = Math.min(ringCapacityBytes, ring.length + pcm.length);
        byte[] next = new byte[capacity];
        int pcmKeep = Math.min(pcm.length, capacity);
        int oldKeep = capacity - pcmKeep;
        if (oldKeep > 0) System.arraycopy(ring, ring.length - oldKeep, next, 0, oldKeep);
        System.arraycopy(pcm, pcm.length - pcmKeep, next, oldKeep, pcmKeep);
        ring = next;
    }

    public synchronized void requestFinish(String turnId) {
        Capture capture = require(turnId);
        capture.finishRequested = true;
        capture.tailRemaining = postRollBytes;
        if (postRollBytes == 0) {
            capture.ready = true;
            active.remove(capture);
        }
    }

    public synchronized void finishAll() {
        captures.values().forEach(c -> c.ready = true);
        active.clear();
    }

    public synchronized boolean isReady(String turnId) { return require(turnId).ready; }
    public synchronized byte[] audio(String turnId) { return require(turnId).audio.toByteArray(); }

    private Capture require(String turnId) {
        Capture value = captures.get(turnId);
        if (value == null) throw new IllegalArgumentException("Unknown PCM turn_id: " + turnId);
        return value;
    }

    private static final class Capture {
        private final ByteArrayOutputStream audio = new ByteArrayOutputStream();
        private boolean finishRequested;
        private boolean ready;
        private int tailRemaining;
    }
}
