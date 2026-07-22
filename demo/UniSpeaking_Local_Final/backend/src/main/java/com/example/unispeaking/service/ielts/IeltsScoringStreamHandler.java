package com.example.unispeaking.service.ielts;

import com.example.unispeaking.model.ielts.IeltsAttempt;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class IeltsScoringStreamHandler extends BinaryWebSocketHandler {
    private final IeltsAttemptRegistry registry;
    private final IeltsClientEventPolicy eventPolicy = new IeltsClientEventPolicy();
    private final ObjectMapper json = new ObjectMapper();
    private final Map<String, Context> streams = new ConcurrentHashMap<>();

    public IeltsScoringStreamHandler(IeltsAttemptRegistry registry) { this.registry = registry; }

    @Override public void afterConnectionEstablished(WebSocketSession socket) throws Exception {
        String attemptId = queryParam(socket.getUri(), "attempt_id");
        IeltsAttempt attempt = registry.get(attemptId);
        if (attempt == null) {
            socket.close(CloseStatus.POLICY_VIOLATION.withReason("IELTS attempt unavailable"));
            return;
        }
        streams.put(socket.getId(), new Context(attempt, socket));
        send(socket, Map.of("type", "stream.ready", "attempt_id", attemptId));
    }

    @Override protected void handleBinaryMessage(WebSocketSession socket, BinaryMessage message) {
        Context context = streams.get(socket.getId());
        if (context == null) return;
        ByteBuffer payload = message.getPayload();
        byte[] pcm = new byte[payload.remaining()];
        payload.get(pcm);
        context.assembler.appendPcm(pcm);
    }

    @Override protected void handleTextMessage(WebSocketSession socket, TextMessage message) {
        Context context = streams.get(socket.getId());
        if (context == null) return;
        try {
            JsonNode event = json.readTree(message.getPayload());
            String eventId = event.path("event_id").asText("");
            if (!context.assembler.acceptEvent(eventId)) return;
            String type = event.path("type").asText();
            String turnId = event.path("turn_id").asText("");
            long timestamp = event.path("timestamp_ms").asLong(System.currentTimeMillis());
            switch (type) {
                case "stream.start" -> send(socket, Map.of("type", "stream.started", "attempt_id", context.attempt.getAttemptId()));
                case "part.started" -> context.attempt.setCurrentPart(event.path("part").asText());
                case "question.asked" -> context.attempt.setCurrentQuestion(
                        event.path("question_id").asText(), event.path("question_text").asText());
                case "turn.opened", "part2.speaking_started" -> context.open(event, timestamp);
                case "turn.speech_started" -> context.assembler.speechStarted(turnId, timestamp);
                case "turn.speech_stopped" -> context.assembler.speechStopped(turnId, timestamp);
                case "turn.transcript_chunk", "turn.transcript_completed" -> {
                    if (event.path("final").asBoolean(true)) context.assembler.transcript(turnId, event.path("text").asText());
                }
                case "turn.completed", "part2.speaking_completed" -> context.complete(turnId, timestamp,
                        event.path("reason").asText("EXPLICIT_COMPLETE"));
                case "part2.preparation_started" -> context.attempt.setCurrentPart("part2");
                case "stream.end" -> context.assembler.finishStream();
                default -> send(socket, Map.of("type", "stream.warning", "message", "Unknown event: " + type));
            }
        } catch (Exception error) {
            sendQuietly(socket, Map.of("type", "stream.error", "message", "Invalid IELTS control event: " + error.getMessage()));
        }
    }

    @Override public void afterConnectionClosed(WebSocketSession socket, CloseStatus status) {
        Context context = streams.remove(socket.getId());
        if (context != null) context.assembler.finishStream();
    }

    private final class Context {
        private final IeltsAttempt attempt;
        private final WebSocketSession socket;
        private final IeltsTurnAssembler assembler = new IeltsTurnAssembler(500, 700, 5_000);
        private Context(IeltsAttempt attempt, WebSocketSession socket) { this.attempt = attempt; this.socket = socket; }
        private void open(JsonNode event, long timestamp) throws Exception {
            String turnId = event.path("turn_id").asText();
            int part = event.path("part").asInt(event.path("type").asText().startsWith("part2") ? 2 : 0);
            String questionId = event.path("question_id").asText(attempt.getQuestionId());
            String question = event.path("question_text").asText(attempt.getQuestionTextSnapshot());
            boolean longTurn = part == 2 && (event.path("turn_type").asText().equals("PART2_LONG_TURN")
                    || event.path("type").asText().equals("part2.speaking_started"));
            boolean scoringEligible = event.path("scoring_eligible").asBoolean(part >= 1 && part <= 3);
            IeltsTurn turn = assembler.open(turnId, part, questionId, question, longTurn, scoringEligible, timestamp);
            if (attempt.findTurn(turnId) == null) attempt.addTurn(turn);
            attempt.setCurrentPart(part == 0 ? "introduction" : "part" + part);
            attempt.setCurrentQuestion(questionId, question);
            send(socket, Map.of("type", "turn.accepted", "attempt_id", attempt.getAttemptId(), "turn_id", turnId));
        }
        private void complete(String turnId, long timestamp, String reason) throws Exception {
            assembler.complete(turnId, timestamp, reason);
            send(socket, eventPolicy.turnScored(attempt.getMode(), attempt.getAttemptId(), turnId, Map.of()));
        }
    }

    private String queryParam(URI uri, String name) {
        if (uri == null || uri.getRawQuery() == null) return "";
        for (String pair : uri.getRawQuery().split("&")) {
            String[] parts = pair.split("=", 2);
            if (parts.length == 2 && parts[0].equals(name)) return URLDecoder.decode(parts[1], StandardCharsets.UTF_8);
        }
        return "";
    }
    private void sendQuietly(WebSocketSession socket, Object payload) { try { send(socket, payload); } catch (Exception ignored) {} }
    private void send(WebSocketSession socket, Object payload) throws Exception {
        if (!socket.isOpen()) return;
        synchronized (socket) { socket.sendMessage(new TextMessage(json.writeValueAsString(payload))); }
    }
}
